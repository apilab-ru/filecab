import {
  ApiErrorCode,
  CatalogMatchJobState,
  CatalogMatchOutcome,
  CatalogMatchPause,
  catalogMatchTitle,
  Locale,
  matchCatalogRecord,
  userTitleRepeatsCatalog,
  type CatalogMatchItem,
  type CatalogRecord,
  type LibraryMutationPreview,
  type ServerEntry,
} from '@filecab/contracts';
import * as Sentry from '@sentry/nestjs';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import {
  CATALOG_DEFAULT_PROVIDERS,
  type CatalogSearchService,
} from '../catalog/catalog-search.service';
import {
  itemFailure,
  MAX_PROVIDER_PAUSES,
  PROVIDER_PACE_MS,
  providerPause,
  ProviderPause,
  sleep,
} from '../catalog/provider-pause';
import type { PrismaClient } from '../generated/prisma/client';
import { ApiException } from '../http/api-error';
import type { LibraryMutationService } from '../library/mutation.service';
import { MutationError } from '../library/proposals';

/** A job lock lasts 2 minutes. Each entry extends it. */
const LOCK_MS = 2 * 60 * 1000;

/** A claim handles at most this many entries, so jobs of other accounts can run in between. */
const BATCH = 25;

/** The job keeps at most this many unlinked entries in its report. */
const MAX_ITEMS = 500;

/** Entries that a device has not synced yet are awaited for 10 minutes after the start. */
const SYNC_GRACE_MS = 10 * 60 * 1000;

/** A job checks again for unsynced entries after 30 seconds. */
const SYNC_WAIT_MS = 30 * 1000;

/** Pauses the job until a device syncs its entries. */
class SyncPause extends Error {
  constructor() {
    super('Sync pause');
  }
}

/**
 * Reports a provider response that failed the schema as a warning. The entry fails and the
 * job continues.
 */
function reportInvalidResponse(job: { id: string; provider: string }, error: ApiException): void {
  if (error.code !== ApiErrorCode.InvalidResponse) return;

  Sentry.withScope((scope) => {
    scope.setLevel('warning');
    scope.setTag('api_error_code', 'catalog-match-invalid-response');
    scope.setTag('provider', job.provider);
    scope.setContext('api_error', {
      code: 'catalog-match-invalid-response',
      status: error.httpStatus,
      message: `Catalog data job skipped an entry: ${error.safeMessage}`,
      jobId: job.id,
    });

    if (error.providerDiagnostic)
      scope.setContext('provider_failure', { ...error.providerDiagnostic });

    Sentry.captureException(error);
  });
}

/** Selects the search language from the script of the title. */
function titleLocale(title: string): Locale {
  return /[а-яё]/i.test(title) ? Locale.Ru : Locale.En;
}

/** Holds a claimed job while it runs. */
interface ClaimedJob {
  id: string;
  ownerId: string;
  provider: string;
  entryIds: string[];
  cursor: number;
  counts: Partial<Record<CatalogMatchOutcome, number>>;
  items: CatalogMatchItem[];
  pauses: number;
  /** When entries last joined the job. */
  enqueuedAt: Date;
}

/**
 * Finds catalog data for entries without a catalog item. Each job uses one provider, and jobs
 * take turns by batch, so a paused or failed provider does not stop another provider. Only
 * exact matches link: a resolved reference, or exactly one search result with the same title
 * (and year, when the entry has one). Linking uses the ordinary catalog association with its
 * version and claim checks. Several instances can run; claims never overlap.
 */
export class CatalogMatchRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly database: PrismaClient,
    private readonly catalog: CatalogSearchService,
    private readonly mutations: LibraryMutationService,
    private readonly pollMs: number | null = null,
    private readonly pace: (provider: string) => number = (provider) =>
      PROVIDER_PACE_MS[provider] ?? 0,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.pollMs || this.timer) return;

    this.timer = setInterval(() => void this.drain(), this.pollMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);

    this.timer = null;
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
      UPDATE "CatalogMatchJob"
      SET "state" = 'running', "pause" = NULL,
        "lockedUntil" = now() + ${LOCK_MS} * interval '1 millisecond'
      WHERE "id" = (
        SELECT "id" FROM "CatalogMatchJob"
        WHERE ("state" = 'queued' AND "runAfter" <= now())
          OR ("state" = 'running' AND "lockedUntil" < now())
        ORDER BY "runAfter"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"`;
    const id = claimed[0]?.id;

    if (!id) return false;

    const row = await this.database.catalogMatchJob.findUniqueOrThrow({ where: { id } });
    const job: ClaimedJob = {
      id,
      ownerId: row.ownerId,
      provider: row.provider,
      entryIds: row.entryIds as string[],
      cursor: row.cursor,
      counts: row.counts as ClaimedJob['counts'],
      items: row.items as unknown as CatalogMatchItem[],
      pauses: row.pauses,
      enqueuedAt: row.enqueuedAt,
    };

    try {
      await this.batch(job);
    } catch (error) {
      if (error instanceof ProviderPause)
        await this.wait(job, CatalogMatchPause.ProviderLimit, error.delayMs);
      else if (error instanceof SyncPause)
        await this.wait(job, CatalogMatchPause.WaitingSync, SYNC_WAIT_MS);
      else await this.fail(job, error);
    }

    return true;
  }

  /** Handles up to one batch of entries, then requeues or finishes the job. */
  private async batch(job: ClaimedJob): Promise<void> {
    const end = Math.min(job.entryIds.length, job.cursor + BATCH);

    while (job.cursor < end) {
      if (!(await this.stillRunning(job))) return;

      const entryId = job.entryIds[job.cursor]!;
      const result = await this.handle(job, entryId);
      this.record(job, result);
      job.cursor += 1;
      await this.save(job, {});
    }

    // Entries can join while the batch runs, so the database list decides the end.
    await this.database.$executeRaw`
      UPDATE "CatalogMatchJob"
      SET "state" = CASE WHEN jsonb_array_length("entryIds") > "cursor"
          THEN 'queued' ELSE 'succeeded' END,
        "finishedAt" = CASE WHEN jsonb_array_length("entryIds") > "cursor"
          THEN NULL ELSE now() END,
        "lockedUntil" = NULL, "runAfter" = now()
      WHERE "id" = ${job.id}::uuid AND "state" = 'running'`;
  }

  /** Returns false when the owner stopped the job. */
  private async stillRunning(job: ClaimedJob): Promise<boolean> {
    const row = await this.database.catalogMatchJob.findUnique({
      where: { id: job.id },
      select: { state: true },
    });

    return row?.state === CatalogMatchJobState.Running;
  }

  /** Counts an outcome and keeps unlinked entries for the report. */
  private record(
    job: ClaimedJob,
    result: { outcome: CatalogMatchOutcome; entryId: string; title: string },
  ): void {
    job.counts[result.outcome] = (job.counts[result.outcome] ?? 0) + 1;

    if (result.outcome !== CatalogMatchOutcome.Linked && job.items.length < MAX_ITEMS)
      job.items.push(result);
  }

  /** Writes the progress of a running job and extends its lock. */
  private async save(
    job: ClaimedJob,
    data: {
      state?: CatalogMatchJobState;
      finishedAt?: Date;
      lockedUntil?: Date | null;
      runAfter?: Date;
    },
  ): Promise<void> {
    await this.database.catalogMatchJob.updateMany({
      where: { id: job.id, state: CatalogMatchJobState.Running },
      data: {
        cursor: job.cursor,
        counts: job.counts,
        items: job.items as object[],
        pauses: job.pauses,
        lockedUntil: new Date(Date.now() + LOCK_MS),
        ...data,
      },
    });
  }

  /** Requeues a job that waits for a provider or for device sync. The cursor stays. */
  private async wait(job: ClaimedJob, pause: CatalogMatchPause, delayMs: number): Promise<void> {
    if (pause === CatalogMatchPause.ProviderLimit) job.pauses += 1;

    if (job.pauses > MAX_PROVIDER_PAUSES) {
      await this.fail(job, new Error('Provider limit did not end'));

      return;
    }

    // Database time drives claims, so compute the next run in SQL as well.
    await this.database.$executeRaw`
      UPDATE "CatalogMatchJob"
      SET "state" = 'queued', "pause" = ${pause}, "pauses" = ${job.pauses},
        "lockedUntil" = NULL, "runAfter" = now() + ${delayMs} * interval '1 millisecond'
      WHERE "id" = ${job.id}::uuid AND "state" = 'running'`;
  }

  /**
   * Ends a job after an unexpected failure and reports it. The event keeps the original error.
   * The Sentry sanitizer replaces exception values with the `api_error` message, so the safe
   * message and code of an API error go into that message and context, and a provider failure
   * adds its diagnostic.
   */
  private async fail(job: ClaimedJob, error: unknown): Promise<void> {
    Sentry.withScope((scope) => {
      const cause =
        error instanceof ApiException
          ? { code: error.code, status: error.httpStatus, message: error.safeMessage }
          : undefined;
      scope.setTag('api_error_code', 'catalog-match-failed');
      scope.setContext('api_error', {
        code: 'catalog-match-failed',
        status: 500,
        message: cause ? `Catalog data job failed: ${cause.message}` : 'Catalog data job failed',
        jobId: job.id,
        provider: job.provider,
        cursor: job.cursor,
        ...(cause ? { cause } : {}),
      });

      if (error instanceof ApiException && error.providerDiagnostic) {
        scope.setContext('provider_failure', { ...error.providerDiagnostic });
        scope.setTag('provider', error.providerDiagnostic.provider);
      }

      Sentry.captureException(error);
    });
    await this.save(job, {
      state: CatalogMatchJobState.Failed,
      finishedAt: new Date(),
      lockedUntil: null,
    });
  }

  /** Finds and links the catalog item of one entry. */
  private async handle(
    job: ClaimedJob,
    entryId: string,
  ): Promise<{ outcome: CatalogMatchOutcome; entryId: string; title: string }> {
    const row = await this.database.libraryEntry.findFirst({
      where: { id: entryId, ownerId: job.ownerId },
    });

    if (!row) {
      // A device import reaches the server through sync. Wait for it for a short time.
      if (Date.now() - job.enqueuedAt.getTime() < SYNC_GRACE_MS) throw new SyncPause();

      return { outcome: CatalogMatchOutcome.Skipped, entryId, title: '' };
    }

    const entry = row.document as unknown as ServerEntry;
    const title = catalogMatchTitle(entry);
    const result = (outcome: CatalogMatchOutcome) => ({ outcome, entryId, title });

    if (entry.deleted || entry.catalogId) return result(CatalogMatchOutcome.Skipped);

    const provider = CATALOG_DEFAULT_PROVIDERS[entry.category];

    // The category changed after the entry joined, so another provider job is responsible.
    if (provider !== job.provider) return result(CatalogMatchOutcome.Skipped);

    const capability = this.catalog
      .capabilities()
      .providers.find((candidate) => candidate.provider === provider);

    if (!capability) return result(CatalogMatchOutcome.Failed);

    let record: CatalogRecord | null = null;

    // A reference identifies the title exactly. Unknown references fall back to the title.
    for (const reference of entry.snapshot.references) {
      if (!capability.referenceNamespaces.includes(reference.namespace)) continue;

      try {
        record = await this.provider(job, provider, () =>
          this.catalog.resolveReference(
            reference.namespace,
            reference.entity,
            reference.id,
            titleLocale(title),
          ),
        );
        break;
      } catch (error) {
        if (error instanceof ProviderPause) throw error;

        // An unknown or unreadable reference falls back to the title search.
        if (itemFailure(error)) {
          reportInvalidResponse(job, error);
          continue;
        }

        throw error;
      }
    }

    if (!record) {
      if (!title) return result(CatalogMatchOutcome.NotFound);

      let response;
      try {
        response = await this.provider(job, provider, () =>
          this.catalog.search({
            category: entry.category,
            provider,
            query: title.slice(0, 200),
            locale: titleLocale(title),
            page: 1,
            pageSize: 20,
          }),
        );
      } catch (error) {
        if (itemFailure(error)) {
          reportInvalidResponse(job, error);

          return result(CatalogMatchOutcome.Failed);
        }

        throw error;
      }

      const match = matchCatalogRecord(entry, response.results);

      if (match.outcome !== CatalogMatchOutcome.Linked) return result(match.outcome);

      record = match.record;
    }

    return result(await this.link(job.ownerId, entry, record));
  }

  /** Calls a provider, converts limits to a pause and keeps the pace. */
  private async provider<T>(
    job: ClaimedJob,
    provider: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw providerPause(error, job.pauses) ?? error;
    } finally {
      await sleep(this.pace(provider));
    }
  }

  /**
   * Links an entry through the ordinary preview and confirmation. A user title that only
   * repeats a catalog title is cleared, so the catalog shows the title in each language.
   */
  private async link(
    ownerId: string,
    entry: ServerEntry,
    record: CatalogRecord,
  ): Promise<CatalogMatchOutcome> {
    const input = {
      entryId: entry.entryId,
      expectedVersion: entry.serverVersion,
      catalogId: record.catalogId,
      fields: userTitleRepeatsCatalog(entry, record) ? { userTitle: '' } : {},
    };

    try {
      const preview = (await this.mutations.associate(ownerId, input)) as LibraryMutationPreview;
      await this.mutations.associate(ownerId, input, preview.previewToken);

      return CatalogMatchOutcome.Linked;
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;

      const claimed = await this.database.libraryEntry.findFirst({
        where: { ownerId, catalogId: record.catalogId, deleted: false, id: { not: entry.entryId } },
        select: { id: true },
      });

      return claimed ? CatalogMatchOutcome.Duplicate : CatalogMatchOutcome.Skipped;
    }
  }
}
