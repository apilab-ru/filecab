import {
  ApiErrorCode,
  Category,
  type CatalogCapabilities,
  type CatalogProviderCapability,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
  type CatalogRecord,
  type Locale,
} from '@filecab/contracts';
import { ApiException } from '../http/api-error';
import { CatalogCacheService } from './catalog-cache.service';

export const CATALOG_DEFAULT_PROVIDERS: CatalogCapabilities['defaults'] = {
  [Category.Anime]: 'smotret',
  [Category.Films]: 'kinopoisk-dev',
  [Category.Tv]: 'kinopoisk-dev',
};

/** Defines the normalized search boundary that verified provider adapters implement. */
export interface CatalogSearchAdapter {
  capability: CatalogProviderCapability;
  schemaVersion: number;
  search(request: CatalogSearchRequest & { provider: string }): Promise<CatalogSearchResponse>;
  resolveReference?(
    namespace: string,
    entity: string,
    id: string,
    locale: Locale,
  ): Promise<CatalogRecord>;
  details?(id: string, locale: Locale): Promise<CatalogRecord>;
}

/** Selects one provider and enforces its advertised catalog capabilities. */
export class CatalogSearchService {
  constructor(
    private readonly adapters: readonly CatalogSearchAdapter[] = [],
    private readonly cache?: CatalogCacheService,
  ) {}

  /** Reports defaults alongside only wired provider capabilities. */
  capabilities(): CatalogCapabilities {
    return {
      schemaVersion: 1 as const,
      defaults: CATALOG_DEFAULT_PROVIDERS,
      providers: this.adapters.map((adapter) => adapter.capability),
    };
  }

  /** Dispatches one bounded search without silently switching provider or ignoring filters. */
  async search(request: CatalogSearchRequest): Promise<CatalogSearchResponse> {
    const provider = request.provider ?? CATALOG_DEFAULT_PROVIDERS[request.category];
    const adapter = this.adapters.find((candidate) => candidate.capability.provider === provider);

    if (!adapter)
      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Selected catalog provider is unavailable',
        true,
      );

    const capability = adapter.capability;
    const unsupportedFilter = Object.keys(request.filters ?? {}).some(
      (filter) => !capability.filters.includes(filter),
    );

    if (
      !capability.categories.includes(request.category) ||
      !capability.operations.includes('search') ||
      !capability.languages.includes(request.locale) ||
      unsupportedFilter ||
      (request.order !== undefined && !capability.ordering.includes(request.order))
    )
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'Selected catalog provider does not support this request',
      );

    const effectiveRequest = { ...request, provider };
    let fresh;

    try {
      fresh = await this.cache?.getSearch(effectiveRequest, false, adapter.schemaVersion);
    } catch {
      // Cache availability must not prevent a live provider request.
    }

    if (fresh)
      return {
        ...fresh.response,
        stale: false,
        cachedAt: fresh.fetchedAt.toISOString(),
      };

    let response: CatalogSearchResponse;

    try {
      response = await adapter.search(effectiveRequest);
    } catch (error) {
      if (error instanceof ApiException && !error.retryable) throw error;

      let stale;

      try {
        stale = await this.cache?.getSearch(effectiveRequest, true, adapter.schemaVersion);
      } catch {
        // The original provider failure remains authoritative when cache storage is unavailable.
      }

      if (stale)
        return {
          ...stale.response,
          stale: true,
          cachedAt: stale.fetchedAt.toISOString(),
        };

      throw error;
    }

    if (
      response.schemaVersion !== 1 ||
      response.locale !== request.locale ||
      response.page !== request.page ||
      response.results.some((result) => result.category !== request.category) ||
      (response.total !== undefined &&
        (!Number.isSafeInteger(response.total) || response.total < response.results.length))
    )
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Catalog provider returned an invalid response',
        true,
      );

    const ids = new Set<string>();
    const results = response.results.filter((result) => {
      if (ids.has(result.catalogId)) return false;

      ids.add(result.catalogId);

      return true;
    });

    const normalizedResponse = {
      ...response,
      schemaVersion: 1 as const,
      locale: request.locale,
      page: request.page,
      results,
    };

    try {
      await this.cache?.storeSearch(effectiveRequest, normalizedResponse, adapter.schemaVersion);
    } catch {
      // A valid provider response remains usable when cache persistence fails.
    }

    return normalizedResponse;
  }

  /** Resolves one provider reference only through the adapter that owns its namespace. */
  async resolveReference(
    namespace: string,
    entity: string,
    id: string,
    locale: Locale,
  ): Promise<CatalogRecord> {
    const adapter = this.adapters.find((candidate) =>
      candidate.capability.referenceNamespaces.includes(namespace),
    );

    if (!adapter?.resolveReference || !adapter.capability.operations.includes('resolve-reference'))
      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Provider reference lookup is unavailable',
        true,
      );

    return adapter.resolveReference(namespace, entity, id, locale);
  }

  /** Reads provider details only when the selected adapter advertises that operation. */
  async details(provider: string, id: string, locale: Locale): Promise<CatalogRecord> {
    const adapter = this.adapters.find((candidate) => candidate.capability.provider === provider);

    if (!adapter?.details || !adapter.capability.operations.includes('details'))
      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Provider details are unavailable',
        true,
      );

    return adapter.details(id, locale);
  }
}
