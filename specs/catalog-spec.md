# Catalog

## Purpose

This document defines provider-independent discovery and metadata for anime, films and TV.
Integration specs add provider-specific rules. [Library UI](library-ui.md) defines the
catalog screens. [Backend](backend.md) owns private library access.

## Requirements

### Provider adapters and capabilities

- Configure Smotret and Kinopoisk Dev independently.
- Expose the enabled categories, operations, filters, ordering, reference namespaces and language support of each provider.
- Report only operations of a verified, wired adapter.
- Reject an unsupported capability explicitly. Never ignore input or simulate success.
- Enable a provider only after you verify its API, credentials, quotas and usage conditions.
- Manual and stored-library CRUD must work when a provider fails.
- Shikimori is a [personal-list sync](integration-shikimori-spec.md) provider. It is not a catalog, search or genre provider.

### Routing

Use the requested enabled provider. Otherwise use the deployment default:

| Category | Default provider |
| -------- | ---------------- |
| Anime    | `smotret`        |
| Films    | `kinopoisk`      |
| TV       | `kinopoisk`      |

A disabled default returns an unavailable error. Never switch providers silently.
One search uses one provider. After a failure, the user can choose another provider.
Automatic aggregation is optional. Provider selection never changes login, ownership or replication.

### Search contract

Input: unchanged query text, category, explicit `en` or `ru` locale, one-based page,
limit 1–50 and advertised filters.

- Reject a missing or unsupported locale.
- Normalize query text only as the provider spec documents.
- Personal status and rating are not catalog filters.

Output: `{ page, results, hasMore, total? }` with internal catalog IDs and namespaced
references. Omit an unknown or inexact total. An empty result and an upstream failure are different results.

### Pagination integrity

- Keep a deterministic order.
- Remove duplicate verified records. Do not merge installments.
- `hasMore` means another deliverable normalized result exists. Get it from continuation data or a bounded lookahead.
- When filtering, track the consumed upstream position separately from display pages. Bounded cached cursor-to-page maps are permitted.
- Invalidate these maps when the query, category, filter, order, provider or locale changes.
- Never skip eligible results. Never show unfiltered totals.
- An unsupported mode or exhausted lookahead returns an explicit limitation. Never return a false end.

### Identity and cross-provider references

- The backend owns `catalogId`. Provider references are unique `{ namespace, entity, id }` string tuples.
- Internal details use `catalogId`. Provider resolution uses the complete tuple. Never accept a provider ID as an internal ID.
- Keep one internal identity across locales and repeated searches.
- A cross-provider link needs a trusted explicit reference or a verified crosswalk with attribution.
- Numeric equality, one candidate, similar titles and franchise relations are not proof.
- Conflicting references stay as resolution conflicts.

### Installment boundaries

A series, season, film, special, remake and edition with their own provider identity
stay separate catalog records. Format is separate from category: an anime movie stays
anime. A complete series from one provider is not equal to a season from another provider.
Relations describe links. They never merge records. Cross-provider equivalence also needs
compatible granularity. Unknown granularity stays unresolved. Rewatch history and
automatic installment grouping are not in scope.

### Details and safe enrichment

- Upserts must be safe under concurrency.
- A missing field keeps the known value. Removal of a value needs an explicit refresh policy.
- Refresh never changes entry UUIDs or user titles, notes, status, rating, progress or links.
- Refresh never deletes saved entries or snapshots.
- A catalog refresh enriches the snapshot of each library entry that links to the catalog item. This is a metadata refresh, not a user edit. See [Domain contract](domain-contract.md).
- An entry that changes gets a new server version and a change record. Its `updatedAt` does not change. An entry without a change keeps its version. Deleted entries do not change.

### Normalized media metadata

- Keep category, format, localized titles, aliases, descriptions, poster, year, genres, provider scores and provenance separate.
- Unknown numbers are null.
- Provider scores are attributed. They are never personal ratings or unlabeled popularity.
- Keep declared and available episode counts separate.

### Localization

- Return the requested locale and the actual language and source of each field, including unknown.
- Title fallback: requested translation, then original, then another translation, then a localized "unavailable" label.
- Descriptions and genres use their own fallbacks. See [LANG-03](functionality.md#10-english-and-russian).
- The original title is not automatically English.
- Keep translations under stable IDs or locale-specific projections. Refreshing one locale never overwrites another locale or user text.
- Machine translation and cross-language search are optional.

### Genres

- Use stable internal IDs, localized labels and explicit provider mappings. Equal labels are not enough.
- An unknown genre does not reject the record.
- Library filters use internal IDs.
- Before you store a catalog snapshot, replace each provider genre with its internal genre from `GenreMapping`. Use verified and unverified mappings. Operator review can correct a mapping.
- A provider can ignore genre IDs that do not describe a genre. A provider can also convert a subgenre ID to a main genre ID. Keep these rules in the server code.
- Remove an unmapped provider genre from the snapshot. Report it to Sentry one time for each process. The event names the provider and lists the external IDs and labels of all its new unmapped genres.
- An unknown provider genre gets a provider-scoped internal candidate and an unverified mapping.
- A trusted adapter can supply a canonical key only from its curated server-side crosswalk. Never take it from provider text.
- Keep contradictory canonical keys as review conflicts. Do not replace the existing mapping.
- Mark a mapping as verified only after two checks. First, find the external ID in the live provider dictionary or in complete bounded pagination. Second, review the meaning of the provider genre and of the internal genre.
- Keep a mapping unverified when the provider does not return its external ID.
- Refresh and conflict review require an account in `CATALOG_OPERATOR_ACCOUNT_IDS`. The default list is empty. When `NODE_ENV` is `development`, catalog administration routes do not require sign-in.
- Public genre reads are read-only. They can return genres whose mappings still need review.
- Limit response size, item count, elapsed time, concurrency, retries and Retry-After waits by configuration. Return a structured error when a budget is exhausted.

### Provider resilience

- Validate responses. Limit timeouts, sizes, retries and concurrency.
- Obey throttling and Retry-After. Never rotate keys to avoid limits.
- Keep secrets on the server.
- Keep these errors separate: unavailable, credentials, quota, capability, missing record, malformed response, timeout and mapping conflict. Do not show secrets or upstream payloads.

### Metadata cache

The cache key includes provider, reference or query, category, locale, filters, order,
page size, page and adapter schema version. Any change of input gives a separate cache page.

| Setting                     | Value                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| Search freshness            | `CATALOG_SEARCH_CACHE_TTL_SECONDS`, default 86400 (24 h), maximum 2592000 (30 d) |
| Stale fallback after expiry | 24 hours                                                                         |
| Search pages                | 5,000 total, 20 for each request identity                                        |
| Locale metadata snapshots   | 10,000 rows, 24-hour freshness                                                   |

- A successful empty page replaces the cached page.
- A failed refresh can return an expired page only with a stale marker and the cache time.
- Never use stale data to hide an empty result or an explicit removal.
- Exclude private fields.
- Store the provider with each search page and metadata row.
- `DELETE /api/v1/catalog/admin/cache` removes the search pages and metadata of all providers. The optional `provider` query (`smotret` or `kinopoisk`) removes only that provider. An unknown provider gives a validation error.
- Only an account in `CATALOG_OPERATOR_ACCOUNT_IDS` can clear the cache. A clear does not change catalog identities or owner libraries.

### API boundaries

Catalog pagination is driven by the provider and server. Library filters, sort and
pagination run on the client over the complete owner library. Document both in Swagger,
including capabilities, provenance, nullable fields and lookup identity. Provider DTOs and
credentials stay on the backend.

## Verification

Use deterministic request and response fixtures. Test identity and upserts, category,
pagination, locale and failures. Authorized live checks add to fixtures. Report them
separately. Fixtures do not prove live availability.
