import {
  ListSyncJobKind,
  type ListSyncImportAddition,
  type ListSyncImportChange,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncJobResult,
  type ListSyncJobState,
  type ListSyncErrorCode,
  type ListSyncProgress,
  type ListSyncValues,
  type ServerEntry,
} from '@filecab/contracts';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  referenceKey,
  type ListSyncAdapter,
  type ListSyncReference,
  type RemoteListRecord,
} from './list-sync-adapter';

/** Keeps the remote record of an addition for the apply job. */
export interface StoredAddition extends ListSyncImportAddition {
  record: RemoteListRecord;
}

/** Keeps the previewed entry version and remote record of a change for the apply job. */
export interface StoredChange extends ListSyncImportChange {
  entryVersion: string;
  record: RemoteListRecord;
}

/** Stores an import preview in its job. Entry versions and records stay on the server. */
export interface StoredPreview {
  additions: StoredAddition[];
  changes: StoredChange[];
  unchanged: number;
}

/** Converts a value to Prisma JSON storage. */
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Converts a job row to its client form. An import preview is read through its own route. */
export function publicJob(row: {
  id: string;
  kind: string;
  state: string;
  progress: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): ListSyncJob {
  return {
    jobId: row.id,
    kind: row.kind as ListSyncJobKind,
    state: row.state as ListSyncJobState,
    progress: row.progress as ListSyncProgress,
    result:
      row.kind === ListSyncJobKind.ImportPreview
        ? null
        : ((row.result as ListSyncJobResult) ?? null),
    error: row.error as ListSyncErrorCode | null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

/** Removes the server-only parts of a stored import preview. */
export function publicPreview(jobId: string, stored: StoredPreview): ListSyncImportPreview {
  return {
    schemaVersion: 1,
    jobId,
    additions: stored.additions.map(({ key, title, category, values }) => ({
      key,
      title,
      category,
      values,
    })),
    changes: stored.changes.map(({ key, entryId, title, fields }) => ({
      key,
      entryId,
      title,
      fields,
    })),
    unchanged: stored.unchanged,
  };
}

/** Reads the transferable values of an entry. */
export function entryValues(entry: ServerEntry): ListSyncValues {
  return { status: entry.status, rating: entry.rating, progress: entry.progress };
}

/** Returns a display title of an entry. */
export function entryTitle(entry: ServerEntry): string {
  return entry.userTitle.trim() || entry.snapshot.titles[0]?.text || entry.entryId;
}

/** Reads the active entries of the owner in the categories of the adapter. */
export async function activeEntries(
  database: PrismaClient,
  ownerId: string,
  adapter: ListSyncAdapter,
): Promise<ServerEntry[]> {
  const rows = await database.libraryEntry.findMany({ where: { ownerId, deleted: false } });

  return rows
    .map((row) => row.document as unknown as ServerEntry)
    .filter((entry) => adapter.categories.includes(entry.category));
}

/**
 * Finds the verified provider reference of each entry, from its snapshot and its catalog item.
 * An entry with two different verified IDs is ambiguous and gets no reference.
 */
export async function verifiedReferences(
  database: PrismaClient,
  entries: ServerEntry[],
  adapter: ListSyncAdapter,
): Promise<Map<string, ListSyncReference>> {
  const catalogIds = [...new Set(entries.flatMap((entry) => entry.catalogId ?? []))];
  const catalogRows = catalogIds.length
    ? await database.catalogReference.findMany({
        where: {
          catalogId: { in: catalogIds },
          namespace: adapter.namespace,
          entity: adapter.entity,
        },
      })
    : [];
  const result = new Map<string, ListSyncReference>();

  for (const entry of entries) {
    const ids = new Set<string>();

    for (const reference of entry.snapshot.references)
      if (
        reference.namespace === adapter.namespace &&
        reference.entity === adapter.entity &&
        reference.provenance.verified
      )
        ids.add(reference.id);

    for (const row of catalogRows)
      if (row.catalogId === entry.catalogId && (row.provenance as { verified?: boolean }).verified)
        ids.add(row.externalId);

    if (ids.size === 1)
      result.set(entry.entryId, {
        namespace: adapter.namespace,
        entity: adapter.entity,
        id: [...ids][0]!,
      });
  }

  return result;
}

/** Indexes remote records by record ID and by reference. */
export function indexRecords(records: RemoteListRecord[]): {
  byId: Map<string, RemoteListRecord>;
  byReference: Map<string, RemoteListRecord>;
} {
  const byId = new Map<string, RemoteListRecord>();
  const byReference = new Map<string, RemoteListRecord>();

  for (const record of records) {
    byId.set(record.recordId, record);
    byReference.set(referenceKey(record.reference), record);
  }

  return { byId, byReference };
}
