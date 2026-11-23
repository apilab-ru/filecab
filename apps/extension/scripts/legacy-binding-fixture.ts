import { createRxDatabase, type RxCollection, type RxJsonSchema } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import oldBindingSchema from '../src/library/binding-v0.schema.json';
import type { SyncBinding } from '../src/library/models/sync-models';

/** Creates the binding written by the previous extension build. */
export async function writeLegacyBinding(ownerId: string): Promise<void> {
  const database = await createRxDatabase<{ binding: RxCollection<SyncBinding> }>({
    name: 'filecab-local',
    storage: getRxStorageDexie(),
  });
  try {
    const { binding } = await database.addCollections({
      binding: { schema: oldBindingSchema as RxJsonSchema<SyncBinding> },
    });
    await binding.insert({
      key: 'device',
      ownerId,
      generation: 1,
      phase: 'linked',
      initialCheckpoint: null,
    });
  } finally {
    await database.close();
  }
}
