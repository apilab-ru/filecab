import {
  emptySnapshot,
  hasSemanticChange,
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

/** Provides a safe failure classification without exposing saved personal data. */
export class LocalLibraryError extends Error {
  constructor(
    readonly code:
      'CONFLICT' | 'NOT_FOUND' | 'INVALID_ENTRY' | 'UNDO_EXPIRED' | 'STORAGE_UNAVAILABLE',
  ) {
    super(code);
  }
}

/** Describes one consistent local library state, including retained tombstones. */
export interface LocalSnapshot {
  revision: number;
  updatedAt: number;
  rows: LocalEntry[];
}

/** Computes revision metadata from the same committed rows as the entries. */
function snapshotOf(rows: LocalEntry[]): LocalSnapshot {
  return {
    revision: rows.reduce((maximum, row) => Math.max(maximum, row.localRevision), 0),
    updatedAt: rows.reduce((maximum, row) => Math.max(maximum, row.localUpdatedAt), 0),
    rows,
  };
}

/** Enforces local identity/claim invariants before a durable write. */
function assertClaims(entry: Entry, rows: LocalEntry[]): void {
  if (entry.deleted) return;

  if (!entry.catalogId && !entry.userTitle.trim()) throw new LocalLibraryError('INVALID_ENTRY');

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

/** Serializes local writes across popup/full-page instances without a running worker. */
export class LocalLibraryRepository {
  private closed = false;
  private constructor(
    readonly name: string,
    private readonly database: LocalDatabase,
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

    return navigator.locks.request(`${this.name}:write`, action);
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

  async create(category: Category, fields: EntryPatch): Promise<LocalEntry> {
    return this.locked(async () => {
      const now = new Date().toISOString();
      const entry = previewEntryPatch(
        {
          schemaVersion: 1,
          entryId: crypto.randomUUID(),
          catalogId: null,
          category,
          userTitle: '',
          status: null,
          rating: 0,
          progress: 0,
          comment: '',
          sources: [],
          snapshot: emptySnapshot(),
          createdAt: now,
          updatedAt: now,
          serverVersion: null,
          deleted: false,
        },
        fields,
      );

      return this.save(entry, await this.rows());
    });
  }

  async update(entryId: string, expectedRevision: number, fields: EntryPatch): Promise<LocalEntry> {
    return this.mutate(entryId, expectedRevision, (before) => {
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
    });
  }

  private async mutate(
    entryId: string,
    expectedRevision: number,
    change: (row: LocalEntry) => Entry,
    deleting = false,
  ): Promise<LocalEntry> {
    return this.locked(async () => {
      const rows = await this.rows();
      const before = rows.find((row) => row.entryId === entryId);

      if (!before) throw new LocalLibraryError('NOT_FOUND');

      if (before.localRevision !== expectedRevision) throw new LocalLibraryError('CONFLICT');

      const entry = change(before);

      if (entry === before.entry) return before;

      return this.save(entry, rows, deleting ? before.entry : null);
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

      return before.undoBefore;
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
