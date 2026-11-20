import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  Category,
  Granularity,
  emptySnapshot,
  type CatalogRecord,
} from '../../packages/contracts/src/index';

const extensionPath = resolve('apps/extension/.output/chrome-mv3');
const catalog: CatalogRecord = {
  schemaVersion: 1,
  catalogId: 'ab13b77a-a016-4fe7-a0d8-25c1119af301',
  category: Category.Films,
  granularity: Granularity.Film,
  snapshot: {
    ...emptySnapshot(),
    titles: [
      {
        text: 'Catalog title',
        language: 'en',
        provenance: { source: 'fixture', retrievedAt: '2026-11-14T00:00:00.000Z', verified: true },
      },
    ],
  },
};

/** Starts the production extension with a disposable profile and no provider or account secrets. */
async function launch(profile: string): Promise<{ context: BrowserContext; origin: string }> {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await context.route('http://127.0.0.1:3001/api/v1/catalog/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/capabilities'))
      return route.fulfill({
        json: {
          schemaVersion: 1,
          defaults: { films: 'fixture', tv: 'fixture', anime: 'fixture' },
          providers: [
            {
              provider: 'fixture',
              categories: ['films'],
              operations: ['search'],
              filters: [],
              ordering: [],
              languages: ['en', 'ru'],
              referenceNamespaces: [],
              browse: true,
            },
          ],
        },
      });

    return route.fulfill({
      json: { schemaVersion: 1, locale: 'en', page: 1, results: [catalog], hasMore: false },
    });
  });

  return { context, origin: `chrome-extension://${new URL(worker.url()).host}` };
}

test('popup search selects a single result once, saves after Save and shows the saved state', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-popup-search-'));
  const { context, origin } = await launch(profile);
  try {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 600 });
    await popup.goto(`${origin}/popup.html#/search/films`);
    await expect(popup.getByRole('combobox', { name: 'Category' })).toHaveValue('films');
    await expect(popup.getByRole('list', { name: 'Search results' })).toBeVisible();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    await popup.getByRole('searchbox', { name: 'Title' }).fill('Catalog');
    const editor = popup.getByRole('dialog', { name: 'Add title' });
    await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('Catalog title');
    await expect(editor.getByLabel('Status', { exact: true })).toHaveValue('planned');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    const result = popup.getByRole('list', { name: 'Search results' }).getByRole('button');
    await expect(result).toContainText('Catalog title');
    await popup.waitForTimeout(500);
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    expect(
      await popup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await result.click();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    await expect(result).toContainText('Planned');
    await expect(result).toContainText('0 / ?');
    await result.click();
    await expect(popup.getByRole('dialog', { name: 'Edit' })).toBeVisible();
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
    await popup.getByRole('combobox', { name: 'Category' }).selectOption('anime');
    await expect(popup).toHaveURL(/#\/search\/anime$/);
    await expect(popup.getByRole('status').filter({ hasText: 'unavailable' })).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('full-page catalog Add/Edit share durable entries and preserve offline edits after restart', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-catalog-'));
  let { context, origin } = await launch(profile);
  try {
    const full = await context.newPage();
    const popup = await context.newPage();
    const errors: string[] = [];
    full.on('pageerror', (error) => errors.push(error.message));
    popup.on('pageerror', (error) => errors.push(error.message));
    await full.goto(`${origin}/full-page.html#/catalog/films`);
    await popup.goto(`${origin}/full-page.html#/catalog/films`);
    await expect(full.locator('.library-card__title:visible')).toHaveText('Catalog title');
    await full.getByRole('button', { name: 'Add title', exact: true }).click();
    await expect(full.locator('.catalog-page .fc-rating-picker__trigger')).toHaveText('Unrated');
    await expect(full.getByRole('dialog')).toHaveCount(0);
    await full
      .locator('.catalog-page')
      .getByRole('button', { name: 'Rating', exact: true })
      .click();
    await full
      .getByRole('dialog', { name: 'Your rating', exact: true })
      .getByRole('button', { name: '8', exact: true })
      .click();
    await expect(full.locator('.catalog-page .fc-rating-picker__trigger')).toHaveText('8 / 10');
    await expect(popup.locator('.catalog-page .fc-rating-picker__trigger')).toHaveText('8 / 10');
    await full.locator('.library-card__menu-trigger:visible').click();
    await full
      .locator('.library-card:visible')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await full.getByLabel('Comment', { exact: true }).fill('First saved note');
    await full.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(full.getByRole('dialog')).toHaveCount(0);
    await expect(popup.locator('.library-card__stats:visible')).toBeVisible();
    await popup.locator('.library-card__menu-trigger:visible').click();
    await popup
      .locator('.library-card:visible')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await expect(popup.getByLabel('Comment', { exact: true })).toHaveValue('First saved note');
    await full.locator('.library-card__menu-trigger:visible').click();
    await full
      .locator('.library-card:visible')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await full.getByLabel('Comment', { exact: true }).fill('Concurrent committed note');
    await full.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(full.getByRole('dialog')).toHaveCount(0);
    await context.setOffline(true);
    await popup.getByLabel('Comment', { exact: true }).fill('Offline note');
    await popup.getByLabel('Progress', { exact: true }).fill('24');
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.getByRole('alert')).toContainText('changed in another window');
    await expect(popup.getByLabel('Comment', { exact: true })).toHaveValue('Offline note');
    await popup.getByRole('button', { name: 'Use current versions and keep my draft' }).click();
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    await expect(full.locator('.library-card__stats:visible')).toContainText('24');
    expect(errors).toEqual([]);
    await context.close();
    ({ context, origin } = await launch(profile));
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/full-page.html#/catalog/films`);
    await expect(reopened.locator('.library-card__stats:visible')).toContainText('24');
    await expect(reopened.locator('.catalog-page .fc-rating-picker__trigger')).toHaveText('8 / 10');
    await reopened.locator('.library-card__menu-trigger:visible').click();
    await reopened
      .locator('.library-card:visible')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await expect(reopened.getByLabel('Comment', { exact: true })).toHaveValue('Offline note');
    const rows = await reopened.evaluate(async () => {
      const module = await import(/* @vite-ignore */ `${location.origin}/storage-test.js`);
      const repository = await module.LocalLibraryRepository.open();
      const snapshot = await repository.snapshot();
      await repository.close();

      return snapshot.rows.filter((row: { entry: { deleted: boolean } }) => !row.entry.deleted);
    });
    expect(rows).toHaveLength(1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('a confirmed interrupted local merge recovers after browser restart and keeps the latest link', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-merge-'));
  let { context, origin } = await launch(profile);
  try {
    const full = await context.newPage();
    await full.goto(`${origin}/full-page.html#/catalog/films`);
    await expect(full.locator('.library-card__title:visible')).toHaveText('Catalog title');
    const before = await full.evaluate(async (record) => {
      const module = await import(/* @vite-ignore */ `${location.origin}/storage-test.js`);
      const repository = await module.LocalLibraryRepository.open();
      const manual = await repository.create(module.Category.Films, {
        userTitle: 'Catalog title',
        comment: 'Private manual note',
        progress: 12,
        sourceUrls: ['https://watch.test/manual'],
      });
      const donor = await repository.create(
        module.Category.Films,
        { userTitle: 'Donor title', sourceUrls: ['https://watch.test/donor'] },
        record,
      );
      const preview = await repository.previewCatalog(
        manual.entryId,
        manual.localRevision,
        record,
        donor.entryId,
        donor.localRevision,
        {},
      );
      const upsert = repository.database.entries.incrementalUpsert.bind(
        repository.database.entries,
      );
      let writes = 0;
      repository.database.entries.incrementalUpsert = async (...args: unknown[]) => {
        if (++writes === 2) throw new Error('Simulated interruption after donor commit');

        return upsert(...args);
      };
      try {
        await repository.applyCatalog(preview.before, preview.proposed);
      } catch {
        /* The committed journal must retain the survivor proposal. */
      }
      repository.database.entries.incrementalUpsert = upsert;
      await repository.close();

      return { entryId: manual.entryId, createdAt: manual.entry.createdAt };
    }, catalog);
    await context.close();
    ({ context, origin } = await launch(profile));
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/full-page.html#/catalog/films`);
    await expect(reopened.locator('.library-card__stats:visible')).toContainText('12');
    const result = await reopened.evaluate(async () => {
      const module = await import(/* @vite-ignore */ `${location.origin}/storage-test.js`);
      const repository = await module.LocalLibraryRepository.open();
      const snapshot = await repository.snapshot();
      const journals = await module.readCollection(repository.database.merges);
      await repository.close();

      return {
        active: snapshot.rows.filter((row: { entry: { deleted: boolean } }) => !row.entry.deleted),
        journals,
      };
    });
    expect(result.journals).toEqual([]);
    expect(result.active).toHaveLength(1);
    expect(result.active[0].entry).toMatchObject({
      entryId: before.entryId,
      createdAt: before.createdAt,
      catalogId: catalog.catalogId,
      comment: 'Private manual note',
      // The donor was modified last, so the merge keeps its link.
      sources: [expect.objectContaining({ originalUrl: 'https://watch.test/donor' })],
    });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
