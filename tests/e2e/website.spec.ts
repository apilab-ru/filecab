import { expect, test } from '@playwright/test';

test('website bootstraps without extension APIs or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Filecab');
  await expect(page.getByRole('heading', { name: 'My library' })).toBeVisible();
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
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/#/settings');
  await expect(second.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('language/theme preferences propagate across tabs, persist, and retain URL filters', async ({
  page,
  context,
}) => {
  await page.goto('/?query=keep-me#/library/anime');
  const second = await context.newPage();
  await second.goto('/#/settings');
  await page.getByLabel('Language', { exact: true }).selectOption('ru');
  await expect(page.getByRole('button', { name: 'Библиотека', exact: true })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Оформление', exact: true })).toBeVisible();
  await expect(second.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page
    .getByRole('group', { name: 'Оформление' })
    .getByRole('button', { name: 'Тёмное', exact: true })
    .click();
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(second.getByRole('button', { name: 'Тёмное', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Тёмное', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(new URL(page.url()).searchParams.get('query')).toBe('keep-me');
  await page.getByRole('button', { name: 'Библиотека', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Аниме', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.setViewportSize({ width: 400, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/#/unknown/route');
  await expect(page).toHaveURL(/#\/library\/anime$/);
});

test('first visit chooses a supported browser locale', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByLabel('Язык')).toHaveValue('ru');
  } finally {
    await context.close();
  }
});

test('mockup library renders actual snapshot cards, filters, pagination and poster failure fallback', async ({
  page,
  context,
}) => {
  const { emptySnapshot, Category, Status } = await import('../../packages/contracts/src');
  const entries = Array.from({ length: 15 }, (_, index) => ({
    schemaVersion: 1,
    entryId: `fixture-${index}`,
    catalogId: null,
    category: Category.Anime,
    userTitle: `Saved title ${index + 1}`,
    status: index === 14 ? Status.Hide : Status.Process,
    progress: index,
    rating: index % 11,
    comment: index === 13 ? 'find this private note' : '',
    sources: [],
    snapshot: {
      ...emptySnapshot(),
      year: 2024,
      episodeCount: 24,
      posterUrl: index === 0 ? 'https://posters.test/missing.png' : null,
    },
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    serverVersion: '1',
    deleted: false,
  }));
  await context.route('https://posters.test/**', (route) => route.fulfill({ status: 404 }));
  let snapshotReads = 0;
  await context.route('http://127.0.0.1:3001/api/v1/**', async (route) => {
    if (route.request().url().endsWith('/library')) snapshotReads++;

    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Credentials': 'true',
    };
    const data = route.request().url().endsWith('/library')
      ? { schemaVersion: 1, revision: '1', entries }
      : { schemaVersion: 1, ownerId: 'mockup-owner' };
    await route.fulfill({ headers, json: data });
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.library-browser__total')).toHaveText('14 titles');
  await expect(page.locator('.library-card')).toHaveCount(12);
  await expect(page.locator('.library-card__placeholder')).toHaveCount(12);
  await expect(page.locator('.full-page__mark')).toHaveJSProperty('naturalWidth', 567);
  expect(
    await page
      .locator('.library-browser__entries')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(4);
  await page.screenshot({ path: 'test-results/mockup-library-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search your library' }).fill('private note');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card__title')).toHaveText('Saved title 14');
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.library-browser__entries')).toHaveClass(/--list/);
  await page.getByRole('textbox', { name: 'Search your library' }).fill('');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption(Status.Hide);
  await expect(page.locator('.library-card__title')).toHaveText('Saved title 15');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Grid view', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeEnabled();
  const previousReads = snapshotReads;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect.poll(() => snapshotReads).toBeGreaterThan(previousReads);
  await expect(page.getByText('Last library refresh:', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-website-light.png', fullPage: true });

  await page
    .getByRole('group', { name: 'Appearance' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await page.screenshot({ path: 'test-results/settings-website-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.screenshot({ path: 'test-results/mockup-library-dark.png', fullPage: true });
});

test('website snapshot errors remain distinct from an empty library and can be retried', async ({
  page,
  context,
}) => {
  let available = false;
  await context.route('http://127.0.0.1:3001/api/v1/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (route.request().url().endsWith('/library')) {
      await route.fulfill({
        status: available ? 200 : 503,
        headers,
        json: { schemaVersion: 1, revision: '0', entries: [] },
      });

      return;
    }

    await route.fulfill({ headers, json: { schemaVersion: 1, ownerId: 'retry-owner' } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Your library could not be loaded');
  await expect(page.getByText('Your library is empty.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search your library' })).toBeDisabled();
  available = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.library-browser__total')).toHaveText('0 titles');
  await expect(page.getByText('Your library is empty.', { exact: false })).toBeVisible();
});
