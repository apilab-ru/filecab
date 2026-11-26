import {
  ApiErrorCode,
  CATALOG_MATCH_MAX_ENTRIES,
  CatalogMatchJobState,
  type CatalogMatchItem,
  type CatalogMatchJob,
  type CatalogMatchPause,
  type CatalogMatchStatus,
  type CatalogMatchTarget,
  type Category,
  type ServerEntry,
} from '@filecab/contracts';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import { ApiException } from '../http/api-error';

/** Job states that can still change. */
const ACTIVE_STATES = [CatalogMatchJobState.Queued, CatalogMatchJobState.Running];

/** The columns of a job row that the client form needs. */
interface MatchJobRow {
  id: string;
  provider: string;
  state: string;
  entryIds: unknown;
  cursor: number;
  counts: unknown;
  items: unknown;
  pause: string | null;
  runAfter: Date;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Returns true for a Prisma unique constraint failure. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

/** Reports a job that would exceed the entry limit. */
function tooManyEntries(): ApiException {
  return new ApiException(400, ApiErrorCode.ValidationError, 'Too many entries');
}

/** Converts a job row to its client form. */
export function publicMatchJob(row: MatchJobRow): CatalogMatchJob {
  const waiting = row.state === CatalogMatchJobState.Queued && row.pause !== null;

  return {
    jobId: row.id,
    provider: row.provider,
    state: row.state as CatalogMatchJobState,
    progress: { done: row.cursor, total: (row.entryIds as string[]).length },
    counts: row.counts as CatalogMatchJob['counts'],
    items: row.items as CatalogMatchItem[],
    pause: waiting ? (row.pause as CatalogMatchPause) : null,
    resumeAt: waiting ? row.runAfter.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

/**
 * Starts, reads and stops the catalog data jobs of an account. Each provider has its own job,
 * so a provider limit or failure does not stop the entries of another provider. The runner
 * does the work.
 */
export class CatalogMatchService {
  constructor(
    private readonly database: PrismaClient,
    /** Returns the enabled default provider of a category, or null. */
    private readonly providerOf: (category: Category) => string | null,
  ) {}

  /** Returns the latest job of each provider. */
  async status(ownerId: string): Promise<CatalogMatchStatus> {
    const rows = await this.database.$queryRaw<MatchJobRow[]>`
      SELECT DISTINCT ON ("provider") "id", "provider", "state", "entryIds", "cursor", "counts",
        "items", "pause", "runAfter", "createdAt", "finishedAt"
      FROM "CatalogMatchJob"
      WHERE "ownerId" = ${ownerId}::uuid
      ORDER BY "provider", "createdAt" DESC`;

    return { schemaVersion: 1, jobs: rows.map(publicMatchJob) };
  }

  /**
   * Adds the given entries, or all active entries without a catalog item, to the job of the
   * default provider of their category. Entries of a provider with an active job join it.
   * Given entries can still be on their way from a device, so their category comes from the
   * client until the server has the entry; the runner waits for them.
   */
  async start(ownerId: string, entries?: CatalogMatchTarget[]): Promise<CatalogMatchStatus> {
    const groups = new Map<string, string[]>();
    const add = (entryId: string, category: Category) => {
      const provider = this.providerOf(category);

      if (!provider) return;

      groups.set(provider, [...(groups.get(provider) ?? []), entryId]);
    };

    if (entries) {
      const targets = new Map<string, Category>();

      for (const entry of entries)
        if (!targets.has(entry.entryId.toLowerCase()))
          targets.set(entry.entryId.toLowerCase(), entry.category);

      const rows = await this.database.libraryEntry.findMany({
        where: { ownerId, id: { in: [...targets.keys()] } },
        select: { id: true, document: true },
      });
      const known = new Map(
        rows.map((row) => [row.id, (row.document as unknown as ServerEntry).category]),
      );

      for (const [entryId, category] of targets) add(entryId, known.get(entryId) ?? category);
    } else {
      const rows = await this.database.libraryEntry.findMany({
        where: { ownerId, deleted: false, catalogId: null },
        select: { id: true, document: true },
      });

      for (const row of rows) add(row.id, (row.document as unknown as ServerEntry).category);
    }

    if ([...groups.values()].some((ids) => ids.length > CATALOG_MATCH_MAX_ENTRIES))
      throw tooManyEntries();

    for (const [provider, ids] of groups) await this.enqueue(ownerId, provider, ids);

    return this.status(ownerId);
  }

  /** Stops the active jobs. Linked entries stay linked. */
  async stop(ownerId: string): Promise<CatalogMatchStatus> {
    await this.database.catalogMatchJob.updateMany({
      where: { ownerId, state: { in: ACTIVE_STATES } },
      data: { state: CatalogMatchJobState.Cancelled, finishedAt: new Date(), lockedUntil: null },
    });

    return this.status(ownerId);
  }

  /**
   * Adds entries to the active job of a provider, or creates the job. The row lock keeps the
   * list consistent with the runner; a concurrent create is retried once.
   */
  private async enqueue(ownerId: string, provider: string, ids: string[]): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.database.$transaction(async (tx) => {
          const [active] = await tx.$queryRaw<Array<{ id: string; entryIds: string[] }>>`
            SELECT "id", "entryIds" FROM "CatalogMatchJob"
            WHERE "ownerId" = ${ownerId}::uuid AND "provider" = ${provider}
              AND "state" IN ('queued', 'running')
            FOR UPDATE`;

          if (active) {
            const known = new Set(active.entryIds);
            const added = ids.filter((id) => !known.has(id));

            if (!added.length) return;

            if (active.entryIds.length + added.length > CATALOG_MATCH_MAX_ENTRIES)
              throw tooManyEntries();

            await tx.catalogMatchJob.update({
              where: { id: active.id },
              data: { entryIds: [...active.entryIds, ...added], enqueuedAt: new Date() },
            });

            return;
          }

          await tx.catalogMatchJob.create({
            data: {
              id: randomUUID(),
              ownerId,
              provider,
              state: CatalogMatchJobState.Queued,
              entryIds: ids,
              counts: {},
              items: [],
            },
          });
        });

        return;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        if (attempt > 0)
          throw new ApiException(409, ApiErrorCode.Conflict, 'A catalog data job is starting');
      }
    }
  }
}
