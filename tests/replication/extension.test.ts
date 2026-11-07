import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { expect, test } from 'vitest';
import { createApiApplication } from '../../apps/api/src/http/application';
import { validateEnvironment } from '../../apps/api/src/config/environment';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import {
  AuthClient,
  credentialHash,
  randomCredential,
  verifierChallenge,
} from '../../apps/api/src/auth/credentials';
import { LibraryMutationService } from '../../apps/api/src/library/mutation.service';

/** Verifies the production Chrome worker and native RxDB adapter against real authenticated PostgreSQL APIs. */
test('explicit linking, offline conflict recovery and delete/Undo converge through the real API', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const prefix = `real-replication-${randomUUID()}`;
  const secret = Buffer.alloc(32, 35).toString('base64');
  const environment = validateEnvironment({
    ...process.env,
    NODE_ENV: 'test',
    WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
    EXTENSION_ORIGINS: `chrome-extension://${extensionId}`,
    GOOGLE_ENABLED: 'true',
    GOOGLE_CLIENT_ID: 'fixture-client',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/v1/auth/google/callback',
    SESSION_SECRET: secret,
    PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32, 36).toString('base64'),
    KINOPOISK_ENABLED: 'false',
    SMOTRET_ENABLED: 'false',
    SHIKIMORI_ENABLED: 'false',
  });
  const app = await createApiApplication(environment, {
    diagnostic: () => {},
    google: {
      authorizationUrl: (state) => `https://accounts.google.com/?state=${state}`,
      exchange: async () => prefix,
    },
  });
  const auth = app.get(AuthService);
  let stateHash: string | undefined;
  try {
    await app.listen(0, '127.0.0.1');
    const verifier = randomCredential();
    const attempt = randomCredential();
    const start = await auth.start(
      AuthClient.Extension,
      `https://${extensionId}.chromiumapp.org/filecab`,
      verifierChallenge(verifier),
      attempt,
    );
    const state = new URL(start.url).searchParams.get('state')!;
    stateHash = credentialHash(state, secret);
    const callback = await auth.callback(state, start.binding, 'fixture-code');
    const tokens = await auth.exchange(
      new URL(callback.returnTo).searchParams.get('code')!,
      attempt,
      verifier,
    );
    await worker.evaluate(
      async ({ tokens, origin }) => {
        const api = (
          globalThis as unknown as {
            chrome: {
              storage: {
                session: { set(value: unknown): Promise<void> };
                local: { set(value: unknown): Promise<void> };
              };
            };
          }
        ).chrome;
        await api.storage.local.set({
          'filecab.auth.refresh': { ownerId: tokens.ownerId, refreshToken: tokens.refreshToken },
        });
        await api.storage.session.set({
          'filecab.auth.access': {
            ownerId: tokens.ownerId,
            accessToken: tokens.accessToken,
            accessExpiresAt: tokens.accessExpiresAt,
          },
        });
        const originalFetch = globalThis.fetch;
        // Change only the fixture API's ephemeral port; use real HTTP, credentials,
        // guards, DTOs, transactions and database data for every request.
        globalThis.fetch = (input, init) => {
          const url = new URL(String(input));

          return originalFetch(`${origin}${url.pathname}${url.search}`, init);
        };
      },
      { tokens, origin: await app.getUrl() },
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/full-page.html`);
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Real replicated manual entry');
    await page.getByRole('button', { name: 'Save locally' }).click();
    const mutations = app.get(LibraryMutationService);
    expect((await mutations.snapshot(tokens.ownerId)).entries).toEqual([]);
    await page.getByRole('button', { name: 'Preview account link' }).click();
    await page.getByRole('button', { name: 'Confirm link and synchronize' }).click();
    await expect
      .poll(async () => (await mutations.snapshot(tokens.ownerId)).entries.length)
      .toBe(1);
    await expect
      .poll(async () => page.getByText('Account synchronization is up to date.').isVisible())
      .toBe(true);
    const entry = (await mutations.snapshot(tokens.ownerId)).entries[0];
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Comment').fill('offline rejected intent');
    await page.getByRole('button', { name: 'Save locally' }).click();
    const remote = await mutations.update(tokens.ownerId, entry.entryId, entry.serverVersion, {
      comment: 'committed on the server',
    });
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Refresh account library' }).click();
    await expect.poll(async () => page.locator('.library-sync__summary').count()).toBe(1);
    expect((await mutations.get(tokens.ownerId, entry.entryId)).comment).toBe(remote.comment);
    await page.locator('.library-sync__summary').click();
    await expect
      .poll(async () => page.locator('.library-sync__intent').textContent())
      .toContain('offline rejected intent');
    await page.getByRole('button', { name: 'Reapply this saved edit' }).click();
    await expect
      .poll(async () => (await mutations.get(tokens.ownerId, entry.entryId)).comment)
      .toBe('offline rejected intent');
    await expect
      .poll(async () => page.getByText('Account synchronization is up to date.').isVisible())
      .toBe(true);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect
      .poll(async () => (await mutations.snapshot(tokens.ownerId)).entries.length)
      .toBe(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () => (await mutations.snapshot(tokens.ownerId)).entries.length)
      .toBe(1);
    const restored = (await mutations.snapshot(tokens.ownerId)).entries[0];
    expect(restored.entryId).toBe(entry.entryId);
    expect(restored.createdAt).toBe(entry.createdAt);
    expect(restored.comment).toBe('offline rejected intent');
  } finally {
    await context.close();
    await auth.database.user.deleteMany({ where: { googleSubject: prefix } });

    if (stateHash) await auth.database.loginAttempt.deleteMany({ where: { stateHash } });

    await app.close();
  }
}, 30000);
