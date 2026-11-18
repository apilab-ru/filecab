import {
  ConflictReason,
  hasSemanticChange,
  type Entry,
  type Conflict,
  type ValidationIssue,
} from '@filecab/contracts';
import { deepEqual } from 'rxdb/plugins/utils';
import type { RxConflictHandler } from 'rxdb/plugins/core';
import type { LocalDatabase, LocalEntry } from './database';
import type { SyncIssue } from './models/sync-models';

/** Detects user intent changes independently of server-assigned versions and timestamps. */
export function differsInIntent(a: Entry, b: Entry): boolean {
  return hasSemanticChange(a, b) || a.deleted !== b.deleted || a.catalogId !== b.catalogId;
}

/** Derives a content key so retries of the same intent share one stored issue. */
async function intentId(
  ownerId: string,
  kind: SyncIssue['kind'],
  proposed: Entry,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([ownerId, kind, proposed]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Saves recoverable intent durably with a content-derived key so retries do not duplicate it. */
export async function retainIntent(
  database: LocalDatabase,
  ownerId: string,
  proposed: Entry,
  conflict: Conflict,
  kind: SyncIssue['kind'] = 'conflict',
  problem?: ValidationIssue,
): Promise<void> {
  const id = await intentId(ownerId, kind, proposed);
  const existing = await database.issues.findOne(id).exec();

  if (existing) {
    if (problem && !existing.toJSON().problem) await existing.incrementalPatch({ problem });

    return;
  }

  await database.issues.incrementalUpsert({
    id,
    ownerId,
    proposed,
    conflict,
    kind,
    ...(problem ? { problem } : {}),
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

      // A row the server rejected is already retained as a validation issue.
      const rejected = await db.issues
        .findOne(await intentId(binding.ownerId, 'validation', newDocumentState.entry))
        .exec();

      if (!rejected && differsInIntent(newDocumentState.entry, realMasterState.entry))
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
