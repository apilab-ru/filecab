import type {
  CatalogCapabilities,
  CatalogRecord,
  Locale,
  PageReference,
  CatalogSearchRequest,
  CatalogSearchResponse,
} from '@filecab/contracts';

/** Reads typed public catalog data with cancellation and safe failure boundaries. */
export async function catalogRead<T>(
  origin: string,
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${origin}/api/v1/catalog/${path}`, { signal });

  if (!response.ok) throw new Error('Catalog service unavailable');

  return (await response.json()) as T;
}

/** Reads deployment capabilities without sending owner data or credentials. */
export function catalogCapabilities(origin: string, signal: AbortSignal) {
  return catalogRead<CatalogCapabilities>(origin, 'capabilities', signal);
}

/** Serializes one catalog request independently of owner-library filters. */
export function catalogSearch(origin: string, request: CatalogSearchRequest, signal: AbortSignal) {
  const { filters, ...values } = request;
  const query = new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

  if (filters && Object.keys(filters).length) query.set('filters', JSON.stringify(filters));

  return catalogRead<CatalogSearchResponse>(origin, `search?${query}`, signal);
}

/** Resolves a provider reference from a page to a catalog record through the owning adapter. */
export function catalogReference(
  origin: string,
  reference: PageReference,
  locale: Locale,
  signal: AbortSignal,
) {
  const path = [reference.namespace, reference.entity, reference.id].map(encodeURIComponent);

  return catalogRead<CatalogRecord>(
    origin,
    `providers/${path.join('/')}?locale=${encodeURIComponent(locale)}`,
    signal,
  );
}
