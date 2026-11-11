import {
  ApiErrorCode,
  Category,
  type CatalogCapabilities,
  type CatalogProviderCapability,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
} from '@filecab/contracts';
import { ApiException } from '../http/api-error';

export const CATALOG_DEFAULT_PROVIDERS: CatalogCapabilities['defaults'] = {
  [Category.Anime]: 'smotret',
  [Category.Films]: 'kinopoisk-dev',
  [Category.Tv]: 'kinopoisk-dev',
};

/** Defines the normalized search boundary that verified provider adapters implement. */
export interface CatalogSearchAdapter {
  capability: CatalogProviderCapability;
  search(request: CatalogSearchRequest & { provider: string }): Promise<CatalogSearchResponse>;
}

/** Selects one provider and enforces its advertised catalog capabilities. */
export class CatalogSearchService {
  constructor(private readonly adapters: readonly CatalogSearchAdapter[] = []) {}

  /** Reports defaults alongside only wired provider capabilities. */
  capabilities(): CatalogCapabilities {
    return {
      schemaVersion: 1,
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

    const response = await adapter.search({ ...request, provider });

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

    return {
      ...response,
      schemaVersion: 1,
      locale: request.locale,
      page: request.page,
      results,
    };
  }
}
