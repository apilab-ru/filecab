import { ConflictReason, hasSemanticChange, type Entry, type Conflict } from '@filecab/contracts';
import { deepEqual } from 'rxdb/plugins/utils';
import type { RxConflictHandler } from 'rxdb/plugins/core';
import type { LocalDatabase, LocalEntry } from './database';
import type { SyncIssue } from './models/sync-models';

/** Detects user intent changes independently of server-assigned versions and timestamps. */
export function differsInIntent(a: Entry, b: Entry): boolean {
  return hasSemanticChange(a, b) || a.deleted !== b.deleted || a.catalogId !== b.catalogId;
}

/** Saves recoverable intent durably with a content-derived key so retries do not duplicate it. */
export async function retainIntent(
  database: LocalDatabase,
  ownerId: string,
  proposed: Entry,
  conflict: Conflict,
  kind: SyncIssue['kind'] = 'conflict',
): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify([ownerId, kind, proposed]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  const existing = await database.issues.findOne(id).exec();

  if (existing) return;

  await database.issues.incrementalUpsert({
    id,
    ownerId,
    proposed,
    conflict,
    kind,
    recordedAt: new Date().toISOString(),
  });
}

/** Keeps the master while requiring durable preservation before any conflicting overwrite. */
export function libraryConflictHandler(
  database: () => LocalDatabase,
): RxConflictHandler<LocalEntry> {
  return {
    isEqual: (a, b) => deepEqual(a.entry, b.entry),
    resolve: async ({ newDocumentState, realMasterState }) => {
      const db = database();
      const binding = await db.binding.findOne('device').exec();

      if (!binding) throw new Error('Account binding is unavailable');

      if (differsInIntent(newDocumentState.entry, realMasterState.entry))
        await retainIntent(db, binding.ownerId, newDocumentState.entry, {
          entryId: newDocumentState.entryId,
          reason: ConflictReason.Version,
          serverDocument: realMasterState.entry.serverVersion
            ? (realMasterState.entry as Entry & { serverVersion: string })
            : null,
        });

      return {
        ...realMasterState,
        localRevision: Math.max(
          Date.now(),
          newDocumentState.localRevision + 1,
          realMasterState.localRevision,
        ),
        undoBefore: newDocumentState.undoBefore,
        undoUntil: newDocumentState.undoUntil,
      };
    },
  };
}
