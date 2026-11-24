import {
  ApiErrorCode,
  ListSyncErrorCode,
  ListSyncJobKind,
  ListSyncJobState,
  ListSyncState,
  type ListSyncAuthorization,
  type ListSyncField,
  type ListSyncImportApply,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncOverview,
} from '@filecab/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import { ApiException } from '../http/api-error';
import { CredentialCipher } from './credential-cipher';
import type { ListSyncAdapter } from './list-sync-adapter';
import { json, publicJob, publicPreview, type StoredPreview } from './list-sync-store';

/** Consent requests expire after 10 minutes. */
const AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1000;

/** Hashes a consent state. The plain state exists only in the provider redirect. */
function stateHash(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

/** Returns true for a Prisma unique constraint failure. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

/** Ends a consent callback with a result code for the Settings page. */
class ConnectFailure extends Error {
  constructor(readonly code: ListSyncErrorCode) {
    super(code);
  }
}

/** Rejects an action that the connection state does not permit. */
function conflict(message: string): ApiException {
  return new ApiException(409, ApiErrorCode.Conflict, message);
}

/** Owns list connections, consent and job requests. The runner executes the jobs. */
export class ListSyncService {
  private readonly adapters: Map<string, ListSyncAdapter>;

  constructor(
    readonly database: PrismaClient,
    adapters: ListSyncAdapter[],
    readonly cipher: CredentialCipher | null,
    private readonly settingsUrl: string,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  /** Returns the registered adapter or a 404 error. */
  adapter(provider: string): ListSyncAdapter {
    const adapter = this.adapters.get(provider);

    if (!adapter) throw new ApiException(404, ApiErrorCode.NotFound, 'Unknown list provider');

    return adapter;
  }

  /** Returns true when at least one adapter is registered. */
  get enabled(): boolean {
    return this.adapters.size > 0;
  }

  private async connection(ownerId: string, provider: string) {
    this.adapter(provider);

    const connection = await this.database.listSyncConnection.findUnique({
      where: { ownerId_provider: { ownerId, provider } },
    });

    if (!connection)
      throw new ApiException(404, ApiErrorCode.NotFound, 'The provider is not connected');

    return connection;
  }

  async overview(ownerId: string): Promise<ListSyncOverview> {
    const connections = await this.database.listSyncConnection.findMany({
      where: { ownerId },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const open = await this.database.listSyncJob.findMany({
      where: { connectionId: { in: connections.map((row) => row.id) }, previewOpen: true },
      select: { connectionId: true },
    });
    const previews = new Set(open.map((row) => row.connectionId));
    const counts = await this.database.listSyncItem.groupBy({
      by: ['connectionId'],
      where: { connectionId: { in: connections.map((row) => row.id) } },
      _count: { _all: true },
    });
    const mappings = new Map(counts.map((row) => [row.connectionId, row._count._all]));

    return {
      schemaVersion: 1,
      providers: [...this.adapters.values()].map((adapter) => {
        const row = connections.find((connection) => connection.provider === adapter.provider);

        return {
          provider: adapter.provider,
          name: adapter.name,
          categories: adapter.categories,
          connection: row
            ? {
                accountId: row.accountId,
                accountName: row.accountName,
                state: row.state as ListSyncState,
                fields: row.fields as ListSyncField[],
                lastExportAt: row.lastExportAt?.toISOString() ?? null,
                lastImportAt: row.lastImportAt?.toISOString() ?? null,
                job: row.jobs[0] ? publicJob(row.jobs[0]) : null,
                previewReady: previews.has(row.id),
                mappings: mappings.get(row.id) ?? 0,
              }
            : null,
        };
      }),
    };
  }

  /** Starts provider consent. A connected account must be disconnected before another links. */
  async authorize(ownerId: string, provider: string): Promise<ListSyncAuthorization> {
    const adapter = this.adapter(provider);

    if (!this.cipher)
      throw new ApiException(503, ApiErrorCode.ServiceUnavailable, 'Encryption is not configured');

    const existing = await this.database.listSyncConnection.findUnique({
      where: { ownerId_provider: { ownerId, provider } },
    });

    if (existing && existing.state !== ListSyncState.AuthorizationRequired)
      throw conflict('Disconnect the connected account first');

    const state = randomBytes(32).toString('base64url');
    await this.database.listSyncAuthorization.create({
      data: {
        stateHash: stateHash(state),
        ownerId,
        provider,
        expiresAt: new Date(Date.now() + AUTHORIZATION_LIFETIME_MS),
      },
    });

    return { schemaVersion: 1, authorizationUrl: adapter.authorizationUrl(state) };
  }

  /** Completes provider consent and returns the Settings address with the result. */
  async callback(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ): Promise<string> {
    const result = await this.connect(provider, code, state).catch((error: unknown) =>
      error instanceof ConnectFailure ? error.code : ListSyncErrorCode.AuthorizationFailed,
    );
    const url = new URL(this.settingsUrl);
    url.searchParams.set('listSync', provider);
    url.searchParams.set('listSyncResult', result);

    return url.href;
  }

  private async connect(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ): Promise<'connected'> {
    const adapter = this.adapter(provider);

    if (!state || !this.cipher) throw new ConnectFailure(ListSyncErrorCode.AuthorizationFailed);

    const consumed = await this.database.listSyncAuthorization.updateManyAndReturn({
      where: {
        stateHash: stateHash(state),
        provider,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    const request = consumed[0];

    if (!request || !code) throw new ConnectFailure(ListSyncErrorCode.AuthorizationFailed);

    const { credentials, account } = await adapter.authorize(code);
    const existing = await this.database.listSyncConnection.findUnique({
      where: { ownerId_provider: { ownerId: request.ownerId, provider } },
    });

    if (existing) {
      if (existing.accountId !== account.accountId)
        throw new ConnectFailure(ListSyncErrorCode.AccountMismatch);

      await this.database.listSyncConnection.update({
        where: { id: existing.id },
        data: {
          state: ListSyncState.Active,
          generation: { increment: 1 },
          accountName: account.accountName,
          credentials: this.cipher.encrypt(existing.id, credentials),
          scopes: credentials.scopes,
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
        },
      });

      return 'connected';
    }

    const id = randomUUID();
    try {
      await this.database.listSyncConnection.create({
        data: {
          id,
          ownerId: request.ownerId,
          provider,
          accountId: account.accountId,
          accountName: account.accountName,
          state: ListSyncState.Active,
          credentials: this.cipher.encrypt(id, credentials),
          scopes: credentials.scopes,
          fields: adapter.fields,
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConnectFailure(ListSyncErrorCode.AccountInUse);

      throw error;
    }

    return 'connected';
  }

  async setPaused(ownerId: string, provider: string, paused: boolean): Promise<ListSyncOverview> {
    const connection = await this.connection(ownerId, provider);
    const from = paused ? ListSyncState.Active : ListSyncState.Paused;

    if (connection.state !== from)
      throw conflict(paused ? 'The connection is not active' : 'The connection is not paused');

    await this.database.listSyncConnection.update({
      where: { id: connection.id },
      data: { state: paused ? ListSyncState.Paused : ListSyncState.Active },
    });

    return this.overview(ownerId);
  }

  /** Deletes credentials, mappings and jobs. Filecab entries stay. A running write can finish. */
  async disconnect(ownerId: string, provider: string): Promise<ListSyncOverview> {
    const adapter = this.adapter(provider);
    const connection = await this.connection(ownerId, provider);

    if (adapter.revoke && connection.credentials && this.cipher)
      await adapter
        .revoke(this.cipher.decrypt(connection.id, connection.credentials))
        .catch(() => undefined);

    await this.database.listSyncConnection.deleteMany({ where: { id: connection.id } });

    return this.overview(ownerId);
  }

  /** Queues an export or an import preview. A new job closes an open import preview. */
  async start(
    ownerId: string,
    provider: string,
    kind: ListSyncJobKind.Export | ListSyncJobKind.ImportPreview,
  ): Promise<ListSyncJob> {
    const connection = await this.connection(ownerId, provider);

    if (connection.state !== ListSyncState.Active) throw conflict('The connection is not active');

    return this.queue(connection.id, connection.generation, kind, {});
  }

  private async queue(
    connectionId: string,
    generation: number,
    kind: ListSyncJobKind,
    input: unknown,
  ): Promise<ListSyncJob> {
    try {
      const row = await this.database.$transaction(async (tx) => {
        await tx.listSyncJob.updateMany({
          where: { connectionId, previewOpen: true },
          data: { previewOpen: false },
        });

        return tx.listSyncJob.create({
          data: {
            id: randomUUID(),
            connectionId,
            generation,
            kind,
            state: ListSyncJobState.Queued,
            input: json(input),
            progress: { done: 0, total: 0 },
          },
        });
      });

      return publicJob(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('Another job of this connection is running');

      throw error;
    }
  }

  private async openPreview(ownerId: string, provider: string) {
    const connection = await this.connection(ownerId, provider);
    const job = await this.database.listSyncJob.findFirst({
      where: { connectionId: connection.id, previewOpen: true },
    });

    if (!job?.result)
      throw new ApiException(404, ApiErrorCode.NotFound, 'No import preview is waiting');

    return { connection, job, stored: job.result as unknown as StoredPreview };
  }

  async preview(ownerId: string, provider: string): Promise<ListSyncImportPreview> {
    const { job, stored } = await this.openPreview(ownerId, provider);

    return publicPreview(job.id, stored);
  }

  /** Queues the selected parts of the open preview. Unknown keys and fields are rejected. */
  async apply(
    ownerId: string,
    provider: string,
    selection: ListSyncImportApply,
  ): Promise<ListSyncJob> {
    const { connection, job, stored } = await this.openPreview(ownerId, provider);

    if (job.id !== selection.jobId) throw conflict('The import preview changed');

    if (connection.state !== ListSyncState.Active) throw conflict('The connection is not active');

    const additions = new Set(stored.additions.map((addition) => addition.key));
    const changes = new Map(
      stored.changes.map((change) => [change.key, new Set(change.fields.map((f) => f.field))]),
    );
    const valid =
      selection.additions.every((key) => additions.has(key)) &&
      selection.changes.every((change) =>
        change.fields.every((field) => changes.get(change.key)?.has(field)),
      );

    if (!valid)
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'The selection does not match the import preview',
      );

    return this.queue(connection.id, connection.generation, ListSyncJobKind.ImportApply, {
      previewJobId: job.id,
      additions: selection.additions,
      changes: selection.changes,
    });
  }

  async cancelPreview(ownerId: string, provider: string): Promise<ListSyncOverview> {
    const connection = await this.connection(ownerId, provider);
    await this.database.listSyncJob.updateMany({
      where: { connectionId: connection.id, previewOpen: true },
      data: { previewOpen: false },
    });

    return this.overview(ownerId);
  }
}
