import { expect, test } from '@playwright/test';

test('website bootstraps without extension APIs or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Filecab');
  await expect(page.getByRole('heading', { name: 'Filecab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('signing out clears account state across website tabs', async ({ page, context }) => {
  let signedIn = true;
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
      signedIn = false;

      return route.fulfill({ status: 204, headers });
    }

    return route.fulfill({
      status: signedIn ? 200 : 401,
      headers,
      json: signedIn ? { schemaVersion: 1, ownerId: 'fixture-owner' } : { code: 'UNAUTHORIZED' },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});
