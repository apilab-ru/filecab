import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { expect, test } from 'vitest';
import {
  Category,
  Granularity,
  emptySnapshot,
  mergedLink,
  type CatalogRecord,
} from '../../packages/contracts/src/index';
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

/** Verifies confirmed local catalog merge convergence through native RxDB, worker credentials and real owner APIs. */
test('catalog association and the latest link converge without replacing the manual UUID', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  execFileSync(
    'pnpm',
    ['--filter', '@filecab/extension', 'exec', 'node', 'scripts/build-storage-test.mjs'],
    { stdio: 'pipe' },
  );
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const subject = `catalog-sync-${randomUUID()}`;
  const secret = Buffer.alloc(32, 61).toString('base64');
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
    PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32, 62).toString('base64'),
    KINOPOISK_ENABLED: 'false',
    SMOTRET_ENABLED: 'false',
    SHIKIMORI_ENABLED: 'false',
  });
  const app = await createApiApplication(environment, {
    diagnostic: () => {},
    google: {
      authorizationUrl: (state) => `https://accounts.google.com/?state=${state}`,
      exchange: async () => subject,
    },
  });
  const auth = app.get(AuthService);
  const catalogId = randomUUID();
  let loginHash: string | undefined;
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
    loginHash = credentialHash(state, secret);
    const callback = await auth.callback(state, start.binding, 'fixture-code');
    const tokens = await auth.exchange(
      new URL(callback.returnTo).searchParams.get('code')!,
      attempt,
      verifier,
    );
    await worker.evaluate(
      async ({ tokens, origin }) => {
        const chrome = (
          globalThis as unknown as {
            chrome: {
              storage: {
                local: { set(value: unknown): Promise<void> };
                session: { set(value: unknown): Promise<void> };
              };
            };
          }
        ).chrome;
        await chrome.storage.local.set({
          'filecab.auth.refresh': { ownerId: tokens.ownerId, refreshToken: tokens.refreshToken },
        });
        await chrome.storage.session.set({
          'filecab.auth.access': {
            ownerId: tokens.ownerId,
            accessToken: tokens.accessToken,
            accessExpiresAt: tokens.accessExpiresAt,
          },
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (input, init) => {
          const url = new URL(String(input));

          return originalFetch(`${origin}${url.pathname}${url.search}`, init);
        };
      },
      { tokens, origin: await app.getUrl() },
    );
    const catalog: CatalogRecord = {
      schemaVersion: 1,
      catalogId,
      category: Category.Films,
      granularity: Granularity.Film,
      snapshot: { ...emptySnapshot(), year: 2020 },
    };
    await auth.database.catalogItem.create({
      data: {
        id: catalogId,
        category: Category.Films,
        granularity: Granularity.Film,
        snapshot: JSON.parse(JSON.stringify(catalog.snapshot)),
      },
    });
    const mutations = app.get(LibraryMutationService);
    const manual = await mutations.create(tokens.ownerId, {
      entryId: randomUUID(),
      category: Category.Films,
      catalogId: null,
      snapshot: emptySnapshot(),
      fields: {
        userTitle: 'Manual survivor',
        comment: 'Private note',
        progress: 12,
        sourceUrls: ['https://watch.test/manual'],
      },
    });
    const donor = await mutations.create(tokens.ownerId, {
      entryId: randomUUID(),
      category: Category.Films,
      catalogId,
      snapshot: catalog.snapshot,
      fields: { userTitle: 'Catalog donor', sourceUrls: ['https://watch.test/donor'] },
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/full-page.html`);
    await page.evaluate(
      'import(location.origin + "/storage-test.js").then(module => { globalThis.catalogStorage = module; })',
    );
    const result = await page.evaluate(
      async ({ ownerId, catalog, manualId, donorId }) => {
        const module = (
          globalThis as unknown as { catalogStorage: typeof import('../e2e/fixtures/storage') }
        ).catalogStorage;
        const repository = await module.LocalLibraryRepository.open();
        const binding = {
          key: 'device' as const,
          ownerId,
          generation: 1,
          phase: 'linked' as const,
          initialCheckpoint: null,
        };
        await repository.database.binding.insert(binding);
        const replica = module.startLibraryReplication(repository.database, binding, () => {});
        try {
          await replica.awaitInitialReplication();
          await replica.awaitInSync();
          const rows = (await repository.snapshot()).rows;
          const manual = rows.find((row: { entryId: string }) => row.entryId === manualId);
          const donor = rows.find((row: { entryId: string }) => row.entryId === donorId);
          const preview = await repository.previewCatalog(
            manualId,
            manual!.localRevision,
            catalog,
            donorId,
            donor!.localRevision,
            {},
          );
          await repository.applyCatalog(preview.before, preview.proposed);
          replica.reSync();
          await replica.awaitInSync();
          const snapshot = await repository.snapshot();
          const issues = await module.readCollection(repository.database.issues);

          return { rows: snapshot.rows, issues };
        } finally {
          await replica.cancel();
          await repository.close();
        }
      },
      { ownerId: tokens.ownerId, catalog, manualId: manual.entryId, donorId: donor.entryId },
    );
    expect(result.issues).toEqual([]);
    const server = await mutations.snapshot(tokens.ownerId);
    expect(server.entries).toHaveLength(1);
    expect(server.entries[0]).toMatchObject({
      entryId: manual.entryId,
      createdAt: manual.createdAt,
      catalogId,
      comment: 'Private note',
      progress: 12,
      sources: mergedLink(manual, donor),
    });
    expect(
      result.rows.filter((row: { entry: { deleted: boolean } }) => !row.entry.deleted),
    ).toHaveLength(1);
  } finally {
    await context.close();
    await auth.database.user.deleteMany({ where: { googleSubject: subject } });
    await auth.database.catalogItem.deleteMany({ where: { id: catalogId } });

    if (loginHash) await auth.database.loginAttempt.deleteMany({ where: { stateHash: loginHash } });

    await app.close();
    await rm(join(extensionPath, 'storage-test.js'), { force: true });
  }
}, 60000);
