import { createHash } from 'node:crypto';
import type {
  CatalogRecord,
  CatalogSearchRequest,
  CatalogSearchResponse,
  Provenance,
  Snapshot,
} from '@filecab/contracts';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

const SEARCH_FRESH_MS = 15 * 60 * 1000;
const SEARCH_STALE_MS = 24 * 60 * 60 * 1000;
const SEARCH_CACHE_MAX_ROWS = 5000;
const SEARCH_CACHE_MAX_PAGES_PER_IDENTITY = 20;
const METADATA_FRESH_MS = 24 * 60 * 60 * 1000;
const METADATA_CACHE_MAX_ROWS = 10000;

/** Sorts JSON object keys recursively to make request hashes deterministic. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

/** Extracts provider provenance attached to normalized metadata fields. */
function metadataProvenance(snapshot: Snapshot): Provenance[] {
  const provenance = [
    ...(snapshot.originalTitle ? [snapshot.originalTitle.provenance] : []),
    ...snapshot.titles.map((title) => title.provenance),
    ...snapshot.descriptions.map((description) => description.provenance),
    ...snapshot.genres.flatMap((genre) => genre.labels.map((label) => label.provenance)),
    ...snapshot.providerRatings.map((rating) => rating.provenance),
    ...snapshot.references.map((reference) => reference.provenance),
  ];

  return [
    ...new Map(
      provenance.map((item) => [`${item.source}\u0000${item.retrievedAt}`, item]),
    ).values(),
  ];
}

/** Stores bounded search pages and locale-specific normalized metadata snapshots. */
export class CatalogCacheService {
  constructor(private readonly database: PrismaClient) {}

  /** Reads a fresh locale-specific metadata projection without owner-private fields. */
  async getMetadata(
    catalogId: string,
    locale: string,
  ): Promise<{ record: CatalogRecord; fetchedAt: Date } | null> {
    const cached = await this.database.catalogMetadataCache.findUnique({
      where: { catalogId_locale_schema: { catalogId, locale, schema: 1 } },
    });

    if (!cached || cached.expiresAt <= new Date()) return null;

    return {
      record: cached.record as unknown as CatalogRecord,
      fetchedAt: cached.fetchedAt,
    };
  }

  /** Reads a cached page and reports whether its configured freshness window elapsed. */
  async getSearch(
    request: CatalogSearchRequest & { provider: string },
    allowStale: boolean,
    adapterSchemaVersion: number,
  ): Promise<{ response: CatalogSearchResponse; fetchedAt: Date; stale: boolean } | null> {
    const keys = this.searchKeys(request, adapterSchemaVersion);
    const now = new Date();
    const cached = await this.database.catalogSearchCache.findUnique({
      where: { requestKey: keys.requestKey },
    });

    if (!cached || (allowStale ? cached.staleUntil <= now : cached.expiresAt <= now)) return null;

    await this.database.catalogSearchCache.update({
      where: { requestKey: keys.requestKey },
      data: { lastAccessedAt: now },
    });

    return {
      response: cached.response as unknown as CatalogSearchResponse,
      fetchedAt: cached.fetchedAt,
      stale: cached.expiresAt <= now,
    };
  }

  /** Persists a successful page, replacing older results including valid empty pages. */
  async storeSearch(
    request: CatalogSearchRequest & { provider: string },
    response: CatalogSearchResponse,
    adapterSchemaVersion: number,
  ): Promise<void> {
    const now = new Date();
    const keys = this.searchKeys(request, adapterSchemaVersion);
    const cachedResponse: CatalogSearchResponse = {
      ...response,
      stale: false,
      cachedAt: now.toISOString(),
    };
    const metadataRows = response.results.map((record) =>
      this.metadataRow(record, response.locale, now),
    );

    await this.database.$transaction(
      async (transaction) => {
        await transaction.catalogSearchCache.upsert({
          where: { requestKey: keys.requestKey },
          create: {
            requestKey: keys.requestKey,
            identityKey: keys.identityKey,
            page: request.page,
            response: cachedResponse as unknown as Prisma.InputJsonValue,
            fetchedAt: now,
            expiresAt: new Date(now.getTime() + SEARCH_FRESH_MS),
            staleUntil: new Date(now.getTime() + SEARCH_STALE_MS),
            lastAccessedAt: now,
          },
          update: {
            identityKey: keys.identityKey,
            page: request.page,
            response: cachedResponse as unknown as Prisma.InputJsonValue,
            fetchedAt: now,
            expiresAt: new Date(now.getTime() + SEARCH_FRESH_MS),
            staleUntil: new Date(now.getTime() + SEARCH_STALE_MS),
            lastAccessedAt: now,
          },
        });

        for (const metadata of metadataRows)
          await transaction.catalogMetadataCache.upsert({
            where: {
              catalogId_locale_schema: {
                catalogId: metadata.catalogId,
                locale: metadata.locale,
                schema: metadata.schema,
              },
            },
            create: metadata,
            update: {
              record: metadata.record,
              provenance: metadata.provenance,
              fetchedAt: metadata.fetchedAt,
              expiresAt: metadata.expiresAt,
            },
          });

        const identityPages = await transaction.catalogSearchCache.findMany({
          where: { identityKey: keys.identityKey },
          orderBy: { fetchedAt: 'desc' },
          select: { requestKey: true },
          skip: SEARCH_CACHE_MAX_PAGES_PER_IDENTITY,
        });

        if (identityPages.length)
          await transaction.catalogSearchCache.deleteMany({
            where: { requestKey: { in: identityPages.map((page) => page.requestKey) } },
          });

        const excessPages = await transaction.catalogSearchCache.findMany({
          orderBy: { lastAccessedAt: 'desc' },
          select: { requestKey: true },
          skip: SEARCH_CACHE_MAX_ROWS,
        });

        if (excessPages.length)
          await transaction.catalogSearchCache.deleteMany({
            where: { requestKey: { in: excessPages.map((page) => page.requestKey) } },
          });

        const excessMetadata = await transaction.catalogMetadataCache.findMany({
          orderBy: { fetchedAt: 'desc' },
          select: { catalogId: true, locale: true, schema: true },
          skip: METADATA_CACHE_MAX_ROWS,
        });

        if (excessMetadata.length)
          await transaction.catalogMetadataCache.deleteMany({
            where: {
              OR: excessMetadata.map(({ catalogId, locale, schema }) => ({
                catalogId,
                locale,
                schema,
              })),
            },
          });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /** Hashes full request identity separately from its bounded page mapping identity. */
  private searchKeys(
    request: CatalogSearchRequest & { provider: string },
    adapterSchemaVersion: number,
  ): {
    requestKey: string;
    identityKey: string;
  } {
    const { page, ...identity } = request;
    const identityKey = this.hash({ contractSchema: 1, adapterSchemaVersion, ...identity });

    return {
      identityKey,
      requestKey: this.hash({ contractSchema: 1, adapterSchemaVersion, ...identity, page }),
    };
  }

  /** Creates a stable SHA-256 cache key without storing raw search text in the key. */
  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(canonicalize(value)))
      .digest('hex');
  }

  /** Builds a cache row that retains provider attribution and requested locale. */
  private metadataRow(record: CatalogRecord, locale: string, now: Date) {
    return {
      catalogId: record.catalogId,
      locale,
      schema: record.schemaVersion,
      record: record as unknown as Prisma.InputJsonValue,
      provenance: metadataProvenance(record.snapshot) as unknown as Prisma.InputJsonValue,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + METADATA_FRESH_MS),
    };
  }
}
