import {
  addRxPlugin,
  createRxDatabase,
  prepareQuery,
  normalizeMangoQuery,
  type RxCollection,
  type RxDatabase,
  type RxJsonSchema,
  type RxValidationError,
  wrappedValidateStorageFactory,
} from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import type { Category, Entry, Locale, Status } from '@filecab/contracts';
import entrySchema from './entry.schema.json';
import settingsSchema from './settings.schema.json';
import bindingSchema from './binding.schema.json';
import issueSchema from './issue.schema.json';
import type { SyncBinding, SyncIssue } from './models/sync-models';
import { libraryConflictHandler } from './sync-recovery';
import { validatorBySchema } from './generated-validators.mjs';

/** Stores a single durable entry mutation and its recoverable deletion state. */
export interface LocalEntry {
  entryId: string;
  entry: Entry;
  localRevision: number;
  localUpdatedAt: number;
  undoBefore: Entry | null;
  undoUntil: number | null;
}

/** Keeps interface preferences independent of portable library data. */
export interface Preferences {
  query: string;
  sort: 'updated' | 'title';
  pageSize: number;
  status: Status | null;
  locale: Locale;
}

/** Scopes preferences to a category and library/catalog mode. */
export interface LocalSettings {
  key: string;
  category: Category;
  mode: 'library' | 'catalog';
  revision: number;
  preferences: Preferences;
}

type Collections = {
  entries: RxCollection<LocalEntry>;
  settings: RxCollection<LocalSettings>;
  binding: RxCollection<SyncBinding>;
  issues: RxCollection<SyncIssue>;
};

export type LocalDatabase = RxDatabase<Collections>;

addRxPlugin(RxDBMigrationSchemaPlugin);

const connections = new Map<string, { database: LocalDatabase; references: number }>();

/** Uses one device-local library independently of the authenticated account. */
export const LOCAL_DATABASE_NAME = 'filecab-local';

/** Looks up a bundled validator compiled from this version's full RxDB storage schema. */
function validatorFor(schema: { title?: string; version: number }) {
  const validate = validatorBySchema[`${schema.title}/${schema.version}`];

  if (!validate) throw new Error('Unsupported local storage schema');

  return (data: unknown) =>
    validate(data)
      ? []
      : ((validate.errors ?? [{ message: 'Invalid stored record' }]) as RxValidationError[]);
}

/** Validates user collections without compiling code under the extension CSP. */
function validatedStorage() {
  const storage = getRxStorageDexie();
  const wrapped = wrappedValidateStorageFactory(validatorFor, 'filecab-standalone')({ storage });

  return {
    ...storage,
    createStorageInstance: <T>(
      parameters: Parameters<typeof storage.createStorageInstance<T>>[0],
    ) =>
      ['entries', 'settings', 'binding', 'issues'].includes(parameters.collectionName)
        ? wrapped.createStorageInstance(parameters)
        : storage.createStorageInstance(parameters),
  };
}

/** Creates versioned local storage; callers handle failure without deleting existing bytes. */
async function createLocalDatabase(name: string): Promise<LocalDatabase> {
  const database = await createRxDatabase<Collections>({
    name,
    storage: validatedStorage(),
    multiInstance: true,
    eventReduce: true,
  });
  try {
    await database.addCollections({
      entries: {
        schema: entrySchema as RxJsonSchema<LocalEntry>,
        migrationStrategies: {},
        conflictHandler: libraryConflictHandler(() => database),
      },
      binding: { schema: bindingSchema as RxJsonSchema<SyncBinding>, migrationStrategies: {} },
      issues: { schema: issueSchema as RxJsonSchema<SyncIssue>, migrationStrategies: {} },
      settings: { schema: settingsSchema as RxJsonSchema<LocalSettings>, migrationStrategies: {} },
    });

    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

/** Reads committed storage directly, without waiting for another surface's broadcast cache. */
export async function readCollection<T>(collection: RxCollection<T>): Promise<T[]> {
  const schema = collection.schema.jsonSchema;
  const result = await collection.storageInstance.query(
    prepareQuery(schema, normalizeMangoQuery(schema, { selector: {} })),
  );

  return result.documents
    .filter((record) => !record._deleted)
    .map((record) => decodeStoredRecord<T>(schema, record));
}

/** Checks every persisted collection before exposing a local library. */
export async function assertStoredRecords(database: LocalDatabase): Promise<void> {
  await readCollection(database.entries);
  await readCollection(database.settings);
  await readCollection(database.binding);
  await readCollection(database.issues);
}

/** Shares one connection per UI realm, including overlapping React StrictMode mounts. */
export async function openLocalDatabase(): Promise<LocalDatabase> {
  const name = LOCAL_DATABASE_NAME;

  return navigator.locks.request(`${name}:connection`, async () => {
    const existing = connections.get(name);

    if (existing) {
      existing.references += 1;

      return existing.database;
    }

    const database = await createLocalDatabase(name);
    connections.set(name, { database, references: 1 });

    return database;
  });
}

/** Releases a UI connection without racing an overlapping reopen or deleting saved data. */
export async function closeLocalDatabase(): Promise<void> {
  const name = LOCAL_DATABASE_NAME;

  await navigator.locks.request(`${name}:connection`, async () => {
    const existing = connections.get(name);

    if (!existing) return;

    existing.references -= 1;

    if (existing.references === 0) {
      await existing.database.close();
      connections.delete(name);
    }
  });
}

/** Validates and copies stored records without carrying RxDB internal fields into writes. */
function decodeStoredRecord<T>(schema: { title?: string; version: number }, record: object): T {
  if (validatorFor(schema)(record).length) throw new Error('Local storage record is unreadable');

  return structuredClone(
    Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith('_'))),
  ) as T;
}
