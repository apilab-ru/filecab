import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, test, vi } from 'vitest';
import {
  ApiErrorCode,
  Category,
  Granularity,
  emptySnapshot,
  type CatalogProviderCapability,
  type CatalogRecord,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
  type Genre,
  Locale,
  type Snapshot,
} from '@filecab/contracts';
import { validateEnvironment } from '../config/environment';
import { createDatabaseClient } from '../database/client';
import { ApiException } from '../http/api-error';
import { CatalogCacheService } from './catalog-cache.service';
import { CatalogGenreResolver } from './catalog-genre-resolver';
import { CatalogGenreService, type CatalogGenreAdapter } from './catalog-genre.service';
import { CatalogIdentityService } from './catalog-identity.service';
import { CatalogSearchService, type CatalogSearchAdapter } from './catalog-search.service';

const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
  CATALOG_PROVIDER_RETRIES: '1',
});

const database = createDatabaseClient(environment.databaseUrl);

const run = randomUUID();

const provenance = { source: 'fixture', retrievedAt: '2026-11-19T00:00:00.000Z', verified: true };

const catalogIds = new Set<string>();

const providers = new Set<string>();

const genreNamespaces = new Set<string>();

const genreKeys = new Set<string>();

afterAll(async () => {
  await database.catalogItem.deleteMany({ where: { id: { in: [...catalogIds] } } });
  await database.catalogSearchCache.deleteMany({ where: { provider: { in: [...providers] } } });
  await database.genreMappingConflict.deleteMany({
    where: { namespace: { in: [...genreNamespaces] } },
  });
  await database.genreMapping.deleteMany({ where: { namespace: { in: [...genreNamespaces] } } });
  await database.genre.deleteMany({
    where: {
      OR: [
        { key: { in: [...genreKeys] } },
        ...[...genreNamespaces].map((namespace) => ({
          key: { startsWith: `provider:${namespace}:` },
        })),
      ],
    },
  });
  await database.$disconnect();
});

/** Builds a provider genre in the form that catalog adapters send. */
function providerGenre(namespace: string, id: string): Genre {
  return {
    genreId: randomUUID(),
    key: `provider:${namespace}:${id}`,
    labels: [{ text: id, language: 'und', provenance }],
  };
}

/** Builds a snapshot with one verified reference that is unique to this test run. */
function snapshot(id: string, fields: Partial<Snapshot> = {}): Snapshot {
  return {
    ...emptySnapshot(),
    references: [
      {
        namespace: `fixture-${run}`,
        entity: 'series',
        id,
        granularity: Granularity.Series,
        provenance,
      },
    ],
    ...fields,
  };
}

/** Records a catalog identity through the real service and registers it for cleanup. */
async function observe(
  identity: CatalogIdentityService,
  value: Snapshot,
  category = Category.Anime,
): Promise<CatalogRecord> {
  const record = await identity.observe(category, Granularity.Series, value);
  catalogIds.add(record.catalogId);

  return record;
}

/** Creates a catalog identity service with a resolver that reads the migrated genre mappings. */
function identityService(): CatalogIdentityService {
  return new CatalogIdentityService(database, new CatalogGenreResolver(database));
}

describe('catalog identities', () => {
  test('repeated observations keep one identity, merge locales and store internal genres', async () => {
    const identity = identityService();
    const id = randomUUID();
    const english = await observe(
      identity,
      snapshot(id, {
        titles: [{ text: 'Frieren', language: 'en', provenance }],
        year: 2023,
        genres: [
          providerGenre('smotret', '54'),
          providerGenre('smotret', '46'),
          providerGenre('smotret', `${run}-unmapped`),
        ],
      }),
    );
    const russian = await observe(
      identity,
      snapshot(id, { titles: [{ text: 'Фрирен', language: 'ru', provenance }] }),
    );

    expect(russian.catalogId).toBe(english.catalogId);
    expect(russian.snapshot.titles.map(({ text }) => text)).toEqual(['Frieren', 'Фрирен']);
    expect(russian.snapshot.year).toBe(2023);
    expect(russian.snapshot.genres.map(({ key }) => key)).toEqual(['martial-arts']);
    expect(await database.catalogReference.count({ where: { catalogId: english.catalogId } })).toBe(
      1,
    );
  });

  test('concurrent observations of one reference create one identity', async () => {
    const identity = identityService();
    const id = randomUUID();
    const records = await Promise.all([
      observe(identity, snapshot(id)),
      observe(identity, snapshot(id)),
    ]);

    expect(new Set(records.map(({ catalogId }) => catalogId)).size).toBe(1);
    expect(
      await database.catalogReference.count({
        where: { namespace: `fixture-${run}`, externalId: id },
      }),
    ).toBe(1);
  });

  test('unverified, conflicting and recategorized references do not change identities', async () => {
    const identity = identityService();
    const first = await observe(identity, snapshot(randomUUID()));
    const second = await observe(identity, snapshot(randomUUID()));
    const unverified = snapshot(randomUUID());
    unverified.references[0]!.provenance = { ...provenance, verified: false };

    await expect(observe(identity, unverified)).rejects.toMatchObject({
      code: ApiErrorCode.Conflict,
    });
    await expect(
      observe(identity, {
        ...first.snapshot,
        references: [...first.snapshot.references, ...second.snapshot.references],
      }),
    ).rejects.toMatchObject({ code: ApiErrorCode.Conflict });
    await expect(observe(identity, first.snapshot, Category.Tv)).rejects.toMatchObject({
      code: ApiErrorCode.Conflict,
    });
    expect(await database.catalogReference.count({ where: { catalogId: first.catalogId } })).toBe(
      1,
    );
  });
});

describe('verified genre mappings', () => {
  test('Kinopoisk game shows stay separate from the anime games theme', async () => {
    const resolved = await new CatalogGenreResolver(database).resolve([
      providerGenre('kinopoisk', 'игра'),
      providerGenre('smotret', '11'),
      providerGenre('smotret', '79'),
      providerGenre('kinopoisk', 'церемония'),
    ]);

    expect(resolved.map(({ key }) => key)).toEqual(['game-show', 'game']);
  });

  test('every mapping of a live provider genre is verified', async () => {
    const mappings = await database.genreMapping.findMany({
      where: { namespace: { in: ['kinopoisk', 'smotret'] } },
    });
    const unverified = mappings
      .filter((mapping) => !(mapping.provenance as { verified: boolean }).verified)
      .map(({ namespace, externalId }) => `${namespace}:${externalId}`)
      .sort();

    expect(mappings).toHaveLength(102);
    expect(unverified).toEqual(['smotret:12', 'smotret:26', 'smotret:28']);
  });
});

/** Describes a fixture search provider with recorded calls. */
interface FixtureProvider {
  provider: string;
  search: ReturnType<typeof vi.fn<CatalogSearchAdapter['search']>>;
  service: CatalogSearchService;
  cache: CatalogCacheService;
}

/** Creates a search service over the real cache with one fixture adapter. */
function fixtureProvider(): FixtureProvider {
  const provider = `fixture-${randomUUID()}`;
  const capability: CatalogProviderCapability = {
    provider,
    categories: [Category.Anime],
    operations: ['search'],
    filters: [],
    ordering: [],
    referenceNamespaces: [],
    languages: [Locale.En, Locale.Ru],
  };
  const search = vi.fn<CatalogSearchAdapter['search']>();
  const cache = new CatalogCacheService(database, 3600);
  providers.add(provider);

  return {
    provider,
    search,
    cache,
    service: new CatalogSearchService([{ capability, schemaVersion: 1, search }], cache),
  };
}

/** Builds a search request for the fixture provider. */
function searchRequest(provider: string, locale: Locale = Locale.En): CatalogSearchRequest {
  return { provider, category: Category.Anime, query: 'frieren', locale, page: 1, pageSize: 20 };
}

/** Builds a provider page that echoes the request locale and page. */
function page(request: CatalogSearchRequest, results: CatalogRecord[]): CatalogSearchResponse {
  return { schemaVersion: 1, locale: request.locale, page: request.page, results, hasMore: false };
}

/** Moves the cached pages of a provider past freshness, and optionally past the stale window. */
async function expire(provider: string, pastStaleWindow = false) {
  const past = new Date(Date.now() - 1000);

  await database.catalogSearchCache.updateMany({
    where: { provider },
    data: { expiresAt: past, ...(pastStaleWindow ? { staleUntil: past } : {}) },
  });
}

describe('catalog search cache', () => {
  test('a fresh page and locale metadata come from the cache, keyed by locale', async () => {
    const { provider, search, service, cache } = fixtureProvider();
    const record = await observe(identityService(), snapshot(randomUUID()));
    search.mockImplementation(async (request) => page(request, [record, record]));

    const live = await service.search(searchRequest(provider));
    const cached = await service.search(searchRequest(provider));
    await service.search(searchRequest(provider, Locale.Ru));

    expect(live.results).toHaveLength(1);
    expect(cached).toMatchObject({ stale: false, results: [{ catalogId: record.catalogId }] });
    expect(cached.cachedAt).toEqual(expect.any(String));
    expect(search).toHaveBeenCalledTimes(2);
    expect((await cache.getMetadata(record.catalogId, Locale.En))?.record.catalogId).toBe(
      record.catalogId,
    );
  });

  test('a retryable failure returns a stale page only inside the stale window', async () => {
    const { provider, search, service } = fixtureProvider();
    const record = await observe(identityService(), snapshot(randomUUID()));
    const unavailable = new ApiException(503, ApiErrorCode.ProviderUnavailable, 'down', true);
    search.mockImplementationOnce(async (request) => page(request, [record]));
    await service.search(searchRequest(provider));
    await expire(provider);
    search.mockRejectedValue(unavailable);

    expect(await service.search(searchRequest(provider))).toMatchObject({
      stale: true,
      results: [{ catalogId: record.catalogId }],
    });

    search.mockRejectedValueOnce(new ApiException(400, ApiErrorCode.ValidationError, 'bad'));
    await expect(service.search(searchRequest(provider))).rejects.toMatchObject({
      code: ApiErrorCode.ValidationError,
    });

    await expire(provider, true);
    await expect(service.search(searchRequest(provider))).rejects.toBe(unavailable);
  });

  test('a valid empty page replaces the cached page and an invalid page is not cached', async () => {
    const { provider, search, service } = fixtureProvider();
    const record = await observe(identityService(), snapshot(randomUUID()));
    search.mockImplementationOnce(async (request) => page(request, [record]));
    await service.search(searchRequest(provider));
    await expire(provider);
    search.mockImplementationOnce(async (request) => page(request, []));

    expect((await service.search(searchRequest(provider))).results).toEqual([]);
    expect((await service.search(searchRequest(provider))).results).toEqual([]);
    expect(search).toHaveBeenCalledTimes(2);

    search.mockImplementation(async (request) =>
      page(request, [{ ...record, category: Category.Films }]),
    );
    await expect(service.search(searchRequest(provider, Locale.Ru))).rejects.toMatchObject({
      code: ApiErrorCode.InvalidResponse,
    });
    await expect(service.search(searchRequest(provider, Locale.Ru))).rejects.toMatchObject({
      code: ApiErrorCode.InvalidResponse,
    });
    expect(search).toHaveBeenCalledTimes(4);
  });

  test('clearing one provider keeps other providers and catalog identities', async () => {
    const first = fixtureProvider();
    const second = fixtureProvider();
    const record = await observe(identityService(), snapshot(randomUUID()));

    for (const { provider, search, service } of [first, second]) {
      search.mockImplementation(async (request) => page(request, []));
      await service.search(searchRequest(provider));
    }

    second.search.mockImplementation(async (request) => page(request, [record]));
    await second.service.search(searchRequest(second.provider, Locale.Ru));

    expect(await first.cache.clear(first.provider)).toEqual({ searchPages: 1, metadata: 0 });
    expect(await second.cache.clear(second.provider)).toEqual({ searchPages: 2, metadata: 1 });
    expect(await database.catalogItem.count({ where: { id: record.catalogId } })).toBe(1);
  });
});

/** Describes a fixture genre provider with replaceable data and crosswalk. */
interface FixtureGenreProvider {
  namespace: string;
  adapter: CatalogGenreAdapter & { canonicalMappings: Map<string, string> };
  fetchGenres: ReturnType<typeof vi.fn<CatalogGenreAdapter['fetchGenres']>>;
  service: CatalogGenreService;
}

/** Creates a genre service over the real database with one fixture adapter. */
function fixtureGenreProvider(): FixtureGenreProvider {
  const namespace = `fixture-${randomUUID()}`;
  const fetchGenres = vi.fn<CatalogGenreAdapter['fetchGenres']>();
  const adapter = {
    provider: namespace,
    namespace,
    canonicalMappings: new Map<string, string>(),
    fetchGenres,
  };
  genreNamespaces.add(namespace);

  return {
    namespace,
    adapter,
    fetchGenres,
    service: new CatalogGenreService(database, environment.catalog, [adapter]),
  };
}

/** Creates an internal genre that only this test run uses. */
async function internalGenre(): Promise<{ id: string; key: string }> {
  const key = `fixture-${randomUUID()}`;
  genreKeys.add(key);

  return database.genre.create({ data: { id: randomUUID(), key, labels: [] } });
}

describe('genre administration', () => {
  test('refresh maps curated genres, creates candidates and records conflicts', async () => {
    const { namespace, adapter, fetchGenres, service } = fixtureGenreProvider();
    const [drama, comedy] = [await internalGenre(), await internalGenre()];
    adapter.canonicalMappings.set('curated', drama.key).set('missing', `absent-${run}`);
    fetchGenres.mockResolvedValue({
      schemaVersion: 1,
      genres: ['curated', 'candidate', 'missing'].map((externalId) => ({
        externalId,
        labels: [{ language: 'en', text: `Label ${externalId}` }],
      })),
    });

    const first = await service.refresh(namespace, Locale.En);

    expect(first).toMatchObject({ imported: 2, unresolved: 2 });
    expect(first.conflicts.map(({ reason }) => reason)).toEqual(['target-missing']);

    adapter.canonicalMappings.set('curated', comedy.key);
    const second = await service.refresh(namespace, Locale.En);
    const review = await service.review(namespace);
    const publicGenres = await service.publicGenres(Locale.En);

    expect(second.conflicts.map(({ reason }) => reason).sort()).toEqual([
      'mapping-change',
      'target-missing',
    ]);
    expect(
      await database.genreMapping.findUnique({
        where: { namespace_externalId: { namespace, externalId: 'curated' } },
      }),
    ).toMatchObject({ genreId: drama.id, provenance: { verified: true } });
    expect(review.mappings.map(({ externalId }) => externalId)).toEqual(['candidate']);
    expect(review.conflicts).toHaveLength(2);
    expect(publicGenres.genres.map(({ key }) => key)).toEqual(
      expect.arrayContaining([drama.key, 'game-show']),
    );
    expect(publicGenres.genres.map(({ key }) => key)).not.toContain(
      `provider:${namespace}:candidate`,
    );
    expect(
      (await new CatalogGenreResolver(database).resolve([providerGenre(namespace, 'candidate')]))[0]
        ?.key,
    ).toBe(`provider:${namespace}:candidate`);
  });

  test('malformed responses and exhausted retries fail without stored mappings', async () => {
    const { namespace, fetchGenres, service } = fixtureGenreProvider();
    fetchGenres.mockResolvedValueOnce({
      schemaVersion: 1,
      genres: [{ externalId: 'x', labels: [], extra: true }],
    });

    await expect(service.refresh(namespace, Locale.En)).rejects.toMatchObject({
      code: ApiErrorCode.InvalidResponse,
    });

    fetchGenres.mockRejectedValue({ status: 503 });

    await expect(service.refresh(namespace, Locale.En)).rejects.toMatchObject({
      code: ApiErrorCode.ProviderUnavailable,
    });
    expect(fetchGenres).toHaveBeenCalledTimes(3);
    await expect(service.refresh('absent', Locale.En)).rejects.toMatchObject({
      code: ApiErrorCode.ProviderUnavailable,
    });
    expect(await database.genreMapping.count({ where: { namespace } })).toBe(0);
  });
});
