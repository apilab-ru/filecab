import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('shared website controls disable pending actions, report failures and recover with sign-out-all', async ({
  page,
  context,
}) => {
  let signedIn = true;
  let failLogout = true;
  let releaseLogout!: () => void;
  const pendingLogout = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await context.route('http://127.0.0.1:3001/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'X-Filecab-Request,Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };

    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    if (path.endsWith('/logout')) {
      await pendingLogout;

      return route.fulfill({ status: failLogout ? 503 : 204, headers });
    }

    if (path.endsWith('/logout-all')) {
      failLogout = false;
      signedIn = false;

      return route.fulfill({ status: 204, headers });
    }

    return route.fulfill({
      status: signedIn ? 200 : 401,
      headers,
      json: signedIn ? { schemaVersion: 1, ownerId: 'fixture-owner' } : { code: 'UNAUTHORIZED' },
    });
  });
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sign out all sessions' })).toBeDisabled();
  releaseLogout();
  await expect(page.locator('.auth-controls__failure').getByRole('status')).toHaveText(
    'Account service unavailable. Please retry.',
  );
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeEnabled();
  await page.getByLabel('Language', { exact: true }).selectOption('ru');
  await expect(page.locator('.auth-controls__failure').getByRole('status')).toHaveText(
    'Сервис аккаунтов недоступен. Повторите попытку.',
  );
  await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
  await expect(page.getByRole('button', { name: 'Войти через Google' })).toBeVisible();
  await expect(page.locator('.auth-controls__failure')).toHaveCount(0);
});

test('shared extension controls retain worker login diagnostics and react to account changes', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            googleEnabled: true,
            extensionAllowed: false,
          }),
        );
    });
    const page = await context.newPage();
    await page.goto(`${origin}/popup.html?debug=1#/settings`);
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.locator('.auth-controls__failure').getByRole('status')).toContainText(
      'EXTENSION_ORIGINS',
    );
    await expect(page.locator('.auth-controls__diagnostic')).toContainText('Stage: configuration');
    await page.getByText('Connection details', { exact: true }).click();
    await expect(page.getByText(new URL(worker.url()).host, { exact: true })).toBeVisible();
    await worker.evaluate(() => {
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
    const fullPage = await context.newPage();
    await fullPage.goto(`${origin}/full-page.html#/settings`);
    await expect(fullPage.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(fullPage.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.locator('.auth-controls__failure')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('fixture-access-credential');
    await expect(page.locator('body')).not.toContainText('fixture-refresh-credential');
    await fullPage.getByRole('button', { name: 'Sign out all sessions' }).click();
    await expect(fullPage.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  } finally {
    await context.close();
  }
});
