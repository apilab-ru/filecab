import { createHash } from 'node:crypto';
import type { EntryPatch, ServerEntry, Snapshot, Category } from '@filecab/contracts';
import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { validateEntryPatchDto } from '../contracts/entry-patch.dto';

export class MutationError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR') {
    super(code);
  }
}

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

/** Applies validated user fields and computes authoritative normalized source claims. */
function patchDocument(entry: ServerEntry, patch: EntryPatch): ServerEntry {
  const { sourceUrls, ...fields } = validateEntryPatchDto(patch);

  return {
    ...entry,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    sources:
      sourceUrls === undefined
        ? entry.sources
        : sourceUrls.map((originalUrl) => ({
            originalUrl,
            normalizedUrl: new URL(originalUrl).href,
            policyVersion: 'generic-v1',
          })),
  };
}

/** Serializes every mutation for one owner until its documents and change feed commit. */
export class LibraryMutationService {
  constructor(private readonly database: PrismaClient) {}

  private async transaction<T>(
    ownerId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.$transaction(async (tx) => {
        const libraries = await tx.$queryRaw<
          Array<{ ownerId: string }>
        >`SELECT "ownerId" FROM "UserLibrary" WHERE "ownerId" = ${ownerId}::uuid FOR UPDATE`;

        if (!libraries.length) throw new MutationError('NOT_FOUND');

        return action(tx);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new MutationError('CONFLICT');

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

    if (!row) throw new MutationError('NOT_FOUND');
    const entry = row.document as unknown as ServerEntry;

    if (entry.serverVersion !== expectedVersion) throw new MutationError('CONFLICT');

    return entry;
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

  async create(ownerId: string, input: CreateEntry): Promise<ServerEntry> {
    return this.transaction(ownerId, async (tx) => {
      if (await tx.libraryEntry.findUnique({ where: { id: input.entryId } }))
        throw new MutationError('CONFLICT');
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

      return this.publish(tx, ownerId, entry, true);
    });
  }

  private async checkCatalog(
    tx: Prisma.TransactionClient,
    catalogId: string | null,
    category: string,
  ): Promise<void> {
    if (catalogId === null) return;
    const catalog = await tx.catalogItem.findUnique({ where: { id: catalogId } });

    if (!catalog || catalog.category !== category) throw new MutationError('VALIDATION_ERROR');
  }

  async update(
    ownerId: string,
    entryId: string,
    expectedVersion: string,
    patch: EntryPatch,
  ): Promise<ServerEntry> {
    return this.transaction(ownerId, async (tx) => {
      const before = await this.load(tx, ownerId, entryId, expectedVersion);

      if (before.deleted) throw new MutationError('CONFLICT');
      const after = patchDocument(before, patch);
      await this.checkCatalog(tx, after.catalogId, after.category);

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

  async reassignSource(
    ownerId: string,
    fromId: string,
    fromVersion: string,
    toId: string,
    toVersion: string,
    normalizedUrl: string,
  ): Promise<ServerEntry[]> {
    return this.transaction(ownerId, async (tx) => {
      const from = await this.load(tx, ownerId, fromId, fromVersion);
      const to = await this.load(tx, ownerId, toId, toVersion);
      const source = from.sources.find((value) => value.normalizedUrl === normalizedUrl);

      if (fromId === toId || from.deleted || to.deleted || !source)
        throw new MutationError('CONFLICT');
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(from.updatedAt), Date.parse(to.updatedAt)),
      ).toISOString();
      const first = await this.publish(tx, ownerId, {
        ...from,
        updatedAt,
        sources: from.sources.filter((value) => value !== source),
      });
      const second = await this.publish(tx, ownerId, {
        ...to,
        updatedAt,
        sources: [...to.sources, source],
      });

      return [first, second];
    });
  }

  async merge(
    ownerId: string,
    survivorId: string,
    survivorVersion: string,
    removedId: string,
    removedVersion: string,
    fields: EntryPatch,
  ): Promise<ServerEntry[]> {
    return this.transaction(ownerId, async (tx) => {
      const survivor = await this.load(tx, ownerId, survivorId, survivorVersion);
      const removed = await this.load(tx, ownerId, removedId, removedVersion);

      if (
        survivorId === removedId ||
        survivor.deleted ||
        removed.deleted ||
        survivor.category !== removed.category ||
        (survivor.catalogId && removed.catalogId && survivor.catalogId !== removed.catalogId) ||
        fields.sourceUrls !== undefined
      )
        throw new MutationError('CONFLICT');
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(survivor.updatedAt), Date.parse(removed.updatedAt)),
      ).toISOString();
      const tombstone = await this.publish(tx, ownerId, { ...removed, deleted: true, updatedAt });
      const merged = patchDocument(survivor, fields);
      merged.catalogId = survivor.catalogId ?? removed.catalogId;

      if (!survivor.catalogId && removed.catalogId) merged.snapshot = removed.snapshot;
      merged.sources = [
        ...new Map(
          [...survivor.sources, ...removed.sources].map((source) => [source.normalizedUrl, source]),
        ).values(),
      ];
      await this.checkCatalog(tx, merged.catalogId, merged.category);
      const saved = await this.publish(tx, ownerId, { ...merged, updatedAt });

      return [saved, tombstone];
    });
  }
}
