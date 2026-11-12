import {
  ApiErrorCode,
  Category,
  Format,
  Granularity,
  Locale,
  type CatalogRecord,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
  type CatalogProviderCapability,
  type Snapshot,
} from '@filecab/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createHash } from 'node:crypto';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';
import { CatalogIdentityService } from './catalog-identity.service';
import type { CatalogSearchAdapter } from './catalog-search.service';
import { KinopoiskMovieDto, KinopoiskMoviesResponseDto } from './kinopoisk-dev.dto';

const TYPES: Record<Category.Films | Category.Tv, readonly string[]> = {
  [Category.Films]: ['movie', 'cartoon'],
  [Category.Tv]: ['tv-series', 'animated-series'],
};
const FORMATS: Record<string, Format> = {
  movie: Format.Movie,
  cartoon: Format.Cartoon,
  'tv-series': Format.TvSeries,
  'animated-series': Format.AnimatedSeries,
};
const KINOPOISK_UPSTREAM_PAGE_SIZE = 50;
const KINOPOISK_MAX_SCAN_PAGES = 20;

/** Converts a provider genre name into a stable provider-scoped candidate identity. */
function genreCandidate(name: string, retrievedAt: string, source: string) {
  const key = name.trim().toLocaleLowerCase('ru');
  const id = createHash('sha256').update(`kinopoisk:${key}`).digest('hex').slice(0, 32);

  return {
    genreId: `${id.slice(0, 8)}-${id.slice(8, 12)}-5${id.slice(13, 16)}-a${id.slice(17, 20)}-${id.slice(20)}`,
    key: `provider:kinopoisk:${key}`,
    labels: [{ text: name, language: 'und', provenance: { source, retrievedAt, verified: true } }],
  };
}

/** Converts a numeric provider score into attributed catalog metadata. */
function providerRating(value: number | null | undefined, source: string, retrievedAt: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) return [];

  return [{ value, scale: 10, provenance: { source, retrievedAt, verified: true } }];
}

/** Normalizes one classified provider movie without guessing title language or season totals. */
function normalizeMovie(
  movie: KinopoiskMovieDto,
  category: Category.Films | Category.Tv,
  locale: Locale,
  retrievedAt: string,
) {
  const source = `https://www.kinopoisk.ru/film/${movie.id}/`;
  const titles = (movie.names ?? []).flatMap(({ name, language }) =>
    name.trim()
      ? [
          {
            text: name,
            language: language || 'und',
            provenance: { source, retrievedAt, verified: true },
          },
        ]
      : [],
  );

  if (movie.name?.trim() && !titles.some(({ text }) => text === movie.name))
    titles.unshift({
      text: movie.name,
      language: 'und',
      provenance: { source, retrievedAt, verified: true },
    });

  if (movie.alternativeName?.trim() && !titles.some(({ text }) => text === movie.alternativeName))
    titles.push({
      text: movie.alternativeName,
      language: 'und',
      provenance: { source, retrievedAt, verified: true },
    });

  titles.sort(
    (left, right) => Number(right.language === locale) - Number(left.language === locale),
  );
  const granularity = category === Category.Films ? Granularity.Film : Granularity.Series;
  const references = [
    {
      namespace: 'kinopoisk',
      entity: 'title',
      id: String(movie.id),
      granularity,
      provenance: { source, retrievedAt, verified: true },
    },
  ];

  if (movie.externalId?.imdb)
    references.push({
      namespace: 'imdb',
      entity: 'title',
      id: movie.externalId.imdb,
      granularity,
      provenance: { source, retrievedAt, verified: true },
    });

  if (movie.externalId?.tmdb)
    references.push({
      namespace: 'tmdb',
      entity: category === Category.Films ? 'movie' : 'tv',
      id: String(movie.externalId.tmdb),
      granularity,
      provenance: { source, retrievedAt, verified: true },
    });

  const snapshot: Snapshot = {
    originalTitle: null,
    titles,
    descriptions: movie.description?.trim()
      ? [
          {
            text: movie.description,
            language: 'und',
            provenance: { source, retrievedAt, verified: true },
          },
        ]
      : [],
    posterUrl: movie.poster?.url?.startsWith('https://') ? movie.poster.url : null,
    year:
      typeof movie.year === 'number' && Number.isSafeInteger(movie.year) && movie.year > 0
        ? movie.year
        : null,
    genres: (movie.genres ?? []).flatMap(({ name }) =>
      name.trim() ? [genreCandidate(name, retrievedAt, source)] : [],
    ),
    format: FORMATS[movie.type] ?? Format.Unknown,
    episodeCount: null,
    availableEpisodeCount: null,
    providerRatings: [
      ...providerRating(movie.rating?.kp, source, retrievedAt),
      ...providerRating(
        movie.rating?.imdb,
        `https://www.imdb.com/title/${movie.externalId?.imdb ?? ''}/`,
        retrievedAt,
      ),
      ...providerRating(
        movie.rating?.tmdb,
        `https://www.themoviedb.org/${category === Category.Films ? 'movie' : 'tv'}/${movie.externalId?.tmdb ?? ''}`,
        retrievedAt,
      ),
    ],
    references,
  };

  return { category, granularity, snapshot };
}

/** Implements the documented Kinopoisk Dev v1.4 title search, discovery and detail endpoints. */
export class KinopoiskDevAdapter implements CatalogSearchAdapter {
  readonly schemaVersion = 2;
  readonly capability: CatalogProviderCapability = {
    provider: 'kinopoisk',
    categories: [Category.Films, Category.Tv],
    operations: ['search', 'details', 'resolve-reference'],
    filters: ['year', 'format'],
    ordering: [],
    referenceNamespaces: ['kinopoisk', 'imdb', 'tmdb'],
    languages: [Locale.En, Locale.Ru],
  };

  constructor(
    private readonly origin: string,
    private readonly apiKey: string,
    private readonly identity: CatalogIdentityService,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** Searches text or performs documented structured discovery with category enforcement. */
  async search(
    request: CatalogSearchRequest & { provider: string },
  ): Promise<CatalogSearchResponse> {
    const category = request.category as Category.Films | Category.Tv;
    const types = TYPES[category];
    const filters = request.filters ?? {};

    if (request.query && Object.keys(filters).length)
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'Kinopoisk cannot combine text search and structured filters',
      );

    const parameters = new URLSearchParams({
      limit: String(KINOPOISK_UPSTREAM_PAGE_SIZE),
    });
    let path: string;

    if (request.query.trim()) {
      path = '/v1.4/movie/search';
      parameters.set('query', request.query.trim());
    } else {
      path = '/v1.4/movie';
      parameters.append('type', types[0]);
      parameters.append('type', types[1]);
      parameters.append('selectFields', 'id');
      parameters.append('selectFields', 'type');
      parameters.append('selectFields', 'isSeries');
      parameters.append('selectFields', 'name');
      parameters.append('selectFields', 'alternativeName');
      parameters.append('selectFields', 'description');
      parameters.append('selectFields', 'year');
      parameters.append('selectFields', 'poster');
      parameters.append('selectFields', 'rating');
      parameters.append('selectFields', 'externalId');
      parameters.append('selectFields', 'names');
      parameters.append('selectFields', 'genres');

      if (filters.year !== undefined) parameters.set('year', String(filters.year));

      if (filters.format !== undefined) parameters.set('type', String(filters.format));
    }

    const eligible = new Map<number, KinopoiskMovieDto>();
    const start = (request.page - 1) * request.pageSize;
    const end = start + request.pageSize;
    let exhausted = false;

    for (let page = 1; page <= KINOPOISK_MAX_SCAN_PAGES; page += 1) {
      parameters.set('page', String(page));
      const envelope = this.validateEnvelope(await this.request(`${path}?${parameters}`));

      if (
        envelope.page !== page ||
        envelope.limit !== KINOPOISK_UPSTREAM_PAGE_SIZE ||
        envelope.docs.length > KINOPOISK_UPSTREAM_PAGE_SIZE
      )
        throw new ApiException(
          502,
          ApiErrorCode.InvalidResponse,
          'Kinopoisk returned inconsistent pagination',
          true,
        );

      for (const movie of envelope.docs) {
        if (this.matchesCategory(movie, category) && !eligible.has(movie.id))
          eligible.set(movie.id, movie);
      }

      exhausted =
        envelope.docs.length === 0 ||
        (envelope.total !== undefined
          ? page * KINOPOISK_UPSTREAM_PAGE_SIZE >= envelope.total
          : envelope.docs.length < KINOPOISK_UPSTREAM_PAGE_SIZE);

      if (eligible.size > end || exhausted) break;
    }

    const hasMore = eligible.size > end;
    const records: CatalogRecord[] = [];

    for (const movie of [...eligible.values()].slice(start, end)) {
      const normalized = normalizeMovie(movie, category, request.locale, new Date().toISOString());
      records.push(
        await this.identity.observe(
          normalized.category,
          normalized.granularity,
          normalized.snapshot,
        ),
      );
    }

    return {
      schemaVersion: 1,
      locale: request.locale,
      page: request.page,
      results: records,
      hasMore,
      ...(!hasMore && !exhausted ? { limitation: 'lookahead-exhausted' as const } : {}),
    };
  }

  /** Resolves exact KinoPoisk, IMDb or TMDB references without converting HD IDs. */
  async resolveReference(
    namespace: string,
    entity: string,
    id: string,
    locale: Locale,
  ): Promise<CatalogRecord> {
    let movie: KinopoiskMovieDto;

    if (namespace === 'kinopoisk' && entity === 'title' && /^\d+$/.test(id)) {
      movie = this.validateMovie(await this.request(`/v1.4/movie/${id}`));
    } else if (namespace === 'imdb' && entity === 'title' && /^tt\d+$/.test(id)) {
      movie = await this.resolveExternal('externalId.imdb', id);
    } else if (namespace === 'tmdb' && ['movie', 'tv'].includes(entity) && /^\d+$/.test(id)) {
      movie = await this.resolveExternal('externalId.tmdb', id);
    } else {
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'Provider reference is unsupported',
      );
    }

    const category = this.classify(movie);

    if (
      !category ||
      (namespace === 'tmdb' && entity !== (category === Category.Films ? 'movie' : 'tv'))
    )
      throw new ApiException(404, ApiErrorCode.NotFound, 'Provider catalog record was not found');

    const normalized = normalizeMovie(movie, category, locale, new Date().toISOString());

    return this.identity.observe(normalized.category, normalized.granularity, normalized.snapshot);
  }

  /** Reads one provider detail and persists its stable verified identity. */
  async details(id: string, locale: Locale): Promise<CatalogRecord> {
    return this.resolveReference('kinopoisk', 'title', id, locale);
  }

  /** Resolves a single external identifier and rejects absent or ambiguous matches. */
  private async resolveExternal(field: string, id: string): Promise<KinopoiskMovieDto> {
    const parameters = new URLSearchParams({ page: '1', limit: '2', [field]: id });
    for (const fieldName of ['id', 'type', 'name', 'alternativeName', 'externalId'])
      parameters.append('selectFields', fieldName);
    const envelope = this.validateEnvelope(await this.request(`/v1.4/movie?${parameters}`));
    const matches = envelope.docs.filter((movie) =>
      field.endsWith('.imdb')
        ? movie.externalId?.imdb === id
        : String(movie.externalId?.tmdb) === id,
    );

    if (matches.length !== 1)
      throw new ApiException(
        matches.length ? 409 : 404,
        matches.length ? ApiErrorCode.Conflict : ApiErrorCode.NotFound,
        'Provider reference could not be resolved exactly',
      );

    return this.validateMovie(await this.request(`/v1.4/movie/${matches[0].id}`));
  }

  /** Checks provider type and series indicator before applying the product category. */
  private classify(movie: KinopoiskMovieDto): Category.Films | Category.Tv | null {
    if (TYPES[Category.Films].includes(movie.type)) {
      if (movie.isSeries === true) return null;

      return Category.Films;
    }

    if (TYPES[Category.Tv].includes(movie.type)) {
      if (movie.isSeries === false) return null;

      return Category.Tv;
    }

    return null;
  }

  /** Confirms that a text-search result belongs to the requested category. */
  private matchesCategory(
    movie: KinopoiskMovieDto,
    category: Category.Films | Category.Tv,
  ): boolean {
    return this.classify(movie) === category;
  }

  /** Validates the response envelope and every movie using the shared DTO rules. */
  private validateEnvelope(value: unknown) {
    const result: KinopoiskMoviesResponseDto = plainToInstance(KinopoiskMoviesResponseDto, value);

    if (validateSync(result, { forbidUnknownValues: true }).length)
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Kinopoisk returned an invalid catalog response',
        true,
      );

    return result;
  }

  /** Validates one detail response. */
  private validateMovie(value: unknown) {
    const result: KinopoiskMovieDto = plainToInstance(KinopoiskMovieDto, value);

    if (validateSync(result, { forbidUnknownValues: true }).length)
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Kinopoisk returned an invalid catalog response',
        true,
      );

    return result;
  }

  /** Sends authenticated requests and preserves safe operational failure diagnostics. */
  private async request(path: string): Promise<unknown> {
    const started = performance.now();
    const url = new URL(path, this.origin);
    let operation: 'search' | 'details' | 'discovery' = 'discovery';

    if (url.pathname.endsWith('/search')) operation = 'search';

    if (/\/movie\/\d+$/.test(url.pathname)) operation = 'details';

    const failure = (
      status: number,
      code: ApiErrorCode,
      message: string,
      stage: 'transport' | 'http' | 'body' | 'json',
      upstreamStatus?: number,
      networkCode?: string,
    ) =>
      new ApiException(
        status,
        code,
        message,
        status >= 500 || status === 429,
        undefined,
        undefined,
        {
          provider: 'kinopoisk',
          origin: url.origin,
          operation,
          stage,
          elapsedMs: Math.round(performance.now() - started),
          upstreamStatus,
          networkCode,
        },
      );
    let response: Response;

    try {
      response = await this.fetcher(url, {
        headers: { accept: 'application/json', 'X-API-KEY': this.apiKey },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
      const networkCode =
        typeof code === 'string' &&
        /^(?:E[A-Z_]+|UND_ERR_[A-Z_]+|CERT_[A-Z_]+|DEPTH_ZERO_SELF_SIGNED_CERT)$/.test(code)
          ? code
          : 'UNKNOWN';

      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        throw failure(
          504,
          ApiErrorCode.TransportError,
          'Kinopoisk request timed out',
          'transport',
          undefined,
          'TIMEOUT',
        );

      throw failure(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Kinopoisk API connection failed',
        'transport',
        undefined,
        networkCode,
      );
    }

    if (!response.ok) {
      await response.body?.cancel();

      if (response.status === 404)
        throw failure(
          404,
          ApiErrorCode.NotFound,
          'Provider catalog record was not found',
          'http',
          response.status,
        );

      if (response.status === 401)
        throw failure(
          503,
          ApiErrorCode.ProviderUnavailable,
          'Kinopoisk credentials were rejected',
          'http',
          response.status,
        );

      if (response.status === 403)
        throw failure(
          503,
          ApiErrorCode.ProviderUnavailable,
          'Kinopoisk access or quota was denied',
          'http',
          response.status,
        );

      if (response.status === 429)
        throw failure(
          429,
          ApiErrorCode.RateLimited,
          'Kinopoisk API rate limit was reached',
          'http',
          response.status,
        );

      throw failure(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Kinopoisk API returned an unsuccessful response',
        'http',
        response.status,
      );
    }

    let body: string;

    try {
      body = await response.text();
    } catch {
      throw failure(
        503,
        ApiErrorCode.TransportError,
        'Kinopoisk response body could not be read',
        'body',
        response.status,
      );
    }

    if (Buffer.byteLength(body, 'utf8') > 1_000_000)
      throw failure(
        502,
        ApiErrorCode.InvalidResponse,
        'Kinopoisk response exceeded its size limit',
        'body',
        response.status,
      );

    try {
      return JSON.parse(body);
    } catch {
      throw failure(
        502,
        ApiErrorCode.InvalidResponse,
        'Kinopoisk response was not valid JSON',
        'json',
        response.status,
      );
    }
  }
}
