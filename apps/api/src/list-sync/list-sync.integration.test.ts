import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  Category,
  ListSyncErrorCode,
  ListSyncField,
  ListSyncIssue,
  ListSyncJobState,
  ListSyncState,
  Status,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncOverview,
  type ListSyncValues,
  type ServerEntry,
} from '@filecab/contracts';
import { validateEnvironment } from '../config/environment';
import { createApiApplication } from '../http/application';
import { AuthService, type SessionTokens } from '../auth/auth.service';
import {
  AuthClient,
  credentialHash,
  randomCredential,
  verifierChallenge,
} from '../auth/credentials';
import {
  ListSyncAuthorizationError,
  ListSyncProviderError,
  type ListSyncAccount,
  type ListSyncAdapter,
  type ListSyncCredentials,
  type ListSyncReference,
  type RemoteListRecord,
} from './list-sync-adapter';
import { ListSyncRunner } from './list-sync-runner';

const prefix = `list-sync-${randomUUID()}`;
const secret = Buffer.alloc(32, 31).toString('base64');
const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
  EXTENSION_ORIGINS: `chrome-extension://${'a'.repeat(32)}`,
  GOOGLE_ENABLED: 'true',
  GOOGLE_CLIENT_ID: 'fixture-client',
  GOOGLE_CLIENT_SECRET: 'fixture-secret',
  GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/v1/auth/google/callback',
  SESSION_SECRET: secret,
  PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32, 32).toString('base64'),
  KINOPOISK_ENABLED: 'false',
  SMOTRET_ENABLED: 'false',
  SHIKIMORI_ENABLED: 'false',
});

/** A fixture access token. The test checks that it never reaches the database as plain text. */
const ACCESS_TOKEN = `${prefix}-access-token`;

/** Keeps an in-memory remote list and counts writes. */
class FakeListAdapter implements ListSyncAdapter {
  readonly provider = 'fake';
  readonly name = 'Fake list';
  readonly categories = [Category.Anime];
  readonly namespace = 'fake';
  readonly entity = 'anime';
  readonly fields = [ListSyncField.Status, ListSyncField.Rating, ListSyncField.Progress];
  readonly statuses = [Status.Planned, Status.Process, Status.Complete, Status.Drop];
  records = new Map<string, RemoteListRecord>();
  writes = 0;
  complete = true;
  failures: Error[] = [];
  refreshToken: string | null = 'refresh';

  authorizationUrl(state: string): string {
    return `https://fake.example/authorize?state=${state}`;
  }

  async authorize(code: string) {
    return {
      credentials: {
        accessToken: ACCESS_TOKEN,
        refreshToken: this.refreshToken,
        expiresAt: null,
        scopes: ['user_rates'],
      },
      account: { accountId: `${prefix}-${code}`, accountName: `Account ${code}` },
    };
  }

  async refresh(credentials: ListSyncCredentials): Promise<ListSyncCredentials> {
    if (!credentials.refreshToken) throw new ListSyncAuthorizationError();

    return { ...credentials, accessToken: `${ACCESS_TOKEN}-refreshed` };
  }

  private check(): void {
    const failure = this.failures.shift();

    if (failure) throw failure;
  }

  async readList(_credentials: ListSyncCredentials, _account: ListSyncAccount) {
    this.check();

    return { complete: this.complete, records: [...this.records.values()] };
  }

  async readRecord(_credentials: ListSyncCredentials, _account: ListSyncAccount, id: string) {
    return this.records.get(id) ?? null;
  }

  async createRecord(
    _credentials: ListSyncCredentials,
    _account: ListSyncAccount,
    reference: ListSyncReference,
    values: Partial<ListSyncValues>,
  ) {
    this.check();
    this.writes += 1;

    return this.put(`r-${reference.id}`, reference.id, {
      status: null,
      rating: 0,
      progress: 0,
      ...values,
    });
  }

  async updateRecord(
    _credentials: ListSyncCredentials,
    _account: ListSyncAccount,
    record: RemoteListRecord,
    values: Partial<ListSyncValues>,
  ) {
    this.check();
    this.writes += 1;

    return this.put(record.recordId, record.reference.id, { ...record.values, ...values });
  }

  /** Stores a remote record for a fake anime ID. */
  put(recordId: string, id: string, values: ListSyncValues, title = `Remote ${id}`) {
    const record: RemoteListRecord = {
      recordId,
      reference: { namespace: 'fake', entity: 'anime', id },
      category: Category.Anime,
      title,
      year: 2020,
      posterUrl: null,
      values,
      metadata: {},
    };
    this.records.set(recordId, record);

    return record;
  }
}

const adapter = new FakeListAdapter();

const stateHashes: string[] = [];

let app: NestExpressApplication;
let auth: AuthService;
let runner: ListSyncRunner;
let base: string;
let owner: SessionTokens;
let connected = 0;

/** Authenticates a fixture account through the real login and exchange boundary. */
async function login(subject: string): Promise<SessionTokens> {
  const verifier = randomCredential();
  const attempt = randomCredential();
  const started = await auth.start(
    AuthClient.Extension,
    `https://${'a'.repeat(32)}.chromiumapp.org/filecab`,
    verifierChallenge(verifier),
    attempt,
  );
  const state = new URL(started.url).searchParams.get('state')!;
  stateHashes.push(credentialHash(state, secret));
  const returned = await auth.callback(state, started.binding, `${prefix}-${subject}`);

  return auth.exchange(new URL(returned.returnTo).searchParams.get('code')!, attempt, verifier);
}

/** Sends an authenticated request. */
function request(path: string, method = 'GET', body?: unknown, tokens = owner) {
  return fetch(`${base}/api/v1${path}`, {
    method,
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Connects the fake provider account and returns the redirect target. */
async function connect(code: string, tokens = owner): Promise<URL> {
  const started = await request('/list-sync/fake/authorize', 'POST', undefined, tokens);
  expect(started.status).toBe(200);
  const { authorizationUrl } = (await started.json()) as { authorizationUrl: string };
  const state = new URL(authorizationUrl).searchParams.get('state')!;
  const callback = await fetch(
    `${base}/api/v1/list-sync/fake/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { redirect: 'manual' },
  );
  expect(callback.status).toBe(302);

  return new URL(callback.headers.get('location')!);
}

/** Creates an anime entry with an optional verified fake reference. */
async function entry(
  title: string,
  fields: Record<string, unknown>,
  referenceId?: string,
): Promise<ServerEntry> {
  const response = await request('/library/entries', 'POST', {
    category: 'anime',
    userTitle: title,
    ...fields,
  });
  expect(response.status).toBe(201);
  const created = (await response.json()) as ServerEntry;

  if (!referenceId) return created;

  // The public API cannot add verified references. Store one as a catalog resolution would.
  const document: ServerEntry = {
    ...created,
    snapshot: {
      ...created.snapshot,
      references: [
        {
          namespace: 'fake',
          entity: 'anime',
          id: referenceId,
          granularity: 'unknown' as ServerEntry['snapshot']['references'][number]['granularity'],
          provenance: { source: 'fixture', retrievedAt: created.createdAt, verified: true },
        },
      ],
    },
  };
  await auth.database.libraryEntry.update({
    where: { id: created.entryId },
    data: { document: JSON.parse(JSON.stringify(document)) },
  });

  return document;
}

/** Runs all ready jobs and returns the overview. */
async function run(): Promise<ListSyncOverview> {
  await runner.drain();
  const response = await request('/list-sync');

  return (await response.json()) as ListSyncOverview;
}

/** Returns the latest job of the fake connection. */
function latest(overview: ListSyncOverview): ListSyncJob {
  return overview.providers[0]!.connection!.job!;
}

beforeAll(async () => {
  app = await createApiApplication(environment, {
    diagnostic: () => {},
    google: {
      authorizationUrl: (state) => `https://accounts.google.com/?state=${state}`,
      exchange: async (code) => code,
    },
    listSync: { adapters: [adapter], pollMs: null },
  });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  auth = app.get(AuthService);
  runner = app.get(ListSyncRunner);
});

beforeEach(async () => {
  connected += 1;
  owner = await login(`owner-${connected}`);
  adapter.records.clear();
  adapter.writes = 0;
  adapter.complete = true;
  adapter.failures = [];
  adapter.refreshToken = 'refresh';
});

afterAll(async () => {
  if (auth) {
    await auth.database.user.deleteMany({ where: { googleSubject: { startsWith: prefix } } });
    await auth.database.loginAttempt.deleteMany({ where: { stateHash: { in: stateHashes } } });
  }

  await app?.close();
});

test('consent links one verified account, stores encrypted credentials and rejects reuse', async () => {
  const target = await connect(`a${connected}`);
  expect(target.pathname).toBe('/settings');
  expect(target.searchParams.get('listSyncResult')).toBe('connected');

  const overview = (await (await request('/list-sync')).json()) as ListSyncOverview;
  expect(overview.providers[0]).toMatchObject({
    provider: 'fake',
    connection: { accountId: `${prefix}-a${connected}`, state: ListSyncState.Active },
  });
  expect(JSON.stringify(overview)).not.toContain(ACCESS_TOKEN);

  const row = await auth.database.listSyncConnection.findFirstOrThrow({
    where: { accountId: `${prefix}-a${connected}` },
  });
  expect(row.credentials).not.toContain(ACCESS_TOKEN);

  // A connected account must be disconnected first.
  expect((await request('/list-sync/fake/authorize', 'POST')).status).toBe(409);

  // Another Filecab account cannot link the same remote account.
  const other = await login(`other-${connected}`);
  const denied = await connect(`a${connected}`, other);
  expect(denied.searchParams.get('listSyncResult')).toBe(ListSyncErrorCode.AccountInUse);

  // A consumed or unknown state never connects.
  const replay = await fetch(`${base}/api/v1/list-sync/fake/callback?code=x&state=unknown`, {
    redirect: 'manual',
  });
  expect(new URL(replay.headers.get('location')!).searchParams.get('listSyncResult')).toBe(
    ListSyncErrorCode.AuthorizationFailed,
  );
});

test('export replaces remote values, skips unidentified items and repeats without writes', async () => {
  await connect(`e${connected}`);
  const changed = await entry('Changed', { status: 'complete', rating: 8, progress: 12 }, '1');
  const missing = await entry('Missing', { status: 'planned' }, '2');
  const unidentified = await entry('Unknown', { status: 'process' });
  const hidden = await entry('Hidden', { status: 'hide' }, '3');
  adapter.put('r-1', '1', { status: Status.Process, rating: 5, progress: 3 });
  adapter.put('r-9', '9', { status: Status.Drop, rating: 2, progress: 1 });

  expect((await request('/list-sync/fake/export', 'POST')).status).toBe(202);
  // One job at a time for each connection.
  expect((await request('/list-sync/fake/export', 'POST')).status).toBe(409);

  const job = latest(await run());
  expect(job.state).toBe(ListSyncJobState.Succeeded);
  expect(job.result?.counts).toEqual({ updated: 1, created: 1, skipped: 2 });
  expect(job.result?.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ entryId: unidentified.entryId, issue: ListSyncIssue.Unidentified }),
      expect.objectContaining({ entryId: hidden.entryId, issue: ListSyncIssue.UnsupportedStatus }),
    ]),
  );
  expect(adapter.records.get('r-1')!.values).toEqual({
    status: Status.Complete,
    rating: 8,
    progress: 12,
  });
  expect(adapter.records.get('r-2')!.values.status).toBe(Status.Planned);
  // A remote record without a Filecab entry stays unchanged.
  expect(adapter.records.get('r-9')!.values.status).toBe(Status.Drop);
  expect(changed.entryId && missing.entryId).toBeTruthy();

  const writes = adapter.writes;
  await request('/list-sync/fake/export', 'POST');
  const repeated = latest(await run());
  expect(repeated.result?.counts).toEqual({ unchanged: 2, skipped: 2 });
  expect(adapter.writes).toBe(writes);
});

test('an incomplete scan stops the export without writes', async () => {
  await connect(`i${connected}`);
  await entry('Missing', { status: 'planned' }, '5');
  adapter.complete = false;
  await request('/list-sync/fake/export', 'POST');
  const job = latest(await run());
  expect(job).toMatchObject({
    state: ListSyncJobState.Failed,
    error: ListSyncErrorCode.IncompleteScan,
  });
  expect(adapter.writes).toBe(0);
});

test('import previews additions and changes and applies only the selection', async () => {
  await connect(`m${connected}`);
  const linked = await entry('Linked', { status: 'process', rating: 4, progress: 2 }, '1');
  const stale = await entry('Stale', { status: 'process', progress: 1 }, '2');
  adapter.put('r-1', '1', { status: Status.Complete, rating: 9, progress: 24 });
  adapter.put('r-2', '2', { status: Status.Complete, rating: 0, progress: 10 });
  adapter.put('r-3', '3', { status: Status.Planned, rating: 0, progress: 0 }, 'New title');
  adapter.put('r-4', '4', { status: null, rating: 0, progress: 0 }, 'On hold');

  await request('/list-sync/fake/import', 'POST');
  const overview = await run();
  expect(overview.providers[0]!.connection!.previewReady).toBe(true);
  const preview = (await (
    await request('/list-sync/fake/import/preview')
  ).json()) as ListSyncImportPreview;
  expect(preview.additions.map((addition) => addition.key).sort()).toEqual(['r-3', 'r-4']);
  expect(preview.changes.find((change) => change.key === 'r-1')?.fields).toEqual([
    { field: ListSyncField.Status, current: Status.Process, incoming: Status.Complete },
    { field: ListSyncField.Rating, current: 4, incoming: 9 },
    { field: ListSyncField.Progress, current: 2, incoming: 24 },
  ]);
  // Nothing changes before the owner applies the preview.
  const before = (await (
    await request(`/library/entries/${linked.entryId}`)
  ).json()) as ServerEntry;
  expect(before.status).toBe(Status.Process);

  // An entry that changes after the preview is skipped.
  await request(`/library/entries/${stale.entryId}`, 'PATCH', {
    expectedVersion: stale.serverVersion,
    progress: 5,
  });

  const applied = await request('/list-sync/fake/import/apply', 'POST', {
    jobId: preview.jobId,
    additions: ['r-3'],
    changes: [
      { key: 'r-1', fields: ['status', 'progress'] },
      { key: 'r-2', fields: ['progress'] },
    ],
  });
  expect(applied.status).toBe(202);
  const job = latest(await run());
  expect(job.result?.counts).toEqual({ added: 1, updated: 1, skipped: 1 });
  expect(job.result?.items).toEqual([
    expect.objectContaining({ entryId: stale.entryId, issue: ListSyncIssue.ChangedAfterPreview }),
  ]);

  const after = (await (await request(`/library/entries/${linked.entryId}`)).json()) as ServerEntry;
  expect(after).toMatchObject({ status: Status.Complete, rating: 4, progress: 24 });

  const library = (await (await request('/library')).json()) as { entries: ServerEntry[] };
  const added = library.entries.find((item) => item.userTitle === 'New title');
  expect(added).toMatchObject({
    category: Category.Anime,
    status: Status.Planned,
    catalogId: null,
  });
  expect(added?.snapshot.references[0]).toMatchObject({ namespace: 'fake', id: '3' });

  // The preview is consumed. A second import shows the added record as linked.
  expect((await request('/list-sync/fake/import/preview')).status).toBe(404);
  await request('/list-sync/fake/import', 'POST');
  await run();
  const next = (await (
    await request('/list-sync/fake/import/preview')
  ).json()) as ListSyncImportPreview;
  expect(next.additions.map((addition) => addition.key)).toEqual(['r-4']);
});

test('a retryable failure requeues the job and a lost authorization pauses the connection', async () => {
  await connect(`r${connected}`);
  await entry('Missing', { status: 'planned' }, '7');
  adapter.failures = [new ListSyncProviderError(true, 0)];
  await request('/list-sync/fake/export', 'POST');
  expect(latest(await run()).state).toBe(ListSyncJobState.Queued);

  await auth.database.listSyncJob.updateMany({
    where: { state: ListSyncJobState.Queued, connection: { accountId: `${prefix}-r${connected}` } },
    data: { runAfter: new Date(0) },
  });
  expect(latest(await run())).toMatchObject({
    state: ListSyncJobState.Succeeded,
    result: { counts: { created: 1 } },
  });

  // The provider rejects the token, then also the refreshed token.
  adapter.failures = [new ListSyncAuthorizationError(), new ListSyncAuthorizationError()];
  await request('/list-sync/fake/export', 'POST');
  const overview = await run();
  expect(overview.providers[0]!.connection!.state).toBe(ListSyncState.AuthorizationRequired);
  expect(latest(overview)).toMatchObject({
    state: ListSyncJobState.Failed,
    error: ListSyncErrorCode.AuthorizationRequired,
  });
  // Reconnecting the same account restores the connection.
  const reconnected = await connect(`r${connected}`);
  expect(reconnected.searchParams.get('listSyncResult')).toBe('connected');
});

test('pause blocks jobs and disconnect keeps Filecab entries', async () => {
  await connect(`p${connected}`);
  const kept = await entry('Kept', { status: 'planned' }, '8');
  expect((await request('/list-sync/fake/pause', 'POST')).status).toBe(200);
  expect((await request('/list-sync/fake/export', 'POST')).status).toBe(409);
  expect((await request('/list-sync/fake/resume', 'POST')).status).toBe(200);
  await request('/list-sync/fake/export', 'POST');
  await run();

  const disconnected = (await (
    await request('/list-sync/fake', 'DELETE')
  ).json()) as ListSyncOverview;
  expect(disconnected.providers[0]!.connection).toBeNull();
  expect(await auth.database.listSyncItem.count({ where: { entryId: kept.entryId } })).toBe(0);
  expect((await request(`/library/entries/${kept.entryId}`)).status).toBe(200);
});
