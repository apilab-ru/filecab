import { expect, test, type BrowserContext } from '@playwright/test';
import {
  emptySnapshot,
  mergedLink,
  Category,
  CatalogMatchJobState,
  CatalogMatchOutcome,
  Granularity,
  Status,
  type CatalogMatchJob,
  type CatalogRecord,
  type Entry,
  type LibraryMutationPreview,
} from '../../packages/contracts/src/index';
import { cardAction } from './fixtures/library';
import { choose } from './fixtures/select';

const timestamp = '2026-11-14T00:00:00.000Z';
const catalogId = 'ab13b77a-a016-4fe7-a0d8-25c1119af301';
const manualId = 'ab13b77a-a016-4fe7-a0d8-25c1119af302';

/** Builds a provider-neutral result without a synthetic exact page count. */
function record(title = 'Catalog title'): CatalogRecord {
  return {
    schemaVersion: 1,
    catalogId,
    category: Category.Films,
    granularity: Granularity.Film,
    snapshot: {
      ...emptySnapshot(),
      titles: [
        {
          text: title,
          language: 'en',
          provenance: { source: 'fixture', retrievedAt: timestamp, verified: true },
        },
      ],
    },
  };
}

/** Creates realistic saved private data for identity and merge assertions. */
function saved(entryId = manualId, catalog: string | null = null): Entry {
  return {
    schemaVersion: 1,
    entryId,
    catalogId: catalog,
    category: Category.Films,
    userTitle: 'Catalog title',
    status: Status.Process,
    rating: 9,
    progress: 12,
    comment: 'Keep private notes',
    sources: [
      {
        originalUrl: `https://watch.test/${entryId}`,
        normalizedUrl: `https://watch.test/${entryId}`,
        policyVersion: 'generic-v1',
      },
    ],
    snapshot: record().snapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
    serverVersion: '1',
    deleted: false,
  };
}

/** Intercepts only the API boundary while exercising the actual shared website UI and adapters. */
async function backend(context: BrowserContext, initial: Entry[] = []) {
  const state = {
    entries: initial,
    records: null as CatalogRecord[] | null,
    ordering: ['year-desc'],
    searchOrdering: [] as string[],
    searches: [] as URL[],
    saves: 0,
    failSave: false,
    conflictOnce: false,
    reads: 0,
    lostCreateResponse: false,
    failSearch: false,
    previews: 0,
    applies: 0,
    matchJobs: [] as CatalogMatchJob[],
  };
  await context.route('http://127.0.0.1:3001/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'X-Filecab-Request,X-Filecab-Owner,Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    };
    const json = (body: unknown, status = 200) => route.fulfill({ headers, status, json: body });

    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });

    if (url.pathname.endsWith('/auth/me'))
      return json({ schemaVersion: 1, ownerId: 'website-owner' });

    if (url.pathname.endsWith('/catalog/capabilities'))
      return json({
        schemaVersion: 1,
        defaults: { films: 'fixture', tv: 'fixture', anime: 'fixture' },
        providers: [
          {
            provider: 'fixture',
            categories: ['films', 'tv', 'anime'],
            operations: ['search'],
            filters: ['year'],
            searchFilters: [],
            ordering: state.ordering,
            searchOrdering: state.searchOrdering,
            languages: ['en', 'ru'],
            referenceNamespaces: [],
            browse: true,
          },
        ],
      });

    if (url.pathname.endsWith('/catalog/search')) {
      state.searches.push(url);

      if (state.failSearch) return json({ code: 'PROVIDER_UNAVAILABLE' }, 503);

      const query = url.searchParams.get('query') ?? '';

      if (query === 'older') await new Promise((resolve) => setTimeout(resolve, 700));

      return json({
        schemaVersion: 1,
        locale: url.searchParams.get('locale'),
        page: Number(url.searchParams.get('page')),
        results: state.records ?? [record(query || 'Catalog title')],
        hasMore: url.searchParams.get('page') === '1',
      });
    }

    if (url.pathname.endsWith('/library/catalog-match'))
      return json({ schemaVersion: 1, jobs: state.matchJobs });

    if (url.pathname.endsWith('/library')) {
      state.reads += 1;

      return json({
        schemaVersion: 1,
        revision: '1',
        entries: state.entries.filter((entry) => !entry.deleted),
      });
    }

    if (url.pathname.endsWith('/library/catalog/preview')) {
      state.previews += 1;
      const input = route.request().postDataJSON();
      const current = state.entries.find((entry) => entry.entryId === input.entryId)!;
      const other = state.entries.find((entry) => entry.entryId === input.mergeEntryId);
      const proposed = {
        ...current,
        ...input.fields,
        catalogId,
        sources: other ? mergedLink(current, other) : current.sources,
      };
      const preview: LibraryMutationPreview = {
        schemaVersion: 1,
        previewToken: 'fixture-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
        changes: [
          { before: current as never, proposed },
          ...(other ? [{ before: other as never, proposed: { ...other, deleted: true } }] : []),
        ],
      };

      return json(preview);
    }

    if (url.pathname.endsWith('/library/catalog/apply')) {
      state.applies += 1;
      const input = route.request().postDataJSON();
      const current = state.entries.find((entry) => entry.entryId === input.entryId)!;
      const other = state.entries.find((entry) => entry.entryId === input.mergeEntryId);
      state.entries = state.entries
        .filter((entry) => entry.entryId !== other?.entryId)
        .map((entry) =>
          entry.entryId === current.entryId
            ? {
                ...entry,
                ...input.fields,
                catalogId,
                sources: other ? mergedLink(entry, other) : entry.sources,
                serverVersion: '2',
              }
            : entry,
        );

      return json({ schemaVersion: 1, entries: state.entries });
    }

    if (route.request().method() === 'GET' && url.pathname.includes('/library/entries/')) {
      const found = state.entries.find((entry) => entry.entryId === url.pathname.split('/').at(-1));

      return json(found ?? {}, found ? 200 : 404);
    }

    const deleting = route.request().method() === 'DELETE';
    const restoring = url.pathname.endsWith('/restore');

    if ((deleting || restoring) && url.pathname.includes('/library/entries/')) {
      const input = route.request().postDataJSON();
      const id = url.pathname.split('/').at(restoring ? -2 : -1);
      const entry = state.entries.find((item) => item.entryId === id)!;
      expect(input.expectedVersion).toBe(entry.serverVersion);
      Object.assign(entry, {
        deleted: deleting,
        serverVersion: String(Number(entry.serverVersion) + 1),
      });

      return json(entry);
    }

    if (route.request().method() === 'PATCH' && url.pathname.includes('/library/entries/')) {
      if (state.failSave) return json({ code: 'SERVICE_UNAVAILABLE' }, 503);

      const input = route.request().postDataJSON();
      const entry = state.entries.find((item) => item.entryId === url.pathname.split('/').at(-1))!;

      if (state.conflictOnce) {
        state.conflictOnce = false;
        entry.serverVersion = String(Number(entry.serverVersion) + 1);

        return json({ code: 'CONFLICT' }, 409);
      }

      expect(input.expectedVersion).toBe(entry.serverVersion);
      const { expectedVersion: _version, sourceUrls, ...fields } = input;
      Object.assign(entry, {
        ...fields,
        ...(sourceUrls?.length === 0 ? { sources: [] } : {}),
        serverVersion: String(Number(entry.serverVersion) + 1),
      });

      return json(entry);
    }

    if (url.pathname.endsWith('/library/entries')) {
      state.saves += 1;

      if (state.failSave) return json({ code: 'SERVICE_UNAVAILABLE' }, 503);

      const input = route.request().postDataJSON();
      const entry = {
        ...saved(input.entryId, input.catalogId),
        ...input,
        snapshot: record().snapshot,
        sources: [],
      };
      delete entry.sourceUrls;
      state.entries.push(entry);

      if (state.lostCreateResponse) {
        state.lostCreateResponse = false;

        return route.abort('failed');
      }

      return json(entry, 201);
    }

    return json({}, 404);
  });

  return state;
}

test('website editor keeps a conflicted draft, removes the link, deletes with Undo and restores the entry', async ({
  page,
  context,
}) => {
  const state = await backend(context, [saved()]);
  await page.goto('/library/films');
  await expect(page.locator('.library-card__title:visible')).toHaveText('Catalog title');
  const card = page.locator('.library-card:visible').first();
  await expect(card.locator('summary')).toHaveCount(0);
  const trash = card.getByRole('button', { name: 'Delete', exact: true });
  await expect(trash.locator('[data-icon="trash"]')).toBeVisible();
  await expect(trash).toHaveCSS('width', '28px');
  const cardStatus = card.getByRole('combobox', { name: 'Status', exact: true });
  const cardStatusSize = await cardStatus.evaluate((element) => {
    const { width, height } = getComputedStyle(element);

    return { width, height };
  });
  await card.locator('.library-card__artwork').click();
  const editorStatus = page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Status', exact: true });
  await expect(editorStatus).toHaveCSS('width', cardStatusSize.width);
  await expect(editorStatus).toHaveCSS('height', cardStatusSize.height);
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await expect(page.getByText('Episode total unknown')).toBeVisible();
  const editorRating = page
    .getByRole('dialog', { name: 'Edit entry', exact: true })
    .getByRole('button', { name: 'Rating', exact: true });
  await editorRating.click();
  const picker = page.getByRole('dialog', { name: 'Your rating', exact: true });
  await expect(picker.getByRole('button', { name: '9', exact: true, pressed: true })).toBeVisible();
  await picker.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(editorRating).toHaveText('Unrated');
  await expect(save).toBeEnabled();
  expect(state.entries[0].rating).toBe(9);
  await page.getByLabel('Comment', { exact: true }).fill('Changed on the website');
  state.conflictOnce = true;
  const reads = state.reads;
  await save.click();
  await expect(page.getByRole('alert')).toContainText('changed in another window');
  await expect(page.getByLabel('Comment', { exact: true })).toHaveValue('Changed on the website');
  await expect(save).toBeDisabled();
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await page.getByRole('button', { name: 'Use current versions and keep my draft' }).click();
  await save.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries[0]).toMatchObject({
    comment: 'Changed on the website',
    rating: 0,
    serverVersion: '3',
  });
  await card.getByRole('button', { name: 'Edit', exact: true }).press('Enter');
  await expect(page.getByRole('link', { name: `https://watch.test/${manualId}` })).toBeVisible();
  await page.getByRole('button', { name: 'Remove link', exact: true }).click();
  await expect(page.getByText('No link', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries[0].sources).toEqual([]);
  await cardAction(page, 'Delete');
  await expect(page.getByRole('status').filter({ hasText: 'Deleted:' })).toHaveText(
    /Deleted: Catalog title/,
  );
  await expect(page.locator('.library-card:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.library-card__title:visible')).toHaveText('Catalog title');
  expect(state.entries[0]).toMatchObject({ deleted: false, serverVersion: '6' });
});

test('entry editor pairs fields and keeps actions visible in a short viewport', async ({
  page,
  context,
}) => {
  await backend(context, [saved()]);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/library/films');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit entry', exact: true });
  const category = dialog.getByRole('combobox', { name: 'Category', exact: true });
  const status = dialog.getByRole('combobox', { name: 'Status', exact: true });
  const rating = dialog.getByRole('button', { name: 'Rating', exact: true });
  const progress = dialog.getByRole('textbox', { name: 'Progress', exact: true });
  await expect(dialog).toHaveCSS('width', '460px');
  expect((await category.boundingBox())!.x).toBeLessThan((await status.boundingBox())!.x);
  expect((await rating.boundingBox())!.x).toBeLessThan((await progress.boundingBox())!.x);

  await page.setViewportSize({ width: 360, height: 320 });
  const bounds = (await dialog.boundingBox())!;
  expect(bounds).toMatchObject({ x: 16, y: 16, width: 328, height: 288 });
  expect((await category.boundingBox())!.y).toBeLessThan((await status.boundingBox())!.y);
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  const comment = dialog.getByRole('textbox', { name: 'Comment', exact: true });
  await comment.scrollIntoViewIfNeeded();
  await expect(comment).toBeInViewport({ ratio: 1 });
  await expect(save).toBeInViewport({ ratio: 1 });
});

test('catalog debounce, late responses, errors and hasMore retain the latest search', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  await page.goto('/catalog/films');
  await expect(page.locator('.library-card__title:visible')).toHaveText('Catalog title');
  const query = page.getByRole('searchbox', { name: 'Search catalog' });
  const baseline = state.searches.length;
  await query.fill('a');
  await query.fill('ab');
  await page.waitForTimeout(100);
  expect(state.searches).toHaveLength(baseline);
  await query.fill('older');
  await expect
    .poll(() => state.searches.some((url) => url.searchParams.get('query') === 'older'))
    .toBe(true);
  await query.fill('newest');
  await expect(page.locator('.library-card__title:visible')).toHaveText('newest');
  await page.waitForTimeout(800);
  await expect(page.locator('.library-card__title:visible')).toHaveText('newest');
  await expect(page.getByRole('button', { name: 'Last page' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.catalog-page .library-browser__pagination')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('page')).toBe('2');
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  state.failSearch = true;
  await query.fill('failure');
  await expect(page.getByRole('alert')).toContainText('Catalog service failed');
  await expect(query).toHaveValue('failure');
  state.failSearch = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.library-card__title:visible')).toHaveText('failure');
});

test('selecting a result prepares an unsaved editor, changes the status and saves only after Save', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  await page.goto('/catalog/films');
  const card = page.locator('.catalog-page .library-card');
  await expect(card).toBeVisible();
  await expect(card.locator('summary')).toHaveCount(0);
  await card.locator('.library-card__artwork').click();
  const editor = page.getByRole('dialog', { name: 'Add title' });
  await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('Catalog title');
  await expect(
    editor.getByRole('combobox', { name: 'Status' }).locator('.fc-select__label'),
  ).toHaveText('Planned');
  await expect(editor.getByText('Viewing link')).toHaveCount(0);
  expect(state.saves).toBe(0);
  await editor.getByLabel('Progress', { exact: true }).fill('3');
  // The editor uses the shared status dropdown, with No status to clear the status.
  const status = editor.getByRole('combobox', { name: 'Status' });
  await status.click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
    'No status',
    'Planned✓',
    'Watching',
    'Watched',
    'Dropped',
    'Hidden',
  ]);
  await page.getByRole('listbox').getByRole('option', { name: 'Watching' }).click();
  await expect(status.locator('.fc-select__label')).toHaveText('Watching');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries).toHaveLength(1);
  expect(state.entries[0]).toMatchObject({ status: Status.Process, progress: 3, sources: [] });
});

test('direct Add retries failures and switches the retained result to personal rating controls', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  state.failSave = true;
  await page.goto('/catalog/films');
  const card = page.locator('.catalog-page .library-card');
  await card.getByRole('button', { name: 'Add title', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Save failed');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries).toHaveLength(0);
  state.failSave = false;
  await card.getByRole('button', { name: 'Add title', exact: true }).click();
  await expect(card.getByLabel('Rating', { exact: true })).toHaveText('Unrated');
  await expect(card.getByRole('button', { name: 'Add title', exact: true })).toHaveCount(0);
  await expect(card.locator('.library-card__title')).toHaveText('Catalog title');
  expect(state.entries).toHaveLength(1);
  expect(state.entries[0]).toMatchObject({ status: Status.Planned, rating: 0, progress: 0 });
  state.failSave = true;
  await card.getByLabel('Rating', { exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Your rating', exact: true });
  await picker.getByRole('button', { name: '8', exact: true }).click();
  await expect(picker.getByRole('alert')).toContainText('Save failed');
  await expect(card.getByLabel('Rating', { exact: true })).toHaveText('Unrated');
  state.failSave = false;
  await picker.getByRole('button', { name: '8', exact: true }).click();
  await expect(card.getByLabel('Rating', { exact: true })).toHaveText('8 / 10');
  expect(state.entries[0].rating).toBe(8);
  expect(state.entries).toHaveLength(1);
});

test('a saved catalog result can be deleted and restored in place', async ({ page, context }) => {
  const state = await backend(context);
  await page.goto('/catalog/films');
  const card = page.locator('.catalog-page .library-card');
  const trash = card.getByRole('button', { name: 'Delete', exact: true });
  const add = card.getByRole('button', { name: 'Add title', exact: true });
  await expect(trash).toHaveCount(0);
  await add.click();
  await expect(trash.locator('[data-icon="trash"]')).toBeVisible();
  const entryId = state.entries[0].entryId;
  await trash.click();
  await expect(add).toBeVisible();
  await expect(trash).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries[0].deleted).toBe(true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(trash).toBeVisible();
  await expect(add).toHaveCount(0);
  expect(state.entries[0]).toMatchObject({ entryId, deleted: false });
  await trash.click();
  await add.click();
  await expect(trash).toBeVisible();
  const active = state.entries.filter((entry) => !entry.deleted);
  expect(active).toHaveLength(1);
  expect(active[0].entryId).not.toBe(entryId);
});

test('manual-to-saved catalog merge requires preview, keeps the manual UUID and the latest link', async ({
  page,
  context,
}) => {
  const manual = { ...saved(), snapshot: emptySnapshot() };
  const donor = {
    ...saved('ab13b77a-a016-4fe7-a0d8-25c1119af303', catalogId),
    userTitle: 'Other title',
    comment: 'Other note',
    updatedAt: '2026-11-15T00:00:00.000Z',
  };
  const state = await backend(context, [manual, donor]);
  await page.goto('/library/films');
  const manualCard = page.locator('.library-card:visible').filter({ hasText: manual.userTitle });
  await manualCard.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Find catalog title' }).click();
  await page.getByRole('button', { name: 'Associate this title' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Association preview' });
  await expect(preview).toBeVisible();
  await expect(preview.getByText(donor.sources[0]!.originalUrl).first()).toBeVisible();
  expect(state.applies).toBe(0);
  await page.getByRole('button', { name: 'Confirm association' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.entries).toHaveLength(1);
  expect(state.entries[0]).toMatchObject({
    entryId: manual.entryId,
    createdAt: manual.createdAt,
    comment: manual.comment,
    progress: 12,
    rating: 9,
    catalogId,
    sources: donor.sources,
  });
});

test('a catalog data item opens a dialog that links the entry through the editor', async ({
  page,
  context,
}) => {
  const manual = { ...saved(), userTitle: 'Двойник', snapshot: emptySnapshot() };
  const state = await backend(context, [manual]);
  state.matchJobs = [
    {
      jobId: 'job-1',
      provider: 'kinopoisk',
      state: CatalogMatchJobState.Succeeded,
      progress: { done: 1, total: 1 },
      counts: { [CatalogMatchOutcome.Ambiguous]: 1 },
      items: [
        { entryId: manual.entryId, title: 'Двойник', outcome: CatalogMatchOutcome.Ambiguous },
      ],
      pause: null,
      resumeAt: null,
      createdAt: timestamp,
      finishedAt: timestamp,
    },
  ];
  await page.goto('/settings');
  const item = page.getByRole('button', { name: /^Двойник: several catalog titles match/ });
  await item.click();
  const dialog = page.getByRole('dialog', { name: 'Link a catalog title' });
  const header = dialog.locator('.fc-dialog__header');
  const search = header.getByRole('searchbox');
  const deleteEntry = header.getByRole('button', { name: 'Delete library entry' });
  await expect(deleteEntry).toHaveCSS('width', '32px');
  await expect(deleteEntry).toHaveCSS('height', '32px');
  // The dialog searches the catalog for the entry title.
  await expect(search).toHaveValue('Двойник');
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('query')).toBe('Двойник');
  await header.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await search.fill('Двойник');
  await expect(dialog.getByRole('button', { name: 'Link', exact: true })).toBeVisible();
  const grid = dialog.locator('.title-results--grid');
  await expect(grid).toHaveCSS('grid-template-columns', /^(\d+(\.\d+)?px ){3}\d+(\.\d+)?px$/);
  await header.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
  await item.click();
  // The header stays with the dialog when the search stacks on a narrow screen.
  await page.setViewportSize({ width: 390, height: 480 });
  const [title, input] = await Promise.all([
    header.getByRole('heading').boundingBox(),
    search.boundingBox(),
  ]);
  expect(title!.y + title!.height).toBeLessThan(input!.y);
  await expect.poll(() => dialog.evaluate((node) => node.scrollHeight - node.clientHeight)).toBe(0);
  await expect(grid).toHaveCSS('grid-template-columns', /^\d+(\.\d+)?px$/);
  await dialog.getByRole('button', { name: 'Link', exact: true }).click();
  // The shared editor replaces the dialog. Save links at once, without a preview step.
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Association preview' })).toHaveCount(0);
  expect(state.applies).toBe(1);
  expect(state.entries[0]).toMatchObject({ entryId: manual.entryId, catalogId });
  // A linked entry leaves the list.
  await expect(item).toHaveCount(0);
});

test('the catalog data dialog deletes the title with Undo', async ({ page, context }) => {
  const manual = { ...saved(), userTitle: 'Мусор', snapshot: emptySnapshot() };
  const state = await backend(context, [manual]);
  state.matchJobs = [
    {
      jobId: 'job-1',
      provider: 'kinopoisk',
      state: CatalogMatchJobState.Succeeded,
      progress: { done: 1, total: 1 },
      counts: { [CatalogMatchOutcome.NotFound]: 1 },
      items: [{ entryId: manual.entryId, title: 'Мусор', outcome: CatalogMatchOutcome.NotFound }],
      pause: null,
      resumeAt: null,
      createdAt: timestamp,
      finishedAt: timestamp,
    },
  ];
  await page.goto('/settings');
  const item = page.getByRole('button', { name: /^Мусор: not found in the catalog/ });
  await item.click();
  const dialog = page.getByRole('dialog', { name: 'Link a catalog title' });
  await dialog
    .locator('.fc-dialog__header')
    .getByRole('button', { name: 'Delete library entry' })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.entries[0]!.deleted).toBe(true);
  await expect(item).toHaveCount(0);
  // Undo restores the entry, and the item can be resolved again.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(item).toBeVisible();
  expect(state.entries[0]!.deleted).toBe(false);
});

test('a lost create response and duplicate submit do not create duplicate entries', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  await page.goto('/catalog/films');
  state.lostCreateResponse = true;
  await page
    .getByRole('button', { name: 'Add title', exact: true })
    .evaluate<void, void, HTMLButtonElement>((button) => {
      button.click();
      button.click();
    });
  await expect(page.locator('.catalog-page .fc-rating-picker__trigger')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.saves).toBe(1);
  expect(state.entries).toHaveLength(1);
  await expect(page.locator('.catalog-page .progress-control__row')).toBeVisible();
});

test('search omits removed controls and ignores their saved URL parameters', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  await page.goto(
    '/catalog/films?provider=obsolete&season=winter&myAnimeListId=12&providerRating=9',
  );
  await expect(page.locator('.library-card__title:visible')).toHaveText('Catalog title');
  for (const label of ['Provider', 'Release season', 'MyAnimeList ID', 'Provider rating']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  const request = state.searches.at(-1)!;
  expect(request.searchParams.has('provider')).toBe(false);
  expect(request.searchParams.has('filters')).toBe(false);
  await expect(page.locator('.catalog-page .library-browser__search-input')).toBeVisible();
});

test('library and catalog share card geometry and category view controls', async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1660, height: 950 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const entries = Array.from({ length: 8 }, (_, index) => ({
    ...saved(`entry-${index}`, `catalog-${index}`),
    userTitle: [
      'Frieren: Beyond Journey’s End',
      'Delicious in Dungeon',
      'Jujutsu Kaisen',
      'Violet Evergarden',
      'Spy x Family',
      'A Silent Voice',
      'Steins;Gate',
      'Mob Psycho 100',
    ][index],
    snapshot: { ...record().snapshot, year: 2023, episodeCount: 28 },
  }));
  const state = await backend(context, entries);
  state.records = entries.map((entry) => ({
    ...record(),
    catalogId: entry.catalogId!,
    snapshot: entry.snapshot,
  }));
  await page.goto('/library/films');
  await expect(page.locator('.library-card:visible')).toHaveCount(8);
  const libraryCard = await page.locator('.library-card:visible').first().boundingBox();
  const libraryPoster = await page.locator('.library-card__artwork:visible').first().boundingBox();
  expect(libraryCard!.width).toBeCloseTo(326, 0);
  expect(Math.abs(libraryCard!.height - 327)).toBeLessThan(2);
  expect(Math.abs(libraryPoster!.height - 208)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('library-cards.png') });
  await page.goto('/catalog/films');
  await expect(page.locator('.library-card:visible')).toHaveCount(8);
  const catalogCard = await page.locator('.library-card:visible').first().boundingBox();
  const catalogPoster = await page.locator('.library-card__artwork:visible').first().boundingBox();
  expect(catalogCard!.width).toBeCloseTo(libraryCard!.width, 0);
  expect(catalogCard!.height).toBeGreaterThanOrEqual(libraryCard!.height);
  expect(catalogPoster!.height).toBe(libraryPoster!.height);
  const firstCard = page.locator('.library-card:visible').first();
  const year = await firstCard.locator('.library-card__year').boundingBox();
  const rating = await firstCard.locator('.library-card__rating').boundingBox();
  const progress = firstCard.locator('.progress-control__row');
  const progressBox = await progress.boundingBox();
  await expect(progress).toContainText('/ 28');
  expect(Math.abs(year!.y - rating!.y)).toBeLessThan(4);
  expect(rating!.x).toBeGreaterThan(year!.x);
  expect(progressBox!.y).toBeGreaterThan(year!.y + year!.height);
  await expect(page.locator('.progress-control__count:visible').first()).toHaveValue('12');
  // A click on the progress bar sets the episode at the click position and saves it.
  const track = page.locator('.progress-control__track:visible').first();
  const trackBox = await track.boundingBox();
  await track.click({ position: { x: trackBox!.width * 0.75, y: trackBox!.height / 2 } });
  await expect(page.locator('.progress-control__count:visible').first()).toHaveValue('21');
  await expect.poll(() => state.entries.find((entry) => entry.progress === 21)).toBeTruthy();
  // The card status uses the shared status dropdown and saves at once.
  await choose(page, 'Status', 'Dropped', firstCard);
  await expect(
    firstCard.getByRole('combobox', { name: 'Status' }).locator('.fc-select__label'),
  ).toHaveText('Dropped');
  await expect.poll(() => state.entries.some((entry) => entry.status === Status.Drop)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catalog-cards.png') });
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.title-results:visible')).toHaveClass(/title-results--list/);
  const listCard = await page.locator('.library-card:visible').first().boundingBox();
  expect(listCard!.width).toBeGreaterThan(catalogCard!.width * 2);
  await firstCard.locator('.library-card__year').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('catalog shows a bottom Add button, hides unknown years and averages provider scores', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  const provenance = { source: 'fixture', retrievedAt: timestamp, verified: true };
  const result = record();
  result.snapshot.providerRatings = [
    { value: 80, scale: 100, provenance },
    { value: 6, scale: 10, provenance },
    { value: 0, scale: 10, provenance },
  ];
  state.records = [result];
  await page.goto('/catalog/films');
  const card = page.locator('.catalog-page .library-card');
  await expect(card.getByTitle('Approximate provider rating')).toHaveText('≈ 7 / 10');
  await expect(card.locator('.library-card__year')).toHaveCount(0);
  await expect(card.locator('.library-card__primary-action')).toHaveText('Add title');
  await expect(card.locator('.progress-control')).toHaveCount(0);
  await card.getByRole('button', { name: 'Add title', exact: true }).click();
  await expect(card.getByLabel('Rating', { exact: true })).toHaveText('Unrated');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.saves).toBe(1);
});

test('library list headers sort all rows and stay in sync with pagination controls', async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1660, height: 950 });
  await page.emulateMedia({ colorScheme: 'light' });
  const entries = ['Zulu', 'Alpha', 'Bravo'].map((title, index) => ({
    ...saved(`entry-${index}`, `catalog-${index}`),
    userTitle: title,
    snapshot: { ...record().snapshot, year: 2024 - index, episodeCount: 24 },
  }));
  await backend(context, entries);
  await page.goto('/library/films?view=list');
  const region = page.getByRole('region', { name: 'Library', exact: true });
  const header = region.locator('.title-collection__header');
  await header.getByRole('button', { name: 'Title', exact: true }).click();
  await expect(region.locator('.library-card__title')).toHaveText(['Alpha', 'Bravo', 'Zulu']);
  await expect(region.getByRole('combobox', { name: 'Sort by', exact: true })).toContainText(
    'Title',
  );
  await expect(region.getByRole('combobox', { name: 'Order', exact: true })).toContainText('A–Z');
  await header.getByRole('button', { name: 'Title', exact: true }).click();
  await expect(region.locator('.library-card__title')).toHaveText(['Zulu', 'Bravo', 'Alpha']);
  await expect(region.getByRole('combobox', { name: 'Order', exact: true })).toContainText('Z–A');
  await header.getByRole('button', { name: 'Year', exact: true }).click();
  await expect(region.locator('.library-card__title')).toHaveText(['Bravo', 'Alpha', 'Zulu']);
  const row = region.locator('.library-card').first();
  const poster = await row
    .locator('.library-card__poster, .library-card__placeholder')
    .boundingBox();
  const box = await row.boundingBox();
  expect(poster!.height).toBe(40);
  expect(box!.height).toBeLessThanOrEqual(55);
  await page.screenshot({ path: testInfo.outputPath('library-list-light.png') });
});

test('catalog list headers expose only supported directions and update the provider order', async ({
  page,
  context,
}, testInfo) => {
  const state = await backend(context);
  state.ordering = ['title-asc', 'title-desc', 'year-desc'];
  await page.goto('/catalog/films?view=list');
  const header = page.locator('.catalog-page .title-collection__header');
  await expect(header.getByRole('button', { name: 'Rating', exact: true })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);
  await expect(
    header.locator('.title-collection__column--year .title-collection__arrows'),
  ).toHaveText('▾');
  await header.getByRole('button', { name: 'Title', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('title-asc');
  await expect(
    page.locator('.catalog-page').getByRole('combobox', { name: 'Order', exact: true }),
  ).toContainText('A–Z');
  await header.getByRole('button', { name: 'Title', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('title-desc');
  await header.getByRole('button', { name: 'Year', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('year-desc');
  await page.screenshot({ path: testInfo.outputPath('catalog-list.png') });
  await page.getByRole('searchbox', { name: 'Search catalog', exact: true }).fill('new query');
  await expect(header.getByRole('button')).toHaveCount(0);
  await expect(header.getByText('Title', { exact: true })).toBeVisible();
});

test('library rating popup selects, highlights, clears and restores focus in grid and list mode', async ({
  page,
  context,
}, testInfo) => {
  const state = await backend(context, [saved(manualId, catalogId)]);
  await page.setViewportSize({ width: 1660, height: 950 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/library/films');
  const card = page.locator('.library-card:visible');
  const trigger = card.getByRole('button', { name: 'Rating', exact: true });
  await expect(trigger).toHaveText('9 / 10');
  await trigger.focus();
  await trigger.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Your rating', exact: true });
  await expect(picker.getByRole('button', { name: '9', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(picker.locator('.fc-rating-picker__score')).toHaveCount(10);
  await expect(card).toHaveCSS('outline-style', 'solid');
  await picker.getByRole('button', { name: '8', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(trigger).toHaveText('8 / 10');
  await expect(trigger).toBeFocused();
  expect(state.entries[0].rating).toBe(8);
  await trigger.click();
  await expect(picker.getByRole('button', { name: '8', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const popupBox = await picker.boundingBox();
  const titleBox = await card.locator('.library-card__title').boundingBox();
  expect(popupBox!.y + popupBox!.height).toBeLessThanOrEqual(titleBox!.y);
  await page.screenshot({ path: testInfo.outputPath('library-rating-picker-light.png') });
  await picker.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(trigger).toHaveText('Unrated');
  expect(state.entries[0].rating).toBe(0);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('.full-page__brand').click();
  await expect(picker).toHaveCount(0);
  expect(state.entries[0].rating).toBe(0);
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await trigger.click();
  await picker.getByRole('button', { name: '7', exact: true }).click();
  await expect(trigger).toHaveText('7 / 10');
  expect(state.entries[0].rating).toBe(7);
});

test('card details cover the grid card and keep list controls available', async ({
  page,
  context,
}) => {
  const entry = saved(manualId, catalogId);
  entry.snapshot.year = 2024;
  entry.snapshot.episodeCount = 24;
  await backend(context, [entry]);
  await page.goto('/library/films');
  const card = page.locator('.library-card:visible');
  const toggle = card.getByRole('button', { name: 'Details' });
  const details = card.locator('.title-details');
  const rating = card.getByRole('button', { name: 'Rating', exact: true });
  await expect(card).toBeVisible();
  await expect(toggle).toHaveCSS('width', '28px');
  const cardBox = await card.boundingBox();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(details).toContainText('Catalog title');
  await expect(details).toContainText('2024');
  await expect(details).toContainText('24');
  await expect(details).toContainText('Keep private notes');
  await expect(details.getByRole('link')).toHaveAttribute('href', entry.sources[0].originalUrl);
  await expect(rating).toBeHidden();
  expect(await card.boundingBox()).toEqual(cardBox);
  expect((await details.boundingBox())!.height).toBeCloseTo(cardBox!.height - 2, 0);

  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(rating).toBeVisible();

  await toggle.click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(details).toBeHidden();
  await expect(rating).toBeVisible();
});

test('short details fit on a compact card with wrapped genres', async ({ page, context }) => {
  const entry = saved();
  entry.userTitle = 'Dragon Ball Z: Wrath of the Dragon';
  entry.comment = '';
  entry.sources = [];
  entry.snapshot.year = 1995;
  entry.snapshot.episodeCount = 1;
  entry.snapshot.genres = [
    'Приключения',
    'Комедия',
    'Фантастика',
    'Сёнен',
    'Фэнтези',
    'Боевики и Приключения',
  ].map((text, index) => ({
    genreId: `genre-${index}`,
    key: `genre-${index}`,
    labels: [{ ...entry.snapshot.titles[0]!, text }],
  }));
  await backend(context, [entry]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/library/films');
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  const details = page.locator('.title-details');
  await expect(details).toContainText('No description');
  const overflow = await details.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(overflow).toBe(0);
});

test('expanded library details cover bright and dark posters and fall back for missing or failed posters', async ({
  page,
  context,
}, testInfo) => {
  const posterHost = 'https://posters.test';
  const posters = [
    { title: 'Bright poster', url: `${posterHost}/bright.svg`, color: '#fff' },
    { title: 'Dark poster', url: `${posterHost}/dark.svg`, color: '#121923' },
    { title: 'Missing poster', url: null, color: null },
    { title: 'Failed poster', url: `${posterHost}/failed.svg`, color: null },
  ];
  for (const { url, color } of posters) {
    if (!url) continue;

    await context.route(url, (route) =>
      color
        ? route.fulfill({
            contentType: 'image/svg+xml',
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="${color}"/></svg>`,
          })
        : route.fulfill({ status: 404 }),
    );
  }

  await backend(
    context,
    posters.map(({ title, url }, index) => {
      const entry = saved(`poster-${index}`);
      entry.userTitle = title;
      entry.snapshot.posterUrl = url;
      entry.snapshot.descriptions = [
        {
          ...entry.snapshot.titles[0]!,
          text: 'A synopsis with enough text to scroll. '.repeat(50),
        },
      ];

      return entry;
    }),
  );
  await page.setViewportSize({ width: 1660, height: 950 });
  await page.goto('/library/films');
  const cards = page.locator('.library-card:visible');
  await expect(cards).toHaveCount(posters.length);
  const boxes = await Promise.all(posters.map((_, index) => cards.nth(index).boundingBox()));
  for (const { title, color } of posters) {
    const card = cards.filter({ hasText: title });
    const image = card.locator('.library-card__poster');
    const details = card.locator('.title-details');
    const toggle = card.getByRole('button', { name: 'Details' });

    if (color) {
      await expect(image).toHaveJSProperty('naturalWidth', 400);
    } else {
      await expect(card.locator('.library-card__placeholder')).toBeVisible();
    }

    await toggle.click();
    await expect(details).toHaveCSS('background-color', 'rgba(11, 18, 32, 0.82)');
    await expect(details.locator('.title-details__text')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(details).toHaveCSS('opacity', '1');
    await expect(card).toHaveCSS('background-color', 'rgb(11, 18, 32)');
    await expect(card).toHaveCSS('overflow', 'hidden');

    if (color) {
      await expect(image).toHaveCSS('object-fit', 'cover');
      expect(await image.boundingBox()).toEqual(await details.boundingBox());
    } else {
      await expect(image).toHaveCount(0);
    }

    const buttonBox = (await toggle.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(buttonBox).toMatchObject({ width: 28, height: 28 });
    expect(cardBox.x + cardBox.width - buttonBox.x - buttonBox.width).toBeCloseTo(
      cardBox.y + cardBox.height - buttonBox.y - buttonBox.height,
    );
    await details.evaluate((element) => {
      element.scrollTop = 120;
    });
    await expect(details).toHaveJSProperty('scrollTop', 120);
    expect(await toggle.boundingBox()).toEqual(buttonBox);
    await details.evaluate((element) => {
      element.scrollTop = 0;
    });
  }

  expect(await Promise.all(posters.map((_, index) => cards.nth(index).boundingBox()))).toEqual(
    boxes,
  );
  await page.screenshot({ path: testInfo.outputPath('expanded-library-posters.png') });
  for (const card of await cards.all()) {
    await card.getByRole('button', { name: 'Details' }).click();
  }

  await expect(page.locator('.title-details')).toHaveCount(0);
  expect(await Promise.all(posters.map((_, index) => cards.nth(index).boundingBox()))).toEqual(
    boxes,
  );
});

test('unsaved catalog cards match the mockup size and covers scale on narrow screens', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  const result = record();
  result.snapshot.year = 2023;
  result.snapshot.posterUrl = 'https://posters.test/portrait.svg';
  state.records = [result];
  await context.route('https://posters.test/portrait.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#7297dd"/><rect y="200" width="400" height="200" fill="#3253ab"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 1662, height: 946 });
  await page.goto('/catalog/films');
  const card = page.locator('.catalog-page .library-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  await expect(card.locator('.library-card__poster')).toHaveJSProperty('naturalWidth', 400);
  const image = await card.locator('.library-card__poster').boundingBox();
  const cover = await card.locator('.library-card__artwork').boundingBox();
  expect(image!.height).toBeCloseTo(cover!.height, 0);
  expect(image!.width).toBeCloseTo(cover!.width, 0);
  expect(box!.width).toBeCloseTo(326, 0);
  expect(Math.abs(box!.height - 327)).toBeLessThan(2);
  expect(cover!.width / cover!.height).toBeCloseTo(25 / 16, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  const narrowCard = await card.boundingBox();
  const narrowCover = await card.locator('.library-card__artwork').boundingBox();
  expect(narrowCard!.width).toBeLessThan(box!.width);
  expect(narrowCover!.width / narrowCover!.height).toBeCloseTo(25 / 16, 2);
});

test('catalog separates sort field and supported direction and can restore provider order', async ({
  page,
  context,
}) => {
  const state = await backend(context);
  state.ordering = ['year-asc', 'year-desc', 'rating-desc'];
  await page.goto('/catalog/films');
  const catalog = page.locator('.catalog-page');
  const sort = catalog.getByRole('combobox', { name: 'Sort by', exact: true });
  const direction = catalog.getByRole('combobox', { name: 'Order', exact: true });
  await expect(direction).toBeDisabled();
  await sort.click();
  await page.getByRole('option', { name: 'Year', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('year-asc');
  await direction.click();
  await page.getByRole('option', { name: 'Newest first', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('year-desc');
  await sort.click();
  await page.getByRole('option', { name: 'Provider rating', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.get('order')).toBe('rating-desc');
  await direction.click();
  await expect(page.getByRole('option', { name: 'Lowest first', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Highest first', exact: true }).click();
  await sort.click();
  await page.getByRole('option', { name: 'Default', exact: true }).click();
  await expect.poll(() => state.searches.at(-1)?.searchParams.has('order')).toBe(false);
  await expect(direction).toBeDisabled();
});

test('catalog loading skeletons match grid and list layouts and keep pagination visible', async ({
  page,
  context,
}) => {
  await backend(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1312, height: 610 });
  for (const view of ['grid', 'list']) {
    await page.goto(`/catalog/films?q=older&view=${view}`);

    if (view === 'list') await page.reload();

    const skeletons = page.locator('.catalog-skeleton');
    await expect(skeletons).toHaveCount(12);
    await expect(skeletons.first()).toHaveCSS('animation-name', 'none');
    const pagination = page.locator('.catalog-page .library-browser__pagination');
    await expect(pagination).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
    await expect(page.locator('.catalog-page .library-card')).toHaveCount(0);
    await expect(page.locator('.catalog-page .library-card__title')).toHaveText('older');
    await expect(skeletons).toHaveCount(0);
    const toolbar = (await page.locator('.catalog-page .library-browser__toolbar').boundingBox())!;
    const results = (await page.locator('.catalog-page .title-results-region').boundingBox())!;
    const footer = (await pagination.boundingBox())!;
    expect(results.y - (toolbar.y + toolbar.height)).toBeCloseTo(8);
    expect(footer.y - (results.y + results.height)).toBeCloseTo(8);
    await expect(pagination).toHaveCSS('padding-top', '0px');
  }
});
