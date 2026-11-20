import {
  ApiErrorCode,
  associateCatalog,
  CatalogAssociationConflictError,
  mergeCatalogSnapshots,
  type CatalogAssociationRequest,
  type CatalogRecord,
  ConflictReason,
  emptySnapshot,
  type ReplicationRow,
  type Conflict,
  type ReplicationPull,
  type ReplicationPullResponse,
  type EntryPatch,
  type FieldPath,
  type ServerEntry,
  type Snapshot,
  type Category,
  type OwnerSnapshot,
  type MergeEntriesRequest,
  type LibraryMutationPreview,
} from '@filecab/contracts';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ApiException } from '../http/api-error';
import type { PrismaClient, Prisma } from '../generated/prisma/client';

import { MutationError, patchDocument, validateEntry, proposeMerge } from './proposals';
import { LibraryPreviewSigner } from './preview';

export { MutationError } from './proposals';

/** Rejects a link that an update adds. Only a create can set the link; an update can remove it. */
/** Carries a new entry without accepting client ownership or server timestamps. */
export interface CreateEntry {
  entryId: string;
  category: Category;
  catalogId: string | null;
  snapshot: Snapshot;
  fields: EntryPatch;
}

/** Converts a validated domain document to Prisma JSON storage. */
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Serializes every mutation for one owner until its documents and change feed commit. */
export class LibraryMutationService {
  constructor(
    private readonly database: PrismaClient,
    private readonly previews?: LibraryPreviewSigner,
  ) {}

  private async transaction<T>(
    ownerId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.$transaction(async (tx) => {
        const libraries = await tx.$queryRaw<
          Array<{ ownerId: string }>
        >`SELECT "ownerId" FROM "UserLibrary" WHERE "ownerId" = ${ownerId}::uuid FOR UPDATE`;

        if (!libraries.length) throw new MutationError(ApiErrorCode.NotFound);

        return action(tx);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new MutationError(ApiErrorCode.Conflict);

      throw error;
    }
  }

  private async load(
    tx: Prisma.TransactionClient,
    ownerId: string,
    entryId: string,
    expectedVersion: string,
  ): Promise<ServerEntry> {
    const row = await tx.libraryEntry.findFirst({ where: { id: entryId, ownerId } });

    if (!row) throw new MutationError(ApiErrorCode.NotFound);

    const entry = row.document as unknown as ServerEntry;

    if (entry.serverVersion !== expectedVersion) throw new MutationError(ApiErrorCode.Conflict);

    return entry;
  }

  /**
   * Moves a link for a create, an update or a replicated write: removes the entry's normalized
   * links from other active entries of the owner. Restore, merge and association never move links.
   * Each changed entry gets its own version and change record before the entry that takes the link.
   */
  private async releaseSources(
    tx: Prisma.TransactionClient,
    ownerId: string,
    entry: ServerEntry,
  ): Promise<void> {
    if (entry.deleted || !entry.sources.length) return;

    const hashes = entry.sources.map((source) =>
      createHash('sha256').update(source.normalizedUrl).digest('hex'),
    );
    const claims = await tx.sourceAssociation.findMany({
      where: { ownerId, normalizedHash: { in: hashes }, entryId: { not: entry.entryId } },
    });
    const normalized = new Set(entry.sources.map((source) => source.normalizedUrl));

    for (const entryId of new Set(claims.map((claim) => claim.entryId))) {
      const row = await tx.libraryEntry.findFirst({ where: { id: entryId, ownerId } });

      if (!row) continue;

      const other = row.document as unknown as ServerEntry;

      await this.publish(tx, ownerId, {
        ...other,
        sources: other.sources.filter((source) => !normalized.has(source.normalizedUrl)),
        updatedAt: new Date(Math.max(Date.now(), Date.parse(other.updatedAt))).toISOString(),
      });
    }
  }

  private async publish(
    tx: Prisma.TransactionClient,
    ownerId: string,
    document: ServerEntry,
    creating = false,
  ): Promise<ServerEntry> {
    const library = await tx.userLibrary.update({
      where: { ownerId },
      data: { revision: { increment: 1 } },
    });
    const entry = { ...document, serverVersion: library.revision.toString() };
    await tx.sourceAssociation.deleteMany({ where: { entryId: entry.entryId, ownerId } });
    const data = { catalogId: entry.catalogId, deleted: entry.deleted, document: json(entry) };

    if (creating) {
      await tx.libraryEntry.create({ data: { ...data, id: entry.entryId, ownerId } });
    } else {
      await tx.libraryEntry.update({ where: { id: entry.entryId, ownerId }, data });
    }

    if (!entry.deleted && entry.sources.length)
      await tx.sourceAssociation.createMany({
        data: entry.sources.map((source, position) => ({
          originalUrl: source.originalUrl,
          normalizedUrl: source.normalizedUrl,
          normalizedHash: createHash('sha256').update(source.normalizedUrl).digest('hex'),
          ownerId,
          entryId: entry.entryId,
          position,
        })),
      });

    await tx.entryChange.create({
      data: { ownerId, revision: library.revision, entryId: entry.entryId, document: json(entry) },
    });

    return entry;
  }

  /** Reads a commit-consistent ordered feed and refuses checkpoints across missing history. */
  async pull(ownerId: string, input: ReplicationPull): Promise<ReplicationPullResponse> {
    const cursor = BigInt(input.checkpoint?.cursor ?? '0');

    if (cursor > 9223372036854775807n) throw new MutationError(ApiErrorCode.ValidationError);

    return this.database.$transaction(
      async (tx) => {
        const library = await tx.userLibrary.findUnique({ where: { ownerId } });

        if (!library) throw new MutationError(ApiErrorCode.NotFound);

        if (cursor > library.revision)
          throw new ApiException(
            409,
            ApiErrorCode.SyncResetRequired,
            'Replication checkpoint requires reset',
          );

        const changes = await tx.entryChange.findMany({
          where: { ownerId, revision: { gt: cursor } },
          orderBy: { revision: 'asc' },
          take: input.limit,
        });
        let consumed = cursor;
        const documents = new Map<string, ServerEntry>();
        for (const change of changes) {
          if (change.revision !== consumed + 1n)
            throw new ApiException(
              409,
              ApiErrorCode.SyncResetRequired,
              'Replication history requires reset',
            );

          consumed = change.revision;
          documents.delete(change.entryId);
          documents.set(change.entryId, change.document as unknown as ServerEntry);
        }

        if (consumed < library.revision && changes.length < input.limit)
          throw new ApiException(
            409,
            ApiErrorCode.SyncResetRequired,
            'Replication history requires reset',
          );

        return {
          schemaVersion: 1,
          documents: [...documents.values()],
          checkpoint: {
            cursor: consumed.toString(),
            entryId: changes.at(-1)?.entryId ?? input.checkpoint?.entryId ?? null,
          },
          hasMore: consumed < library.revision,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Applies one replicated state through the same lock, claims and publication as manual writes. */
  async pushRow(ownerId: string, row: ReplicationRow): Promise<Conflict | null> {
    const { proposed, assumedMaster } = row;

    if (
      assumedMaster &&
      (assumedMaster.entryId !== proposed.entryId || !assumedMaster.serverVersion)
    )
      throw new MutationError(ApiErrorCode.ValidationError, {
        path: ['assumedMaster'],
        message: 'The saved server version does not match this entry.',
      });

    try {
      return await this.transaction(ownerId, async (tx) => {
        const stored = await tx.libraryEntry.findUnique({ where: { id: proposed.entryId } });
        const current =
          stored?.ownerId === ownerId ? (stored.document as unknown as ServerEntry) : null;

        if (stored && !current)
          return {
            entryId: proposed.entryId,
            reason: ConflictReason.Identity,
            serverDocument: null,
          };

        const fields: EntryPatch = {
          category: proposed.category,
          userTitle: proposed.userTitle,
          status: proposed.status,
          rating: proposed.rating,
          progress: proposed.progress,
          comment: proposed.comment,
          sourceUrls: proposed.sources.map((source) => source.originalUrl),
        };
        const normalized = patchDocument(
          current ?? {
            ...proposed,
            serverVersion: '0',
          },
          fields,
        );

        if (
          !isDeepStrictEqual(
            normalized.sources,
            proposed.sources.map((source) => ({
              originalUrl: source.originalUrl,
              normalizedUrl: source.normalizedUrl,
              policyVersion: source.policyVersion,
            })),
          )
        )
          throw new MutationError(ApiErrorCode.ValidationError, {
            path: ['proposed', 'sources'],
            message: 'The source links do not match the server URL format.',
          });

        // An acknowledged write may have lost its response. Compare mutable state before
        // rejecting its now-stale assumption, excluding server-owned timestamps and version.
        const same =
          current &&
          isDeepStrictEqual(
            {
              ...normalized,
              catalogId: proposed.catalogId,
              snapshot: proposed.snapshot,
              deleted: proposed.deleted,
            },
            current,
          );

        if (same) return null;

        if ((current?.serverVersion ?? null) !== (assumedMaster?.serverVersion ?? null))
          return {
            entryId: proposed.entryId,
            reason: ConflictReason.Version,
            serverDocument: current,
          };

        if (
          current &&
          ((current.catalogId !== null && current.catalogId !== proposed.catalogId) ||
            current.createdAt !== proposed.createdAt)
        )
          throw new MutationError(ApiErrorCode.ValidationError, {
            path: ['proposed', 'catalogId'],
            message: 'The catalog identity or creation time cannot change.',
          });

        await this.checkCatalog(tx, proposed.catalogId, proposed.category, ['proposed']);
        const catalog = proposed.catalogId
          ? await tx.catalogItem.findUnique({ where: { id: proposed.catalogId } })
          : null;
        const snapshot =
          current && current.catalogId === proposed.catalogId
            ? current.snapshot
            : mergeCatalogSnapshots(
                current?.snapshot ?? emptySnapshot(),
                (catalog?.snapshot as unknown as Snapshot | undefined) ?? emptySnapshot(),
              );
        // Snapshots are server-owned. Store the authoritative copy instead of rejecting a
        // stale client copy: a rejection cannot be resolved by keeping the device edit, and
        // the client receives the stored snapshot on its next pull.
        const now = new Date(
          Math.max(Date.now(), Date.parse(current?.updatedAt ?? '1970-01-01')),
        ).toISOString();
        const document: ServerEntry = {
          ...normalized,
          catalogId: proposed.catalogId,
          snapshot,
          deleted: proposed.deleted,
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        };

        validateEntry(document, ['proposed']);
        await this.releaseSources(tx, ownerId, document);
        await this.publish(tx, ownerId, document, !current);

        return null;
      });
    } catch (error) {
      if (!(error instanceof MutationError) || error.code !== ApiErrorCode.Conflict) throw error;

      const current = await this.database.libraryEntry.findFirst({
        where: { ownerId, id: proposed.entryId },
      });

      return {
        entryId: proposed.entryId,
        reason: proposed.catalogId ? ConflictReason.Identity : ConflictReason.Source,
        serverDocument: current ? (current.document as unknown as ServerEntry) : null,
      };
    }
  }

  async create(ownerId: string, input: CreateEntry): Promise<ServerEntry> {
    return this.transaction(ownerId, async (tx) => {
      if (await tx.libraryEntry.findUnique({ where: { id: input.entryId } }))
        throw new MutationError(ApiErrorCode.Conflict);

      await this.checkCatalog(tx, input.catalogId, input.category);
      const now = new Date().toISOString();
      const entry = patchDocument(
        {
          schemaVersion: 1,
          entryId: input.entryId,
          catalogId: input.catalogId,
          category: input.category,
          snapshot: input.snapshot,
          userTitle: '',
          status: null,
          rating: 0,
          progress: 0,
          comment: '',
          sources: [],
          createdAt: now,
          updatedAt: now,
          serverVersion: '0',
          deleted: false,
        },
        input.fields,
      );
      await this.checkCatalog(tx, entry.catalogId, entry.category);
      validateEntry(entry);
      await this.releaseSources(tx, ownerId, entry);

      return this.publish(tx, ownerId, entry, true);
    });
  }

  private async checkCatalog(
    tx: Prisma.TransactionClient,
    catalogId: string | null,
    category: string,
    path: FieldPath = [],
  ): Promise<void> {
    if (catalogId === null) return;

    const catalog = await tx.catalogItem.findUnique({ where: { id: catalogId } });

    if (!catalog || catalog.category !== category)
      throw new MutationError(ApiErrorCode.ValidationError, {
        path: [...path, 'catalogId'],
        message: 'The catalog item is missing or belongs to another category.',
      });
  }

  async update(
    ownerId: string,
    entryId: string,
    expectedVersion: string,
    patch: EntryPatch,
  ): Promise<ServerEntry> {
    return this.transaction(ownerId, async (tx) => {
      const before = await this.load(tx, ownerId, entryId, expectedVersion);

      if (before.deleted) throw new MutationError(ApiErrorCode.Conflict);

      const after = patchDocument(before, patch);

      await this.checkCatalog(tx, after.catalogId, after.category);
      validateEntry(after);

      if (
        before.category === after.category &&
        before.userTitle === after.userTitle &&
        before.status === after.status &&
        before.rating === after.rating &&
        before.progress === after.progress &&
        before.comment === after.comment &&
        JSON.stringify(
          before.sources.map((source) => [
            source.originalUrl,
            source.normalizedUrl,
            source.policyVersion,
          ]),
        ) ===
          JSON.stringify(
            after.sources.map((source) => [
              source.originalUrl,
              source.normalizedUrl,
              source.policyVersion,
            ]),
          )
      )
        return before;

      await this.releaseSources(tx, ownerId, after);

      return this.publish(tx, ownerId, {
        ...after,
        updatedAt: new Date(Math.max(Date.now(), Date.parse(before.updatedAt))).toISOString(),
      });
    });
  }

  async setDeleted(
    ownerId: string,
    entryId: string,
    expectedVersion: string,
    deleted: boolean,
  ): Promise<ServerEntry> {
    return this.transaction(ownerId, async (tx) => {
      const before = await this.load(tx, ownerId, entryId, expectedVersion);

      if (before.deleted === deleted) return before;

      return this.publish(tx, ownerId, {
        ...before,
        deleted,
        updatedAt: new Date(Math.max(Date.now(), Date.parse(before.updatedAt))).toISOString(),
      });
    });
  }

  async snapshot(ownerId: string): Promise<OwnerSnapshot> {
    return this.database.$transaction(
      async (tx) => {
        const library = await tx.userLibrary.findUnique({ where: { ownerId } });

        if (!library) throw new MutationError(ApiErrorCode.NotFound);

        const rows = await tx.libraryEntry.findMany({
          where: { ownerId, deleted: false },
          orderBy: { id: 'asc' },
        });

        return {
          schemaVersion: 1,
          revision: library.revision.toString(),
          entries: rows.map((row) => row.document as unknown as ServerEntry),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async get(ownerId: string, entryId: string): Promise<ServerEntry> {
    const entry = await this.database.libraryEntry.findFirst({
      where: { id: entryId, ownerId, deleted: false },
    });

    if (!entry) throw new MutationError(ApiErrorCode.NotFound);

    return entry.document as unknown as ServerEntry;
  }

  async previewMerge(ownerId: string, input: MergeEntriesRequest): Promise<LibraryMutationPreview> {
    return this.transaction(ownerId, async (tx) => {
      const survivor = await this.load(tx, ownerId, input.survivorId, input.survivorVersion);
      const removed = await this.load(tx, ownerId, input.removedId, input.removedVersion);
      const proposed = proposeMerge(survivor, removed, input.fields);
      await this.checkCatalog(tx, proposed[0].catalogId, proposed[0].category);

      if (!this.previews) throw new MutationError(ApiErrorCode.Conflict);

      return this.previews.create(ownerId, 'merge', input, [survivor, removed], proposed);
    });
  }

  /** Previews or commits an association using canonical metadata and owner-locked versions. */
  async associate(
    ownerId: string,
    input: CatalogAssociationRequest,
    previewToken?: string,
  ): Promise<LibraryMutationPreview | ServerEntry[]> {
    return this.transaction(ownerId, async (tx) => {
      if (!this.previews || Boolean(input.mergeEntryId) !== Boolean(input.mergeExpectedVersion))
        throw new MutationError(ApiErrorCode.Conflict);

      const current = await this.load(tx, ownerId, input.entryId, input.expectedVersion);
      const other = input.mergeEntryId
        ? await this.load(tx, ownerId, input.mergeEntryId, input.mergeExpectedVersion!)
        : undefined;
      const catalog = await tx.catalogItem.findUnique({ where: { id: input.catalogId } });

      if (!catalog) throw new MutationError(ApiErrorCode.NotFound);

      const claimed = await tx.libraryEntry.findFirst({
        where: { ownerId, catalogId: input.catalogId, deleted: false, id: { not: input.entryId } },
      });

      if (claimed && claimed.id !== input.mergeEntryId)
        throw new MutationError(ApiErrorCode.Conflict);

      let proposed;
      try {
        proposed = associateCatalog(
          current,
          {
            schemaVersion: 1,
            catalogId: catalog.id,
            category: catalog.category,
            granularity: catalog.granularity,
            snapshot: catalog.snapshot,
          } as unknown as CatalogRecord,
          other,
          input.fields,
        ) as ServerEntry[];
      } catch (error) {
        if (error instanceof CatalogAssociationConflictError)
          throw new MutationError(ApiErrorCode.Conflict);

        throw error;
      }
      proposed.forEach((entry) => validateEntry(entry));
      const before = [current, ...(other ? [other] : [])];

      if (previewToken === undefined)
        return this.previews.create(
          ownerId,
          'catalog-association',
          { input, catalog: catalog.snapshot },
          before,
          proposed,
        );

      this.previews.verify(
        previewToken,
        ownerId,
        'catalog-association',
        { input, catalog: catalog.snapshot },
        before,
      );

      if (!other && isDeepStrictEqual(current, proposed[0])) return [current];

      const updatedAt = new Date(
        Math.max(Date.now(), ...before.map((entry) => Date.parse(entry.updatedAt))),
      ).toISOString();
      const tombstone = proposed[1]
        ? await this.publish(tx, ownerId, { ...proposed[1], updatedAt })
        : undefined;
      const survivor = await this.publish(tx, ownerId, { ...proposed[0], updatedAt });

      return [survivor, ...(tombstone ? [tombstone] : [])];
    });
  }

  async merge(
    ownerId: string,
    survivorId: string,
    survivorVersion: string,
    removedId: string,
    removedVersion: string,
    fields: EntryPatch,
    previewToken?: string,
  ): Promise<ServerEntry[]> {
    return this.transaction(ownerId, async (tx) => {
      const survivor = await this.load(tx, ownerId, survivorId, survivorVersion);
      const removed = await this.load(tx, ownerId, removedId, removedVersion);
      const [merged, removedEntry] = proposeMerge(survivor, removed, fields);
      await this.checkCatalog(tx, merged.catalogId, merged.category);

      if (previewToken !== undefined) {
        if (!this.previews) throw new MutationError(ApiErrorCode.Conflict);

        this.previews.verify(
          previewToken,
          ownerId,
          'merge',
          { survivorId, survivorVersion, removedId, removedVersion, fields },
          [survivor, removed],
        );
      }

      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(survivor.updatedAt), Date.parse(removed.updatedAt)),
      ).toISOString();
      const tombstone = await this.publish(tx, ownerId, { ...removedEntry, updatedAt });
      const saved = await this.publish(tx, ownerId, { ...merged, updatedAt });

      return [saved, tombstone];
    });
  }
}
