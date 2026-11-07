import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  LibraryMutationPreview,
  LibraryMutationResult,
  OwnerSnapshot,
  ServerEntry,
} from '@filecab/contracts';
import type { PrismaClient } from '../generated/prisma/client';
import { validateEnvironment } from '../config/environment';
import { createApiApplication } from '../http/application';
import { AuthService, type SessionTokens } from '../auth/auth.service';
import {
  AuthClient,
  credentialHash,
  randomCredential,
  verifierChallenge,
} from '../auth/credentials';
import { LibraryMutationService } from './mutation.service';

const prefix = `library-api-${randomUUID()}`;
const secret = Buffer.alloc(32, 21).toString('base64');
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
  PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32, 22).toString('base64'),
  KINOPOISK_ENABLED: 'false',
  SMOTRET_ENABLED: 'false',
  SHIKIMORI_ENABLED: 'false',
});
const stateHashes: string[] = [];

const catalogIds: string[] = [];

let app: NestExpressApplication;
let auth: AuthService;
let base: string;
let first: SessionTokens;
let other: SessionTokens;

/** Authenticates a fixture account through the real persisted login/exchange boundary. */
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
  const returned = await auth.callback(state, started.binding, subject);

  return auth.exchange(new URL(returned.returnTo).searchParams.get('code')!, attempt, verifier);
}

beforeAll(async () => {
  app = await createApiApplication(environment, {
    diagnostic: () => {},
    google: {
      authorizationUrl: (state) => `https://accounts.google.com/?state=${state}`,
      exchange: async (code) => `${prefix}-${code}`,
    },
  });
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1/library`;
  auth = app.get(AuthService);
  first = await login('first');
  other = await login('other');
});

afterAll(async () => {
  if (auth) {
    await auth.database.user.deleteMany({ where: { googleSubject: { startsWith: prefix } } });
    await auth.database.catalogItem.deleteMany({ where: { id: { in: catalogIds } } });
    await auth.database.loginAttempt.deleteMany({ where: { stateHash: { in: stateHashes } } });
  }

  await app?.close();
});

/** Sends owner-scoped requests without relying on user-specific local credentials. */
function request(path: string, method = 'GET', body?: unknown, owner = first) {
  return fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Persists a manual item through the public API, with catalog providers disabled. */
async function create(fields: Record<string, unknown> = {}, owner = first): Promise<ServerEntry> {
  const response = await request(
    '/entries',
    'POST',
    { category: 'anime', userTitle: '  原文  ', ...fields },
    owner,
  );
  expect(response.status).toBe(201);

  return response.json() as Promise<ServerEntry>;
}

test('manual persistence, complete snapshots and field clearing work without catalog providers', async () => {
  const entry = await create({
    status: 'hide',
    comment: 'private notes',
    progress: 12,
    rating: 9,
    sourceUrls: ['https://example.com/watch?id=001'],
  });
  expect(entry).toMatchObject({
    userTitle: '  原文  ',
    catalogId: null,
    status: 'hide',
    progress: 12,
    snapshot: { posterUrl: null, episodeCount: null },
  });
  const response = await request('');
  const snapshot = (await response.json()) as OwnerSnapshot;
  expect(snapshot.entries).toContainEqual(entry);
  expect(BigInt(snapshot.revision)).toBeGreaterThanOrEqual(BigInt(entry.serverVersion));
  const noOp = await request(`/entries/${entry.entryId}`, 'PATCH', {
    expectedVersion: entry.serverVersion,
  });
  expect(await noOp.json()).toEqual(entry);
  const updated = await request(`/entries/${entry.entryId}`, 'PATCH', {
    expectedVersion: entry.serverVersion,
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sourceUrls: [],
  });
  expect(updated.status).toBe(200);
  const cleared = (await updated.json()) as ServerEntry;
  expect(cleared).toMatchObject({
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sources: [],
    createdAt: entry.createdAt,
  });
  const deletedResponse = await request(`/entries/${entry.entryId}`, 'DELETE', {
    expectedVersion: cleared.serverVersion,
  });
  const deleted = (await deletedResponse.json()) as ServerEntry;
  expect(deletedResponse.status).toBe(200);
  expect(deleted.deleted).toBe(true);
  expect((await request(`/entries/${entry.entryId}`)).status).toBe(404);
  const afterDelete = (await (await request('')).json()) as OwnerSnapshot;
  expect(afterDelete.entries.some((item) => item.entryId === entry.entryId)).toBe(false);
  const restored = await request(`/entries/${entry.entryId}/restore`, 'POST', {
    expectedVersion: deleted.serverVersion,
  });
  expect(restored.status).toBe(200);
  expect(await restored.json()).toMatchObject({
    entryId: entry.entryId,
    deleted: false,
    createdAt: entry.createdAt,
    userTitle: entry.userTitle,
  });
});

test('ownership, request allowlists and canonical versions reject unauthorized or forged fields', async () => {
  const entry = await create();
  expect((await fetch(base)).status).toBe(401);
  for (const path of ['', '?page=1', '?search=private']) {
    const response = await request(path);
    expect(response.status).toBe(path ? 400 : 200);
  }
  expect((await request(`/entries/${entry.entryId}`, 'GET', undefined, other)).status).toBe(404);
  expect(
    (
      await request(
        `/entries/${entry.entryId}`,
        'PATCH',
        { expectedVersion: entry.serverVersion, comment: 'attack' },
        other,
      )
    ).status,
  ).toBe(404);
  for (const invalid of [
    {},
    { category: 'anime' },
    { category: 'anime', userTitle: '  ' },
    { category: 'anime', userTitle: 'Title', ownerId: other.ownerId },
    { category: 'anime', userTitle: 'Title', snapshot: {} },
    { category: 'invalid', userTitle: 'Title' },
  ])
    expect((await request('/entries', 'POST', invalid)).status).toBe(400);
  for (const expectedVersion of [1, '01', '0', null])
    expect(
      (await request(`/entries/${entry.entryId}`, 'PATCH', { expectedVersion, comment: 'changed' }))
        .status,
    ).toBe(400);
  expect((await request('/entries/not-a-uuid')).status).toBe(400);
  expect(
    (
      await request(`/entries/${entry.entryId}`, 'PATCH', {
        expectedVersion: entry.serverVersion,
        userTitle: '',
      })
    ).status,
  ).toBe(400);
});

test('concurrent edits have one winner and conflicting restore rolls back the library revision', async () => {
  const url = `https://example.com/${randomUUID()}`;
  const entry = await create({ sourceUrls: [url] });
  const results = await Promise.all([
    request(`/entries/${entry.entryId}`, 'PATCH', {
      expectedVersion: entry.serverVersion,
      comment: 'first edit',
    }),
    request(`/entries/${entry.entryId}`, 'PATCH', {
      expectedVersion: entry.serverVersion,
      comment: 'second edit',
    }),
  ]);
  expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  const current = (await (await request(`/entries/${entry.entryId}`)).json()) as ServerEntry;
  const deleted = (await (
    await request(`/entries/${entry.entryId}`, 'DELETE', { expectedVersion: current.serverVersion })
  ).json()) as ServerEntry;
  await create({ sourceUrls: [url] });
  const before = (await (await request('')).json()) as OwnerSnapshot;
  expect(
    (
      await request(`/entries/${entry.entryId}/restore`, 'POST', {
        expectedVersion: deleted.serverVersion,
      })
    ).status,
  ).toBe(409);
  expect(await (await request('')).json()).toEqual(before);
});

test('merge previews have no side effects and bind ownership, choices and both versions', async () => {
  const survivor = await create({
    comment: 'kept',
    sourceUrls: [`https://example.com/${randomUUID()}`],
  });
  const removed = await create({ sourceUrls: [`https://example.com/${randomUUID()}`] });
  const input = {
    survivorId: survivor.entryId,
    survivorVersion: survivor.serverVersion,
    removedId: removed.entryId,
    removedVersion: removed.serverVersion,
    fields: { comment: 'chosen comment' },
  };
  const before = await (await request('')).json();
  const previewResponse = await request('/merges/preview', 'POST', input);
  expect(previewResponse.status).toBe(200);
  const preview = (await previewResponse.json()) as LibraryMutationPreview;
  expect(preview.changes[0].proposed).toMatchObject({
    entryId: survivor.entryId,
    comment: 'chosen comment',
    serverVersion: null,
    sources: [...survivor.sources, ...removed.sources],
  });
  expect(preview.changes[1].proposed.deleted).toBe(true);
  expect(await (await request('')).json()).toEqual(before);
  await create({ userTitle: 'Unrelated entry changed after preview' });
  expect(
    (
      await request('/merges/apply', 'POST', {
        ...input,
        fields: { comment: 'changed choice' },
        previewToken: preview.previewToken,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(
        '/merges/apply',
        'POST',
        { ...input, previewToken: preview.previewToken },
        other,
      )
    ).status,
  ).toBe(404);
  const applied = await request('/merges/apply', 'POST', {
    ...input,
    previewToken: preview.previewToken,
  });
  expect(applied.status).toBe(200);
  const result = (await applied.json()) as LibraryMutationResult;
  expect(result.entries[0]).toMatchObject({
    entryId: survivor.entryId,
    createdAt: survivor.createdAt,
    comment: 'chosen comment',
  });
  expect(result.entries[1]).toMatchObject({ entryId: removed.entryId, deleted: true });
  expect(
    (await request('/merges/apply', 'POST', { ...input, previewToken: preview.previewToken }))
      .status,
  ).toBe(409);
});

test('stale or tampered previews fail while source movement commits both documents atomically', async () => {
  const from = await create({ sourceUrls: [`https://example.com/${randomUUID()}`] });
  const to = await create();
  const input = {
    fromId: from.entryId,
    fromVersion: from.serverVersion,
    toId: to.entryId,
    toVersion: to.serverVersion,
    normalizedUrl: from.sources[0].normalizedUrl,
  };
  const preview = (await (
    await request('/sources/reassignment/preview', 'POST', input)
  ).json()) as LibraryMutationPreview;
  const tampered =
    preview.previewToken.slice(0, -1) + (preview.previewToken.endsWith('a') ? 'b' : 'a');
  expect(
    (await request('/sources/reassignment/apply', 'POST', { ...input, previewToken: tampered }))
      .status,
  ).toBe(409);
  const updated = (await (
    await request(`/entries/${to.entryId}`, 'PATCH', {
      expectedVersion: to.serverVersion,
      comment: 'edited after preview',
    })
  ).json()) as ServerEntry;
  expect(
    (
      await request('/sources/reassignment/apply', 'POST', {
        ...input,
        previewToken: preview.previewToken,
      })
    ).status,
  ).toBe(409);
  input.toVersion = updated.serverVersion;
  const fresh = (await (
    await request('/sources/reassignment/preview', 'POST', input)
  ).json()) as LibraryMutationPreview;
  const result = await request('/sources/reassignment/apply', 'POST', {
    ...input,
    previewToken: fresh.previewToken,
  });
  expect(result.status).toBe(200);
  const { entries } = (await result.json()) as LibraryMutationResult;
  expect(entries[0].sources).toEqual([]);
  expect(entries[1].sources).toEqual(from.sources);
  const history = await auth.database.entryChange.findMany({
    where: { ownerId: first.ownerId, revision: { gte: BigInt(entries[0].serverVersion) } },
    orderBy: { revision: 'asc' },
  });
  expect(history.map((change) => change.entryId)).toEqual([from.entryId, to.entryId]);
});

test('snapshot revision and entries stay consistent while a later mutation commits between queries', async () => {
  const owner = await login('snapshot-race');
  const entry = await create({}, owner);
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const intercepted = auth.database.$extends({
    query: {
      libraryEntry: {
        async findMany({ args, query }) {
          reached();
          await gate;

          return query(args);
        },
      },
    },
  });
  const mutations = new LibraryMutationService(intercepted as unknown as PrismaClient);
  const reading = mutations.snapshot(owner.ownerId);
  await paused;
  try {
    expect(
      (
        await request(
          `/entries/${entry.entryId}`,
          'PATCH',
          { expectedVersion: entry.serverVersion, comment: 'later commit' },
          owner,
        )
      ).status,
    ).toBe(200);
  } finally {
    release();
  }
  const consistent = await reading;
  expect(consistent.revision).toBe(entry.serverVersion);
  expect(consistent.entries).toEqual([entry]);
  const latest = (await (await request('', 'GET', undefined, owner)).json()) as OwnerSnapshot;
  expect(latest.entries[0].comment).toBe('later commit');
  expect(BigInt(latest.revision)).toBeGreaterThan(BigInt(consistent.revision));
});

test('OpenAPI describes complete snapshots, nullable metadata, versions and protected access', async () => {
  const response = await fetch(`${await app.getUrl()}/api/docs-json`);
  const document = await response.json();
  expect(document).toMatchObject({
    paths: {
      '/api/v1/library': {
        get: {
          security: expect.arrayContaining([{ bearer: [] }, { cookie: [] }]),
          responses: {
            '200': {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/OwnerSnapshotDto' } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        SnapshotDto: {
          properties: { episodeCount: { nullable: true }, originalTitle: { nullable: true } },
        },
        ServerEntryDto: {
          properties: {
            serverVersion: { type: 'string', nullable: false },
            status: { nullable: true },
          },
        },
        CreateLibraryEntryDto: { required: expect.arrayContaining(['category']) },
      },
    },
  });
});

test('catalog association uses server metadata and merge preserves manual identity without losing sources', async () => {
  const manual = await create({
    userTitle: 'manual identity',
    sourceUrls: [`https://example.com/${randomUUID()}`],
  });
  const catalogId = randomUUID();
  catalogIds.push(catalogId);
  const snapshot = {
    ...manual.snapshot,
    episodeCount: 12,
    year: 2024,
    posterUrl: 'https://example.com/poster.jpg',
  };
  await auth.database.catalogItem.create({
    data: { id: catalogId, category: 'anime', snapshot: JSON.parse(JSON.stringify(snapshot)) },
  });
  expect((await request('/entries', 'POST', { category: 'films', catalogId })).status).toBe(400);
  const response = await request('/entries', 'POST', {
    category: 'anime',
    catalogId,
    sourceUrls: [`https://example.com/${randomUUID()}`],
  });
  expect(response.status).toBe(201);
  const linked = (await response.json()) as ServerEntry;
  expect(linked.userTitle).toBe('');
  expect(linked.snapshot).toEqual(snapshot);
  expect((await request('/entries', 'POST', { category: 'anime', catalogId })).status).toBe(409);
  const input = {
    survivorId: manual.entryId,
    survivorVersion: manual.serverVersion,
    removedId: linked.entryId,
    removedVersion: linked.serverVersion,
    fields: {},
  };
  expect((await request('/merges/apply', 'POST', input)).status).toBe(400);
  const preview = (await (
    await request('/merges/preview', 'POST', input)
  ).json()) as LibraryMutationPreview;
  const applied = await request('/merges/apply', 'POST', {
    ...input,
    previewToken: preview.previewToken,
  });
  expect(applied.status).toBe(200);
  const { entries } = (await applied.json()) as LibraryMutationResult;
  expect(entries[0]).toMatchObject({
    entryId: manual.entryId,
    createdAt: manual.createdAt,
    userTitle: manual.userTitle,
    catalogId,
    snapshot,
    sources: [...manual.sources, ...linked.sources],
  });
  expect(
    (
      await request(`/entries/${linked.entryId}/restore`, 'POST', {
        expectedVersion: entries[1].serverVersion,
      })
    ).status,
  ).toBe(409);
  const progressResponse = await request(`/entries/${manual.entryId}`, 'PATCH', {
    expectedVersion: entries[0].serverVersion,
    progress: 15,
  });
  expect(progressResponse.status).toBe(200);
  expect(await progressResponse.json()).toMatchObject({ progress: 15, status: null });
});

/** Exercises replication through real authentication, DTOs and owner transactions. */
function replicate(operation: 'pull' | 'push', body: unknown, owner = first) {
  return fetch(base.replace(/library$/, `replication/${operation}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('replication retries, stale intent, tombstones and account collisions preserve server state', async () => {
  const original = await create({ userTitle: 'Replication original' });
  const proposed = { ...original, comment: 'offline intent', progress: 5 };
  const batch = { schemaVersion: 1, rows: [{ assumedMaster: original, proposed }] };
  expect(await (await replicate('push', batch)).json()).toEqual({
    schemaVersion: 1,
    conflicts: [],
  });
  const current = await app.get(LibraryMutationService).get(first.ownerId, original.entryId);
  expect(current).toMatchObject({
    comment: 'offline intent',
    progress: 5,
    createdAt: original.createdAt,
  });
  expect(current.serverVersion).not.toBe(original.serverVersion);
  expect(await (await replicate('push', batch)).json()).toEqual({
    schemaVersion: 1,
    conflicts: [],
  });
  expect(await app.get(LibraryMutationService).get(first.ownerId, original.entryId)).toEqual(
    current,
  );
  const conflict = await replicate('push', {
    schemaVersion: 1,
    rows: [{ assumedMaster: original, proposed: { ...original, comment: 'stale intent' } }],
  });
  expect(await conflict.json()).toMatchObject({
    conflicts: [{ reason: 'VERSION', serverDocument: current }],
  });
  const collision = await replicate(
    'push',
    { schemaVersion: 1, rows: [{ assumedMaster: null, proposed }] },
    other,
  );
  expect(await collision.json()).toMatchObject({
    conflicts: [{ reason: 'IDENTITY', serverDocument: null }],
  });

  const deletion = {
    schemaVersion: 1,
    rows: [{ assumedMaster: current, proposed: { ...current, deleted: true } }],
  };
  expect((await replicate('push', deletion)).status).toBe(200);
  const deletedRow = await auth.database.libraryEntry.findUniqueOrThrow({
    where: { id: current.entryId },
  });
  const deleted = deletedRow.document as unknown as ServerEntry;
  expect(deleted.deleted).toBe(true);
  expect((await replicate('push', deletion)).status).toBe(200);
  const pull = await replicate('pull', {
    schemaVersion: 1,
    checkpoint: { cursor: current.serverVersion, entryId: current.entryId },
    limit: 100,
  });
  expect(await pull.json()).toMatchObject({ documents: expect.arrayContaining([deleted]) });
  const restoration = await replicate('push', {
    schemaVersion: 1,
    rows: [{ assumedMaster: deleted, proposed: { ...deleted, deleted: false } }],
  });
  expect(await restoration.json()).toEqual({ schemaVersion: 1, conflicts: [] });
});

test('replication creates are retry safe and cannot inject metadata or duplicate source claims', async () => {
  const template = await create({ sourceUrls: ['https://example.com/replication-source'] });
  const proposed = { ...template, entryId: randomUUID(), serverVersion: null, sources: [] };
  const batch = { schemaVersion: 1, rows: [{ assumedMaster: null, proposed }] };
  expect(await (await replicate('push', batch)).json()).toEqual({
    schemaVersion: 1,
    conflicts: [],
  });
  const current = await app.get(LibraryMutationService).get(first.ownerId, proposed.entryId);
  expect(await (await replicate('push', batch)).json()).toEqual({
    schemaVersion: 1,
    conflicts: [],
  });
  expect(await app.get(LibraryMutationService).get(first.ownerId, proposed.entryId)).toEqual(
    current,
  );
  const invalid = await replicate('push', {
    schemaVersion: 1,
    rows: [
      {
        assumedMaster: current,
        proposed: { ...current, snapshot: { ...current.snapshot, year: 2020 } },
      },
    ],
  });
  expect(invalid.status).toBe(400);
  const sourceConflict = await replicate('push', {
    schemaVersion: 1,
    rows: [{ assumedMaster: current, proposed: { ...current, sources: template.sources } }],
  });
  expect(await sourceConflict.json()).toMatchObject({
    conflicts: [{ reason: 'SOURCE', serverDocument: current }],
  });
  expect(await app.get(LibraryMutationService).get(first.ownerId, proposed.entryId)).toEqual(
    current,
  );
});

test('pull batches follow committed revisions and detect unavailable history without leaking other owners', async () => {
  const owner = await login('pull-isolation');
  const one = await create({ userTitle: 'One' }, owner);
  const two = await create({ userTitle: 'Two' }, owner);
  const mutations = app.get(LibraryMutationService);
  const changed = await mutations.update(owner.ownerId, one.entryId, one.serverVersion, {
    progress: 7,
  });
  const firstPage = await replicate(
    'pull',
    { schemaVersion: 1, checkpoint: null, limit: 2 },
    owner,
  );
  expect(await firstPage.json()).toEqual({
    schemaVersion: 1,
    documents: [one, two],
    checkpoint: { cursor: two.serverVersion, entryId: two.entryId },
    hasMore: true,
  });
  const secondPage = await replicate(
    'pull',
    { schemaVersion: 1, checkpoint: { cursor: two.serverVersion, entryId: two.entryId }, limit: 2 },
    owner,
  );
  expect(await secondPage.json()).toMatchObject({ documents: [changed], hasMore: false });
  const reset = await replicate(
    'pull',
    { schemaVersion: 1, checkpoint: { cursor: '9223372036854775807', entryId: null }, limit: 2 },
    owner,
  );
  expect(reset.status).toBe(409);
  expect(await reset.json()).toMatchObject({ code: 'SYNC_RESET_REQUIRED' });
  await auth.database.entryChange.delete({
    where: { ownerId_revision: { ownerId: owner.ownerId, revision: 2n } },
  });
  const gap = await replicate(
    'pull',
    { schemaVersion: 1, checkpoint: { cursor: '1', entryId: null }, limit: 2 },
    owner,
  );
  expect(await gap.json()).toMatchObject({ code: 'SYNC_RESET_REQUIRED' });
});

test('push validates all request shapes first and documents independent mixed-row commits', async () => {
  const firstEntry = await create();
  const secondEntry = await create();
  const firstRow = {
    assumedMaster: firstEntry,
    proposed: { ...firstEntry, comment: 'mixed valid' },
  };
  const stale = { assumedMaster: secondEntry, proposed: { ...secondEntry, progress: 10 } };
  const current = await app
    .get(LibraryMutationService)
    .update(first.ownerId, secondEntry.entryId, secondEntry.serverVersion, { progress: 3 });
  const mixed = await replicate('push', { schemaVersion: 1, rows: [firstRow, stale] });
  expect(await mixed.json()).toMatchObject({
    conflicts: [{ entryId: secondEntry.entryId, serverDocument: current }],
  });
  expect(
    await app.get(LibraryMutationService).get(first.ownerId, firstEntry.entryId),
  ).toMatchObject({ comment: 'mixed valid' });
  for (const body of [
    { schemaVersion: 1, rows: [firstRow, firstRow] },
    { schemaVersion: 1, rows: [{ ...firstRow, ownerId: other.ownerId }] },
    { schemaVersion: 1, rows: [{ ...firstRow, proposed: { ...firstRow.proposed, rating: 11 } }] },
  ])
    expect((await replicate('push', body)).status).toBe(400);

  const semantic = await replicate('push', {
    schemaVersion: 1,
    rows: [
      { assumedMaster: current, proposed: { ...current, comment: 'committed before error' } },
      {
        assumedMaster: null,
        proposed: { ...firstEntry, entryId: randomUUID(), serverVersion: null, userTitle: '' },
      },
    ],
  });
  expect(semantic.status).toBe(400);
  expect(
    await app.get(LibraryMutationService).get(first.ownerId, secondEntry.entryId),
  ).toMatchObject({ comment: 'committed before error' });
  const docs = await fetch(base.replace(/v1\/library$/, 'docs-json'));
  const schema = (await docs.json()) as { paths: Record<string, unknown> };
  expect(schema.paths).toHaveProperty('/api/v1/replication/pull');
  expect(schema.paths).toHaveProperty('/api/v1/replication/push');
});

test('concurrent replicated writes serialize assumed-state checks and publish only the winner', async () => {
  const owner = await login('replication-concurrency');
  const entry = await create({}, owner);
  const results = await Promise.all(
    [1, 2].map((progress) =>
      replicate(
        'push',
        {
          schemaVersion: 1,
          rows: [{ assumedMaster: entry, proposed: { ...entry, progress } }],
        },
        owner,
      ),
    ),
  );
  const bodies = (await Promise.all(results.map((response) => response.json()))) as Array<{
    conflicts: unknown[];
  }>;
  expect(bodies.map((body) => body.conflicts.length).sort()).toEqual([0, 1]);
  const changes = await auth.database.entryChange.findMany({
    where: { ownerId: owner.ownerId },
    orderBy: { revision: 'asc' },
  });
  expect(changes).toHaveLength(2);
  expect(changes.map((change) => change.revision)).toEqual([1n, 2n]);
  const pulled = await replicate('pull', { schemaVersion: 1, checkpoint: null, limit: 100 }, owner);
  const current = await app.get(LibraryMutationService).get(owner.ownerId, entry.entryId);
  expect(await pulled.json()).toEqual({
    schemaVersion: 1,
    documents: [current],
    checkpoint: { cursor: '2', entryId: entry.entryId },
    hasMore: false,
  });
});
