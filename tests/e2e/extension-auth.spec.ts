import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { cardAction } from './fixtures/library';

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
    await page.goto(`chrome-extension://${extensionId}/popup.html?debug=1#/settings`);
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

        if (path.endsWith('/list-sync'))
          return new Response(JSON.stringify({ schemaVersion: 1, providers: [] }));

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

        if (path.endsWith('/account/username'))
          return new Response(JSON.stringify({ schemaVersion: 1, username: null }));

        return new Response(JSON.stringify({ schemaVersion: 1, ownerId: 'fixture-owner' }));
      };
    });
    await page.goto(`chrome-extension://${extensionId}/full-page.html#/library/anime`);
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Guest remains local');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/full-page.html#/settings`);
    await settings.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(settings.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
    await cardAction(page, 'Edit');
    await page.getByLabel('Comment').fill('Unsaved while signing out');
    await expect(page.locator('body')).not.toContainText('fixture-refresh-credential');
    await expect(page.locator('body')).not.toContainText('fixture-access-credential');
    await settings.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByLabel('Comment')).toHaveValue('Unsaved while signing out');
    await page.keyboard.press('Escape');
    await expect(page.locator('.local-library__entry-title')).toHaveText('Guest remains local');
  } finally {
    await context.close();
  }
});

test('link confirmation starts replication and a later sign-in replaces the device library', async () => {
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
        usernameReads: [] as string[],
        usernameReadFailed: false,
      };
      const other = {
        revision: 1,
        pushes: 0,
        entries: new Map<string, Record<string, unknown>>(),
        changes: [] as Record<string, unknown>[],
        downloadBlocked: true,
      };
      Object.assign(globalThis, { syncFixture: server });
      Object.assign(globalThis, { otherSyncFixture: other });
      globalThis.fetch = async (input, init) => {
        const path = new URL(String(input)).pathname;
        const headers = init?.headers as Record<string, string>;
        const different = headers?.Authorization?.includes('different-account');
        const library = different ? other : server;

        if (path.endsWith('/list-sync'))
          return new Response(JSON.stringify({ schemaVersion: 1, providers: [] }));

        if (path.endsWith('/auth/me'))
          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              ownerId: headers.Authorization.includes('different-account')
                ? '10000000-0000-4000-8000-000000000005'
                : ownerId,
            }),
          );

        if (path.endsWith('/account/username')) {
          const token = headers.Authorization;
          server.usernameReads.push(token);

          if (!server.usernameReadFailed) {
            server.usernameReadFailed = true;

            return new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }), {
              status: 503,
              headers: { 'X-Correlation-ID': '10000000-0000-4000-8000-000000000008' },
            });
          }

          const username = token.includes('different-account')
            ? 'different-library'
            : 'bound-library';

          return new Response(JSON.stringify({ schemaVersion: 1, username }));
        }

        if (path.endsWith('/library')) {
          if (different && other.downloadBlocked)
            return new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }), { status: 503 });

          if (different && !other.entries.size) {
            const entry = {
              ...server.entries.values().next().value,
              entryId: '10000000-0000-4000-8000-000000000006',
              userTitle: 'Downloaded second library',
              serverVersion: '1',
            };
            other.entries.set(entry.entryId, entry);
            other.changes.push(entry);
          }

          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              revision: String(library.revision),
              entries: [...library.entries.values()],
            }),
          );
        }

        if (path.endsWith('/pull')) {
          const body = JSON.parse(String(init?.body)) as {
            checkpoint: { cursor: string } | null;
            limit: number;
          };
          const changes = library.changes
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
          library.pushes++;

          const body = JSON.parse(String(init?.body)) as {
            rows: Array<{
              assumedMaster: Record<string, unknown> | null;
              proposed: Record<string, unknown>;
            }>;
          };
          for (const row of body.rows) {
            if (different && server.entries.has(String(row.proposed.entryId)))
              server.wrongOwnerWrites++;

            if (different) {
              const current = other.entries.get(String(row.proposed.entryId));

              if (current && current.serverVersion !== row.assumedMaster?.serverVersion)
                return new Response(
                  JSON.stringify({
                    schemaVersion: 1,
                    conflicts: [
                      {
                        entryId: current.entryId,
                        reason: 'version',
                        serverDocument: current,
                      },
                    ],
                  }),
                );
            }

            const entry: Record<string, unknown> = {
              ...row.proposed,
              serverVersion: String(++library.revision),
            };
            library.entries.set(String(entry.entryId), entry);
            library.changes.push(entry);
          }

          return new Response(JSON.stringify({ schemaVersion: 1, conflicts: [] }));
        }

        return new Response(JSON.stringify({ schemaVersion: 1 }));
      };
    }, ownerId);
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    const page = await context.newPage();
    await page.goto(`${origin}/full-page.html#/library/anime`);
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Production linked entry');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Preview account link' }).click();
    const usernameError = page
      .getByRole('alert')
      .filter({ hasText: 'The username could not be read.' });
    await expect(usernameError).toContainText('SERVICE_UNAVAILABLE · HTTP 503');
    await expect(usernameError).toContainText('10000000-0000-4000-8000-000000000008');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('bound-library');
    await expect(usernameError).toHaveCount(0);
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
    await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('bound-library');
    await worker.evaluate(() => {
      const previous = globalThis.fetch;
      Object.assign(globalThis, { settingsRefreshPulls: 0 });
      globalThis.fetch = async (input, init) => {
        if (new URL(String(input)).pathname.endsWith('/pull'))
          (globalThis as unknown as { settingsRefreshPulls: number }).settingsRefreshPulls++;

        return previous(input, init);
      };
    });
    await expect(page.getByText('Last successful sync:', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await expect
      .poll(() =>
        worker.evaluate(
          () => (globalThis as unknown as { settingsRefreshPulls: number }).settingsRefreshPulls,
        ),
      )
      .toBeGreaterThan(0);
    await page
      .getByRole('group', { name: 'Appearance' })
      .getByRole('button', { name: 'Dark', exact: true })
      .click();
    await page.screenshot({
      path: 'test-results/settings-extension-linked-dark.png',
      fullPage: true,
    });
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
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
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
    await popup.goto(`${origin}/full-page.html#/library/anime`);
    await expect(popup.locator('.local-library__entry-title')).toHaveText(
      'Production linked entry',
    );
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await cardAction(page, 'Edit');
    await page.getByLabel('Comment').fill('Unsaved draft through account switch');
    await popup.goto(`${origin}/full-page.html#/settings`);
    await expect(popup.getByRole('textbox', { name: 'Username' })).toHaveValue('bound-library');
    const usernameReads = () =>
      worker.evaluate(
        () =>
          (globalThis as unknown as { syncFixture: { usernameReads: string[] } }).syncFixture
            .usernameReads,
      );
    const readsBeforeSignOut = await usernameReads();
    await popup.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(popup.getByText('Synchronization paused:', { exact: false })).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'Public library' })).toHaveCount(0);
    await popup.reload();
    await expect(popup.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
    await expect(popup.getByRole('heading', { name: 'Public library' })).toHaveCount(0);
    expect(await usernameReads()).toEqual(readsBeforeSignOut);
    await popup.getByRole('button', { name: 'Library', exact: true }).click();
    await popup.getByRole('button', { name: 'Add manual entry' }).click();
    await popup.getByLabel('Title', { exact: true }).fill('Previous account pending entry');
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.getByText('Previous account pending entry', { exact: true })).toBeVisible();
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
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
    await expect(popup.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(popup.getByRole('textbox', { name: 'Username' })).toHaveValue('different-library');
    expect((await usernameReads()).slice(readsBeforeSignOut.length)).toEqual([
      'Bearer different-account',
    ]);
    await expect(page.getByLabel('Comment')).toHaveValue('Unsaved draft through account switch');
    const retryDownload = popup.getByRole('button', { name: 'Retry account download' });
    await expect(retryDownload).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Sync now', exact: true })).toBeDisabled();
    await expect(page.locator('.local-library__entry-title')).toHaveCount(2);
    await worker.evaluate(() => {
      const other = (globalThis as unknown as { otherSyncFixture: { downloadBlocked: boolean } })
        .otherSyncFixture;
      other.downloadBlocked = false;
    });
    await retryDownload.click();
    await expect(popup.getByRole('button', { name: 'Sync now', exact: true })).toBeEnabled();
    await expect(popup.getByText('Account synchronization is up to date.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.local-library__entry-title')).toHaveText(
      'Downloaded second library',
    );
    const otherPushes = () =>
      worker.evaluate(
        () =>
          (globalThis as unknown as { otherSyncFixture: { pushes: number } }).otherSyncFixture
            .pushes,
      );
    expect(await otherPushes()).toBe(0);
    await cardAction(page, 'Edit');
    await page.getByLabel('Title', { exact: true }).fill('Updated second library');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(otherPushes).toBe(1);
    await expect
      .poll(() =>
        worker.evaluate(
          () =>
            (
              globalThis as unknown as {
                otherSyncFixture: { entries: Map<string, { userTitle: string }> };
              }
            ).otherSyncFixture.entries
              .values()
              .next().value?.userTitle,
        ),
      )
      .toBe('Updated second library');
    await expect(popup.getByRole('button', { name: 'Preview account link' })).toHaveCount(0);
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
