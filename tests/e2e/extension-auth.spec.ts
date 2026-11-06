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
    await expect(page.getByRole('status')).toContainText('EXTENSION_ORIGINS');
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
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('fixture-refresh-credential');
    await expect(page.locator('body')).not.toContainText('fixture-access-credential');
  } finally {
    await context.close();
  }
});
