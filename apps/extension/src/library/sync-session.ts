import {
  SyncOperation,
  SyncErrorCode,
  ConflictReason,
  type OwnerSnapshot,
  type Entry,
} from '@filecab/contracts';
import {
  LOCAL_DATABASE_NAME,
  readCollection,
  type LocalDatabase,
  type LocalEntry,
} from './database';
import { retainIntent } from './sync-recovery';
import { masterRow } from './replication';
import { SyncError, syncRequest } from './sync-transport';

export const SYNC_RUN_LOCK = `${LOCAL_DATABASE_NAME}:sync-run`;

/** Binds a linking confirmation to exact local contents and the owner's remote revision. */
export interface LinkPreview {
  ownerId: string;
  localDigest: string;
  remoteRevision: string;
  localCount: number;
  remoteCount: number;
  conflicts: number;
}

/** Fingerprints local documents so confirmation cannot adopt data edited after the preview. */
async function digest(rows: LocalEntry[]): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(rows.sort((a, b) => a.entryId.localeCompare(b.entryId))),
  );
  const result = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(result), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

/** Counts local entries whose UUID, catalog identity or sources overlap the account snapshot. */
function conflictsWith(local: LocalEntry[], remote: OwnerSnapshot): number {
  return local.filter(
    ({ entry }) =>
      !entry.deleted &&
      remote.entries.some(
        (other) =>
          entry.entryId === other.entryId ||
          (entry.catalogId && entry.catalogId === other.catalogId) ||
          entry.sources.some((source) =>
            other.sources.some((candidate) => candidate.normalizedUrl === source.normalizedUrl),
          ),
      ),
  ).length;
}

/** Reads the actual local/account contents without changing the account binding or uploading. */
export async function previewLink(
  database: LocalDatabase,
  ownerId: string,
  request = syncRequest,
): Promise<LinkPreview> {
  const remote = await request<OwnerSnapshot>(ownerId, SyncOperation.Snapshot);

  return navigator.locks.request(`${LOCAL_DATABASE_NAME}:write`, async () => {
    const binding = await database.binding.findOne('device').exec();

    if (binding) throw new SyncError(SyncErrorCode.AlreadyLinked);

    const local = await readCollection(database.entries);

    return {
      ownerId,
      localDigest: await digest(local),
      remoteRevision: remote.revision,
      localCount: local.filter((row) => !row.entry.deleted).length,
      remoteCount: remote.entries.length,
      conflicts: conflictsWith(local, remote),
    };
  });
}

/** Revalidates both libraries before durably authorizing retry-safe adoption and replication. */
export async function confirmLink(
  database: LocalDatabase,
  preview: LinkPreview,
  request = syncRequest,
): Promise<void> {
  await navigator.locks.request(`${LOCAL_DATABASE_NAME}:write`, async () => {
    const remote = await request<OwnerSnapshot>(preview.ownerId, SyncOperation.Snapshot);
    const binding = await database.binding.findOne('device').exec();

    if (binding) throw new SyncError(SyncErrorCode.AlreadyLinked);

    if (
      remote.revision !== preview.remoteRevision ||
      (await digest(await readCollection(database.entries))) !== preview.localDigest
    )
      throw new SyncError(SyncErrorCode.PreviewChanged);

    await database.binding.insert({
      key: 'device',
      ownerId: preview.ownerId,
      generation: 1,
      phase: 'linked',
      initialCheckpoint: null,
    });
  });
}

/** Preserves all local intent before replacing a stale replica with a fresh server snapshot. */
export async function reconcileReset(
  database: LocalDatabase,
  ownerId: string,
  request = syncRequest,
): Promise<void> {
  const binding = await database.binding.findOne('device').exec();

  if (!binding || binding.ownerId !== ownerId || binding.phase === 'linked')
    throw new SyncError(SyncErrorCode.AccountChanged);

  await binding.incrementalPatch({ phase: 'resetting' });
  // All surfaces cancel replication when they observe this phase. The lease waits
  // for their in-flight network work before any reset writes are permitted.
  await navigator.locks.request(SYNC_RUN_LOCK, () =>
    navigator.locks.request(`${LOCAL_DATABASE_NAME}:write`, async () => {
      const current = await database.binding.findOne('device').exec();

      if (!current || current.ownerId !== ownerId || current.phase !== 'resetting')
        throw new SyncError(SyncErrorCode.AccountChanged);

      const remote = await request<OwnerSnapshot>(ownerId, SyncOperation.Snapshot);
      const rows = await readCollection(database.entries);
      for (const row of rows) {
        const master = remote.entries.find((entry) => entry.entryId === row.entryId) ?? null;
        await retainIntent(
          database,
          ownerId,
          row.entry,
          { entryId: row.entryId, reason: ConflictReason.Version, serverDocument: master },
          'reset',
        );
      }
      const byId = new Map(remote.entries.map((entry) => [entry.entryId, entry]));
      for (const row of rows) {
        const entry: Entry = byId.get(row.entryId) ?? {
          ...row.entry,
          deleted: true,
          serverVersion: null,
        };
        const { _deleted: _ignored, ...replacement } = masterRow(entry, row);
        await database.entries.incrementalUpsert({
          ...replacement,
          undoBefore: null,
          undoUntil: null,
        });
        byId.delete(row.entryId);
      }
      for (const entry of byId.values()) {
        const { _deleted: _ignored, ...replacement } = masterRow(entry);
        await database.entries.incrementalUpsert(replacement);
      }
      const generation = current.generation + 1;

      if (!Number.isSafeInteger(generation)) throw new SyncError(SyncErrorCode.StorageUnavailable);

      await current.incrementalPatch({
        generation,
        phase: 'linked',
        initialCheckpoint: { cursor: remote.revision, entryId: null },
      });
    }),
  );
}
