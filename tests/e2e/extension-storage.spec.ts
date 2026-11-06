import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const extensionPath = resolve('apps/extension/.output/chrome-mv3');

test.beforeAll(() => {
  execFileSync(
    'pnpm',
    ['--filter', '@filecab/extension', 'exec', 'node', 'scripts/build-storage-test.mjs'],
    { stdio: 'pipe' },
  );
});

test.afterAll(async () => {
  await rm(join(extensionPath, 'storage-test.js'), { force: true });
});

/** Launches the real unpacked extension using a reusable isolated Chromium profile. */
async function launch(profile: string): Promise<{ context: BrowserContext; origin: string }> {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

  return { context, origin: `chrome-extension://${new URL(worker.url()).host}` };
}

test('offline popup/full-page edits survive worker termination and browser restart; stale edits retain input', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-storage-'));
  let { context, origin } = await launch(profile);
  try {
    await context.setOffline(true);
    const popup = await context.newPage();
    const full = await context.newPage();
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.message));
    full.on('pageerror', (error) => errors.push(error.message));
    await popup.goto(`${origin}/popup.html`);
    await full.goto(`${origin}/full-page.html`);
    await popup.getByRole('button', { name: 'Add manual entry' }).click();
    await popup.getByLabel('Title', { exact: true }).fill('  Offline title  ');
    await popup.getByLabel('Comment').fill('  exact note\nsecond line  ');
    await popup.getByLabel('Viewing URLs').fill('https://example.test/watch?id=001#episode');
    await popup.getByRole('button', { name: 'Save locally' }).click();
    await expect(full.locator('.local-library__entry-title')).toHaveText('  Offline title  ');
    await popup.getByRole('button', { name: 'Edit', exact: true }).click();
    await full.getByRole('button', { name: 'Edit', exact: true }).click();
    await popup.getByLabel('Title', { exact: true }).fill('First committed edit');
    await full.getByLabel('Title', { exact: true }).fill('Keep my unsaved edit');
    await popup.getByRole('button', { name: 'Save locally' }).click();
    await full.getByRole('button', { name: 'Save locally' }).click();
    await expect(full.getByRole('alert')).toContainText('changed');
    await expect(full.getByLabel('Title', { exact: true })).toHaveValue('Keep my unsaved edit');
    await full.getByRole('button', { name: 'Reload entry', exact: true }).click();
    await expect(full.getByLabel('Title', { exact: true })).toHaveValue('First committed edit');
    await full.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(full.locator('.local-library__entry-title')).toHaveText('First committed edit');
    await full.getByRole('button', { name: 'Edit', exact: true }).click();
    await full.getByLabel('Title', { exact: true }).fill('Unsaved after quota failure');
    await full.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.transaction.db.name.endsWith('--entries'))
          throw new DOMException('Fixture quota failure', 'QuotaExceededError');

        return original.apply(this, args);
      };
    });
    await full.getByRole('button', { name: 'Save locally' }).click();
    await expect(full.getByRole('alert')).toContainText('Save failed');
    await expect(full.getByLabel('Title', { exact: true })).toHaveValue(
      'Unsaved after quota failure',
    );
    await full.reload();
    await expect(full.locator('.local-library__entry-title')).toHaveText('First committed edit');
    const workers = await context.newPage();
    await workers.goto('chrome://serviceworker-internals/');
    await workers.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(workers.locator('body')).toContainText('Running Status: STOPPED');
    await popup.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(full.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await full.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(popup.locator('.local-library__entry-title')).toHaveText('First committed edit');
    await expect(full.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
    await workers.reload();
    await expect(workers.locator('body')).toContainText('Running Status: STOPPED');
    expect(errors).toEqual([]);
    await context.close();
    ({ context, origin } = await launch(profile));
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/full-page.html`);
    await expect(reopened.locator('.local-library__entry-title')).toHaveText(
      'First committed edit',
    );
    await reopened.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(reopened.getByLabel('Comment')).toHaveValue('  exact note\nsecond line  ');
    await expect(reopened.getByLabel('Viewing URLs')).toHaveValue(
      'https://example.test/watch?id=001#episode',
    );
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('repository commits revisions atomically across instances, shares one database/settings, and enforces Undo claims/expiry', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'filecab-repository-'));
  let { context, origin } = await launch(profile);
  try {
    const page = await context.newPage();
    const second = await context.newPage();
    await page.goto(`${origin}/full-page.html`);
    await second.goto(`${origin}/popup.html`);
    await expect(page.getByRole('button', { name: 'Add manual entry' })).toBeVisible();
    const url = `${origin}/storage-test.js`;
    const created = await Promise.all(
      [page, second].map((surface, index) =>
        surface.evaluate(
          async ({ url, index }) => {
            const { LocalLibraryRepository, Category } = (await import(
              url
            )) as typeof import('./fixtures/storage');
            const repository = await LocalLibraryRepository.open();
            try {
              return await repository.create(Category.Anime, { userTitle: `Concurrent ${index}` });
            } finally {
              await repository.close();
            }
          },
          { url, index },
        ),
      ),
    );
    expect(created.map((row) => row.localRevision).sort()).toEqual([1, 2]);
    await expect(page.locator('.local-library__entry')).toHaveCount(2);
    const updated = await Promise.all(
      [page, second].map((surface, index) =>
        surface.evaluate(
          async ({ url, row, index }) => {
            const { LocalLibraryRepository } = (await import(
              url
            )) as typeof import('./fixtures/storage');
            const repository = await LocalLibraryRepository.open();
            try {
              return await repository.update(row.entryId, row.localRevision, {
                comment: `Concurrent edit ${index}`,
              });
            } finally {
              await repository.close();
            }
          },
          { url, row: created[index], index },
        ),
      ),
    );
    expect(updated.map((row) => row.localRevision).sort()).toEqual([3, 4]);
    expect(updated.map((row) => row.entry.comment)).toEqual([
      'Concurrent edit 0',
      'Concurrent edit 1',
    ]);

    const result = await page.evaluate(
      async ({ url, entryId }) => {
        const { LocalLibraryRepository, Category, Locale, Status } = (await import(
          url
        )) as typeof import('./fixtures/storage');
        const repository = await LocalLibraryRepository.open();
        const account = await LocalLibraryRepository.open();
        const other = await LocalLibraryRepository.open();
        try {
          const before = (await repository.snapshot()).rows.find((row) => row.entryId === entryId)!;
          const unchanged = await repository.update(entryId, before.localRevision, {});
          const changed = await repository.update(entryId, unchanged.localRevision, {
            status: Status.Hide,
            progress: 150,
            rating: 10,
            sourceUrls: ['https://example.test/source'],
            comment: ' note ',
          });
          const cleared = await repository.update(entryId, changed.localRevision, {
            status: null,
            progress: 0,
            rating: 0,
            comment: '',
            sourceUrls: [],
          });
          const removed = await repository.delete(entryId, cleared.localRevision);
          await repository.close();
          const reopened = await LocalLibraryRepository.open();
          const undone = await reopened.undo(entryId, removed.localRevision);
          const exactUndo = JSON.stringify(undone.entry) === JSON.stringify(cleared.entry);
          const preferences = {
            query: 'retained query',
            sort: 'title' as const,
            pageSize: 20,
            status: null,
            locale: Locale.Ru,
          };
          await reopened.saveSettings(Category.Anime, 'library', 0, preferences);
          let settingsConflict = false;
          try {
            await reopened.saveSettings(Category.Anime, 'library', 0, preferences);
          } catch {
            settingsConflict = true;
          }
          const separateMode = await reopened.settings(Category.Anime, 'catalog');
          const separateCategory = await reopened.settings(Category.Films, 'library');
          const accountEntry = await account.create(Category.Tv, {
            userTitle: 'Shared device title',
          });
          const otherSnapshot = await other.snapshot();
          const originalNow = Date.now;
          const secondDeletion = await reopened.delete(entryId, undone.localRevision);
          let expired = false;
          try {
            Date.now = () => secondDeletion.undoUntil!;
            try {
              await reopened.undo(entryId, secondDeletion.localRevision);
            } catch {
              expired = true;
            }
          } finally {
            Date.now = originalNow;
          }
          const sourceEntry = await reopened.create(Category.Films, {
            userTitle: 'Source holder',
            sourceUrls: ['https://example.test/claimed'],
          });
          const sourceDeletion = await reopened.delete(
            sourceEntry.entryId,
            sourceEntry.localRevision,
          );
          await reopened.create(Category.Films, {
            userTitle: 'New source holder',
            sourceUrls: ['https://example.test/claimed'],
          });
          const revisionBeforeConflict = (await reopened.snapshot()).revision;
          let claimConflict = false;
          try {
            await reopened.undo(sourceEntry.entryId, sourceDeletion.localRevision);
          } catch {
            claimConflict = true;
          }
          const snapshot = await reopened.snapshot();
          const savedSettings = await reopened.settings(Category.Anime, 'library');
          await reopened.close();

          return {
            unchanged: JSON.stringify(before) === JSON.stringify(unchanged),
            cleared: cleared.entry,
            exactUndo,
            expired,
            settingsConflict,
            separateMode,
            separateCategory,
            savedSettings,
            otherCount: otherSnapshot.rows.length,
            accountTitle: accountEntry.entry.userTitle,
            guestHasAccount: snapshot.rows.some(
              (row) => row.entry.entryId === accountEntry.entryId,
            ),
            claimConflict,
            revisionBeforeConflict,
            revisionAfterConflict: snapshot.revision,
          };
        } finally {
          await account.close();
          await other.close();
        }
      },
      { url, entryId: created[0].entryId },
    );
    expect(result.unchanged).toBe(true);
    expect(result.cleared).toMatchObject({
      status: null,
      progress: 0,
      rating: 0,
      comment: '',
      sources: [],
    });
    expect(result.exactUndo).toBe(true);
    expect(result.expired).toBe(true);
    expect(result.settingsConflict).toBe(true);
    expect(result.separateMode).toBeNull();
    expect(result.separateCategory).toBeNull();
    expect(result.savedSettings?.preferences.query).toBe('retained query');
    expect(result.otherCount).toBeGreaterThan(0);
    expect(result.guestHasAccount).toBe(true);
    expect(result.claimConflict).toBe(true);
    expect(result.revisionAfterConflict).toBe(result.revisionBeforeConflict);
    await context.setOffline(true);
    await expect(page.locator('.local-library__scope')).toHaveText('Library on this device');
    await expect(page.getByText('Shared device title', { exact: true })).toBeVisible();
    await expect(second.getByText('Shared device title', { exact: true })).toBeVisible();
    await context.close();
    ({ context, origin } = await launch(profile));
    await context.setOffline(true);
    const restarted = await context.newPage();
    await restarted.goto(`${origin}/full-page.html`);
    await expect(restarted.getByText('Shared device title', { exact: true })).toBeVisible();
    const settingsAfterRestart = await restarted.evaluate(async (url) => {
      const { LocalLibraryRepository, Category } = (await import(
        url
      )) as typeof import('./fixtures/storage');
      const repository = await LocalLibraryRepository.open();
      try {
        return await repository.settings(Category.Anime, 'library');
      } finally {
        await repository.close();
      }
    }, `${origin}/storage-test.js`);
    expect(settingsAfterRestart?.preferences.query).toBe('retained query');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('damaged local records enter recovery and export raw data without resetting storage', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'filecab-recovery-'));
  const { context, origin } = await launch(profile);
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/full-page.html`);
    await page.getByRole('button', { name: 'Add manual entry' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Keep raw bytes');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await expect(page.locator('.local-library__entry-title')).toHaveText('Keep raw bytes');
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      const name = databases.find((database) => database.name?.endsWith('--entries'))!.name!;
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction('docs', 'readwrite');
          const store = transaction.objectStore('docs');
          const request = store.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;

            if (cursor) {
              const row = cursor.value;
              row.entry.userTitle = 123;
              cursor.update(row);
            }
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
    });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('preserved');
    await expect(page.getByRole('button', { name: 'Add manual entry' })).toHaveCount(0);
    const raw = await page.evaluate(async (url) => {
      const { exportRawLibrary } = (await import(url)) as typeof import('./fixtures/storage');

      return exportRawLibrary();
    }, `${origin}/storage-test.js`);
    const rows = raw.databases.flatMap((database) =>
      database.stores.flatMap((store) => store.records ?? []),
    );
    expect(
      rows.some((row) => (row as { entry?: { userTitle: unknown } }).entry?.userTitle === 123),
    ).toBe(true);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export recoverable raw data' }).click();
    expect((await download).suggestedFilename()).toBe('filecab-local-recovery.json');
    await page.getByRole('button', { name: 'Retry local storage' }).click();
    await expect(page.getByRole('alert')).toContainText('preserved');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
