import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('extension worker reports preflight failures and completes a mocked login through real Chrome messaging', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: false }),
        );
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html?debug=1`);
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.locator('.auth-controls').getByRole('status')).toContainText(
      'EXTENSION_ORIGINS',
    );
    await expect(page.getByText('Stage: configuration', { exact: false })).toBeVisible();
    await page.getByText('Connection details', { exact: true }).click();
    await expect(page.getByText(extensionId, { exact: true })).toBeVisible();
    await worker.evaluate(() => {
      // Only external I/O is mocked; messaging, browser storage and UI use the real extension.
      const api = (
        globalThis as unknown as {
          chrome: {
            identity: {
              getRedirectURL(path: string): string;
              launchWebAuthFlow(input: { url: string }): Promise<string>;
            };
          };
        }
      ).chrome;
      api.identity.launchWebAuthFlow = async ({ url }) => {
        const start = new URL(url);

        return `${api.identity.getRedirectURL('filecab')}?${new URLSearchParams({ attempt: start.searchParams.get('attempt')!, code: 'fixture-one-use-code' })}`;
      };
      globalThis.fetch = async (input) => {
        const path = new URL(String(input)).pathname;

        if (path.endsWith('/extension/config'))
          return new Response(
            JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: true }),
          );

        if (path.endsWith('/exchange'))
          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              ownerId: 'fixture-owner',
              accessToken: 'fixture-access-credential',
              refreshToken: 'fixture-refresh-credential',
              accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
              sessionExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
            }),
          );

        return new Response(JSON.stringify({ schemaVersion: 1, ownerId: 'fixture-owner' }));
      };
    });
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Guest remains local');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.locator('.local-library__scope')).toHaveText('Library on this device');
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Comment').fill('Unsaved while signing out');
    await expect(page.locator('body')).not.toContainText('fixture-refresh-credential');
    await expect(page.locator('body')).not.toContainText('fixture-access-credential');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.locator('.local-library__scope')).toHaveText('Library on this device');
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
    await expect(page.getByLabel('Comment')).toHaveValue('Unsaved while signing out');
  } finally {
    await context.close();
  }
});

test('link confirmation starts production replication and account changes suspend it without losing drafts', async () => {
  test.setTimeout(30000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const ownerId = '10000000-0000-4000-8000-000000000004';
    await worker.evaluate(async (ownerId) => {
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
      await api.storage.session.set({
        'filecab.auth.access': {
          ownerId,
          accessToken: 'bound-account-token',
          accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      });
      await api.storage.local.set({
        'filecab.auth.refresh': { ownerId, refreshToken: 'bound-refresh-token' },
      });
      const server = {
        revision: 0,
        pushes: 0,
        entries: new Map<string, Record<string, unknown>>(),
        changes: [] as Record<string, unknown>[],
        wrongOwnerWrites: 0,
      };
      Object.assign(globalThis, { syncFixture: server });
      globalThis.fetch = async (input, init) => {
        const path = new URL(String(input)).pathname;
        const headers = init?.headers as Record<string, string>;

        if (path.endsWith('/auth/me'))
          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              ownerId: headers.Authorization.includes('different-account')
                ? '10000000-0000-4000-8000-000000000005'
                : ownerId,
            }),
          );

        if (path.endsWith('/library'))
          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              revision: String(server.revision),
              entries: [...server.entries.values()],
            }),
          );

        if (path.endsWith('/pull')) {
          const body = JSON.parse(String(init?.body)) as {
            checkpoint: { cursor: string } | null;
            limit: number;
          };
          const changes = server.changes
            .filter((entry) => Number(entry.serverVersion) > Number(body.checkpoint?.cursor ?? 0))
            .slice(0, body.limit);

          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              documents: [...new Map(changes.map((entry) => [entry.entryId, entry])).values()],
              checkpoint: {
                cursor: String(changes.at(-1)?.serverVersion ?? body.checkpoint?.cursor ?? 0),
                entryId: changes.at(-1)?.entryId ?? null,
              },
              hasMore: false,
            }),
          );
        }

        if (path.endsWith('/push')) {
          server.pushes++;

          if (headers.Authorization.includes('different-account')) server.wrongOwnerWrites++;

          const body = JSON.parse(String(init?.body)) as {
            rows: Array<{ proposed: Record<string, unknown> }>;
          };
          for (const row of body.rows) {
            const entry: Record<string, unknown> = {
              ...row.proposed,
              serverVersion: String(++server.revision),
            };
            server.entries.set(String(entry.entryId), entry);
            server.changes.push(entry);
          }

          return new Response(JSON.stringify({ schemaVersion: 1, conflicts: [] }));
        }

        return new Response(JSON.stringify({ schemaVersion: 1 }));
      };
    }, ownerId);
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    const page = await context.newPage();
    await page.goto(`${origin}/full-page.html`);
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Production linked entry');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await page.getByRole('button', { name: 'Preview account link' }).click();
    await expect(page.getByText('Confirming authorizes uploading', { exact: false })).toBeVisible();
    expect(
      await worker.evaluate(
        () => (globalThis as unknown as { syncFixture: { pushes: number } }).syncFixture.pushes,
      ),
    ).toBe(0);
    await page.getByRole('button', { name: 'Cancel link' }).click();
    await page.getByRole('button', { name: 'Preview account link' }).click();
    await page.getByRole('button', { name: 'Confirm link and synchronize' }).click();
    await expect
      .poll(() =>
        worker.evaluate(
          () => (globalThis as unknown as { syncFixture: { pushes: number } }).syncFixture.pushes,
        ),
      )
      .toBeGreaterThan(0);
    await expect(page.getByText('Account synchronization is up to date.')).toBeVisible();
    await worker.evaluate(() => {
      const previous = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        if (new URL(String(input)).pathname.endsWith('/pull'))
          return new Response('private upstream rejection', {
            status: 403,
            headers: { 'X-Correlation-ID': '10000000-0000-4000-8000-000000000007' },
          });

        return previous(input, init);
      };
      Object.assign(globalThis, {
        restoreSyncFetch: () => {
          globalThis.fetch = previous;
        },
      });
    });
    await page.getByRole('button', { name: 'Refresh account library' }).click();
    await expect(page.getByText('The API denied synchronization.', { exact: false })).toBeVisible();
    await expect(page.getByText('Code: FORBIDDEN', { exact: false })).toContainText('HTTP 403');
    await expect(page.getByText('Code: FORBIDDEN', { exact: false })).toContainText(
      '10000000-0000-4000-8000-000000000007',
    );
    await expect(page.locator('body')).not.toContainText('private upstream rejection');
    await worker.evaluate(() =>
      (globalThis as unknown as { restoreSyncFetch(): void }).restoreSyncFetch(),
    );
    const popup = await context.newPage();
    await popup.goto(`${origin}/popup.html`);
    await expect(popup.locator('.local-library__entry-title')).toHaveText(
      'Production linked entry',
    );
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Comment').fill('Unsaved draft through account switch');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByText('Synchronization paused:', { exact: false })).toBeVisible();
    await worker.evaluate(async () => {
      const api = (
        globalThis as unknown as {
          chrome: {
            storage: {
              session: { set(value: unknown): Promise<void> };
              local: { set(value: unknown): Promise<void> };
            };
            runtime: { sendMessage(value: unknown): Promise<unknown> };
          };
        }
      ).chrome;
      const ownerId = '10000000-0000-4000-8000-000000000005';
      await api.storage.session.set({
        'filecab.auth.access': {
          ownerId,
          accessToken: 'different-account',
          accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      });
      await api.storage.local.set({
        'filecab.auth.refresh': { ownerId, refreshToken: 'different-refresh' },
      });
      await api.runtime.sendMessage({ action: 'auth.changed' });
    });
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.getByLabel('Comment')).toHaveValue('Unsaved draft through account switch');
    await expect(page.getByText('Synchronization paused:', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview account link' })).toHaveCount(0);
    const blocked = await page.evaluate(async (ownerId) => {
      const api = (
        globalThis as unknown as {
          chrome: { runtime: { sendMessage(value: unknown): Promise<unknown> } };
        }
      ).chrome;

      return api.runtime.sendMessage({
        action: 'sync.request',
        ownerId,
        operation: 'push',
        body: { schemaVersion: 1, rows: [] },
      });
    }, ownerId);
    expect(blocked).toEqual({ error: 'ACCOUNT_CHANGED' });
    expect(
      await worker.evaluate(
        () =>
          (globalThis as unknown as { syncFixture: { wrongOwnerWrites: number } }).syncFixture
            .wrongOwnerWrites,
      ),
    ).toBe(0);
  } finally {
    await context.close();
  }
});
