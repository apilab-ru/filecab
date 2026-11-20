import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  Category,
  Granularity,
  emptySnapshot,
  type CatalogRecord,
  type PageExtraction,
} from '../../packages/contracts/src/index';

const extensionPath = resolve('apps/extension/.output/chrome-mv3');
const pageUrl = 'https://www.kinopoisk.ru/film/301/';
const record: CatalogRecord = {
  schemaVersion: 1,
  catalogId: 'ab13b77a-a016-4fe7-a0d8-25c1119af399',
  category: Category.Films,
  granularity: Granularity.Film,
  snapshot: {
    ...emptySnapshot(),
    titles: [
      {
        text: 'The Matrix',
        language: 'en',
        provenance: { source: 'fixture', retrievedAt: '2026-11-20T00:00:00.000Z', verified: true },
      },
    ],
    references: [
      {
        namespace: 'kinopoisk',
        entity: 'title',
        id: '301',
        granularity: Granularity.Film,
        provenance: { source: 'fixture', retrievedAt: '2026-11-20T00:00:00.000Z', verified: true },
      },
    ],
  },
};
const extraction: PageExtraction = {
  url: pageUrl,
  title: 'Матрица',
  category: Category.Films,
  references: [{ namespace: 'kinopoisk', entity: 'title', id: '301' }],
  ruleId: 'kinopoisk',
  searchOnly: false,
};

/** Starts the production extension with fixture catalog answers and no provider secrets. */
async function launch(profile: string): Promise<{ context: BrowserContext; origin: string }> {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await context.route('http://127.0.0.1:3001/api/v1/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/catalog/capabilities'))
      return route.fulfill({
        json: {
          schemaVersion: 1,
          defaults: { films: 'fixture', tv: 'fixture', anime: 'fixture' },
          providers: [
            {
              provider: 'fixture',
              categories: ['films'],
              operations: ['search', 'resolve-reference'],
              filters: [],
              ordering: [],
              languages: ['en', 'ru'],
              referenceNamespaces: ['kinopoisk'],
            },
          ],
        },
      });

    if (url.pathname.endsWith('/catalog/providers/kinopoisk/title/301'))
      return route.fulfill({ json: record });

    if (url.pathname.endsWith('/catalog/search'))
      return route.fulfill({
        json: { schemaVersion: 1, locale: 'en', page: 1, results: [], hasMore: false },
      });

    // Page rules and every other route are offline, so the bundled rules apply.
    return route.abort('failed');
  });

  return { context, origin: `chrome-extension://${new URL(worker.url()).host}` };
}

/**
 * Opens the popup with a stubbed active tab. A test cannot grant `activeTab`, so the stub
 * replaces only the two browser calls. The page rule fixtures test the engine itself.
 */
async function popup(
  context: BrowserContext,
  origin: string,
  tabUrl: string,
  result: PageExtraction | null,
): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 380, height: 600 });
  await page.addInitScript(
    ({ url, value }) => {
      const scope = globalThis as unknown as Record<string, Record<string, object> | undefined>;

      // Chrome exposes the same APIs as `chrome` and `browser`. WXT uses either one.
      for (const api of [scope.chrome, scope.browser]) {
        if (!api) continue;

        Object.defineProperty(api.tabs, 'query', { value: async () => [{ id: 7, url }] });
        Object.defineProperty(api, 'scripting', {
          configurable: true,
          value: {
            executeScript: async () => {
              if (!value) throw new Error('Cannot access contents of the page');

              return [{ result: value }];
            },
          },
        });
      }
    },
    { url: tabUrl, value: result },
  );
  await page.goto(`${origin}/popup.html#/page/anime`);

  return page;
}

/** Reads the active device entries through the production storage bundle. */
async function entries(page: Page) {
  return page.evaluate(async () => {
    const module = await import(/* @vite-ignore */ `${location.origin}/storage-test.js`);
    const repository = await module.LocalLibraryRepository.open();
    const snapshot = await repository.snapshot();
    await repository.close();

    return snapshot.rows
      .filter((row: { entry: { deleted: boolean } }) => !row.entry.deleted)
      .map((row: { entry: { userTitle: string; sources: { originalUrl: string }[] } }) => ({
        title: row.entry.userTitle,
        link: row.entry.sources[0]?.originalUrl ?? null,
      }));
  });
}

test('the Page tab opens the referenced record, saves the page link, moves it on a card click and shares the title with Search', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-page-'));
  const { context, origin } = await launch(profile);
  try {
    const first = await popup(context, origin, pageUrl, extraction);
    const editor = first.getByRole('dialog', { name: 'Add title' });
    await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('The Matrix');
    await expect(
      editor.getByRole('combobox', { name: 'Status' }).locator('.fc-select__label'),
    ).toHaveText('Planned');
    await expect(editor.getByText('Viewing link')).toHaveCount(0);
    await expect(editor.getByText(pageUrl)).toHaveCount(0);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(first.getByRole('dialog')).toHaveCount(0);
    expect(await entries(first)).toEqual([{ title: 'The Matrix', link: pageUrl }]);
    await first.close();

    // A saved entry does not open by itself. A click on its linked card opens the editor.
    const second = await popup(context, origin, pageUrl, extraction);
    const linkedCard = second
      .getByRole('list', { name: 'Search results' })
      .getByRole('listitem')
      .filter({ hasText: 'The Matrix' });
    await expect(
      linkedCard.getByRole('img', { name: 'This page is linked to this entry' }),
    ).toBeVisible();
    await expect(second.getByRole('dialog')).toHaveCount(0);

    // A Chrome popup is only as tall as its content. The status menu must stay inside it.
    await second.setViewportSize({ width: 380, height: 330 });
    const status = linkedCard.getByRole('combobox', { name: 'Status' });
    // The status keeps one width when it opens and when its value changes.
    const width = (await status.boundingBox())!.width;
    await status.click();
    expect((await status.boundingBox())!.width).toBe(width);
    // An open status list does not lock the page scroll, so the scrollbar cannot shift the layout.
    expect(await second.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe(
      'hidden',
    );
    const options = second.getByRole('option');
    await expect(options).toHaveCount(5);
    for (const option of await options.all()) {
      const box = await option.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(330);
    }
    await second.getByRole('option', { name: 'Watching' }).click();
    await expect(status.locator('.fc-select__label')).toHaveText('Watching');
    expect((await status.boundingBox())!.width).toBe(width);
    await second.setViewportSize({ width: 380, height: 600 });
    await linkedCard.getByRole('button', { name: 'The Matrix' }).click();
    await expect(second.getByRole('dialog', { name: 'Edit' })).toBeVisible();
    await second.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Saving the page to another entry moves the link and names the entry that loses it.
    await second.getByRole('button', { name: 'Add manual entry', exact: true }).click();
    const manual = second.getByRole('dialog', { name: 'Add title' });
    await expect(manual.getByLabel('Title', { exact: true })).toHaveValue('Матрица');
    await expect(manual.getByRole('status')).toHaveText(
      'Save moves the page link from “The Matrix” to this entry.',
    );
    await manual.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(second.getByRole('dialog')).toHaveCount(0);
    expect(await entries(second)).toEqual(
      expect.arrayContaining([
        { title: 'The Matrix', link: null },
        { title: 'Матрица', link: pageUrl },
      ]),
    );
    await second.close();

    // The reference names "The Matrix", but "Матрица" holds the link. A click on the
    // "The Matrix" card moves the link to it and ends the conflict.
    const third = await popup(context, origin, pageUrl, extraction);
    await expect(third.getByRole('alert')).toContainText('Choose the entry to edit.');
    const cards = third.getByRole('list', { name: 'Search results' }).getByRole('listitem');
    const matrix = cards.filter({ hasText: 'The Matrix' });
    await expect(
      matrix.getByRole('img', { name: 'This page is linked to this entry' }),
    ).toHaveCount(0);
    await matrix.getByRole('button', { name: 'The Matrix' }).click();
    await expect(
      matrix.getByRole('img', { name: 'This page is linked to this entry' }),
    ).toBeVisible();
    await expect(third.getByRole('dialog')).toHaveCount(0);
    await expect(third.getByText('Choose the entry to edit.', { exact: false })).toHaveCount(0);
    await expect(third.getByText('No catalog titles found.')).toHaveCount(0);
    expect(await entries(third)).toEqual(
      expect.arrayContaining([
        { title: 'The Matrix', link: pageUrl },
        { title: 'Матрица', link: null },
      ]),
    );

    // Page and Search share the title text and the category.
    await third.getByRole('textbox', { name: 'Title' }).fill('Matrix Reloaded');
    await third.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(third).toHaveURL(/#\/search\/films\?q=Matrix\+Reloaded$/);
    await expect(third.getByRole('searchbox', { name: 'Title' })).toHaveValue('Matrix Reloaded');
    await third.getByRole('searchbox', { name: 'Title' }).fill('Matrix Revolutions');
    await third.getByRole('button', { name: 'Page', exact: true }).click();
    await expect(third.getByRole('dialog')).toHaveCount(0);
    await expect(third.getByRole('textbox', { name: 'Title' })).toHaveValue('Matrix Revolutions');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('a restricted tab offers retry and manual entry after a category choice', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-page-restricted-'));
  const { context, origin } = await launch(profile);
  try {
    const page = await popup(context, origin, 'chrome://extensions/', null);
    await expect(page.getByRole('alert')).toContainText('This page cannot be read.');
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    const add = page.getByRole('button', { name: 'Add manual entry', exact: true });
    await expect(add).toBeDisabled();
    await page.getByRole('textbox', { name: 'Title' }).fill('Мой фильм');
    await expect(add).toBeDisabled();
    await page.getByRole('button', { name: 'TV series', exact: true }).click();
    await add.click();
    const editor = page.getByRole('dialog', { name: 'Add title' });
    await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('Мой фильм');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await entries(page)).toEqual([{ title: 'Мой фильм', link: null }]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
