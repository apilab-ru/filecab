import { LOCAL_DATABASE_NAME } from './database';

/** Records readable raw stores alongside failures without modifying any IndexedDB bytes. */
export interface RecoveryExport {
  format: 'filecab-local-recovery-v1';
  exportedAt: string;
  databases: {
    name: string;
    stores: { name: string; records?: unknown[]; error?: string }[];
    error?: string;
  }[];
}

/** Reads a raw object store without passing through RxDB or validating damaged documents. */
function readStore(database: IDBDatabase, name: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(name, 'readonly');
    const request = transaction.objectStore(name).getAll();
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(new Error('Store read failed'));
    transaction.onabort = () => reject(new Error('Store read aborted'));
  });
}

/** Opens an existing database only; aborts creation if it disappeared during recovery. */
function existingDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Database read failed'));
    request.onblocked = () => reject(new Error('Database is blocked'));
  });
}

/** Exports only the selected library's readable stores, retaining safe failure information. */
export async function exportRawLibrary(): Promise<RecoveryExport> {
  const result: RecoveryExport = {
    format: 'filecab-local-recovery-v1',
    exportedAt: new Date().toISOString(),
    databases: [],
  };
  const databases = await indexedDB.databases();
  for (const { name } of databases) {
    if (!name || !name.startsWith(`rxdb-dexie-${LOCAL_DATABASE_NAME}--`)) continue;

    const output: RecoveryExport['databases'][number] = { name, stores: [] };
    result.databases.push(output);
    let database: IDBDatabase | undefined;
    try {
      database = await existingDatabase(name);
      for (const store of Array.from(database.objectStoreNames)) {
        try {
          output.stores.push({ name: store, records: await readStore(database, store) });
        } catch {
          output.stores.push({ name: store, error: 'Store could not be read' });
        }
      }
    } catch {
      output.error = 'Database could not be read';
    } finally {
      database?.close();
    }
  }

  return result;
}
