import {
  Granularity,
  ListSyncErrorCode,
  ListSyncField,
  ListSyncIssue,
  ListSyncJobKind,
  ListSyncJobState,
  ListSyncOutcome,
  ListSyncState,
  type EntryPatch,
  type ListSyncChangeSelection,
  type ListSyncItemReport,
  type ListSyncJobResult,
  type ListSyncValues,
  type ServerEntry,
  type Snapshot,
} from '@filecab/contracts';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nestjs';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client';
import type { LibraryMutationService } from '../library/mutation.service';
import { MutationError } from '../library/proposals';
import type { CredentialCipher } from './credential-cipher';
import {
  ListSyncAuthorizationError,
  ListSyncProviderError,
  ListSyncUnsupportedValueError,
  referenceKey,
  type ListSyncAccount,
  type ListSyncAdapter,
  type ListSyncCredentials,
  type ListSyncReference,
  type RemoteListRecord,
} from './list-sync-adapter';
import { planExport, planImport, valuesMatch } from './list-sync-plan';
import {
  activeEntries,
  entryTitle,
  entryValues,
  indexRecords,
  json,
  providerReferences,
  type StoredAddition,
  type StoredChange,
  type StoredPreview,
} from './list-sync-store';

/** A job lock lasts 2 minutes. Progress updates extend it. */
const LOCK_MS = 2 * 60 * 1000;

/** A retryable provider failure requeues a job at most this many times. */
const MAX_ATTEMPTS = 5;

/** The first retry waits 5 seconds. Each next retry waits twice as long. */
const RETRY_BASE_MS = 5000;

/** Refresh credentials that expire within one minute before a request. */
const REFRESH_MARGIN_MS = 60 * 1000;

/** Writes progress after this many items. */
const PROGRESS_STEP = 10;

/** Stops a job with a final error code. */
class JobStop extends Error {
  constructor(readonly code: ListSyncErrorCode) {
    super(code);
  }
}

/**
 * Reports a job failure to Sentry. The sanitizer keeps only the safe message and the stack,
 * so titles, tokens and provider responses never leave the API.
 */
function reportJobFailure(
  error: unknown,
  job: { provider: string | null; kind: ListSyncJobKind | null },
  code: ListSyncErrorCode | ListSyncIssue,
): void {
  Sentry.withScope((scope) => {
    scope.setTag('list_sync_provider', job.provider ?? 'unknown');
    scope.setTag('list_sync_job', job.kind ?? 'unknown');
    scope.setTag('api_error_code', code);
    scope.setContext('api_error', {
      code,
      status: 500,
      message: `List sync ${job.kind ?? 'job'} failed: ${code}`,
    });
    Sentry.captureException(error);
  });
}

/** Holds the claimed job, its connection and the decrypted credentials. */
interface JobContext {
  jobId: string;
  connectionId: string;
  ownerId: string;
  generation: number;
  adapter: ListSyncAdapter;
  account: ListSyncAccount;
  fields: ListSyncField[];
  credentials: ListSyncCredentials;
  refreshToken: string | null;
}

/** The input of an import apply job. */
interface ApplyInput {
  previewJobId: string;
  additions: string[];
  changes: ListSyncChangeSelection[];
}

/** Counts outcomes and keeps the skipped and failed items. */
class Report {
  private readonly counts: Partial<Record<ListSyncOutcome, number>> = {};
  private readonly items: ListSyncItemReport[] = [];

  add(outcome: ListSyncOutcome, title: string, entryId: string | null, issue?: ListSyncIssue) {
    this.counts[outcome] = (this.counts[outcome] ?? 0) + 1;

    if (outcome === ListSyncOutcome.Skipped || outcome === ListSyncOutcome.Failed)
      this.items.push({ title, entryId, outcome, issue: issue ?? null });
  }

  /** Returns true when an item already has the issue. */
  has(issue: ListSyncIssue): boolean {
    return this.items.some((item) => item.issue === issue);
  }

  result(): ListSyncJobResult {
    return { counts: this.counts, items: this.items };
  }
}

/** Builds the snapshot of an imported entry from its remote record. */
function importedSnapshot(record: RemoteListRecord, adapter: ListSyncAdapter): Snapshot {
  const provenance = {
    source: adapter.provider,
    retrievedAt: new Date().toISOString(),
    verified: true,
  };

  return {
    originalTitle: null,
    titles: record.titles.map((title) => ({ ...title, provenance })),
    descriptions: [],
    posterUrl: record.posterUrl,
    year: record.year,
    genres: [],
    format: null,
    episodeCount: record.episodeCount,
    availableEpisodeCount: null,
    providerRatings: [],
    references: [{ ...record.reference, granularity: Granularity.Unknown, provenance }],
  };
}

/** Selects the enabled fields of a value set for a Filecab write. */
function patchFor(values: ListSyncValues, fields: ListSyncField[]): EntryPatch {
  return Object.fromEntries(fields.map((field) => [field, values[field]]));
}

/** Claims and executes durable list jobs. Several instances can run; claims never overlap. */
export class ListSyncRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly adapters: Map<string, ListSyncAdapter>;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly database: PrismaClient,
    adapters: ListSyncAdapter[],
    private readonly cipher: CredentialCipher | null,
    private readonly mutations: LibraryMutationService,
    private readonly pollMs: number | null = null,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  onApplicationBootstrap(): void {
    if (this.pollMs) this.start(this.pollMs);
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /** Polls for jobs at the given interval. Does nothing without adapters. */
  start(intervalMs: number): void {
    if (this.timer || !this.adapters.size) return;

    this.timer = setInterval(() => void this.drain(), intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);

    this.timer = null;
  }

  /** Runs jobs until none are ready. Overlapping calls return at once. */
  async drain(): Promise<void> {
    if (this.running) return;

    this.running = true;
    try {
      while (await this.runOnce());
    } finally {
      this.running = false;
    }
  }

  /** Claims one ready job, or a running job with an expired lock, and runs it. */
  async runOnce(): Promise<boolean> {
    const claimed = await this.database.$queryRaw<Array<{ id: string; attempts: number }>>`
      UPDATE "ListSyncJob"
      SET "state" = 'running', "attempts" = "attempts" + 1,
        "lockedUntil" = now() + ${LOCK_MS} * interval '1 millisecond'
      WHERE "id" = (
        SELECT "id" FROM "ListSyncJob"
        WHERE ("state" = 'queued' AND "runAfter" <= now())
          OR ("state" = 'running' AND "lockedUntil" < now())
        ORDER BY "runAfter"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "attempts"`;
    const job = claimed[0];

    if (!job) return false;

    const known: { provider: string | null; kind: ListSyncJobKind | null } = {
      provider: null,
      kind: null,
    };
    try {
      if (job.attempts > MAX_ATTEMPTS) throw new JobStop(ListSyncErrorCode.ProviderUnavailable);

      const context = await this.context(job.id);
      known.provider = context.adapter.provider;
      known.kind = context.kind;
      const result = await this.execute(context);
      await this.finish(job.id, ListSyncJobState.Succeeded, result, null);
    } catch (error) {
      await this.fail(job.id, job.attempts, error, known);
    }

    return true;
  }

  private async fail(
    jobId: string,
    attempts: number,
    error: unknown,
    job: { provider: string | null; kind: ListSyncJobKind | null },
  ): Promise<void> {
    if (error instanceof ListSyncProviderError && error.retryable && attempts < MAX_ATTEMPTS) {
      const delay = Math.max(error.retryAfterMs ?? 0, RETRY_BASE_MS * 2 ** (attempts - 1));
      // Database time drives claims, so compute the retry time in SQL as well.
      await this.database.$executeRaw`
        UPDATE "ListSyncJob"
        SET "state" = 'queued', "lockedUntil" = NULL,
          "runAfter" = now() + ${delay} * interval '1 millisecond'
        WHERE "id" = ${jobId}::uuid AND "state" = 'running'`;

      return;
    }

    let code = ListSyncErrorCode.InternalError;

    if (error instanceof JobStop) code = error.code;
    else if (error instanceof ListSyncProviderError) code = ListSyncErrorCode.ProviderUnavailable;

    // Expected stops (lost authorization, partial scan, changed connection) are not reported.
    if (!(error instanceof JobStop)) {
      console.error(JSON.stringify({ event: 'list-sync-job-failed', jobId, code }));
      reportJobFailure(error, job, code);
    }

    await this.finish(jobId, ListSyncJobState.Failed, null, code);
  }

  private async finish(
    jobId: string,
    state: ListSyncJobState,
    result: unknown,
    error: ListSyncErrorCode | null,
  ): Promise<void> {
    await this.database.listSyncJob.updateMany({
      where: { id: jobId, state: ListSyncJobState.Running },
      data: {
        state,
        ...(result === null ? {} : { result: json(result) }),
        error,
        lockedUntil: null,
        finishedAt: new Date(),
      },
    });
  }

  private async context(
    jobId: string,
  ): Promise<JobContext & { kind: ListSyncJobKind; input: unknown }> {
    const job = await this.database.listSyncJob.findUnique({
      where: { id: jobId },
      include: { connection: true },
    });

    if (!job) throw new JobStop(ListSyncErrorCode.ConnectionChanged);

    const { connection } = job;
    const adapter = this.adapters.get(connection.provider);

    if (
      !adapter ||
      !this.cipher ||
      job.generation !== connection.generation ||
      connection.state === ListSyncState.AuthorizationRequired ||
      !connection.credentials
    )
      throw new JobStop(ListSyncErrorCode.ConnectionChanged);

    const credentials = this.cipher.decrypt(connection.id, connection.credentials);

    return {
      jobId,
      kind: job.kind as ListSyncJobKind,
      input: job.input,
      connectionId: connection.id,
      ownerId: connection.ownerId,
      generation: connection.generation,
      adapter,
      account: { accountId: connection.accountId, accountName: connection.accountName },
      fields: connection.fields as ListSyncField[],
      credentials,
      refreshToken: credentials.refreshToken,
    };
  }

  /** Stops the job when the connection was removed, relinked or lost authorization. */
  private async checkConnection(context: JobContext): Promise<void> {
    const connection = await this.database.listSyncConnection.findUnique({
      where: { id: context.connectionId },
      select: { generation: true, state: true },
    });

    if (
      !connection ||
      connection.generation !== context.generation ||
      connection.state === ListSyncState.AuthorizationRequired
    )
      throw new JobStop(ListSyncErrorCode.ConnectionChanged);
  }

  private async refresh(context: JobContext): Promise<void> {
    if (!context.refreshToken) throw new ListSyncAuthorizationError();

    context.credentials = await context.adapter.refresh(context.credentials);
    context.refreshToken = context.credentials.refreshToken;
    await this.database.listSyncConnection.updateMany({
      where: { id: context.connectionId, generation: context.generation },
      data: {
        credentials: this.cipher!.encrypt(context.connectionId, context.credentials),
        expiresAt: context.credentials.expiresAt ? new Date(context.credentials.expiresAt) : null,
      },
    });
  }

  /** Calls the provider. Refreshes expiring or rejected credentials once. */
  private async call<T>(
    context: JobContext,
    action: (credentials: ListSyncCredentials) => Promise<T>,
  ): Promise<T> {
    try {
      const expires = context.credentials.expiresAt
        ? Date.parse(context.credentials.expiresAt)
        : null;

      if (expires !== null && expires - Date.now() < REFRESH_MARGIN_MS) await this.refresh(context);

      try {
        return await action(context.credentials);
      } catch (error) {
        if (!(error instanceof ListSyncAuthorizationError) || !error.refreshable) throw error;

        await this.refresh(context);

        return await action(context.credentials);
      }
    } catch (error) {
      if (!(error instanceof ListSyncAuthorizationError)) throw error;

      await this.database.listSyncConnection.updateMany({
        where: { id: context.connectionId, generation: context.generation },
        data: { state: ListSyncState.AuthorizationRequired, credentials: null },
      });

      throw new JobStop(ListSyncErrorCode.AuthorizationRequired);
    }
  }

  private async progress(context: JobContext, done: number, total: number): Promise<void> {
    const progress = JSON.stringify({ done, total });
    await this.database.$executeRaw`
      UPDATE "ListSyncJob"
      SET "progress" = ${progress}::jsonb,
        "lockedUntil" = now() + ${LOCK_MS} * interval '1 millisecond'
      WHERE "id" = ${context.jobId}::uuid AND "state" = 'running'`;
  }

  private async execute(
    context: JobContext & { kind: ListSyncJobKind; input: unknown },
  ): Promise<unknown> {
    if (context.kind === ListSyncJobKind.Export) return this.exportList(context);

    if (context.kind === ListSyncJobKind.ImportPreview) return this.previewImport(context);

    return this.applyImport(context, context.input as ApplyInput);
  }

  /** Reads the complete remote list. A partial read stops the job without changes. */
  private async scan(context: JobContext): Promise<RemoteListRecord[]> {
    const scan = await this.call(context, (credentials) =>
      context.adapter.readList(credentials, context.account),
    );

    if (!scan.complete) throw new JobStop(ListSyncErrorCode.IncompleteScan);

    return scan.records.filter((record) => context.adapter.categories.includes(record.category));
  }

  private async mappings(connectionId: string) {
    const rows = await this.database.listSyncItem.findMany({ where: { connectionId } });

    return {
      byEntry: new Map(rows.map((row) => [row.entryId, row])),
      byRecord: new Map(rows.map((row) => [row.remoteRecordId, row])),
    };
  }

  /** Stores the confirmed mapping and the acknowledged values of one item. */
  private async acknowledge(
    context: JobContext,
    entryId: string,
    record: RemoteListRecord,
  ): Promise<void> {
    const data = {
      namespace: record.reference.namespace,
      entity: record.reference.entity,
      externalId: record.reference.id,
      remoteRecordId: record.recordId,
      acknowledged: json(record.values),
      metadata: json(record.metadata),
      updatedAt: new Date(),
    };
    await this.database.$transaction([
      this.database.listSyncItem.deleteMany({
        where: {
          connectionId: context.connectionId,
          entryId: { not: entryId },
          OR: [
            { remoteRecordId: record.recordId },
            {
              namespace: record.reference.namespace,
              entity: record.reference.entity,
              externalId: record.reference.id,
            },
          ],
        },
      }),
      this.database.listSyncItem.upsert({
        where: { connectionId_entryId: { connectionId: context.connectionId, entryId } },
        create: { connectionId: context.connectionId, entryId, ...data },
        update: data,
      }),
    ]);
  }

  /** Pairs active entries with remote records by mapping, then by provider ID. */
  private async pair(context: JobContext, records: RemoteListRecord[]) {
    const entries = await activeEntries(this.database, context.ownerId, context.adapter);
    const references = await providerReferences(this.database, entries, context.adapter);
    const mappings = await this.mappings(context.connectionId);
    const { byId, byReference } = indexRecords(records);
    const claimed = new Map<string, string>();
    const pairs: Array<{
      entry: ServerEntry;
      reference: ListSyncReference | null;
      record: RemoteListRecord | null;
      issue: ListSyncIssue | null;
    }> = [];

    for (const entry of entries) {
      const mapped = mappings.byEntry.get(entry.entryId);
      const reference: ListSyncReference | null = mapped
        ? { namespace: mapped.namespace, entity: mapped.entity, id: mapped.externalId }
        : (references.get(entry.entryId) ?? null);

      if (!reference) {
        pairs.push({ entry, reference, record: null, issue: ListSyncIssue.Unidentified });
        continue;
      }

      const key = referenceKey(reference);
      const record = (mapped && byId.get(mapped.remoteRecordId)) || byReference.get(key) || null;
      const owner = record && mappings.byRecord.get(record.recordId);

      if (
        claimed.has(key) ||
        (owner &&
          owner.entryId !== entry.entryId &&
          entries.some((e) => e.entryId === owner.entryId))
      ) {
        pairs.push({ entry, reference, record: null, issue: ListSyncIssue.AlreadyLinked });
        continue;
      }

      claimed.set(key, entry.entryId);
      pairs.push({ entry, reference, record, issue: null });
    }

    return { pairs, claimed, entries };
  }

  /** Writes Filecab values to the remote list. Never deletes remote records. */
  private async exportList(context: JobContext): Promise<ListSyncJobResult> {
    const records = await this.scan(context);
    const { pairs } = await this.pair(context, records);
    const report = new Report();
    let done = 0;
    await this.progress(context, 0, pairs.length);

    for (const { entry, reference, record, issue } of pairs) {
      const title = entryTitle(entry);

      if (issue || !reference) {
        report.add(
          ListSyncOutcome.Skipped,
          title,
          entry.entryId,
          issue ?? ListSyncIssue.Unidentified,
        );
      } else {
        await this.exportEntry(context, report, entry, reference, record);
      }

      done += 1;

      if (done % PROGRESS_STEP === 0) await this.progress(context, done, pairs.length);
    }

    await this.progress(context, done, pairs.length);
    await this.database.listSyncConnection.updateMany({
      where: { id: context.connectionId, generation: context.generation },
      data: { lastExportAt: new Date() },
    });

    return report.result();
  }

  private async exportEntry(
    context: JobContext,
    report: Report,
    entry: ServerEntry,
    reference: ListSyncReference,
    scanned: RemoteListRecord | null,
  ): Promise<void> {
    const title = entryTitle(entry);
    const values = entryValues(entry);
    const { adapter } = context;
    const planned = planExport(values, scanned?.values ?? null, context.fields, adapter.statuses);

    if (planned.kind === 'unchanged') {
      await this.acknowledge(context, entry.entryId, scanned!);
      report.add(ListSyncOutcome.Unchanged, title, entry.entryId);

      return;
    }

    // Read before the write. The scan can be old when the list is long.
    const record = scanned
      ? await this.call(context, (credentials) =>
          adapter.readRecord(credentials, context.account, scanned.recordId),
        )
      : null;
    const action = planExport(values, record?.values ?? null, context.fields, adapter.statuses);

    if (action.kind === 'skip') {
      report.add(ListSyncOutcome.Skipped, title, entry.entryId, action.issue);

      return;
    }

    if (action.kind === 'unchanged') {
      await this.acknowledge(context, entry.entryId, record!);
      report.add(ListSyncOutcome.Unchanged, title, entry.entryId);

      return;
    }

    await this.checkConnection(context);
    try {
      const written =
        action.kind === 'create'
          ? await this.call(context, (credentials) =>
              adapter.createRecord(credentials, context.account, reference, action.values),
            )
          : await this.call(context, (credentials) =>
              adapter.updateRecord(credentials, context.account, record!, action.values),
            );
      // Verify after the write. Without conditional writes, only a read confirms the result.
      const verified = await this.call(context, (credentials) =>
        adapter.readRecord(credentials, context.account, written.recordId),
      );

      if (!verified || !valuesMatch(verified.values, action.values)) {
        report.add(ListSyncOutcome.Failed, title, entry.entryId, ListSyncIssue.ProviderError);

        return;
      }

      await this.acknowledge(context, entry.entryId, verified);
      report.add(
        action.kind === 'create' ? ListSyncOutcome.Created : ListSyncOutcome.Updated,
        title,
        entry.entryId,
      );
    } catch (error) {
      if (error instanceof ListSyncUnsupportedValueError) {
        report.add(ListSyncOutcome.Skipped, title, entry.entryId, ListSyncIssue.UnsupportedValue);

        return;
      }

      if (error instanceof ListSyncProviderError && !error.retryable) {
        report.add(ListSyncOutcome.Failed, title, entry.entryId, ListSyncIssue.ProviderError);

        return;
      }

      throw error;
    }
  }

  /** Compares the remote list with the library and stores the preview. Changes nothing. */
  private async previewImport(context: JobContext): Promise<StoredPreview> {
    const records = await this.scan(context);
    const { pairs } = await this.pair(context, records);
    const linked = new Map<string, (typeof pairs)[number]>();

    for (const pair of pairs) if (pair.record) linked.set(pair.record.recordId, pair);

    const linkedReferences = new Set(
      pairs.flatMap((pair) => (pair.reference ? [referenceKey(pair.reference)] : [])),
    );
    const additions: StoredAddition[] = [];
    const changes: StoredChange[] = [];
    let unchanged = 0;

    for (const record of records) {
      const pair = linked.get(record.recordId);

      if (!pair) {
        if (linkedReferences.has(referenceKey(record.reference))) continue;

        additions.push({
          key: record.recordId,
          title: record.title,
          category: record.category,
          values: record.values,
          record,
        });
        continue;
      }

      const fields = planImport(entryValues(pair.entry), record.values, context.fields);

      if (!fields.length) {
        unchanged += 1;
        continue;
      }

      changes.push({
        key: record.recordId,
        entryId: pair.entry.entryId,
        title: entryTitle(pair.entry),
        fields,
        entryVersion: pair.entry.serverVersion,
        record,
      });
    }

    await this.progress(context, records.length, records.length);
    await this.database.listSyncJob.updateMany({
      where: { id: context.jobId, state: ListSyncJobState.Running },
      data: { previewOpen: true },
    });

    return { additions, changes, unchanged };
  }

  /** Applies the selected preview parts through the library mutation service. */
  private async applyImport(context: JobContext, input: ApplyInput): Promise<ListSyncJobResult> {
    const preview = await this.database.listSyncJob.findUnique({
      where: { id: input.previewJobId },
      select: { result: true },
    });

    if (!preview?.result) throw new JobStop(ListSyncErrorCode.ConnectionChanged);

    const stored = preview.result as unknown as StoredPreview;
    const report = new Report();
    const total = input.additions.length + input.changes.length;
    let done = 0;
    await this.progress(context, 0, total);

    for (const key of input.additions) {
      const addition = stored.additions.find((item) => item.key === key);

      if (addition) await this.add(context, report, addition);

      done += 1;

      if (done % PROGRESS_STEP === 0) await this.progress(context, done, total);
    }

    for (const selection of input.changes) {
      const change = stored.changes.find((item) => item.key === selection.key);

      if (change) await this.change(context, report, change, selection.fields);

      done += 1;

      if (done % PROGRESS_STEP === 0) await this.progress(context, done, total);
    }

    await this.progress(context, done, total);
    await this.database.listSyncConnection.updateMany({
      where: { id: context.connectionId, generation: context.generation },
      data: { lastImportAt: new Date() },
    });

    return report.result();
  }

  private async add(context: JobContext, report: Report, addition: StoredAddition): Promise<void> {
    const { record } = addition;
    const existing = await this.database.listSyncItem.findFirst({
      where: {
        connectionId: context.connectionId,
        OR: [
          { remoteRecordId: record.recordId },
          {
            namespace: record.reference.namespace,
            entity: record.reference.entity,
            externalId: record.reference.id,
          },
        ],
      },
    });
    const entries = await activeEntries(this.database, context.ownerId, context.adapter);
    const references = await providerReferences(this.database, entries, context.adapter);
    const key = referenceKey(record.reference);
    const linked =
      (existing && entries.some((entry) => entry.entryId === existing.entryId)) ||
      [...references.values()].some((reference) => referenceKey(reference) === key);

    if (linked) {
      report.add(
        ListSyncOutcome.Skipped,
        addition.title,
        existing?.entryId ?? null,
        ListSyncIssue.AlreadyLinked,
      );

      return;
    }

    await this.checkConnection(context);
    let entry: ServerEntry;
    try {
      // An entry without a catalog item needs its own title. The snapshot keeps the
      // localized titles as well.
      entry = await this.mutations.create(context.ownerId, {
        entryId: randomUUID(),
        category: record.category,
        catalogId: null,
        snapshot: importedSnapshot(record, context.adapter),
        fields: { userTitle: record.title, ...patchFor(record.values, context.fields) },
      });
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;

      // A rejected entry is a Filecab defect. Report it once for each job and continue.
      if (!report.has(ListSyncIssue.InvalidEntry))
        reportJobFailure(
          error,
          { provider: context.adapter.provider, kind: ListSyncJobKind.ImportApply },
          ListSyncIssue.InvalidEntry,
        );

      report.add(ListSyncOutcome.Failed, addition.title, null, ListSyncIssue.InvalidEntry);

      return;
    }

    await this.acknowledge(context, entry.entryId, record);
    report.add(ListSyncOutcome.Added, addition.title, entry.entryId);
  }

  private async change(
    context: JobContext,
    report: Report,
    change: StoredChange,
    fields: ListSyncField[],
  ): Promise<void> {
    const patch: EntryPatch = Object.fromEntries(
      change.fields
        .filter((item) => fields.includes(item.field))
        .map((item) => [item.field, item.incoming]),
    );
    await this.checkConnection(context);
    try {
      await this.mutations.update(context.ownerId, change.entryId, change.entryVersion, patch);
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;

      // A retried job finds its own earlier write. Equal values count as done.
      const row = await this.database.libraryEntry.findFirst({
        where: { id: change.entryId, ownerId: context.ownerId, deleted: false },
      });
      const current = row?.document as ServerEntry | undefined;

      if (!current || !valuesMatch(entryValues(current), patch as Partial<ListSyncValues>)) {
        report.add(
          ListSyncOutcome.Skipped,
          change.title,
          change.entryId,
          ListSyncIssue.ChangedAfterPreview,
        );

        return;
      }
    }

    await this.acknowledge(context, change.entryId, change.record);
    report.add(ListSyncOutcome.Updated, change.title, change.entryId);
  }
}
