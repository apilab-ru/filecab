import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  ApiError,
  Backup,
  PublicLibrary,
  BackupPreview,
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
import { emptySnapshot, toBackup } from '@filecab/contracts';

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
    // The removed entry is newer, so the merge keeps its link.
    sources: removed.sources,
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

test('an entry keeps at most one link that an update can add, replace, move or remove', async () => {
  const link = `https://example.com/${randomUUID()}`;
  expect(
    (
      await request('/entries', 'POST', {
        category: 'anime',
        userTitle: 'Two links',
        sourceUrls: [link, `${link}/second`],
      })
    ).status,
  ).toBe(400);
  const linked = await create({ sourceUrls: [link] });
  expect(linked.sources.map((source) => source.originalUrl)).toEqual([link]);
  const replaced = (await (
    await request(`/entries/${linked.entryId}`, 'PATCH', {
      expectedVersion: linked.serverVersion,
      sourceUrls: [`${link}/other`],
    })
  ).json()) as ServerEntry;
  expect(replaced.sources.map((source) => source.originalUrl)).toEqual([`${link}/other`]);
  const removed = (await (
    await request(`/entries/${linked.entryId}`, 'PATCH', {
      expectedVersion: replaced.serverVersion,
      sourceUrls: [],
    })
  ).json()) as ServerEntry;
  expect(removed.sources).toEqual([]);
  const added = (await (
    await request(`/entries/${linked.entryId}`, 'PATCH', {
      expectedVersion: removed.serverVersion,
      sourceUrls: [link],
    })
  ).json()) as ServerEntry;
  expect(added.sources.map((source) => source.originalUrl)).toEqual([link]);

  // A Page tab save to another entry moves the link in one transaction.
  const target = await create({ userTitle: 'Link target' });
  const moved = await request(`/entries/${target.entryId}`, 'PATCH', {
    expectedVersion: target.serverVersion,
    sourceUrls: [link],
  });
  expect(moved.status).toBe(200);
  const winner = (await moved.json()) as ServerEntry;
  const loser = (await (await request(`/entries/${linked.entryId}`)).json()) as ServerEntry;
  expect(winner.sources.map((source) => source.originalUrl)).toEqual([link]);
  expect(loser).toMatchObject({ deleted: false, sources: [] });
  expect(BigInt(loser.serverVersion)).toBeGreaterThan(BigInt(added.serverVersion));
  expect(BigInt(winner.serverVersion)).toBeGreaterThan(BigInt(loser.serverVersion));
  const created = await create({ userTitle: 'New owner', sourceUrls: [link] });
  expect(created.sources.map((source) => source.originalUrl)).toEqual([link]);
  expect(
    ((await (await request(`/entries/${target.entryId}`)).json()) as ServerEntry).sources,
  ).toEqual([]);
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

test('catalog association uses server metadata and merge keeps the manual identity and the latest link', async () => {
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
    sources: linked.sources,
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

test('replication creates are retry safe, cannot inject metadata and move a duplicate link', async () => {
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
  const duplicate = { ...template, entryId: randomUUID(), serverVersion: null };
  const moved = await replicate('push', {
    schemaVersion: 1,
    rows: [{ assumedMaster: null, proposed: duplicate }],
  });
  expect(await moved.json()).toEqual({ schemaVersion: 1, conflicts: [] });
  expect(
    (await app.get(LibraryMutationService).get(first.ownerId, duplicate.entryId)).sources,
  ).toEqual(template.sources);
  expect(
    (await app.get(LibraryMutationService).get(first.ownerId, template.entryId)).sources,
  ).toEqual([]);
  expect(await app.get(LibraryMutationService).get(first.ownerId, proposed.entryId)).toEqual(
    current,
  );
  const staleSnapshot = await replicate('push', {
    schemaVersion: 1,
    rows: [
      {
        assumedMaster: current,
        proposed: {
          ...current,
          comment: 'Kept with a stale snapshot',
          snapshot: { ...current.snapshot, year: 2020 },
        },
      },
    ],
  });
  expect(await staleSnapshot.json()).toEqual({ schemaVersion: 1, conflicts: [] });
  const kept = await app.get(LibraryMutationService).get(first.ownerId, proposed.entryId);
  expect(kept.comment).toBe('Kept with a stale snapshot');
  expect(kept.snapshot).toEqual(current.snapshot);
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
      {
        assumedMaster: null,
        proposed: { ...firstEntry, entryId: randomUUID(), serverVersion: null, userTitle: '' },
      },
      { assumedMaster: current, proposed: { ...current, comment: 'committed after error' } },
      {
        assumedMaster: current,
        proposed: { ...firstEntry, entryId: randomUUID(), serverVersion: null },
      },
    ],
  });
  expect(semantic.status).toBe(200);
  expect(await semantic.json()).toEqual({
    schemaVersion: 1,
    conflicts: [],
    issues: [
      { path: ['rows', 0, 'proposed', 'userTitle'], message: expect.any(String) },
      { path: ['rows', 2, 'assumedMaster'], message: expect.any(String) },
    ],
  });
  expect(
    await app.get(LibraryMutationService).get(first.ownerId, secondEntry.entryId),
  ).toMatchObject({ comment: 'committed after error' });
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

test('catalog association HTTP preview validates input and confirms canonical metadata with preserved UUID', async () => {
  const catalogId = randomUUID();
  catalogIds.push(catalogId);
  const manual = await create({
    userTitle: 'Manual association',
    progress: 12,
    comment: 'Private note',
  });
  const { emptySnapshot } = await import('@filecab/contracts');
  const snapshot = { ...emptySnapshot(), year: 2022 };
  await auth.database.catalogItem.create({
    data: { id: catalogId, category: 'anime', snapshot: JSON.parse(JSON.stringify(snapshot)) },
  });
  const input = {
    entryId: manual.entryId,
    expectedVersion: manual.serverVersion,
    catalogId,
    fields: {},
  };
  expect((await request('/catalog/preview', 'POST', { ...input, snapshot: {} })).status).toBe(400);
  const response = await request('/catalog/preview', 'POST', input);
  expect(response.status).toBe(200);
  const preview = (await response.json()) as LibraryMutationPreview;
  expect(preview.changes[0].before.catalogId).toBeNull();
  expect(preview.changes[0].proposed).toMatchObject({
    entryId: manual.entryId,
    catalogId,
    comment: 'Private note',
    progress: 12,
    snapshot,
  });
  expect(
    (
      await request(
        '/catalog/apply',
        'POST',
        { ...input, previewToken: preview.previewToken },
        other,
      )
    ).status,
  ).toBe(404);
  const applied = await request('/catalog/apply', 'POST', {
    ...input,
    previewToken: preview.previewToken,
  });
  expect(applied.status).toBe(200);
  const result = (await applied.json()) as LibraryMutationResult;
  expect(result.entries[0]).toMatchObject({
    entryId: manual.entryId,
    createdAt: manual.createdAt,
    catalogId,
    snapshot,
  });
  expect(
    (await request('/catalog/apply', 'POST', { ...input, previewToken: preview.previewToken }))
      .status,
  ).toBe(409);
});

test('an explicit website owner precondition cannot write through a different authenticated account', async () => {
  const response = await fetch(`${base}/entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${first.accessToken}`,
      'Content-Type': 'application/json',
      'X-Filecab-Owner': other.ownerId,
    },
    body: JSON.stringify({ category: 'anime', userTitle: 'Must not be committed' }),
  });
  expect(response.status).toBe(409);
  const snapshot = (await (await request('')).json()) as OwnerSnapshot;
  expect(snapshot.entries.some((entry) => entry.userTitle === 'Must not be committed')).toBe(false);
});

/** Previews a backup for an owner and returns the response status and body. */
async function previewBackup(backup: unknown, owner: SessionTokens) {
  const response = await request('/backup/preview', 'POST', backup, owner);

  return { status: response.status, body: (await response.json()) as BackupPreview & ApiError };
}

test('backup restore replaces the library atomically, exchanges claims and publishes tombstones', async () => {
  const owner = await login(`backup-${randomUUID()}`);
  const linkA = `https://example.com/${randomUUID()}`;
  const linkB = `https://example.com/${randomUUID()}`;
  const kept = await create({ userTitle: 'Kept' }, owner);
  const changed = await create({ userTitle: 'Changed', sourceUrls: [linkA] }, owner);
  const removed = await create({ userTitle: 'Removed', sourceUrls: [linkB] }, owner);
  const catalogId = randomUUID();
  catalogIds.push(catalogId);
  await auth.database.catalogItem.create({
    data: {
      id: catalogId,
      category: 'anime',
      snapshot: JSON.parse(JSON.stringify({ ...emptySnapshot(), year: 2001 })),
    },
  });
  const exported = (await (await request('/backup', 'GET', undefined, owner)).json()) as Backup;
  expect(exported.entries).toHaveLength(3);
  expect(exported.entries[0]).not.toHaveProperty('serverVersion');

  const addedId = randomUUID();
  const backup: Backup = {
    schemaVersion: 1,
    entries: [
      exported.entries.find((entry) => entry.entryId === kept.entryId)!,
      {
        ...exported.entries.find((entry) => entry.entryId === changed.entryId)!,
        userTitle: 'Restored',
        sources: [{ originalUrl: linkB, normalizedUrl: linkB, policyVersion: 'generic-v1' }],
        updatedAt: '2020-01-02T00:00:00.000Z',
        createdAt: '2020-01-01T00:00:00.000Z',
      },
      {
        ...exported.entries.find((entry) => entry.entryId === kept.entryId)!,
        entryId: addedId,
        catalogId,
        userTitle: '',
        sources: [{ originalUrl: linkA, normalizedUrl: linkA, policyVersion: 'generic-v1' }],
        snapshot: { ...emptySnapshot(), year: 1900 },
      },
    ],
  };
  const preview = await previewBackup(backup, owner);
  expect(preview.status).toBe(200);
  expect(preview.body.comparison).toEqual({
    current: 3,
    incoming: 3,
    added: 1,
    updated: 1,
    unchanged: 1,
    removed: 1,
    conflicts: 1,
  });

  const restored = await request(
    '/backup/restore',
    'POST',
    { backup, confirmationToken: preview.body.confirmationToken },
    owner,
  );
  expect(restored.status).toBe(200);
  const snapshot = (await restored.json()) as OwnerSnapshot;
  const byId = new Map(snapshot.entries.map((entry) => [entry.entryId, entry]));
  expect(byId.size).toBe(3);
  expect(byId.get(kept.entryId)).toEqual(kept);
  expect(byId.get(changed.entryId)).toMatchObject({
    userTitle: 'Restored',
    sources: [{ normalizedUrl: linkB }],
    createdAt: '2020-01-01T00:00:00.000Z',
  });
  expect(BigInt(byId.get(changed.entryId)!.serverVersion)).toBeGreaterThan(
    BigInt(removed.serverVersion),
  );
  expect(byId.get(addedId)!.snapshot.year).toBe(2001);

  const pulled = (await (
    await fetch(base.replace(/\/library$/, '/replication/pull'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        checkpoint: { cursor: removed.serverVersion, entryId: null },
        limit: 100,
      }),
    })
  ).json()) as { documents: ServerEntry[] };
  expect(pulled.documents[0]).toMatchObject({ entryId: removed.entryId, deleted: true });

  const replay = await request(
    '/backup/restore',
    'POST',
    { backup, confirmationToken: preview.body.confirmationToken },
    owner,
  );
  expect(replay.status).toBe(409);
});

test('backup validation reports entry indexes and rejects old formats and unavailable identities', async () => {
  const owner = await login(`backup-${randomUUID()}`);
  const foreign = await create({ userTitle: 'Foreign' }, other);
  const valid = toBackup([{ ...foreign, entryId: randomUUID() }]).entries[0]!;

  expect((await previewBackup([valid], owner)).status).toBe(400);
  expect((await previewBackup({ data: { anime: [valid] } }, owner)).status).toBe(400);
  expect((await previewBackup({ schemaVersion: 2, entries: [] }, owner)).status).toBe(400);
  const unknown = await previewBackup(
    { schemaVersion: 1, entries: [{ ...valid, serverVersion: '1' }] },
    owner,
  );
  expect(unknown.status).toBe(400);

  const invalid = await previewBackup(
    {
      schemaVersion: 1,
      entries: [
        valid,
        { ...valid, userTitle: 'Again' },
        { ...valid, entryId: foreign.entryId },
        { ...valid, entryId: randomUUID(), catalogId: randomUUID() },
        {
          ...valid,
          entryId: randomUUID(),
          sources: [
            {
              originalUrl: 'https://u:p@example.com/',
              normalizedUrl: 'https://u:p@example.com/',
              policyVersion: 'generic-v1',
            },
          ],
        },
      ],
    },
    owner,
  );
  expect(invalid.status).toBe(400);
  expect(invalid.body.issues!.map((issue) => issue.path)).toEqual([
    ['entries', 1, 'entryId'],
    ['entries', 4, 'sources', 0, 'originalUrl'],
    ['entries', 2, 'entryId'],
    ['entries', 3, 'catalogId'],
  ]);
  expect(JSON.stringify(invalid.body)).not.toContain('u:p@');
  expect(
    ((await (await request('', 'GET', undefined, owner)).json()) as OwnerSnapshot).entries,
  ).toEqual([]);
});

test('a backup restore stops after a library change and an empty restore needs confirmation', async () => {
  const owner = await login(`backup-${randomUUID()}`);
  const entry = await create({ userTitle: 'Current' }, owner);
  const backup = toBackup([{ ...entry, userTitle: 'Old' }]);
  const preview = await previewBackup(backup, owner);
  await create({ userTitle: 'Later' }, owner);
  const stale = await request(
    '/backup/restore',
    'POST',
    { backup, confirmationToken: preview.body.confirmationToken },
    owner,
  );
  expect(stale.status).toBe(409);

  const fresh = await previewBackup(backup, owner);
  const altered = await request(
    '/backup/restore',
    'POST',
    {
      backup: { ...backup, entries: [{ ...backup.entries[0]!, userTitle: 'Altered' }] },
      confirmationToken: fresh.body.confirmationToken,
    },
    owner,
  );
  expect(altered.status).toBe(409);
  expect(
    ((await (await request('', 'GET', undefined, owner)).json()) as OwnerSnapshot).entries,
  ).toHaveLength(2);

  const empty: Backup = { schemaVersion: 1, entries: [] };
  const emptyPreview = await previewBackup(empty, owner);
  expect(emptyPreview.body.comparison.removed).toBe(2);
  const unconfirmed = await request(
    '/backup/restore',
    'POST',
    { backup: empty, confirmationToken: emptyPreview.body.confirmationToken },
    owner,
  );
  expect(unconfirmed.status).toBe(400);
  const cleared = await request(
    '/backup/restore',
    'POST',
    { backup: empty, confirmationToken: emptyPreview.body.confirmationToken, confirmEmpty: true },
    owner,
  );
  expect(((await cleared.json()) as OwnerSnapshot).entries).toEqual([]);
});

test('backup routes accept bodies up to 10 MiB and other routes keep the 1 MiB limit', async () => {
  const owner = await login(`backup-${randomUUID()}`);
  const base = toBackup([{ ...(await create({ userTitle: 'Large' }, owner)) }]).entries[0]!;
  const entries = Array.from({ length: 25 }, () => ({
    ...base,
    entryId: randomUUID(),
    comment: 'x'.repeat(90000),
  }));
  expect((await previewBackup({ schemaVersion: 1, entries }, owner)).status).toBe(200);
  expect(
    (
      await request(
        '/entries',
        'POST',
        { category: 'anime', userTitle: 'x', comment: 'y'.repeat(1100000) },
        owner,
      )
    ).status,
  ).toBe(413);
  const tooLarge = await request(
    '/backup/preview',
    'POST',
    { schemaVersion: 1, entries: Array.from({ length: 120 }, () => entries[0]) },
    owner,
  );
  expect(tooLarge.status).toBe(413);
});

/** Reads a public library anonymously. */
function publicLibrary(username: string) {
  return fetch(
    `${base.replace(/\/library$/, '')}/public/libraries/${encodeURIComponent(username)}`,
  );
}

/** Sets the public library username of an owner. */
function setUsername(username: string, owner: SessionTokens) {
  return fetch(`${base.replace(/\/library$/, '')}/account/username`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${owner.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
}

test('a username publishes a read-only projection without hidden entries or private data', async () => {
  const owner = await login(`public-${randomUUID()}`);
  const username = `u${randomUUID().slice(0, 8)}`;
  const link = `https://example.com/${randomUUID()}`;
  await create(
    {
      userTitle: 'Shown',
      status: 'process',
      rating: 7,
      progress: 3,
      comment: 'secret',
      sourceUrls: [link],
    },
    owner,
  );
  await create({ userTitle: 'Hidden', status: 'hide' }, owner);
  const deleted = await create({ userTitle: 'Deleted' }, owner);
  await request(
    `/entries/${deleted.entryId}`,
    'DELETE',
    { expectedVersion: deleted.serverVersion },
    owner,
  );

  expect((await publicLibrary(username)).status).toBe(404);
  const initial = await fetch(`${base.replace(/\/library$/, '')}/account/username`, {
    headers: { Authorization: `Bearer ${owner.accessToken}` },
  });
  expect(await initial.json()).toEqual({ schemaVersion: 1, username: null });

  const saved = await setUsername(username.toUpperCase(), owner);
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ schemaVersion: 1, username });
  expect((await setUsername(username, other)).status).toBe(409);
  expect((await setUsername('-bad', owner)).status).toBe(400);
  expect((await setUsername('ab', owner)).status).toBe(400);

  const response = await publicLibrary(username.toUpperCase());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  const body = (await response.json()) as PublicLibrary;
  expect(body.username).toBe(username);
  expect(body.entries).toHaveLength(1);
  expect(body.entries[0]).toMatchObject({
    userTitle: 'Shown',
    status: 'process',
    rating: 7,
    progress: 3,
  });
  const text = JSON.stringify(body);
  for (const value of [
    'secret',
    link,
    'entryId',
    'catalogId',
    'serverVersion',
    'sources',
    'comment',
    owner.ownerId,
  ])
    expect(text).not.toContain(value);

  const notFound = await publicLibrary(`missing${randomUUID().slice(0, 8)}`);
  const invalid = await publicLibrary('%20');
  expect(notFound.status).toBe(404);
  expect(invalid.status).toBe(404);
  expect(notFound.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  const notFoundBody = (await notFound.json()) as ApiError;
  const invalidBody = (await invalid.json()) as ApiError;
  expect([notFoundBody.code, notFoundBody.message]).toEqual([
    invalidBody.code,
    invalidBody.message,
  ]);

  const renamed = `r${randomUUID().slice(0, 8)}`;
  expect((await setUsername(renamed, owner)).status).toBe(200);
  expect((await publicLibrary(username)).status).toBe(404);
  expect((await publicLibrary(renamed)).status).toBe(200);
  expect((await setUsername('', owner)).status).toBe(200);
  expect((await publicLibrary(renamed)).status).toBe(404);
  expect((await setUsername(username, other)).status).toBe(200);
  expect((await setUsername('', other)).status).toBe(200);

  const write = await fetch(`${base.replace(/\/library$/, '')}/public/libraries/${renamed}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(write.status).toBe(404);
});
