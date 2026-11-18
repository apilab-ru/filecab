import { ConflictReason, type ServerEntry } from '@filecab/contracts';
import { readCollection, type LocalDatabase, type LocalEntry } from './database';
import type { LocalMergeJournal } from './models/local-merge-journal';
import { differsInIntent, retainIntent } from './sync-recovery';

/** Finishes confirmed merges while the caller holds the device write lock. */
export async function recoverLocalMerges(database: LocalDatabase): Promise<void> {
  const journals = await readCollection(database.merges);

  if (!journals.length) return;

  const entries = new Map(
    (await readCollection(database.entries)).map((row) => [row.entryId, row]),
  );

  for (const journal of journals) {
    const conflicted = journal.rows.some((row) => {
      const current = entries.get(row.entryId);

      return (
        current !== undefined &&
        current.localRevision > row.localRevision &&
        differsInIntent(current.entry, row.entry)
      );
    });

    if (conflicted) await preserveJournal(database, journal, entries);
    else
      for (const row of journal.rows) {
        const current = entries.get(row.entryId);

        if (current && current.localRevision >= row.localRevision) continue;

        await database.entries.incrementalUpsert(row);
        entries.set(row.entryId, row);
      }

    const document = await database.merges.findOne(journal.id).exec();
    await document?.remove();
  }
}

/** Keeps unapplied merge rows as recoverable issues when newer data, such as a pull, changed them. */
async function preserveJournal(
  database: LocalDatabase,
  journal: LocalMergeJournal,
  entries: Map<string, LocalEntry>,
): Promise<void> {
  const binding = await database.binding.findOne('device').exec();

  // Only replication writes outside the device lock, so an unlinked device cannot get here.
  if (!binding)
    throw new Error('Confirmed merge conflicts with newer local data; journal preserved');

  for (const row of journal.rows) {
    const current = entries.get(row.entryId);

    if (current?.localRevision === row.localRevision) continue;

    await retainIntent(database, binding.ownerId, row.entry, {
      entryId: row.entryId,
      reason: ConflictReason.Version,
      serverDocument: current?.entry.serverVersion ? (current.entry as ServerEntry) : null,
    });
  }
}
