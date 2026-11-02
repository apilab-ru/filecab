# Catalog Specification

## Purpose

Provide a provider-independent catalog for anime, films, and TV series. This specification owns shared catalog behavior. Provider-specific requirements are defined in the adjacent integration specifications. Library ownership, CRUD, replication, sharing, and entry identity remain defined in the backend specification.

## Requirements

### Requirement: Provider adapters and capabilities

The backend SHALL implement independently configurable Smotret Anime and Kinopoisk Dev catalog adapters. It SHALL expose enabled providers and their supported categories, operations, filters, ordering, lookup namespaces, and language capabilities. Unsupported operations SHALL return a structured capability error rather than silently ignore inputs.

Shikimori SHALL be a personal-list synchronization provider only, as defined in its integration specification; it SHALL NOT be advertised for catalog search, browsing, or genre refresh.

An adapter SHALL be enabled only after its configured API contract, credentials, quotas, and usage conditions are verified. Provider availability SHALL NOT be required for manual entry creation or stored-library CRUD.

### Requirement: Routing and selection

Catalog requests SHALL accept an optional explicit provider and otherwise use the configured default for the category. Defaults SHALL be explicit deployment configuration: `anime=smotret`, `films=kinopoisk-dev`, and `tv=kinopoisk-dev`. Disabled defaults SHALL return an unavailable-provider result; they SHALL NOT silently switch providers. Search SHALL use one selected provider; automatic aggregation and silent provider switching are not required. Clients SHALL be able to select another enabled provider after a failure.

Provider routing SHALL NOT alter Google authentication, entry ownership, or extension replication.

### Requirement: Search contract

Search SHALL accept text, category, locale, one-based page, page size 1–50, and supported catalog filters. User viewing status and personal rating SHALL NOT be interpreted as catalog fields. Input text SHALL remain unchanged except for documented provider-required encoding/normalization.

Responses SHALL use `{ page, results, hasMore, total? }`. Each result SHALL contain an internal catalog identity and namespaced provider references. Exact total SHALL be omitted when unknown or invalidated by normalization. Valid empty results SHALL be distinguishable from upstream failures.

### Requirement: Pagination integrity

Pagination SHALL preserve deterministic provider ordering and deduplicate verified repeated references without merging different installments. `hasMore` SHALL indicate another deliverable normalized result, using provider continuation evidence or bounded lookahead.

If records are excluded, the adapter SHALL track consumed upstream position independently from the displayed page, using a bounded cached cursor/page mapping when necessary. Changing query, category, filters, ordering, provider, or locale SHALL invalidate that mapping. It SHALL NOT silently skip eligible results or report provider-wide totals for a filtered subset.

A provider mode SHALL not be advertised as supported if it cannot satisfy the contract. Lookahead exhaustion SHALL return a structured limitation, not a fabricated definitive end.

### Requirement: Identity and cross-provider references

Internal `catalogId` SHALL be backend-owned and independent of raw provider IDs. References SHALL preserve `{ provider, entityType, id }`, with string IDs. Uniqueness SHALL cover the full namespace/entity scope.

The same verified provider record SHALL retain one internal identity across language changes and repeated searches. Cross-provider association SHALL require a trusted explicit reference or verified crosswalk. Numerical equality, one returned candidate, similar titles, or franchise relations SHALL NOT prove equivalence.

When existing references disagree, the backend SHALL return a resolution conflict rather than silently combine records. Source attribution SHALL remain available for every verified mapping. Legacy ambiguous IDs SHALL be retained unresolved.

### Requirement: Details and safe enrichment

Internal catalog detail and provider reference resolution SHALL be separate operations. A detail lookup SHALL never query an internal primary key using a raw provider ID.

Upserts SHALL be concurrency-safe. Provider absence SHALL not erase known values; genuine removals SHALL require an explicit refresh policy. Catalog changes SHALL NOT overwrite user titles, notes, status, rating, progress, viewing links, or entry UUIDs. Unavailable provider/catalog rows SHALL NOT remove saved entries or snapshots.

### Requirement: Normalized media metadata

Normalized records SHALL distinguish library category, format, titles/aliases, descriptions, poster, release year, episode total, genres, provider scores, and provenance. Unknown numeric values SHALL be null rather than invented zeros. Provider scores SHALL NOT become personal ratings or an unlabeled popularity metric.

Episode totals SHALL distinguish declared total from released/available episodes where available. Season, special, movie, remake, and edition identities SHALL be retained. Relationships SHALL not automatically collapse installments.

### Requirement: Localization

Search/detail/genre requests SHALL accept `en` or `ru`; new clients SHALL send a locale. Unsupported nonempty locales SHALL fail validation. Responses SHALL identify requested locale, actual field language, and source, including unknown when not established.

Title fallback SHALL use requested translation, original title, another available title, then let the client display a localized unavailable-title label. Description and genre fallback SHALL be field-specific. Original title SHALL NOT be assumed to be English. Machine translation and universal cross-language search are not required.

Storage SHALL retain translations under stable identities or locale-specific projections. Refreshing one locale SHALL not overwrite another. User-owned text SHALL remain unchanged.

### Requirement: Genres

Genres SHALL have stable internal IDs, localized labels, and provider-scoped references. Matching translated labels alone SHALL not establish equivalence. Unknown genres SHALL preserve source data for later mapping without failing the complete media record.

Owner-library filters SHALL use stable internal genre IDs. Provider adapters SHALL translate those IDs only through verified mappings. Genre refresh SHALL be protected operator functionality; public GET requests SHALL not trigger refresh writes.

### Requirement: Provider resilience and metadata cache

Adapters SHALL validate upstream responses and impose configurable timeouts, retry budgets, concurrency and response-size limits. They SHALL respect throttling and Retry-After, keep credentials server-side, and never rotate credentials to evade quotas.

Caches SHALL be keyed by provider, namespace/ID or query, category, locale, filters, ordering, pagination state, and adapter/schema version where applicable. They SHALL not contain owner notes or other private fields. Stale fallback SHALL be identified explicitly and SHALL not mask a valid empty result or explicit removal.

Errors SHALL distinguish unavailable provider, invalid credentials, throttling, unsupported capability, missing record, malformed response, timeout, and mapping conflict. Upstream secrets/payloads SHALL not leak into client errors.

### Requirement: Client and API boundaries

Catalog search pagination SHALL remain server/provider-driven. Owner-library search, sorting, filters, and display pagination SHALL run client-side over the complete owner dataset. These contracts SHALL not be conflated.

Swagger SHALL document normalized catalog contracts, capability failures, locale provenance, internal/provider lookup differences, and nullable metadata. Provider DTOs and credentials SHALL remain backend-only.

### Requirement: Verification

Adapters SHALL have deterministic request/response fixture tests, identity/upsert tests, category and pagination tests, locale tests, and failure tests. Live smoke tests MAY supplement fixtures when authorized credentials and service availability permit. Fixtures SHALL not be described as proof of live availability.
