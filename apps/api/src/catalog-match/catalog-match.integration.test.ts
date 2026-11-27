import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ApiErrorCode,
  Category,
  CatalogMatchJobState,
  CatalogMatchOutcome,
  CatalogMatchPause,
  emptySnapshot,
  Granularity,
  type CatalogMatchJob,
  type CatalogMatchStatus,
  type CatalogMatchTarget,
  type CatalogRecord,
  type CatalogSearchRequest,
  type LibraryImportPreview,
  type LibraryImportSummary,
  type OwnerSnapshot,
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
import { CatalogMatchRunner } from './catalog-match-runner';

const prefix = `catalog-match-${randomUUID()}`;
const secret = Buffer.alloc(32, 41).toString('base64');
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
  // Enabled providers receive jobs. The runner uses a stub catalog, so nothing calls them.
  KINOPOISK_ENABLED: 'true',
  KINOPOISK_API_KEY: 'fixture-key',
  SMOTRET_ENABLED: 'true',
  SHIKIMORI_ENABLED: 'false',
});
const provenance = { source: 'fixture', retrievedAt: '2026-11-24T00:00:00.000Z', verified: true };
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

/** Sends an authenticated request. */
function request(owner: SessionTokens, path: string, method = 'GET', body?: unknown) {
  return fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Imports CSV rows, including possible duplicates, and returns the new entries. */
async function importRows(owner: SessionTokens, csv: string): Promise<CatalogMatchTarget[]> {
  const preview = (await (
    await request(owner, '/library/import/preview', 'POST', { csv })
  ).json()) as LibraryImportPreview;
  expect(preview.issues).toEqual([]);
  const response = await request(owner, '/library/import', 'POST', {
    csv,
    lines: preview.rows.map((row) => row.line),
    confirmationToken: preview.confirmationToken,
  });

  return ((await response.json()) as LibraryImportSummary).entries;
}

/** Stores a catalog title with a verified provider ID, as a provider search would. */
async function catalogTitle(
  title: string,
  year: number,
  category = Category.Films,
): Promise<CatalogRecord> {
  const record = await identity.observe(category, Granularity.Unknown, {
    ...emptySnapshot(),
    titles: [{ text: title, language: 'ru', provenance }],
    year,
    posterUrl: `https://example.com/${randomUUID()}.jpg`,
    references: [
      {
        namespace: category === Category.Anime ? 'smotret' : 'kinopoisk',
        entity: category === Category.Anime ? 'series' : 'title',
        id: String(Math.floor(Math.random() * 1e9) + 1),
        granularity: Granularity.Unknown,
        provenance,
      },
    ],
  });
  catalogIds.push(record.catalogId);

  return record;
}

/** Builds a stub catalog that answers searches and reference lookups from fixtures. */
function stubCatalog(
  search: (request: CatalogSearchRequest) => CatalogRecord[],
  references: Map<string, CatalogRecord> = new Map(),
): CatalogSearchService & { searches: string[] } {
  const searches: string[] = [];

  return {
    searches,
    capabilities: () => ({
      schemaVersion: 1,
      defaults: { anime: 'smotret', films: 'kinopoisk', tv: 'kinopoisk' },
      providers: [
        {
          provider: 'kinopoisk',
          categories: [Category.Films, Category.Tv],
          operations: ['search', 'resolve-reference'],
          browse: false,
          filters: [],
          ordering: [],
          referenceNamespaces: ['kinopoisk', 'imdb', 'tmdb'],
          languages: [],
        },
        {
          provider: 'smotret',
          categories: [Category.Anime],
          operations: ['search', 'resolve-reference'],
          browse: false,
          filters: [],
          ordering: [],
          referenceNamespaces: ['smotret', 'myanimelist'],
          languages: [],
        },
      ],
    }),
    search: async (input: CatalogSearchRequest) => {
      searches.push(`${input.provider}:${input.query}`);

      return {
        schemaVersion: 1,
        locale: input.locale,
        page: 1,
        results: search(input),
        hasMore: false,
      };
    },
    resolveReference: async (namespace: string, entity: string, id: string) => {
      const record = references.get(`${namespace}:${entity}:${id}`);

      if (!record) throw new ApiException(404, ApiErrorCode.NotFound, 'Not found');

      return record;
    },
  } as unknown as CatalogSearchService & { searches: string[] };
}

/** Creates a runner with the stub catalog and no pause between requests. */
function runner(catalog: CatalogSearchService): CatalogMatchRunner {
  return new CatalogMatchRunner(
    auth.database,
    catalog,
    app.get(LibraryMutationService),
    null,
    () => 0,
  );
}

/** Reads the latest job of each provider of an account. */
async function status(owner: SessionTokens): Promise<Record<string, CatalogMatchJob>> {
  const { jobs } = (await (
    await request(owner, '/library/catalog-match')
  ).json()) as CatalogMatchStatus;

  return Object.fromEntries(jobs.map((job) => [job.provider, job]));
}

/** Builds a provider failure as an adapter reports it. */
function providerFailure(code: ApiErrorCode, upstreamStatus?: number): ApiException {
  return new ApiException(
    code === ApiErrorCode.InvalidResponse ? 502 : 503,
    code,
    'Provider failure',
    true,
    undefined,
    undefined,
    {
      provider: 'kinopoisk',
      origin: 'https://api.poiskkino.dev',
      operation: 'search',
      stage: upstreamStatus ? 'http' : 'schema',
      elapsedMs: 1,
      upstreamStatus,
    },
  );
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

afterAll(async () => {
  if (auth) {
    await auth.database.user.deleteMany({ where: { googleSubject: { startsWith: prefix } } });
    await auth.database.loginAttempt.deleteMany({ where: { stateHash: { in: stateHashes } } });
    await auth.database.catalogItem.deleteMany({ where: { id: { in: catalogIds } } });
  }

  await app?.close();
});

test('imported entries link only on exact matches and report the rest', async () => {
  const owner = await login('exact');
  const kursk = await catalogTitle('Курск', 2018);
  const twinA = await catalogTitle('Двойник', 2020);
  const twinB = await catalogTitle('Двойник', 2020);
  const byReference = await catalogTitle('Анон', 2017);
  const yearless = await catalogTitle('Без года', 2015);
  const entries = await importRows(
    owner,
    [
      'Title;Type;Rating;Year;Reference',
      'Курск;Film;10;2018;',
      'КУРСК;Film;;2018;',
      'Двойник;Film;;2020;',
      'Нет такого;Film;;2021;',
      'Без года;Film;;;',
      'Anon;Film;8;;kinopoisk:title:77',
    ].join('\n'),
  );
  expect(entries).toHaveLength(6);
  expect(entries.every((entry) => entry.category === Category.Films)).toBe(true);

  const started = await request(owner, '/library/catalog-match', 'POST', { entries });
  expect(started.status).toBe(202);
  // A second start joins the active job instead of creating another one.
  expect((await request(owner, '/library/catalog-match', 'POST', {})).status).toBe(202);

  const catalog = stubCatalog(
    (input) => {
      if (input.query.toLowerCase() === 'курск') return [kursk, twinA];

      if (input.query === 'Двойник') return [twinA, twinB];

      if (input.query === 'Без года') return [yearless];

      return [];
    },
    new Map([['kinopoisk:title:77', byReference]]),
  );
  await runner(catalog).drain();

  const { kinopoisk: job, ...others } = await status(owner);
  expect(others).toEqual({});
  expect(job).toMatchObject({
    state: CatalogMatchJobState.Succeeded,
    progress: { done: 6, total: 6 },
    counts: {
      [CatalogMatchOutcome.Linked]: 3,
      [CatalogMatchOutcome.Duplicate]: 1,
      [CatalogMatchOutcome.Ambiguous]: 1,
      [CatalogMatchOutcome.NotFound]: 1,
    },
  });
  expect(job!.items.map((item) => [item.title, item.outcome])).toEqual([
    ['КУРСК', CatalogMatchOutcome.Duplicate],
    ['Двойник', CatalogMatchOutcome.Ambiguous],
    ['Нет такого', CatalogMatchOutcome.NotFound],
  ]);
  // The entry without a year linked by title; the reference needed no search.
  expect(catalog.searches).toContain('kinopoisk:Без года');
  expect(catalog.searches).not.toContain('kinopoisk:Anon');

  const library = (await (await request(owner, '/library')).json()) as OwnerSnapshot;
  const linked = library.entries.find((entry) => entry.catalogId === kursk.catalogId)!;
  // The catalog now names the entry and supplies the poster. User fields stay.
  expect(linked).toMatchObject({ userTitle: '', rating: 10, status: 'complete' });
  expect(linked.snapshot.posterUrl).toBe(kursk.snapshot.posterUrl);
  const anon = library.entries.find((entry) => entry.catalogId === byReference.catalogId)!;
  expect(anon).toMatchObject({ userTitle: 'Anon', rating: 8 });
  expect(library.entries.some((entry) => entry.catalogId === yearless.catalogId)).toBe(true);
});

test('a broken provider pauses or fails only its own job; anime still links', async () => {
  const owner = await login('providers');
  const elf = await catalogTitle('Эльф не может сидеть на диете', 2024, Category.Anime);
  const entries = await importRows(
    owner,
    [
      'category,title,year',
      'films,Квота,2020',
      'anime,Эльф не может похудеть,',
      'anime,Сломанный ответ,2021',
      'anime,Нет такого аниме,2022',
    ].join('\n'),
  );
  await request(owner, '/library/catalog-match', 'POST', { entries });
  const catalog = stubCatalog((input) => {
    // Kinopoisk refuses the quota.
    if (input.provider === 'kinopoisk')
      throw providerFailure(ApiErrorCode.ProviderUnavailable, 403);

    // One unreadable response fails only its entry.
    if (input.query === 'Сломанный ответ') throw providerFailure(ApiErrorCode.InvalidResponse);

    if (input.query === 'Эльф не может похудеть')
      return [{ ...elf, alternativeTitles: ['Эльф не может похудеть'] }];

    return [];
  });
  await runner(catalog).drain();

  const jobs = await status(owner);
  expect(jobs.kinopoisk).toMatchObject({
    state: CatalogMatchJobState.Queued,
    pause: CatalogMatchPause.ProviderLimit,
    progress: { done: 0, total: 1 },
  });
  expect(jobs.smotret).toMatchObject({
    state: CatalogMatchJobState.Succeeded,
    progress: { done: 3, total: 3 },
    counts: {
      [CatalogMatchOutcome.Linked]: 1,
      [CatalogMatchOutcome.Failed]: 1,
      [CatalogMatchOutcome.NotFound]: 1,
    },
  });

  // A later anime import starts a new anime job while Kinopoisk still waits.
  const [later] = await importRows(owner, 'category,title,year\nanime,Позже,2023\n');
  await request(owner, '/library/catalog-match', 'POST', { entries: [later] });
  await runner(catalog).drain();
  const after = await status(owner);
  expect(after.smotret).toMatchObject({
    state: CatalogMatchJobState.Succeeded,
    progress: { done: 1, total: 1 },
  });
  expect(after.kinopoisk!.jobId).toBe(jobs.kinopoisk!.jobId);
});

test('unsynced entries wait, new entries join the active job and Stop ends it', async () => {
  const owner = await login('pause');
  const [entry] = await importRows(owner, 'category,title,year\nfilms,Квота,2020\n');
  await request(owner, '/library/catalog-match', 'POST', { entries: [entry] });
  await runner(
    stubCatalog(() => {
      throw providerFailure(ApiErrorCode.ProviderUnavailable, 403);
    }),
  ).drain();
  let { kinopoisk: job } = await status(owner);
  expect(job).toMatchObject({
    state: CatalogMatchJobState.Queued,
    progress: { done: 0, total: 1 },
  });
  // A refused quota waits hours, so the daily quota can renew.
  expect(Date.parse(job!.resumeAt!) - Date.now()).toBeGreaterThan(5 * 60 * 60 * 1000);

  // An entry from a device can reach the server after the job starts. It joins the job.
  await request(owner, '/library/catalog-match', 'POST', {
    entries: [{ entryId: randomUUID(), category: Category.Films }, entry],
  });
  ({ kinopoisk: job } = await status(owner));
  expect(job).toMatchObject({ progress: { done: 0, total: 2 } });

  ({ kinopoisk: job } = Object.fromEntries(
    (
      (await (
        await request(owner, '/library/catalog-match/stop', 'POST')
      ).json()) as CatalogMatchStatus
    ).jobs.map((item) => [item.provider, item]),
  ));
  expect(job?.state).toBe(CatalogMatchJobState.Cancelled);

  await request(owner, '/library/catalog-match', 'POST', {
    entries: [{ entryId: randomUUID(), category: Category.Films }, entry],
  });
  await runner(stubCatalog(() => [])).drain();
  ({ kinopoisk: job } = await status(owner));
  expect(job).toMatchObject({
    state: CatalogMatchJobState.Queued,
    pause: CatalogMatchPause.WaitingSync,
    progress: { done: 0 },
  });
});
