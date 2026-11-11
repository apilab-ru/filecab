import {
  SyncOperation,
  ApiErrorCode,
  SyncErrorCode,
  type SyncDiagnostic,
  type Checkpoint,
  type Entry,
  type ReplicationPullResponse,
  type ReplicationPushResponse,
  type ServerEntry,
} from '@filecab/contracts';
import { replicateRxCollection, type RxReplicationState } from 'rxdb/plugins/replication';
import { getLastCheckpointDoc, type WithDeleted } from 'rxdb/plugins/core';
import { type LocalDatabase, type LocalEntry, readCollection } from './database';
import { retainIntent } from './sync-recovery';
import { SyncError, syncRequest } from './sync-transport';
import type { SyncBinding } from './models/sync-models';
import { API_ORIGIN } from '../auth/connection';
import { syncDiagnostic } from './sync-diagnostics';
import type { SyncStatus } from './models/sync-status';
export type { SyncStatus } from './models/sync-status';

/** Wraps a master document without exposing local revision or Undo fields to the server. */
export function masterRow(entry: Entry, previous?: LocalEntry): WithDeleted<LocalEntry> {
  return {
    entryId: entry.entryId,
    entry,
    localRevision: Math.max(Date.now(), (previous?.localRevision ?? 0) + 1),
    localUpdatedAt: Date.now(),
    undoBefore: previous?.undoBefore ?? null,
    undoUntil: previous?.undoUntil ?? null,
    _deleted: false,
  };
}

/** Runs native RxDB replication for the explicitly bound account and metadata generation. */
export function startLibraryReplication(
  database: LocalDatabase,
  binding: SyncBinding,
  status: (value: SyncStatus) => void,
  request: typeof syncRequest = syncRequest,
): RxReplicationState<LocalEntry, Checkpoint> {
  let reset = false;
  const assertBound = async () => {
    const current = await database.binding.findOne('device').exec();

    if (
      reset ||
      !current ||
      current.ownerId !== binding.ownerId ||
      current.generation !== binding.generation ||
      current.phase !== 'linked'
    )
      throw new SyncError(SyncErrorCode.AccountChanged);
  };
  const call = async <T>(
    operation: SyncOperation.Pull | SyncOperation.Push,
    body: unknown,
  ): Promise<T> => {
    await assertBound();
    try {
      return await request<T>(binding.ownerId, operation, body);
    } catch (error) {
      if (error instanceof SyncError && error.code === ApiErrorCode.SyncResetRequired) {
        reset = true;
        await database.binding.findOne('device').incrementalPatch({ phase: 'reset-required' });
        status({ phase: 'reset-required', error: error.code });
      } else
        status({
          phase: 'failed',
          error: error instanceof SyncError ? error.code : SyncErrorCode.RequestFailed,
          diagnostic: syncDiagnostic(error),
        });

      throw error;
    }
  };
  const state = replicateRxCollection<LocalEntry, Checkpoint>({
    collection: database.entries,
    replicationIdentifier: `filecab:${new URL(API_ORIGIN).origin}:owner:${binding.ownerId}:schema:1:generation:${binding.generation}`,
    live: true,
    retryTime: 10000,
    waitForLeadership: false,
    pull: {
      batchSize: 100,
      initialCheckpoint: binding.initialCheckpoint ?? undefined,
      handler: async (checkpoint, batchSize) => {
        const documents = new Map<string, ServerEntry>();
        let next: Checkpoint | null = checkpoint ?? null;
        // RxDB treats a short batch as exhausted; consume further server pages when
        // repeated revisions collapse to fewer documents than the transport limit.
        let more = true;
        while (more && documents.size < batchSize) {
          const result: ReplicationPullResponse = await call(SyncOperation.Pull, {
            schemaVersion: 1,
            checkpoint: next,
            limit: batchSize - documents.size,
          });
          for (const document of result.documents) {
            documents.delete(document.entryId);
            documents.set(document.entryId, document);
          }
          next = result.checkpoint;
          more = result.hasMore;
        }
        const local = await readCollection(database.entries);

        return {
          documents: [...documents.values()].map((entry) =>
            masterRow(
              entry,
              local.find((row) => row.entryId === entry.entryId),
            ),
          ),
          checkpoint: next!,
        };
      },
    },
    push: {
      batchSize: 50,
      modifier: (row) => (row.entry.deleted && row.entry.serverVersion === null ? null : row),
      handler: async (rows) => {
        // Validate the persisted pull position before every upload, including retries
        // after long offline periods. Never upload first after history was pruned.
        const checkpoint = await getLastCheckpointDoc<LocalEntry, Checkpoint>(
          state.internalReplicationState!,
          'down',
        );
        await call<ReplicationPullResponse>(SyncOperation.Pull, {
          schemaVersion: 1,
          checkpoint: checkpoint ?? binding.initialCheckpoint,
          limit: 1,
        });
        const result = await call<ReplicationPushResponse>(SyncOperation.Push, {
          schemaVersion: 1,
          rows: rows.map((row) => ({
            assumedMaster: row.assumedMasterState?.entry.serverVersion
              ? row.assumedMasterState.entry
              : null,
            proposed: row.newDocumentState.entry,
          })),
        });
        const conflicts: WithDeleted<LocalEntry>[] = [];
        for (const conflict of result.conflicts) {
          const row = rows.find(
            (candidate) => candidate.newDocumentState.entryId === conflict.entryId,
          )!;
          await retainIntent(database, binding.ownerId, row.newDocumentState.entry, conflict);
          conflicts.push(
            masterRow(
              conflict.serverDocument ?? {
                ...row.newDocumentState.entry,
                serverVersion: null,
                deleted: true,
              },
              row.newDocumentState,
            ),
          );
        }
        // Accepted writes receive authoritative versions/timestamps through pull.
        state.reSync();

        return conflicts;
      },
    },
  });
  state.active$.subscribe((active) => {
    if (!reset && active) status({ phase: 'syncing' });
  });
  state.error$.subscribe((error) => {
    if (reset) return;

    const diagnostic = syncDiagnostic(error);
    console.warn('[Filecab sync]', diagnostic);
    status({ phase: 'failed', error: diagnostic.code, diagnostic });
  });
  state.sent$.subscribe(() => {
    if (!reset) status({ phase: 'syncing' });
  });
  state.subs.push(
    state.active$.subscribe((active) => {
      if (!active && !reset) {
        void state
          .awaitInSync()
          .then(() => {
            if (!state.isStopped() && !reset) status({ phase: 'idle' });
          })
          .catch(() => {});
      }
    }),
  );

  return state;
}
