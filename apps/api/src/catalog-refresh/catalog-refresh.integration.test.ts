import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ApiErrorCode,
  Category,
  CatalogRefreshJobState,
  CatalogRefreshOutcome,
  emptySnapshot,
  Granularity,
  type CatalogRecord,
  type ServerEntry,
  type Snapshot,
} from '@filecab/contracts';
import { validateEnvironment } from '../config/environment';
import { createApiApplication } from '../http/application';
import { ApiException } from '../http/api-error';
import { AuthService, type SessionTokens } from '../auth/auth.service';
import {
  AuthClient,
  credentialHash,
  randomCredential,
  verifierChallenge,
} from '../auth/credentials';
import type { CatalogSearchService } from '../catalog/catalog-search.service';
import { CatalogGenreResolver } from '../catalog/catalog-genre-resolver';
import { CatalogIdentityService } from '../catalog/catalog-identity.service';
import { LibraryMutationService } from '../library/mutation.service';
import { CatalogRefreshRunner } from './catalog-refresh-runner';

const prefix = `catalog-refresh-${randomUUID()}`;
const secret = Buffer.alloc(32, 43).toString('base64');
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
  SMOTRET_ENABLED: 'false',
  KINOPOISK_ENABLED: 'false',
  SHIKIMORI_ENABLED: 'false',
});
const provenance = { source: 'fixture', retrievedAt: '2026-11-28T00:00:00.000Z', verified: true };
const stateHashes: string[] = [];
const catalogIds: string[] = [];

let app: NestExpressApplication;
let auth: AuthService;
let base: string;
let identity: CatalogIdentityService;

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

/** Sends an authenticated request and returns the JSON body. */
async function request<T>(owner: SessionTokens, path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(response.ok).toBe(true);

  return (await response.json()) as T;
}

/** Builds a stored Smotret series snapshot. */
function seriesSnapshot(seriesId: string, values: Partial<Snapshot> = {}): Snapshot {
  return {
    ...emptySnapshot(),
    titles: [{ text: `Series ${seriesId}`, language: 'ru', provenance }],
    references: [
      {
        namespace: 'smotret',
        entity: 'series',
        id: seriesId,
        granularity: Granularity.Series,
        provenance,
      },
    ],
    ...values,
  };
}

/** Stores a Smotret series as a search would. */
async function storedSeries(
  values: Partial<Snapshot>,
): Promise<{ id: string; record: CatalogRecord }> {
  const id = String(Math.floor(Math.random() * 1e9) + 1);
  const record = await identity.observe(
    Category.Anime,
    Granularity.Series,
    seriesSnapshot(id, values),
  );
  catalogIds.push(record.catalogId);

  return { id, record };
}

/** Builds a catalog with Smotret details that answer from a function. */
function stubCatalog(details: (id: string) => Promise<CatalogRecord>) {
  const calls: string[] = [];
  const catalog = {
    capabilities: () => ({
      schemaVersion: 1,
      defaults: { anime: 'smotret', films: 'kinopoisk', tv: 'kinopoisk' },
      providers: [
        {
          provider: 'smotret',
          categories: [Category.Anime],
          operations: ['search', 'details', 'resolve-reference'],
          browse: false,
          filters: [],
          ordering: [],
          referenceNamespaces: ['smotret', 'myanimelist'],
          languages: [],
        },
      ],
    }),
    details: async (_provider: string, id: string) => {
      calls.push(id);

      return details(id);
    },
  } as unknown as CatalogSearchService;

  return { catalog, calls };
}

/** Creates a runner with a one-hour interval and no pause between requests. */
function runner(catalog: CatalogSearchService): CatalogRefreshRunner {
  return new CatalogRefreshRunner(
    auth.database,
    catalog,
    app.get(LibraryMutationService),
    60 * 60 * 1000,
    null,
    () => 0,
  );
}

/** A series ID that the stub provider does not know. */
function missing(): never {
  throw new ApiException(404, ApiErrorCode.NotFound, 'Provider catalog record was not found');
}

beforeAll(async () => {
  app = await createApiApplication(environment, {
    diagnostic: () => {},
    google: {
      authorizationUrl: (state) => `https://accounts.google.com/?state=${state}`,
      exchange: async (code) => code,
    },
    listSync: { adapters: [], pollMs: null },
    catalogMatch: { pollMs: null },
    catalogRefresh: { pollMs: null },
  });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  auth = app.get(AuthService);
  identity = new CatalogIdentityService(auth.database, new CatalogGenreResolver(auth.database));
});

beforeEach(async () => {
  // The provider allows one active job, so each test starts without jobs.
  await auth.database.catalogRefreshJob.deleteMany({ where: { provider: 'smotret' } });
});

afterAll(async () => {
  if (auth) {
    await auth.database.catalogRefreshJob.deleteMany({ where: { provider: 'smotret' } });
    await auth.database.user.deleteMany({ where: { googleSubject: { startsWith: prefix } } });
    await auth.database.loginAttempt.deleteMany({ where: { stateHash: { in: stateHashes } } });
    await auth.database.catalogItem.deleteMany({ where: { id: { in: catalogIds } } });
  }

  await app?.close();
});

test('the job reads incomplete series again and refreshes the linked entries', async () => {
  const owner = await login('refresh');
  const airing = await storedSeries({ episodeCount: 12, availableEpisodeCount: 5 });
  const complete = await storedSeries({
    descriptions: [{ text: 'Готово', language: 'und', provenance }],
    episodeCount: 12,
    availableEpisodeCount: 12,
  });
  const before = await request<ServerEntry>(owner, '/library/entries', 'POST', {
    category: Category.Anime,
    catalogId: airing.record.catalogId,
    comment: 'Моя заметка',
  });
  const { catalog, calls } = stubCatalog(async (id) => {
    if (id !== airing.id) missing();

    return identity.observe(
      Category.Anime,
      Granularity.Series,
      seriesSnapshot(id, {
        descriptions: [{ text: 'Описание', language: 'und', provenance }],
        episodeCount: 12,
        availableEpisodeCount: 12,
      }),
    );
  });
  const jobs = runner(catalog);

  await jobs.tick();

  const { job } = await jobs.status('smotret');
  expect(job).toMatchObject({ state: CatalogRefreshJobState.Succeeded });
  expect(job!.counts[CatalogRefreshOutcome.Refreshed]).toBeGreaterThanOrEqual(1);
  expect(job!.entries).toBeGreaterThanOrEqual(1);
  expect(calls).toContain(airing.id);
  expect(calls).not.toContain(complete.id);

  const after = await request<ServerEntry>(owner, `/library/entries/${before.entryId}`);
  expect(after.snapshot.descriptions.map((value) => value.text)).toEqual(['Описание']);
  expect(after.snapshot.availableEpisodeCount).toBe(12);
  expect(after.comment).toBe('Моя заметка');
  expect(after.updatedAt).toBe(before.updatedAt);
  expect(BigInt(after.serverVersion)).toBeGreaterThan(BigInt(before.serverVersion));

  // The interval has not passed, so the poll does not start another job.
  await jobs.tick();
  expect((await jobs.status('smotret')).job!.jobId).toBe(job!.jobId);

  // An operator starts a job at once.
  const started = await jobs.start('smotret');
  expect(started.job!.jobId).not.toBe(job!.jobId);
  expect(started.job!.state).toBe(CatalogRefreshJobState.Queued);
  await jobs.drain();
  expect(calls.filter((id) => id === airing.id)).toHaveLength(1);
});

test('a provider rate limit pauses the job and keeps its progress', async () => {
  await storedSeries({});
  const { catalog } = stubCatalog(async () => {
    throw new ApiException(429, ApiErrorCode.RateLimited, 'Limit', true, undefined, 120);
  });
  const jobs = runner(catalog);

  await jobs.start('smotret');
  await jobs.drain();

  const { job } = await jobs.status('smotret');
  expect(job).toMatchObject({ state: CatalogRefreshJobState.Queued, counts: {} });
  expect(Date.parse(job!.resumeAt!)).toBeGreaterThan(Date.now() + 60_000);

  // An operator request runs the waiting job at once.
  const started = await jobs.start('smotret');
  expect(started.job).toMatchObject({ jobId: job!.jobId, resumeAt: null });
  await jobs.drain();
  const row = await auth.database.catalogRefreshJob.findUniqueOrThrow({
    where: { id: job!.jobId },
  });
  expect(row.pauses).toBe(2);
});
