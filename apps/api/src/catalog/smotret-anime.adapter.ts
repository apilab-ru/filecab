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
  type LocalizedText,
  type ProviderReference,
  type Provenance,
  type Snapshot,
} from '@filecab/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createHash } from 'node:crypto';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';
import { CatalogIdentityService } from './catalog-identity.service';
import type { CatalogSearchAdapter } from './catalog-search.service';
import {
  SmotretSeriesDetailResponseDto,
  SmotretSeriesDto,
  SmotretSeriesResponseDto,
} from './smotret-anime.dto';

const SMOTRET_TYPE_FORMATS: Readonly<Record<string, Format>> = {
  movie: Format.Movie,
  tv: Format.Tv,
  ova: Format.Ova,
  ona: Format.Ona,
  special: Format.Special,
  music: Format.Music,
};

const SMOTRET_TYPE_GRANULARITIES: Readonly<Record<string, Granularity>> = {
  movie: Granularity.Film,
  special: Granularity.Special,
  tv: Granularity.Series,
  ova: Granularity.Series,
  ona: Granularity.Series,
  music: Granularity.Series,
};

const SMOTRET_TITLE_LANGUAGES: Readonly<Record<string, string>> = {
  en: 'en',
  ja: 'ja',
  romaji: 'ja-Latn',
  ru: 'ru',
};

const SMOTRET_SEARCH_FILTERS = ['myAnimeListId', 'type', 'year', 'season'] as const;
const SMOTRET_SUPPORTED_TYPES = ['tv', 'movie', 'ova', 'ona', 'special', 'music'] as const;
const SMOTRET_COUNTED_EPISODE_TYPES = new Set([
  'tv',
  'ova',
  'ona',
  'movie',
  'special',
  'tv_special',
]);
const SMOTRET_MAX_EPISODE_RECORDS = 5000;
const SMOTRET_FIELDS = [
  'id',
  'myAnimeListId',
  'myAnimeListScore',
  'worldArtScore',
  'numberOfEpisodes',
  'season',
  'year',
  'type',
  'typeTitle',
  'posterUrl',
  'posterUrlSmall',
  'titles',
  'links',
].join(',');

interface ProviderFailure {
  status?: number;
  retryAfterSeconds?: number;
}

/** Converts a validated series ID to a stable candidate UUID for provider genres. */
function genreCandidateId(externalId: number): string {
  const value = createHash('md5')
    .update(`filecab:genre:provider:smotret:${externalId}`)
    .digest('hex');

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-5${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

/** Validates a provider response without retaining class instances or unknown fields. */
function validateResponse<T extends object>(value: unknown, dto: new () => T): T {
  const instance = plainToInstance(dto, value);
  const errors = validateSync(instance, { forbidUnknownValues: true });

  if (errors.length)
    throw new ApiException(
      502,
      ApiErrorCode.InvalidResponse,
      'Smotret returned an invalid catalog response',
      true,
    );

  return instance;
}

/** Produces an HTTPS-only poster URL without credentials or fragments. */
function posterUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;

    return url.href;
  } catch {
    return null;
  }
}

/** Maps a known provider format or keeps an unsupported value explicitly unknown. */
function formatFor(type: string | undefined): Format | null {
  if (!type) return null;

  return SMOTRET_TYPE_FORMATS[type] ?? Format.Unknown;
}

/** Preserves only known, documented Smotret entity granularity. */
function granularityFor(type: string | undefined): Granularity {
  if (!type) return Granularity.Unknown;

  return SMOTRET_TYPE_GRANULARITIES[type] ?? Granularity.Unknown;
}

/** Extracts exact external IDs from provider links without verifying their equivalence. */
function linkedReference(
  series: SmotretSeriesDto,
  namespace: string,
  entity: string,
  pattern: RegExp,
  provenance: Provenance,
  granularity: Granularity,
): ProviderReference[] {
  const matches = (series.links ?? [])
    .map((link) => link.url ?? '')
    .map((url) => url.match(pattern)?.[1])
    .filter((id): id is string => Boolean(id));

  return [...new Set(matches)].map((id) => ({
    namespace,
    entity,
    id,
    granularity,
    provenance: { ...provenance, verified: false },
  }));
}

/** Counts only narrative episode records and preserves a missing episode array as unknown. */
function availableEpisodeCount(series: SmotretSeriesDto): number | null {
  if (!series.episodes) return null;

  return series.episodes.filter((episode) => {
    if (episode.seriesId !== undefined && episode.seriesId !== series.id) return false;

    return SMOTRET_COUNTED_EPISODE_TYPES.has(episode.episodeType ?? '');
  }).length;
}

/** Rejects detail collections that exceed configured genre or fixed episode-record budgets. */
function assertDetailCollectionLimits(series: SmotretSeriesDto, maxGenres: number): void {
  if (
    (series.genres && series.genres.length > maxGenres) ||
    (series.episodes && series.episodes.length > SMOTRET_MAX_EPISODE_RECORDS)
  )
    throw new ApiException(
      502,
      ApiErrorCode.InvalidResponse,
      'Smotret detail exceeded its item limit',
      true,
    );
}

/** Normalizes a validated provider record while retaining source attribution and namespaces. */
function normalizeSeries(
  series: SmotretSeriesDto,
  locale: Locale,
  origin: string,
  retrievedAt: string,
  detailed: boolean,
): { category: Category; granularity: Granularity; snapshot: Snapshot } {
  const source = new URL('/api/series', origin).toString();
  const provenance: Provenance = { source, retrievedAt, verified: true };
  const granularity = granularityFor(series.type);
  const titles: LocalizedText[] = Object.entries(series.titles ?? {}).flatMap(
    ([language, value]) => {
      if (typeof value !== 'string' || !value.trim()) return [];

      return [{ text: value, language: SMOTRET_TITLE_LANGUAGES[language] ?? language, provenance }];
    },
  );
  titles.sort(
    (left, right) => Number(right.language === locale) - Number(left.language === locale),
  );
  const genres = (series.genres ?? []).map((genre) => ({
    genreId: genreCandidateId(genre.id),
    key: `provider:smotret:${genre.id}`,
    labels: [{ text: genre.title, language: 'und', provenance }],
    categories: [Category.Anime],
  }));
  const descriptions: LocalizedText[] = (series.descriptions ?? []).flatMap((description) => {
    if (!description.value.trim()) return [];

    return [
      {
        text: description.value,
        language: 'und',
        provenance: { ...provenance, source: description.source || source },
      },
    ];
  });
  const references: ProviderReference[] = [
    {
      namespace: 'smotret',
      entity: 'series',
      id: String(series.id),
      granularity,
      provenance,
    },
    ...(series.myAnimeListId
      ? [
          {
            namespace: 'myanimelist',
            entity: 'anime',
            id: String(series.myAnimeListId),
            granularity,
            provenance: { ...provenance, verified: false },
          },
        ]
      : []),
    ...(series.aniDbId
      ? [
          {
            namespace: 'anidb',
            entity: 'anime',
            id: String(series.aniDbId),
            granularity,
            provenance: { ...provenance, verified: false },
          },
        ]
      : []),
    ...linkedReference(
      series,
      'shikimori',
      'anime',
      /shikimori\.(?:io|me)\/animes\/(\d+)/i,
      provenance,
      granularity,
    ),
    ...linkedReference(
      series,
      'anidb',
      'anime',
      /anidb\.net\/perl-bin\/animedb\.pl\?show=anime&aid=(\d+)/i,
      provenance,
      granularity,
    ),
  ];
  const uniqueReferences = [
    ...new Map(
      references.map((reference) => [
        `${reference.namespace}\u0000${reference.entity}\u0000${reference.id}`,
        reference,
      ]),
    ).values(),
  ];
  const score = series.myAnimeListScore;

  return {
    category: Category.Anime,
    granularity,
    snapshot: {
      originalTitle: null,
      titles,
      descriptions: detailed ? descriptions : [],
      posterUrl: posterUrl(series.posterUrl) ?? posterUrl(series.posterUrlSmall),
      year:
        series.year !== undefined && Number.isSafeInteger(series.year) && series.year > 0
          ? series.year
          : null,
      genres: detailed ? genres : [],
      format: formatFor(series.type),
      episodeCount:
        series.numberOfEpisodes !== undefined &&
        Number.isSafeInteger(series.numberOfEpisodes) &&
        series.numberOfEpisodes > 0
          ? series.numberOfEpisodes
          : null,
      availableEpisodeCount: detailed ? availableEpisodeCount(series) : null,
      providerRatings:
        score !== undefined &&
        series.myAnimeListId !== undefined &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= 10
          ? [
              {
                value: score,
                scale: 10,
                provenance: {
                  ...provenance,
                  source: `https://myanimelist.net/anime/${series.myAnimeListId}`,
                },
              },
            ]
          : [],
      references: uniqueReferences,
    },
  };
}

/** Reads a bounded provider response body and rejects invalid JSON or excessive payloads. */
async function readJson(response: Response, maxResponseBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));

  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes)
    throw new ApiException(
      502,
      ApiErrorCode.InvalidResponse,
      'Smotret response exceeded its size limit',
    );

  if (!response.body)
    throw new ApiException(502, ApiErrorCode.InvalidResponse, 'Smotret response was empty');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    size += value.byteLength;

    if (size > maxResponseBytes) {
      await reader.cancel();
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Smotret response exceeded its size limit',
      );
    }

    chunks.push(value);
  }

  try {
    const body = Buffer.concat(chunks).toString('utf8');

    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiException(
      502,
      ApiErrorCode.InvalidResponse,
      'Smotret response was not valid JSON',
    );
  }
}

/** Resolves safe retry metadata from a provider failure response. */
function failureFromResponse(response: Response): ProviderFailure {
  const value = response.headers.get('retry-after');
  let retryAfterSeconds: number | undefined;

  if (value && /^\d+$/.test(value)) retryAfterSeconds = Number(value);

  if (value && retryAfterSeconds === undefined) {
    const retryAt = Date.parse(value);

    if (Number.isFinite(retryAt))
      retryAfterSeconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  }

  return {
    status: response.status,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

/** Waits for a bounded provider retry delay. */
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Implements the documented public Smotret catalog API with bounded requests. */
export class SmotretAnimeAdapter implements CatalogSearchAdapter {
  readonly schemaVersion = 1;
  readonly capability: CatalogProviderCapability = {
    provider: 'smotret',
    categories: [Category.Anime],
    operations: ['search', 'details', 'resolve-reference'],
    filters: [...SMOTRET_SEARCH_FILTERS],
    ordering: ['id'],
    referenceNamespaces: ['smotret', 'myanimelist'],
    languages: [Locale.En, Locale.Ru],
  };

  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly origin: string,
    private readonly environment: ApiEnvironment['catalog'],
    private readonly identity: CatalogIdentityService,
    private readonly userAgent: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** Searches Smotret with exact documented filters and persists each returned identity. */
  async search(
    request: CatalogSearchRequest & { provider: string },
  ): Promise<CatalogSearchResponse> {
    this.validateFilters(request.filters ?? {});
    const upstreamLimit = request.pageSize + 1;
    const offset = (request.page - 1) * request.pageSize;
    const parameters = new URLSearchParams({
      limit: String(upstreamLimit),
      offset: String(offset),
    });

    if (request.query) parameters.set('query', request.query);

    for (const [key, value] of Object.entries(request.filters ?? {}))
      parameters.set(key, String(value));

    parameters.set('order', request.order ?? 'id');

    parameters.set('fields', SMOTRET_FIELDS);

    const raw = await this.requestJson(`/series?${parameters.toString()}`);
    const envelope = validateResponse(raw, SmotretSeriesResponseDto);

    if (envelope.data.length > upstreamLimit)
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Smotret returned too many catalog records',
        true,
      );

    const unique = new Map<number, SmotretSeriesDto>();

    for (const series of envelope.data) unique.set(series.id, series);

    const records = [...unique.values()];
    const hasMore = records.length > request.pageSize;
    const page = records.slice(0, request.pageSize);
    const retrievedAt = new Date().toISOString();
    const results: CatalogRecord[] = [];

    for (const series of page) {
      assertDetailCollectionLimits(series, this.environment.budgets.maxGenres);

      const normalized = normalizeSeries(series, request.locale, this.origin, retrievedAt, false);

      results.push(
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
      results,
      hasMore,
    };
  }

  /** Resolves exact Smotret or MAL references before returning a persisted catalog identity. */
  async resolveReference(
    namespace: string,
    entity: string,
    id: string,
    locale: Locale,
  ): Promise<CatalogRecord> {
    const numericId = Number(id);

    if (
      !/^\d+$/.test(id) ||
      String(numericId) !== id ||
      !Number.isSafeInteger(numericId) ||
      numericId < 1
    )
      throw new ApiException(400, ApiErrorCode.ValidationError, 'Provider reference ID is invalid');

    let series: SmotretSeriesDto;

    if (namespace === 'smotret' && entity === 'series') {
      series = await this.fetchSeries(numericId);
    } else if (namespace === 'myanimelist' && entity === 'anime') {
      const response = validateResponse(
        await this.requestJson(
          `/series?myAnimeListId=${numericId}&limit=2&fields=${SMOTRET_FIELDS}`,
        ),
        SmotretSeriesResponseDto,
      );
      const exact = response.data.filter((candidate) => candidate.myAnimeListId === numericId);

      if (response.data.length > 2)
        throw new ApiException(
          502,
          ApiErrorCode.InvalidResponse,
          'Smotret returned too many lookup records',
          true,
        );

      if (!exact.length)
        throw new ApiException(404, ApiErrorCode.NotFound, 'Provider catalog record was not found');

      if (exact.length !== 1)
        throw new ApiException(
          409,
          ApiErrorCode.Conflict,
          'Provider reference resolves ambiguously',
        );

      series = exact[0];
    } else {
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'Provider reference is unsupported',
      );
    }

    if (namespace === 'myanimelist') series = await this.fetchSeries(series.id);

    assertDetailCollectionLimits(series, this.environment.budgets.maxGenres);

    const retrievedAt = new Date().toISOString();
    const normalized = normalizeSeries(series, locale, this.origin, retrievedAt, true);

    if (namespace === 'myanimelist') {
      normalized.snapshot.references = normalized.snapshot.references.map((reference) =>
        reference.namespace === 'myanimelist' && reference.id === id
          ? { ...reference, provenance: { ...reference.provenance, verified: true } }
          : reference,
      );
    }

    return this.identity.observe(normalized.category, normalized.granularity, normalized.snapshot);
  }

  /** Reads one series detail and safely enriches its previously observed catalog identity. */
  async details(id: string, locale: Locale): Promise<CatalogRecord> {
    const numericId = Number(id);

    if (
      !/^\d+$/.test(id) ||
      String(numericId) !== id ||
      !Number.isSafeInteger(numericId) ||
      numericId < 1
    )
      throw new ApiException(400, ApiErrorCode.ValidationError, 'Provider reference ID is invalid');

    const series = await this.fetchSeries(numericId);
    assertDetailCollectionLimits(series, this.environment.budgets.maxGenres);

    const retrievedAt = new Date().toISOString();
    const normalized = normalizeSeries(series, locale, this.origin, retrievedAt, true);

    return this.identity.observe(normalized.category, normalized.granularity, normalized.snapshot);
  }

  /** Loads and validates a single documented series detail. */
  private async fetchSeries(id: number): Promise<SmotretSeriesDto> {
    const raw = await this.requestJson(`/series/${id}`);

    try {
      return validateResponse(raw, SmotretSeriesDetailResponseDto).data;
    } catch (error) {
      if (error instanceof ApiException && error.httpStatus === 404)
        throw new ApiException(404, ApiErrorCode.NotFound, 'Provider catalog record was not found');

      throw error;
    }
  }

  /** Rejects unsupported or ill-typed filters before building an upstream request. */
  private validateFilters(filters: Record<string, string | number | boolean>): void {
    for (const [key, value] of Object.entries(filters)) {
      if (
        !SMOTRET_SEARCH_FILTERS.includes(key as (typeof SMOTRET_SEARCH_FILTERS)[number]) ||
        typeof value === 'boolean'
      )
        throw new ApiException(
          400,
          ApiErrorCode.ValidationError,
          'Smotret search filter is unsupported',
        );

      if (
        key === 'type' &&
        !SMOTRET_SUPPORTED_TYPES.includes(value as (typeof SMOTRET_SUPPORTED_TYPES)[number])
      )
        throw new ApiException(
          400,
          ApiErrorCode.ValidationError,
          'Smotret series type is unsupported',
        );

      if (
        (key === 'year' || key === 'myAnimeListId') &&
        (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
      )
        throw new ApiException(
          400,
          ApiErrorCode.ValidationError,
          'Smotret numeric filter is invalid',
        );

      if (key === 'season' && (typeof value !== 'string' || value.length > 40))
        throw new ApiException(
          400,
          ApiErrorCode.ValidationError,
          'Smotret season filter is invalid',
        );
    }
  }

  /** Applies request concurrency, timeout, retry, response-size and provider-status budgets. */
  private async requestJson(path: string): Promise<unknown> {
    const release = await this.acquire();

    try {
      let lastError: unknown;

      for (let attempt = 0; attempt <= this.environment.budgets.retries; attempt += 1) {
        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;

        try {
          const response = await Promise.race([
            this.fetcher(new URL(`/api${path}`, this.origin), {
              headers: { accept: 'application/json', 'user-agent': this.userAgent },
              signal: controller.signal,
              redirect: 'error',
            }),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                controller.abort();
                reject(
                  new ApiException(
                    504,
                    ApiErrorCode.TransportError,
                    'Smotret request timed out',
                    true,
                  ),
                );
              }, this.environment.budgets.timeoutMs);
            }),
          ]);

          if (!response.ok) {
            const failure = failureFromResponse(response);

            if (failure.status === 404)
              throw new ApiException(
                404,
                ApiErrorCode.NotFound,
                'Provider catalog record was not found',
              );

            if (failure.status === 429)
              throw new ApiException(
                429,
                ApiErrorCode.RateLimited,
                'Smotret API rate limit was reached',
                true,
                undefined,
                failure.retryAfterSeconds,
              );

            if ([401, 403].includes(response.status))
              throw new ApiException(
                503,
                ApiErrorCode.ProviderUnavailable,
                'Smotret API denied the request',
              );

            if (response.status >= 500)
              throw new ApiException(
                503,
                ApiErrorCode.ProviderUnavailable,
                'Smotret API is unavailable',
                true,
              );

            throw new ApiException(
              502,
              ApiErrorCode.InvalidResponse,
              'Smotret API returned an invalid response',
            );
          }

          return await readJson(response, this.environment.budgets.maxResponseBytes);
        } catch (error) {
          lastError = error;

          if (error instanceof ApiException && !error.retryable) throw error;

          const retryAfter = error instanceof ApiException ? error.retryAfterSeconds : undefined;

          if (
            retryAfter !== undefined &&
            retryAfter > this.environment.budgets.maxRetryAfterSeconds
          )
            throw new ApiException(
              429,
              ApiErrorCode.RateLimited,
              'Smotret retry delay exceeds the configured budget',
              true,
              undefined,
              retryAfter,
            );

          if (attempt >= this.environment.budgets.retries) break;

          await wait(
            retryAfter === undefined ? Math.min(2000, 100 * 2 ** attempt) : retryAfter * 1000,
          );
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }

      if (lastError instanceof ApiException) throw lastError;

      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Smotret API could not be reached',
        true,
      );
    } finally {
      release();
    }
  }

  /** Enforces a bounded in-process queue for provider requests. */
  private async acquire(): Promise<() => void> {
    const maxQueued = this.environment.budgets.concurrency * 4;

    if (this.active >= this.environment.budgets.concurrency && this.waiters.length >= maxQueued)
      throw new ApiException(
        429,
        ApiErrorCode.RateLimited,
        'Smotret request capacity is full',
        true,
      );

    if (this.active >= this.environment.budgets.concurrency)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    else this.active += 1;

    let released = false;

    return () => {
      if (released) return;

      released = true;
      const next = this.waiters.shift();

      if (next) next();
      else this.active -= 1;
    };
  }
}
