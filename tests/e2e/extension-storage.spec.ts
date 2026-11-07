import type { ApiErrorCode, SyncErrorCode } from '../../packages/contracts/src';
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

test('native RxDB replication adopts explicitly, preserves stale intent and retries after restart', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-replication-'));
  const server = {
    revision: 0,
    documents: new Map<string, Record<string, unknown>>(),
    changes: [] as Record<string, unknown>[],
    pushes: 0,
    loseResponse: false,
    floor: 0,
  };
  const ownerId = '10000000-0000-4000-8000-000000000001';
  const handler = async (input: { operation: string; ownerId?: string; body?: unknown }) => {
    const body = input.body as {
      checkpoint?: { cursor: string };
      limit?: number;
      rows?: Array<{
        proposed: Record<string, unknown>;
        assumedMaster: Record<string, unknown> | null;
      }>;
    };

    if (input.operation === 'edit') {
      const existing = server.documents.values().next().value!;
      const changed: Record<string, unknown> = {
        ...existing,
        comment: 'server wins',
        serverVersion: String(++server.revision),
        updatedAt: new Date().toISOString(),
      };
      server.documents.set(String(changed.entryId), changed);
      server.changes.push(changed);

      return { data: changed };
    }

    if (input.operation === 'lose-response') {
      server.loseResponse = true;

      return { data: true };
    }

    if (input.operation === 'snapshot')
      return {
        data: {
          schemaVersion: 1,
          revision: String(server.revision),
          entries: [...server.documents.values()].filter((entry) => !entry.deleted),
        },
      };

    if (input.operation === 'pull') {
      const cursor = Number(body.checkpoint?.cursor ?? 0);

      if (cursor < server.floor) return { error: 'SYNC_RESET_REQUIRED' };

      const changes = server.changes
        .filter((entry) => Number(entry.serverVersion) > cursor)
        .slice(0, body.limit);
      const documents = [...new Map(changes.map((entry) => [entry.entryId, entry])).values()];

      return {
        data: {
          schemaVersion: 1,
          documents,
          checkpoint: {
            cursor: String(changes.at(-1)?.serverVersion ?? cursor),
            entryId: changes.at(-1)?.entryId ?? null,
          },
          hasMore: Number(changes.at(-1)?.serverVersion ?? cursor) < server.revision,
        },
      };
    }

    if (input.operation === 'push') {
      server.pushes++;
      const conflicts = [];
      for (const row of body.rows!) {
        const id = String(row.proposed.entryId);
        const current = server.documents.get(id);
        const intent = (entry: Record<string, unknown>) =>
          JSON.stringify([
            entry.userTitle,
            entry.comment,
            entry.progress,
            entry.deleted,
            entry.sources,
          ]);

        if (current && intent(current) === intent(row.proposed)) continue;

        if ((current?.serverVersion ?? null) !== (row.assumedMaster?.serverVersion ?? null)) {
          conflicts.push({ entryId: id, reason: 'VERSION', serverDocument: current ?? null });
          continue;
        }

        const entry = {
          ...row.proposed,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          serverVersion: String(++server.revision),
        };
        server.documents.set(id, entry);
        server.changes.push(entry);
      }

      if (server.loseResponse) {
        server.loseResponse = false;

        return { error: 'NETWORK_ERROR' };
      }

      return { data: { schemaVersion: 1, conflicts } };
    }

    throw new Error('Unknown fixture operation');
  };
  let launched = await launch(profile);
  try {
    await launched.context.exposeFunction('filecabFixture', handler);
    let page = await launched.context.newPage();
    await page.goto(`${launched.origin}/full-page.html`);
    let url = `${launched.origin}/storage-test.js`;
    const result = await page.evaluate(
      async ({ url, ownerId }) => {
        const module = (await import(url)) as typeof import('./fixtures/storage');
        const bridge = (
          globalThis as unknown as {
            filecabFixture(
              input: unknown,
            ): Promise<{ data?: unknown; error?: ApiErrorCode | SyncErrorCode }>;
          }
        ).filecabFixture;
        const request = async <T>(
          ownerId: string,
          operation: 'pull' | 'push' | 'snapshot',
          body?: unknown,
        ): Promise<T> => {
          const reply = await bridge({ ownerId, operation, body });

          if (reply.error) throw new module.SyncError(reply.error);

          return reply.data as T;
        };
        const repository = await module.LocalLibraryRepository.open();
        const database = repository.database;
        const guest = await repository.create(module.Category.Anime, {
          userTitle: 'Explicit guest adoption',
          comment: 'original',
        });
        const preview = await module.previewLink(database, ownerId, request);
        await repository.update(guest.entryId, guest.localRevision, { progress: 1 });
        let stalePreview = false;
        try {
          await module.confirmLink(database, preview, request);
        } catch (error) {
          stalePreview = error instanceof module.SyncError && error.code === 'PREVIEW_CHANGED';
        }
        const before = await module.readCollection(database.binding);
        await module.confirmLink(
          database,
          await module.previewLink(database, ownerId, request),
          request,
        );
        let binding = (await module.readCollection(database.binding))[0];
        const errors: string[] = [];
        let state = module.startLibraryReplication(database, binding, () => {}, request);
        state.error$.subscribe((error) => errors.push(String(error)));
        const settle = () =>
          Promise.race([
            state.awaitInSync(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Replication timed out: ${errors.join('; ')}`)),
                10000,
              ),
            ),
          ]);
        await settle();
        const first = (await repository.snapshot()).rows.find(
          (row) => row.entryId === guest.entryId,
        )!;
        await state.cancel();
        await bridge({ operation: 'edit' });
        await repository.update(first.entryId, first.localRevision, {
          comment: 'rejected offline intent',
        });
        binding = (await module.readCollection(database.binding))[0];
        state = module.startLibraryReplication(database, binding, () => {}, request);
        state.error$.subscribe((error) => errors.push(String(error)));
        await settle();
        const conflict = (await repository.snapshot()).rows.find(
          (row) => row.entryId === first.entryId,
        )!;
        const issues = await module.readCollection(database.issues);
        await state.cancel();
        await repository.reapplyIssue(issues[0].id, ownerId, conflict.localRevision);
        state = module.startLibraryReplication(database, binding, () => {}, request);
        await settle();
        const applied = (await repository.snapshot()).rows.find(
          (row) => row.entryId === first.entryId,
        )!;
        const deleted = await repository.delete(applied.entryId, applied.localRevision);
        await settle();
        const deletion = (await repository.snapshot()).rows.find(
          (row) => row.entryId === first.entryId,
        )!;
        await repository.undo(deletion.entryId, deletion.localRevision);
        await settle();
        const restored = (await repository.snapshot()).rows.find(
          (row) => row.entryId === first.entryId,
        )!;
        await state.cancel();
        await repository.update(restored.entryId, restored.localRevision, {
          comment: 'pending across browser restart',
        });
        const recoveryCleared = (await module.readCollection(database.issues)).length;
        await repository.close();

        return {
          stalePreview,
          unlinkedBeforeConfirmation: before.length === 0,
          adopted: first.entry.serverVersion !== null,
          serverWon: conflict.entry.comment,
          retained: issues.map((issue) => issue.proposed.comment),
          reapplied: applied.entry.comment,
          undoDeleted: deleted.entry.deleted,
          restored: !restored.entry.deleted,
          recoveryCleared,
        };
      },
      { url, ownerId },
    );
    expect(result).toMatchObject({
      stalePreview: true,
      unlinkedBeforeConfirmation: true,
      adopted: true,
      serverWon: 'server wins',
      retained: ['rejected offline intent'],
      reapplied: 'rejected offline intent',
      undoDeleted: true,
      restored: true,
      recoveryCleared: 0,
    });
    const revisionBeforeRestart = server.revision;
    await launched.context.close();
    launched = await launch(profile);
    await launched.context.exposeFunction('filecabFixture', handler);
    page = await launched.context.newPage();
    await page.goto(`${launched.origin}/full-page.html`);
    url = `${launched.origin}/storage-test.js`;
    const restarted = await page.evaluate(
      async ({ url, ownerId }) => {
        const module = (await import(url)) as typeof import('./fixtures/storage');
        const bridge = (
          globalThis as unknown as {
            filecabFixture(
              input: unknown,
            ): Promise<{ data?: unknown; error?: ApiErrorCode | SyncErrorCode }>;
          }
        ).filecabFixture;
        const request = async <T>(
          ownerId: string,
          operation: 'pull' | 'push' | 'snapshot',
          body?: unknown,
        ): Promise<T> => {
          const result = await bridge({ ownerId, operation, body });

          if (result.error) throw new module.SyncError(result.error);

          return result.data as T;
        };
        const repository = await module.LocalLibraryRepository.open();
        const binding = (await module.readCollection(repository.database.binding))[0];
        await bridge({ operation: 'lose-response' });
        const state = module.startLibraryReplication(
          repository.database,
          binding,
          () => {},
          request,
        );
        // A lost reply must leave native metadata pending. Cancel the failed cycle,
        // restart it immediately, and verify the already-committed write is a no-op.
        await new Promise<void>((resolve) => state.error$.subscribe(() => resolve()));
        await state.cancel();
        const resumed = module.startLibraryReplication(
          repository.database,
          binding,
          () => {},
          request,
        );
        await Promise.race([
          resumed.awaitInSync(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Restart did not converge')), 10000),
          ),
        ]);
        const rows = (await repository.snapshot()).rows;
        const issues = await module.readCollection(repository.database.issues);
        await resumed.cancel();
        await repository.close();

        return { comment: rows[0].entry.comment, issues: issues.length };
      },
      { url, ownerId },
    );
    expect(restarted).toEqual({ comment: 'pending across browser restart', issues: 0 });
    expect(server.revision).toBe(revisionBeforeRestart + 1);
  } finally {
    await launched.context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('history reset blocks uploads and preserves intent before any replacement, including failed recovery writes', async () => {
  test.setTimeout(30000);
  const profile = await mkdtemp(join(tmpdir(), 'filecab-reset-'));
  const { context, origin } = await launch(profile);
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/full-page.html`);
    const result = await page.evaluate(async (url) => {
      const module = (await import(url)) as typeof import('./fixtures/storage');
      const repository = await module.LocalLibraryRepository.open();
      const database = repository.database;
      const ownerId = '10000000-0000-4000-8000-000000000002';
      const pending = await repository.create(module.Category.Anime, {
        userTitle: 'Recoverable pending intent',
        comment: 'keep this exact note',
      });
      await database.binding.insert({
        key: 'device',
        ownerId,
        generation: 1,
        phase: 'linked',
        initialCheckpoint: null,
      });
      let pushes = 0;
      let revision = 3;
      let master: typeof pending.entry | null = null;
      const request = async <T>(
        _ownerId: string,
        operation: 'pull' | 'push' | 'snapshot',
        input?: unknown,
      ): Promise<T> => {
        if (operation === 'snapshot')
          return {
            schemaVersion: 1,
            revision: String(revision),
            entries: master ? [master] : [],
          } as T;

        if (operation === 'pull') {
          const body = input as { checkpoint: { cursor: string } | null };
          const cursor = Number(body.checkpoint?.cursor ?? 0);

          if (cursor < 3) throw new module.SyncError(module.ApiErrorCode.SyncResetRequired);

          return {
            schemaVersion: 1,
            documents: master && cursor < revision ? [master] : [],
            checkpoint: { cursor: String(revision), entryId: master?.entryId ?? null },
            hasMore: false,
          } as T;
        }

        pushes++;
        const body = input as { rows: Array<{ proposed: typeof pending.entry }> };
        master = { ...body.rows[0].proposed, serverVersion: String(++revision) };

        return { schemaVersion: 1, conflicts: [] } as T;
      };
      const binding = (await module.readCollection(database.binding))[0];
      const state = module.startLibraryReplication(database, binding, () => {}, request);
      await new Promise<void>((resolve) => state.error$.subscribe(() => resolve()));
      await state.cancel();
      const phase = (await module.readCollection(database.binding))[0].phase;
      const beforePushes = pushes;
      const original = database.issues.incrementalUpsert.bind(database.issues);
      database.issues.incrementalUpsert = async () => {
        throw new Error('Injected quota failure');
      };
      let failed = false;
      try {
        await module.reconcileReset(database, ownerId, request);
      } catch {
        failed = true;
      }
      database.issues.incrementalUpsert = original;
      const afterFailure = (await repository.snapshot()).rows[0];
      const failedPhase = (await module.readCollection(database.binding))[0].phase;
      await module.reconcileReset(database, ownerId, request);
      const recovered = (await repository.snapshot()).rows[0];
      const issues = await module.readCollection(database.issues);
      const resetBinding = (await module.readCollection(database.binding))[0];
      let resumed = module.startLibraryReplication(database, resetBinding, () => {}, request);
      const settle = () =>
        Promise.race([
          resumed.awaitInSync(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Reset replication timed out')), 5000),
          ),
        ]);
      await settle();
      const afterResetPushes = pushes;
      await resumed.cancel();
      let wrongAccount = false;
      try {
        await repository.reapplyIssue(
          issues[0].id,
          '10000000-0000-4000-8000-000000000003',
          recovered.localRevision,
        );
      } catch {
        wrongAccount = true;
      }
      await repository.reapplyIssue(issues[0].id, ownerId, recovered.localRevision);
      resumed = module.startLibraryReplication(database, resetBinding, () => {}, request);
      await settle();
      const reapplied = (await repository.snapshot()).rows[0];
      await resumed.cancel();
      await repository.close();

      return {
        phase,
        beforePushes,
        failed,
        unchangedAfterFailure: JSON.stringify(afterFailure.entry) === JSON.stringify(pending.entry),
        failedPhase,
        recoveredDeleted: recovered.entry.deleted,
        recoveredComment: issues[0].proposed.comment,
        kind: issues[0].kind,
        checkpoint: resetBinding.initialCheckpoint?.cursor,
        generation: resetBinding.generation,
        afterResetPushes,
        wrongAccount,
        reapplied: !reapplied.entry.deleted && reapplied.entry.serverVersion !== null,
      };
    }, `${origin}/storage-test.js`);
    expect(result).toEqual({
      phase: 'reset-required',
      beforePushes: 0,
      failed: true,
      unchangedAfterFailure: true,
      failedPhase: 'resetting',
      recoveredDeleted: true,
      recoveredComment: 'keep this exact note',
      kind: 'reset',
      checkpoint: '3',
      generation: 2,
      afterResetPushes: 0,
      wrongAccount: true,
      reapplied: true,
    });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('collapsed pull pages reach the latest master and missing-master conflicts retain the rejected create', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'filecab-pull-conflict-'));
  const { context, origin } = await launch(profile);
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/full-page.html`);
    const result = await page.evaluate(async (url) => {
      const module = (await import(url)) as typeof import('./fixtures/storage');
      const repository = await module.LocalLibraryRepository.open();
      const database = repository.database;
      const ownerId = '10000000-0000-4000-8000-000000000006';
      const local = await repository.create(module.Category.Anime, {
        userTitle: 'Conflicting device create',
        sourceUrls: ['https://example.test/already-owned'],
      });
      const remote = {
        ...local.entry,
        entryId: crypto.randomUUID(),
        userTitle: 'Existing account entry',
        serverVersion: '1',
      };
      const changes = Array.from({ length: 121 }, (_, index) => ({
        ...remote,
        serverVersion: String(index + 1),
        progress: index,
      }));
      let pullRequests = 0;
      let rejected = false;
      const request = async <T>(
        _ownerId: string,
        operation: 'pull' | 'push' | 'snapshot',
        input?: unknown,
      ): Promise<T> => {
        if (operation === 'snapshot')
          return { schemaVersion: 1, revision: '121', entries: [changes[120]] } as T;

        if (operation === 'pull') {
          pullRequests++;
          const body = input as { checkpoint: { cursor: string } | null; limit: number };
          const cursor = Number(body.checkpoint?.cursor ?? 0);
          const page = changes.slice(cursor, cursor + body.limit);
          const checkpoint = Number(page.at(-1)?.serverVersion ?? cursor);

          return {
            schemaVersion: 1,
            documents: page.length ? [page.at(-1)] : [],
            checkpoint: { cursor: String(checkpoint), entryId: remote.entryId },
            hasMore: checkpoint < 121,
          } as T;
        }

        const body = input as { rows: Array<{ proposed: typeof local.entry }> };
        const conflicts = body.rows
          .filter((row) => row.proposed.entryId === local.entryId)
          .map((row) => ({
            entryId: row.proposed.entryId,
            reason: 'SOURCE',
            serverDocument: null,
          }));
        rejected ||= conflicts.length > 0;

        return { schemaVersion: 1, conflicts } as T;
      };
      await module.confirmLink(
        database,
        await module.previewLink(database, ownerId, request),
        request,
      );
      const binding = (await module.readCollection(database.binding))[0];
      const state = module.startLibraryReplication(database, binding, () => {}, request);
      await Promise.race([
        state.awaitInSync(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Collapsed feed failed to converge')), 5000),
        ),
      ]);
      const rows = (await repository.snapshot()).rows;
      const issues = await module.readCollection(database.issues);
      await state.cancel();
      await repository.close();

      return {
        rejected,
        continued: pullRequests > 1,
        active: rows
          .filter((row) => !row.entry.deleted)
          .map((row) => ({ title: row.entry.userTitle, progress: row.entry.progress })),
        retained: issues.map((issue) => ({
          title: issue.proposed.userTitle,
          reason: issue.conflict.reason,
          master: issue.conflict.serverDocument,
        })),
        rejectedCreateDeleted: rows.find((row) => row.entryId === local.entryId)?.entry.deleted,
      };
    }, `${origin}/storage-test.js`);
    expect(result).toEqual({
      rejected: true,
      continued: true,
      active: [{ title: 'Existing account entry', progress: 120 }],
      retained: [{ title: 'Conflicting device create', reason: 'SOURCE', master: null }],
      rejectedCreateDeleted: true,
    });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
