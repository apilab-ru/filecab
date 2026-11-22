import {
  backupChanges,
  compareBackup,
  toBackup,
  type Backup,
  type BackupComparison,
  emptySnapshot,
  associateCatalog,
  type CatalogRecord,
  hasSemanticChange,
  MAX_ENTRY_SOURCES,
  previewEntryPatch,
  type Category,
  type Entry,
  type EntryPatch,
} from '@filecab/contracts';
import {
  assertStoredRecords,
  readCollection,
  closeLocalDatabase,
  LOCAL_DATABASE_NAME,
  openLocalDatabase,
  type LocalDatabase,
  type LocalEntry,
  type LocalSettings,
  type Preferences,
} from './database';
import { recoverLocalMerges } from './merge-recovery';
import type { LocalSnapshot } from './models/local-snapshot';
export type { LocalSnapshot } from './models/local-snapshot';

/** Provides a safe failure classification without exposing saved personal data. */
export class LocalLibraryError extends Error {
  constructor(
    readonly code:
      'CONFLICT' | 'NOT_FOUND' | 'INVALID_ENTRY' | 'UNDO_EXPIRED' | 'STORAGE_UNAVAILABLE',
  ) {
    super(code);
  }
}

/** Binds a device restore preview to the account binding and the local library revision. */
export interface LocalBackupPreview {
  owner: string;
  revision: number;
  comparison: BackupComparison;
}

/** Computes revision metadata from the same committed rows as the entries. */
function snapshotOf(rows: LocalEntry[]): LocalSnapshot {
  return {
    revision: rows.reduce((maximum, row) => Math.max(maximum, row.localRevision), 0),
    updatedAt: rows.reduce((maximum, row) => Math.max(maximum, row.localUpdatedAt), 0),
    rows,
  };
}

/** Carries only a link removal from saved intent. An update never adds a link. */
function linkRemoval(proposed: Entry): string[] | undefined {
  return proposed.sources.length ? undefined : [];
}

/** Enforces local identity/claim invariants before a durable write. */
function assertClaims(entry: Entry, rows: LocalEntry[]): void {
  if (entry.deleted) return;

  if (!entry.catalogId && !entry.userTitle.trim()) throw new LocalLibraryError('INVALID_ENTRY');

  if (entry.sources.length > MAX_ENTRY_SOURCES) throw new LocalLibraryError('INVALID_ENTRY');

  const normalized = new Set<string>();
  for (const source of entry.sources) {
    const url = new URL(source.originalUrl);

    if (!/^https?:$/.test(url.protocol) || url.username || url.password || normalized.has(url.href))
      throw new LocalLibraryError('INVALID_ENTRY');

    normalized.add(url.href);
  }
  for (const { entry: other } of rows) {
    if (other.deleted || other.entryId === entry.entryId) continue;

    if (
      (entry.catalogId && entry.catalogId === other.catalogId) ||
      other.sources.some((source) => normalized.has(source.normalizedUrl))
    )
      throw new LocalLibraryError('CONFLICT');
  }
}

/** Reports whether a local entry already holds a server version at least as new as the given one. */
function hasServerVersion(entry: Entry, serverVersion: string): boolean {
  return entry.serverVersion !== null && BigInt(entry.serverVersion) >= BigInt(serverVersion);
}

/** Serializes local writes across popup/full-page instances without a running worker. */
export class LocalLibraryRepository {
  private closed = false;
  private constructor(
    readonly name: string,
    readonly database: LocalDatabase,
  ) {}

  static async open(): Promise<LocalLibraryRepository> {
    if (!navigator.locks) throw new LocalLibraryError('STORAGE_UNAVAILABLE');

    const name = LOCAL_DATABASE_NAME;
    const database = await openLocalDatabase();
    const repository = new LocalLibraryRepository(name, database);
    try {
      await repository.snapshot();

      return repository;
    } catch (error) {
      await closeLocalDatabase();
      throw error;
    }
  }

  private async locked<T>(action: () => Promise<T>): Promise<T> {
    if (this.closed) throw new LocalLibraryError('STORAGE_UNAVAILABLE');

    return navigator.locks.request(`${this.name}:write`, async () => {
      await recoverLocalMerges(this.database);

      return action();
    });
  }

  private async rows(): Promise<LocalEntry[]> {
    await assertStoredRecords(this.database);

    return readCollection(this.database.entries);
  }

  async snapshot(): Promise<LocalSnapshot> {
    return this.locked(async () => snapshotOf(await this.rows()));
  }

  observe(next: (snapshot: LocalSnapshot) => void, error: () => void): () => void {
    let stopped = false;
    const subscription = this.database.entries.find().$.subscribe({
      next: () => {
        void this.snapshot()
          .then((snapshot) => {
            if (!stopped) next(snapshot);
          })
          .catch(() => {
            if (!stopped) error();
          });
      },
      error,
    });

    return () => {
      stopped = true;
      subscription.unsubscribe();
    };
  }

  /**
   * Moves a link for a create or an update: writes each other active entry that holds one of
   * the entry's normalized links without that link. Each write gets the next local revision,
   * so replication sends the entry that loses the link before the entry that takes it.
   */
  private async releaseSources(entry: Entry, rows: LocalEntry[]): Promise<LocalEntry[]> {
    if (entry.deleted || !entry.sources.length) return rows;

    const normalized = new Set(entry.sources.map((source) => source.normalizedUrl));
    let current = rows;

    for (const row of rows) {
      if (
        row.entry.deleted ||
        row.entryId === entry.entryId ||
        !row.entry.sources.some((source) => normalized.has(source.normalizedUrl))
      )
        continue;

      const released = await this.save(
        {
          ...row.entry,
          sources: row.entry.sources.filter((source) => !normalized.has(source.normalizedUrl)),
          updatedAt: new Date(Math.max(Date.now(), Date.parse(row.entry.updatedAt))).toISOString(),
        },
        current,
      );
      current = current.map((item) => (item.entryId === released.entryId ? released : item));
    }

    return current;
  }

  private async save(
    entry: Entry,
    rows: LocalEntry[],
    undoBefore: Entry | null = null,
  ): Promise<LocalEntry> {
    assertClaims(entry, rows);
    const previous = snapshotOf(rows);
    const localRevision = previous.revision + 1;

    if (!Number.isSafeInteger(localRevision)) throw new LocalLibraryError('STORAGE_UNAVAILABLE');

    const localUpdatedAt = Math.max(Date.now(), previous.updatedAt);
    const row: LocalEntry = {
      entryId: entry.entryId,
      entry,
      localRevision,
      localUpdatedAt,
      undoBefore,
      undoUntil: undoBefore ? Date.now() + 10000 : null,
    };
    // One RxDB document write commits the entry, revision and Undo state together.
    await this.database.entries.incrementalUpsert(row);

    return row;
  }

  async create(
    category: Category,
    fields: EntryPatch,
    catalog?: CatalogRecord,
    entryId: string = crypto.randomUUID(),
  ): Promise<LocalEntry> {
    return this.locked(async () => {
      const now = new Date().toISOString();
      const entry = previewEntryPatch(
        {
          schemaVersion: 1,
          entryId,
          catalogId: catalog?.catalogId ?? null,
          category,
          userTitle: '',
          status: null,
          rating: 0,
          progress: 0,
          comment: '',
          sources: [],
          snapshot: catalog?.snapshot ?? emptySnapshot(),
          createdAt: now,
          updatedAt: now,
          serverVersion: null,
          deleted: false,
        },
        fields,
      );

      const rows = await this.rows();

      if (rows.some((row) => row.entryId === entryId)) throw new LocalLibraryError('CONFLICT');

      return this.save(entry, await this.releaseSources(entry, rows));
    });
  }

  /** Prepares a local catalog association without changing durable entries. */
  async previewCatalog(
    entryId: string,
    version: number,
    catalog: CatalogRecord,
    otherId: string | undefined,
    otherVersion: number | undefined,
    fields: EntryPatch,
  ) {
    return this.locked(async () => {
      const rows = await this.rows();
      const current = rows.find((row) => row.entryId === entryId);
      const other = otherId ? rows.find((row) => row.entryId === otherId) : undefined;

      if (
        !current ||
        current.localRevision !== version ||
        (otherId && (!other || other.localRevision !== otherVersion))
      )
        throw new LocalLibraryError('CONFLICT');

      const proposed = associateCatalog(current.entry, catalog, other?.entry, fields);
      const finalRows = rows.map((row) => ({
        ...row,
        entry: proposed.find((entry) => entry.entryId === row.entryId) ?? row.entry,
      }));
      proposed.forEach((entry) => assertClaims(entry, finalRows));

      return { before: [current, ...(other ? [other] : [])], proposed };
    });
  }

  /** Confirms a preview after version revalidation and journals every entry before writes. */
  async applyCatalog(before: LocalEntry[], proposed: Entry[]): Promise<void> {
    await this.locked(async () => {
      const rows = await this.rows();

      if (
        before.some(
          (row) =>
            !rows.some(
              (current) =>
                current.entryId === row.entryId && current.localRevision === row.localRevision,
            ),
        )
      )
        throw new LocalLibraryError('CONFLICT');

      const finalRows = rows.map((row) => ({
        ...row,
        entry: proposed.find((entry) => entry.entryId === row.entryId) ?? row.entry,
      }));
      proposed.forEach((entry) => assertClaims(entry, finalRows));
      const previous = snapshotOf(rows);
      const now = Math.max(Date.now(), ...before.map((row) => Date.parse(row.entry.updatedAt)));
      const committed = [...proposed]
        .sort((a, b) => Number(b.deleted) - Number(a.deleted))
        .map((entry, index) => ({
          entryId: entry.entryId,
          entry: { ...entry, updatedAt: new Date(now).toISOString() },
          localRevision: previous.revision + index + 1,
          localUpdatedAt: now,
          undoBefore: null,
          undoUntil: null,
        }));

      if (!Number.isSafeInteger(previous.revision + committed.length))
        throw new LocalLibraryError('STORAGE_UNAVAILABLE');

      await this.database.merges.incrementalUpsert({ id: crypto.randomUUID(), rows: committed });
      await recoverLocalMerges(this.database);
    });
  }

  async update(entryId: string, expectedRevision: number, fields: EntryPatch): Promise<LocalEntry> {
    return this.mutate(
      entryId,
      expectedRevision,
      (before) => {
        if (before.entry.deleted) throw new LocalLibraryError('NOT_FOUND');

        const entry = previewEntryPatch(before.entry, fields);

        return hasSemanticChange(before.entry, entry)
          ? {
              ...entry,
              updatedAt: new Date(
                Math.max(Date.now(), Date.parse(before.entry.updatedAt)),
              ).toISOString(),
            }
          : before.entry;
      },
      false,
      true,
    );
  }

  private async mutate(
    entryId: string,
    expectedRevision: number,
    change: (row: LocalEntry) => Entry,
    deleting = false,
    moveLink = false,
  ): Promise<LocalEntry> {
    return this.locked(async () => {
      const rows = await this.rows();
      const before = rows.find((row) => row.entryId === entryId);

      if (!before) throw new LocalLibraryError('NOT_FOUND');

      if (before.localRevision !== expectedRevision) throw new LocalLibraryError('CONFLICT');

      const entry = change(before);

      if (entry === before.entry) return before;

      const current = moveLink ? await this.releaseSources(entry, rows) : rows;

      return this.save(entry, current, deleting ? before.entry : null);
    });
  }

  async delete(entryId: string, expectedRevision: number): Promise<LocalEntry> {
    return this.mutate(
      entryId,
      expectedRevision,
      (before) => {
        if (before.entry.deleted) throw new LocalLibraryError('NOT_FOUND');

        return {
          ...before.entry,
          deleted: true,
          updatedAt: new Date(
            Math.max(Date.now(), Date.parse(before.entry.updatedAt)),
          ).toISOString(),
        };
      },
      true,
    );
  }

  async undo(entryId: string, deletionRevision: number): Promise<LocalEntry> {
    return this.mutate(entryId, deletionRevision, (before) => {
      if (
        !before.entry.deleted ||
        !before.undoBefore ||
        !before.undoUntil ||
        Date.now() >= before.undoUntil
      )
        throw new LocalLibraryError('UNDO_EXPIRED');

      return {
        ...before.undoBefore,
        createdAt: before.entry.createdAt,
        serverVersion: before.entry.serverVersion,
        snapshot: before.entry.snapshot,
      };
    });
  }

  /** Reapplies reviewed user fields against the current local revision and server identity. */
  async reapplyIssue(id: string, ownerId: string, expectedRevision: number): Promise<void> {
    await this.locked(async () => {
      const issue = await this.database.issues.findOne(id).exec();
      const binding = await this.database.binding.findOne('device').exec();

      if (
        !issue ||
        issue.ownerId !== ownerId ||
        binding?.ownerId !== ownerId ||
        binding.phase !== 'linked'
      )
        throw new LocalLibraryError('CONFLICT');

      const rows = await this.rows();
      const current = rows.find((row) => row.entryId === issue.proposed.entryId);

      if (
        !current ||
        current.localRevision !== expectedRevision ||
        current.entry.catalogId !== issue.proposed.catalogId
      )
        throw new LocalLibraryError('CONFLICT');

      const proposed = issue.proposed;
      await this.save(
        {
          ...previewEntryPatch(current.entry, {
            category: proposed.category,
            userTitle: proposed.userTitle,
            status: proposed.status,
            rating: proposed.rating,
            progress: proposed.progress,
            comment: proposed.comment,
            sourceUrls: linkRemoval(proposed),
          }),
          deleted: proposed.deleted,
          updatedAt: new Date(
            Math.max(Date.now(), Date.parse(current.entry.updatedAt)),
          ).toISOString(),
        },
        rows,
      );
      await issue.remove();
    });
  }

  /** Resolves one rejected replication row using device fields or its captured server document. */
  async resolveValidationIssue(
    id: string,
    ownerId: string,
    expectedRevision: number | null,
    choice: 'device' | 'server',
  ): Promise<void> {
    await this.locked(async () => {
      const issue = await this.database.issues.findOne(id).exec();
      const binding = await this.database.binding.findOne('device').exec();

      if (
        !issue ||
        issue.kind !== 'validation' ||
        issue.ownerId !== ownerId ||
        binding?.ownerId !== ownerId ||
        binding.phase !== 'linked'
      )
        throw new LocalLibraryError('CONFLICT');

      const rows = await this.rows();
      const current = rows.find((row) => row.entryId === issue.proposed.entryId);

      if ((current?.localRevision ?? null) !== expectedRevision)
        throw new LocalLibraryError('CONFLICT');

      // Keep the issue when its entry is gone so the saved intent is not lost.
      if (choice === 'device' && !current) throw new LocalLibraryError('NOT_FOUND');

      if (choice === 'device' && current) {
        const proposed = issue.proposed;
        await this.save(
          {
            ...previewEntryPatch(current.entry, {
              category: proposed.category,
              userTitle: proposed.userTitle,
              status: proposed.status,
              rating: proposed.rating,
              progress: proposed.progress,
              comment: proposed.comment,
              sourceUrls: linkRemoval(proposed),
            }),
            deleted: proposed.deleted,
            updatedAt: new Date(
              Math.max(Date.now(), Date.parse(current.entry.updatedAt)),
            ).toISOString(),
          },
          rows,
        );
      }

      if (choice === 'server') {
        const serverDocument = issue.conflict.serverDocument;

        // Rejected rows already return to their master and later pulls may advance it;
        // rewriting the captured copy would push stale server fields back as a local edit.
        if (
          serverDocument &&
          current &&
          !hasServerVersion(current.entry, serverDocument.serverVersion)
        ) {
          await this.save(serverDocument, rows);
        } else if (!serverDocument && current && !current.entry.deleted) {
          await this.save(
            {
              ...current.entry,
              deleted: true,
              serverVersion: null,
              updatedAt: new Date(
                Math.max(Date.now(), Date.parse(current.entry.updatedAt)),
              ).toISOString(),
            },
            rows,
          );
        }
      }

      await issue.remove();
    });
  }

  /** Names the bound account, or the device when no account is bound. */
  private async owner(): Promise<string> {
    const binding = await this.database.binding.findOne('device').exec();

    return binding?.ownerId ?? 'device';
  }

  /** Exports the active device library in the current backup format. */
  async exportBackup(): Promise<Backup> {
    return toBackup((await this.snapshot()).rows.map((row) => row.entry));
  }

  /** Compares a validated backup with the device library without changing it. */
  async previewBackup(backup: Backup): Promise<LocalBackupPreview> {
    return this.locked(async () => {
      const rows = await this.rows();

      return {
        owner: await this.owner(),
        revision: snapshotOf(rows).revision,
        comparison: compareBackup(
          rows.map((row) => row.entry),
          backup,
        ),
      };
    });
  }

  /**
   * Replaces the device library with a previewed backup. One journal document holds all
   * changed rows: tombstones first, then added and updated entries. Existing UUIDs keep their
   * server version, so replication pushes the rows as ordinary changes.
   */
  async restoreBackup(
    backup: Backup,
    preview: Pick<LocalBackupPreview, 'owner' | 'revision'>,
    confirmEmpty: boolean,
  ): Promise<void> {
    if (!backup.entries.length && !confirmEmpty) throw new LocalLibraryError('INVALID_ENTRY');

    await this.locked(async () => {
      const rows = await this.rows();
      const previous = snapshotOf(rows);

      if (previous.revision !== preview.revision || (await this.owner()) !== preview.owner)
        throw new LocalLibraryError('CONFLICT');

      const current = new Map(rows.map((row) => [row.entryId.toLowerCase(), row]));
      const incoming = new Set(backup.entries.map((entry) => entry.entryId.toLowerCase()));
      const now = Date.now();
      const removed: Entry[] = rows
        .filter((row) => !row.entry.deleted && !incoming.has(row.entryId.toLowerCase()))
        .map((row) => ({
          ...row.entry,
          deleted: true,
          updatedAt: new Date(Math.max(now, Date.parse(row.entry.updatedAt))).toISOString(),
        }));
      const restored: Entry[] = backup.entries
        .filter((entry) => backupChanges(current.get(entry.entryId.toLowerCase())?.entry, entry))
        .map((entry) => {
          const before = current.get(entry.entryId.toLowerCase());

          return {
            ...entry,
            schemaVersion: 1,
            entryId: before?.entryId ?? entry.entryId,
            serverVersion: before?.entry.serverVersion ?? null,
            deleted: false,
          };
        });
      const changed = [...removed, ...restored];

      if (!changed.length) return;

      if (!Number.isSafeInteger(previous.revision + changed.length))
        throw new LocalLibraryError('STORAGE_UNAVAILABLE');

      const localUpdatedAt = Math.max(now, previous.updatedAt);
      await this.database.merges.incrementalUpsert({
        id: crypto.randomUUID(),
        rows: changed.map((entry, index) => ({
          entryId: entry.entryId,
          entry,
          localRevision: previous.revision + index + 1,
          localUpdatedAt,
          undoBefore: null,
          undoUntil: null,
        })),
      });
      await recoverLocalMerges(this.database);
    });
  }

  async settings(category: Category, mode: 'library' | 'catalog'): Promise<LocalSettings | null> {
    return this.locked(async () => {
      await assertStoredRecords(this.database);
      const rows = await readCollection(this.database.settings);

      return rows.find((row) => row.key === `${category}:${mode}`) ?? null;
    });
  }

  async saveSettings(
    category: Category,
    mode: 'library' | 'catalog',
    expectedRevision: number,
    preferences: Preferences,
  ): Promise<LocalSettings> {
    return this.locked(async () => {
      await assertStoredRecords(this.database);
      const key = `${category}:${mode}`;

      const committed = (await readCollection(this.database.settings)).find(
        (row) => row.key === key,
      );

      if ((committed?.revision ?? 0) !== expectedRevision) throw new LocalLibraryError('CONFLICT');

      if (!Number.isSafeInteger(expectedRevision + 1))
        throw new LocalLibraryError('STORAGE_UNAVAILABLE');

      const row = { key, category, mode, revision: expectedRevision + 1, preferences };

      await this.database.settings.incrementalUpsert(row);

      return row;
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;
    await closeLocalDatabase();
  }
}
