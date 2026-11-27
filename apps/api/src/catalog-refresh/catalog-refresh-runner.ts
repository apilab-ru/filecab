import {
  ApiErrorCode,
  CatalogRefreshJobState,
  CatalogRefreshOutcome,
  Locale,
  type CatalogRefreshJob,
  type CatalogRefreshStatus,
} from '@filecab/contracts';
import * as Sentry from '@sentry/nestjs';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CatalogSearchService } from '../catalog/catalog-search.service';
import {
  itemFailure,
  MAX_PROVIDER_PAUSES,
  PROVIDER_PACE_MS,
  providerPause,
  sleep,
} from '../catalog/provider-pause';
import type { CatalogRefreshJob as JobRow, PrismaClient } from '../generated/prisma/client';
import { ApiException } from '../http/api-error';
import type { LibraryMutationService } from '../library/mutation.service';
import { MutationError } from '../library/proposals';

/** A job lock lasts 2 minutes. Each item extends it. */
const LOCK_MS = 2 * 60 * 1000;

/** A claim handles at most this many catalog items, so other jobs can run in between. */
const BATCH = 25;

/** A UUID lower than every catalog item ID. A new job starts after it. */
const FIRST_CURSOR = '00000000-0000-0000-0000-000000000000';

/** Names the stored provider identity that a refresh job reads again. */
interface RefreshTarget {
  namespace: string;
  entity: string;
  /** The locale of the detail request. It changes only the order of the localized titles. */
  locale: Locale;
}

/** The providers that have a detail refresh job. */
export const CATALOG_REFRESH_TARGETS: Readonly<Record<string, RefreshTarget>> = {
  smotret: { namespace: 'smotret', entity: 'series', locale: Locale.Ru },
};

/** Holds one stored catalog item that the job reads again. */
interface RefreshCandidate {
  catalogId: string;
  externalId: string;
}

/** Converts a stored job to its public model. `now` is the database time. */
function toJob(row: JobRow, now: Date): CatalogRefreshJob {
  return {
    jobId: row.id,
    provider: row.provider,
    state: row.state as CatalogRefreshJobState,
    counts: row.counts as CatalogRefreshJob['counts'],
    entries: row.entries,
    resumeAt:
      row.state === CatalogRefreshJobState.Queued && row.runAfter.getTime() > now.getTime()
        ? row.runAfter.toISOString()
        : null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

/**
 * Reports one catalog item that the job could not refresh as a warning. The Sentry sanitizer
 * replaces exception values with the `api_error` message, so the item and the reason go into
 * that message and context.
 */
function reportItemFailure(
  job: { id: string; provider: string },
  candidate: RefreshCandidate,
  error: ApiException | MutationError,
): void {
  const reason =
    error instanceof ApiException
      ? {
          code: error.code,
          status: error.httpStatus,
          message: error.safeMessage,
          // Sentry cuts nested arrays from a context, so the issues go as one line.
          issues: (error.issues ?? [])
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        }
      : { code: error.code, status: 409, message: 'Library entry refresh failed', issues: '' };

  Sentry.withScope((scope) => {
    scope.setLevel('warning');
    scope.setTag('api_error_code', 'catalog-refresh-item-failed');
    scope.setTag('provider', job.provider);
    scope.setTag('item_id', candidate.externalId);
    scope.setTag('reason', reason.code);
    scope.setContext('api_error', {
      code: 'catalog-refresh-item-failed',
      status: reason.status,
      message: `Catalog refresh skipped ${job.provider} item ${candidate.externalId}: ${reason.message}`,
      jobId: job.id,
      provider: job.provider,
      itemId: candidate.externalId,
      catalogId: candidate.catalogId,
      reason,
    });

    if (error instanceof ApiException && error.providerDiagnostic)
      scope.setContext('provider_failure', { ...error.providerDiagnostic });

    Sentry.captureException(error);
  });
}

/**
 * Reads the provider details of stored catalog items again and updates the library entries
 * that link to them. The job selects items without a description or with incomplete episode
 * counts. A job starts at the configured interval or on an operator request. Several instances
 * can run; claims never overlap.
 */
export class CatalogRefreshRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly database: PrismaClient,
    private readonly catalog: CatalogSearchService,
    private readonly mutations: LibraryMutationService,
    private readonly intervalMs: number,
    private readonly pollMs: number | null = null,
    private readonly pace: (provider: string) => number = (provider) =>
      PROVIDER_PACE_MS[provider] ?? 0,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.pollMs || this.timer) return;

    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);

    this.timer = null;
  }

  /** Returns the latest job of a provider. */
  async status(provider: string): Promise<CatalogRefreshStatus> {
    const row = await this.database.catalogRefreshJob.findFirst({
      where: { provider },
      orderBy: { createdAt: 'desc' },
    });

    // Database time drives claims, so the wait ends by database time as well.
    const [{ now }] = await this.database.$queryRaw<Array<{ now: Date }>>`SELECT now() AS "now"`;

    return { schemaVersion: 1, job: row ? toJob(row, now) : null };
  }

  /**
   * Starts a job of a provider at once. An active job stays, and the route returns it. A queued
   * job runs at once, also when it waits for the provider.
   */
  async start(provider: string): Promise<CatalogRefreshStatus> {
    if (!this.supports(provider))
      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Provider details are unavailable',
        true,
      );

    await this.enqueue(provider, null);
    await this.database.$executeRaw`
      UPDATE "CatalogRefreshJob"
      SET "runAfter" = now()
      WHERE "provider" = ${provider} AND "state" = 'queued' AND "runAfter" > now()`;

    if (this.timer) setImmediate(() => void this.tick());

    return this.status(provider);
  }

  /** Starts the jobs that are due, then runs ready jobs. Reports failures; never rejects. */
  async tick(): Promise<void> {
    try {
      for (const provider of Object.keys(CATALOG_REFRESH_TARGETS))
        if (this.supports(provider)) await this.enqueue(provider, this.intervalMs);

      await this.drain();
    } catch (error) {
      // The next poll tries again, so a database outage does not end the poll.
      Sentry.captureException(error);
    }
  }

  /** Runs batches until no job is ready. Overlapping calls return at once. */
  async drain(): Promise<void> {
    if (this.running) return;

    this.running = true;
    try {
      while (await this.runOnce());
    } finally {
      this.running = false;
    }
  }

  /** Claims one ready job, or a running job with an expired lock, and runs one batch. */
  async runOnce(): Promise<boolean> {
    const claimed = await this.database.$queryRaw<Array<{ id: string }>>`
      UPDATE "CatalogRefreshJob"
      SET "state" = 'running',
        "lockedUntil" = now() + ${LOCK_MS} * interval '1 millisecond'
      WHERE "id" = (
        SELECT "id" FROM "CatalogRefreshJob"
        WHERE ("state" = 'queued' AND "runAfter" <= now())
          OR ("state" = 'running' AND "lockedUntil" < now())
        ORDER BY "runAfter"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"`;
    const id = claimed[0]?.id;

    if (!id) return false;

    const job = await this.database.catalogRefreshJob.findUniqueOrThrow({ where: { id } });
    const target = CATALOG_REFRESH_TARGETS[job.provider];

    if (!target || !this.supports(job.provider)) {
      await this.finish(job.id, CatalogRefreshJobState.Failed);

      return true;
    }

    await this.batch(job, target);

    return true;
  }

  /** Tells whether the provider has a refresh target and an active details operation. */
  private supports(provider: string): boolean {
    return (
      provider in CATALOG_REFRESH_TARGETS &&
      this.catalog
        .capabilities()
        .providers.some(
          (capability) =>
            capability.provider === provider && capability.operations.includes('details'),
        )
    );
  }

  /**
   * Adds a queued job of a provider when no job is active. With an interval, it adds the job
   * only when the last job started before the interval.
   */
  private async enqueue(provider: string, intervalMs: number | null): Promise<void> {
    await this.database.$executeRaw`
      INSERT INTO "CatalogRefreshJob" ("id", "provider", "state", "counts")
      SELECT ${randomUUID()}::uuid, ${provider}, 'queued', '{}'::jsonb
      WHERE ${intervalMs}::bigint IS NULL OR NOT EXISTS (
        SELECT 1 FROM "CatalogRefreshJob"
        WHERE "provider" = ${provider}
          AND "createdAt" > now() - ${intervalMs ?? 0} * interval '1 millisecond'
      )
      ON CONFLICT ("provider") WHERE "state" IN ('queued', 'running') DO NOTHING`;
  }

  /**
   * Selects the next stored items of the provider in ID order: items without a description,
   * with an unknown episode total or count, or with fewer available episodes than declared.
   */
  private candidates(cursor: string, target: RefreshTarget): Promise<RefreshCandidate[]> {
    return this.database.$queryRaw<RefreshCandidate[]>`
      SELECT DISTINCT ON (r."catalogId") r."catalogId", r."externalId"
      FROM "CatalogReference" r
      JOIN "CatalogItem" c ON c."id" = r."catalogId"
      WHERE r."namespace" = ${target.namespace}
        AND r."entity" = ${target.entity}
        AND r."catalogId" > ${cursor}::uuid
        AND (
          jsonb_array_length(COALESCE(c."snapshot" -> 'descriptions', '[]'::jsonb)) = 0
          OR c."snapshot" ->> 'episodeCount' IS NULL
          OR c."snapshot" ->> 'availableEpisodeCount' IS NULL
          OR (c."snapshot" ->> 'availableEpisodeCount')::numeric
            < (c."snapshot" ->> 'episodeCount')::numeric
        )
      ORDER BY r."catalogId", r."externalId"
      LIMIT ${BATCH}`;
  }

  /** Refreshes up to one batch of items, then requeues, pauses or finishes the job. */
  private async batch(job: JobRow, target: RefreshTarget): Promise<void> {
    const counts = { ...(job.counts as CatalogRefreshJob['counts']) };
    let cursor = job.cursor ?? FIRST_CURSOR;
    let entries = job.entries;
    const candidates = await this.candidates(cursor, target);

    for (const candidate of candidates) {
      await this.database.$executeRaw`
        UPDATE "CatalogRefreshJob"
        SET "lockedUntil" = now() + ${LOCK_MS} * interval '1 millisecond'
        WHERE "id" = ${job.id}::uuid`;

      let outcome: CatalogRefreshOutcome;
      try {
        const record = await this.catalog.details(
          job.provider,
          candidate.externalId,
          target.locale,
        );
        entries += await this.mutations.refreshCatalogEntries(record.catalogId);
        outcome = CatalogRefreshOutcome.Refreshed;
      } catch (error) {
        const pause = providerPause(error, job.pauses);

        if (pause) {
          await this.wait(job, { cursor, counts, entries }, pause.delayMs);

          return;
        }

        if (!itemFailure(error) && !(error instanceof MutationError)) throw error;

        reportItemFailure(job, candidate, error);
        outcome = CatalogRefreshOutcome.Failed;
      }

      counts[outcome] = (counts[outcome] ?? 0) + 1;
      cursor = candidate.catalogId;
      await this.database.catalogRefreshJob.update({
        where: { id: job.id },
        data: { cursor, counts, entries },
      });
      await sleep(this.pace(job.provider));
    }

    if (candidates.length < BATCH) {
      await this.finish(job.id, CatalogRefreshJobState.Succeeded);

      return;
    }

    // Other jobs can run before the next batch.
    await this.database.$executeRaw`
      UPDATE "CatalogRefreshJob"
      SET "state" = 'queued', "lockedUntil" = NULL, "runAfter" = now()
      WHERE "id" = ${job.id}::uuid`;
  }

  /** Saves the progress and waits for the provider, or fails the job after too many waits. */
  private async wait(
    job: JobRow,
    progress: { cursor: string; counts: CatalogRefreshJob['counts']; entries: number },
    delayMs: number,
  ): Promise<void> {
    const pauses = job.pauses + 1;

    if (pauses > MAX_PROVIDER_PAUSES) {
      await this.database.catalogRefreshJob.update({
        where: { id: job.id },
        data: { ...progress, pauses },
      });
      await this.finish(job.id, CatalogRefreshJobState.Failed);

      return;
    }

    await this.database.catalogRefreshJob.update({
      where: { id: job.id },
      data: { ...progress, pauses },
    });
    // Database time drives claims, so compute the next run in SQL as well.
    await this.database.$executeRaw`
      UPDATE "CatalogRefreshJob"
      SET "state" = 'queued', "lockedUntil" = NULL,
        "runAfter" = now() + ${delayMs} * interval '1 millisecond'
      WHERE "id" = ${job.id}::uuid`;
  }

  /** Ends a job. */
  private async finish(id: string, state: CatalogRefreshJobState): Promise<void> {
    await this.database.catalogRefreshJob.update({
      where: { id },
      data: { state, finishedAt: new Date(), lockedUntil: null },
    });
  }
}
