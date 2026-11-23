import { expect, test } from '@playwright/test';
import { choose } from './fixtures/select';
import { Category, Status, emptySnapshot } from '../../packages/contracts/src/index';

test('website bootstraps without extension APIs or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Filecab');
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/settings');
  await expect(second.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('language/theme preferences propagate across tabs, persist, and retain URL filters', async ({
  page,
  context,
}) => {
  await page.goto('/library/anime?query=keep-me');
  await page.reload();
  expect(new URL(page.url()).searchParams.get('query')).toBe('keep-me');
  const second = await context.newPage();
  await second.goto('/settings');
  await choose(page, 'Language', 'Русский');
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
  await page.getByRole('button', { name: 'Библиотека', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Аниме', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.setViewportSize({ width: 400, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/unknown/route');
  await expect(page).toHaveURL(/\/library\/anime$/);
  expect(new URL(page.url()).hash).toBe('');
});

test('first visit chooses a supported browser locale', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('combobox', { name: 'Язык', exact: true })).toContainText(
      'Русский',
    );
  } finally {
    await context.close();
  }
});

test('mockup library renders actual snapshot cards, filters, pagination and poster failure fallback', async ({
  page,
  context,
}) => {
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
    // Later entries were added later. Earlier entries were changed later.
    createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    updatedAt: `2026-11-${String(20 - index).padStart(2, '0')}T00:00:00.000Z`,
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
  await expect(page.locator('.library-browser__pagination')).toContainText('1–8 of 14');
  await expect(page.locator('.library-card')).toHaveCount(8);
  await expect(page.locator('.library-card__placeholder')).toHaveCount(8);
  // LIB-05: the default order is the added date, newest first. Entry 15 is hidden.
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toContainText(
    'Date added',
  );
  await expect(page.locator('.library-card__title').first()).toHaveText('Saved title 14');
  await choose(page, 'Sort by', 'Recently updated');
  await expect(page.locator('.library-card__title').first()).toHaveText('Saved title 1');
  await choose(page, 'Sort by', 'Date added');
  await expect(page.locator('.library-card__title').first()).toHaveText('Saved title 14');
  await expect(page.locator('.full-page__mark')).toHaveJSProperty('naturalWidth', 567);
  expect(
    await page
      .locator('.title-results')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(4);
  await page.screenshot({ path: 'test-results/mockup-library-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(6);
  await page.getByRole('searchbox', { name: 'Search your library' }).fill('private note');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card__title')).toHaveText('Saved title 14');
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.title-results')).toHaveClass(/title-results--list/);
  await page.getByRole('searchbox', { name: 'Search your library' }).fill('');
  const toolbar = page.locator('.library-browser__toolbar');
  await choose(page, 'Status', 'Hidden', toolbar);
  await expect(page.locator('.library-card__title')).toHaveText('Saved title 15');
  await choose(page, 'Status', 'Status', toolbar);
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
  await expect(page.getByRole('searchbox', { name: 'Search your library' })).toBeDisabled();
  available = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.library-browser__pagination')).toContainText('0 of 0');
  await expect(page.getByText('Your library is empty.', { exact: false })).toBeVisible();
});

test('a public library page is read-only and hides Catalog; Settings saves the username', async ({
  page,
  context,
}) => {
  const headers = {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'X-Filecab-Request,X-Filecab-Owner,Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  };
  const publicEntry = (title: string, category: Category) => ({
    category,
    userTitle: title,
    status: Status.Process,
    rating: 8,
    progress: 2,
    snapshot: { ...emptySnapshot(), episodeCount: 12 },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  });
  let username: string | null = null;
  let signedIn = false;
  let usernameReads = 0;
  await context.route('http://127.0.0.1:3001/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    if (path === '/api/v1/public/libraries/anna')
      return route.fulfill({
        headers,
        json: {
          schemaVersion: 1,
          username: 'anna',
          entries: [
            publicEntry('Public anime', Category.Anime),
            publicEntry('Public film', Category.Films),
          ],
        },
      });

    if (path.startsWith('/api/v1/public/libraries/'))
      return route.fulfill({ status: 404, headers, json: { code: 'NOT_FOUND' } });

    if (path === '/api/v1/account/username' && request.method() === 'PUT') {
      const next = (request.postDataJSON() as { username: string }).username;

      if (next === 'taken')
        return route.fulfill({ status: 409, headers, json: { code: 'CONFLICT' } });

      username = next || null;
    }

    if (path === '/api/v1/account/username') {
      if (request.method() === 'GET') usernameReads++;

      return route.fulfill({ headers, json: { schemaVersion: 1, username } });
    }

    if (path === '/api/v1/library')
      return route.fulfill({ status: 503, headers, json: { code: 'SERVICE_UNAVAILABLE' } });

    return route.fulfill({
      status: signedIn ? 200 : 401,
      headers,
      json: signedIn ? { schemaVersion: 1, ownerId: 'public-owner' } : { code: 'UNAUTHORIZED' },
    });
  });

  await page.goto('/u/anna');
  const header = page.getByRole('navigation', { name: 'Categories' });
  const heading = header.getByRole('heading', { name: 'anna’s library', level: 1 });
  await expect(heading).toBeVisible();
  const [title, anime] = await Promise.all([
    heading.boundingBox(),
    header.getByRole('button', { name: 'Anime', exact: true }).boundingBox(),
  ]);
  expect(title!.x + title!.width).toBeLessThan(anime!.x);
  await expect(page.getByText('Public anime')).toBeVisible();
  await expect(page.getByText('Public film')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Catalog', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const card = page.locator('.library-card');
  await expect(card.getByRole('combobox')).toHaveCount(0);
  await expect(card.getByRole('spinbutton')).toHaveCount(0);
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.locator('.library-card__progress-text')).toHaveText('Progress: 2 / 12');
  await page.getByRole('button', { name: 'Films', exact: true }).click();
  await expect(page).toHaveURL(/\/u\/anna\/films$/);
  await expect(heading).toBeVisible();
  await expect(page.getByText('Public film')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileTitle, mobileAnime] = await Promise.all([
    heading.boundingBox(),
    header.getByRole('button', { name: 'Anime', exact: true }).boundingBox(),
  ]);
  expect(mobileTitle!.y + mobileTitle!.height).toBeLessThan(mobileAnime!.y);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto('/u/nobody');
  await expect(
    page.getByText('This public library does not exist or is not public.'),
  ).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Public library' })).toHaveCount(0);
  expect(usernameReads).toBe(0);

  signedIn = true;
  await page.reload();
  const field = page.getByRole('textbox', { name: 'Username' });
  await field.fill('taken');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Another account uses this username.', { exact: false }),
  ).toBeVisible();
  await expect(field).toHaveValue('taken');
  await field.fill('anna');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('link', { name: 'http://127.0.0.1:5173/u/anna' })).toBeVisible();
  await field.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Public access is off.')).toBeVisible();
});
