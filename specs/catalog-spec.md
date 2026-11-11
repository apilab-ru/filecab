# Catalog

## Purpose

Provider-independent discovery and metadata for anime, films and TV. This document
owns shared catalog rules; integration specs add provider-specific constraints.
[Backend](backend.md) owns private library access and synchronization.

## Requirements

### Provider adapters and capabilities

- Configure Smotret and Kinopoisk Dev independently; expose enabled categories, operations, filters, ordering, reference namespaces and language support.
- Reject unsupported capabilities explicitly; never ignore inputs or simulate success.
- Enable only after verifying the selected API, credentials, quotas and usage conditions.
- Manual/stored-library CRUD must remain available during provider failure.
- Shikimori is [personal-list sync](integration-shikimori-spec.md), not catalog search/browse/genre refresh.

### Routing and selection

Allow an explicit enabled provider; otherwise use deployment defaults:
`anime=smotret`, `films=kinopoisk-dev`, `tv=kinopoisk-dev`.
A disabled default returns unavailable, without silent switching. Search uses one
provider; users may choose another after failure. Automatic aggregation is optional.
Provider selection never changes Filecab login, ownership or extension replication.

### Search contract

Accept unchanged query text, category, explicit `en|ru` locale, one-based page,
limit 1–50 and advertised filters. Reject missing/unsupported locale; normalize query
text only as documented by the provider. Personal status/rating are not catalog filters.
Return `{ page, results, hasMore, total? }` with internal catalog IDs and namespaced
references. Omit unknown/inexact totals. Empty results and upstream failures differ.

### Pagination integrity

Preserve deterministic ordering; deduplicate verified records without merging installments.
`hasMore` means another deliverable normalized result, established from continuation
or bounded lookahead. Track consumed upstream position separately from display pages
when filtering; bounded cached cursor/page mappings may be used.
Invalidate mappings on query/category/filter/order/provider/locale changes.
Never skip eligible results or expose unfiltered totals. Unsupported modes and exhausted
lookahead return an explicit limitation, not a fabricated end.

### Identity and cross-provider references

Use backend-owned `catalogId` and unique `{ provider, entityType, id }` string references.
Keep one internal identity across locales/repeated searches. Cross-provider links need
trusted explicit references or verified crosswalks with attribution. Numeric equality,
a lone candidate, similar titles or franchise relations are not proof. Conflicting
references remain resolution conflicts; unverified references do not establish identity.

Catalog operations keep internal identity and provider identity explicit: internal
details are addressed by `catalogId`, while provider resolution uses the complete
`{ namespace, entity, id }` tuple. Capability discovery reports deployment defaults and
only operations actually enabled by a verified, wired adapter. Search adapters return
normalized records through a shared provider contract; provider IDs are never accepted as
internal IDs.

### Details and safe enrichment

Separate internal details from provider resolution; never use raw provider IDs as internal
primary keys. Upserts must be concurrency-safe. Missing fields preserve known values;
actual removal needs an explicit refresh policy. Refresh never alters entry UUIDs or
user titles/notes/status/rating/progress/links, or deletes saved entries/snapshots.

### Normalized media metadata

Keep category, format, localized titles/aliases/descriptions, poster, year, genres,
provider scores and provenance distinct. Unknown numbers are null. Provider scores
are attributed, never personal ratings or unlabeled popularity. Distinguish declared
and available episode counts. Preserve season/special/movie/remake/edition identities;
relationships do not merge installments.

### Localization

Return requested locale, actual field language and source, including unknown.
Title fallback: requested translation → original → another translation → client-localized
unavailable label. Use field-specific description/genre fallback. Do not assume original
means English. Preserve translations under stable IDs or locale-specific projections;
refreshing one locale never overwrites another or user text. Machine translation and
universal cross-language search are optional.

### Genres

Use stable internal IDs, localized labels and explicit provider mappings; matching labels
alone are insufficient. Preserve unknown genres/source data without rejecting a record.
Library filters use internal IDs; adapters use verified mappings. Unknown provider IDs keep
a provider-scoped internal candidate and an unverified mapping until a trusted adapter
supplies a canonical key from its curated server-side crosswalk (never from provider
payload text). Contradictory canonical keys are retained as review conflicts
without replacing the existing mapping. Refresh and conflict review require an authenticated
account in the configured operator allowlist, which defaults to empty. Public genre reads
are read-only and may return stable internal genres whose provider mappings still need
review; adapters only use verified mappings. Bound response bytes, item count, elapsed time, concurrency, retries and
Retry-After waits by server configuration; return structured safe errors on budget exhaustion.

### Provider resilience and metadata cache

Validate responses; bound timeouts, sizes, retries and concurrency. Honor throttling and
Retry-After; keep secrets server-side and never rotate keys to evade limits.
Cache keys include provider, reference/query, category, locale, filters, ordering,
pagination and adapter/schema version as applicable. Search-cache identity includes
page size and isolates pages whenever any request input changes. Successful empty
pages replace cached pages; a failed refresh may return an expired page only with an
explicit stale marker and cache timestamp. Search pages remain fresh for 15 minutes
and eligible for stale fallback for up to 24 hours. Bound search cache storage to
5,000 pages globally and 20 pages per request identity; bound locale metadata snapshots
to 10,000 rows with a 24-hour freshness window. Exclude private fields.
Identify stale fallback; do not mask empty results or explicit removals.
Distinguish unavailable, credentials, quota, capability, missing-record, malformed-response,
timeout and mapping-conflict errors without leaking secrets or upstream payloads.

### Client and API boundaries

Catalog pagination is provider/server-driven. Library filters/sort/pagination operate
client-side over the complete owner dataset. Document both contracts in Swagger,
including capabilities, provenance, nullable fields and lookup identity. Provider DTOs
and credentials stay backend-only.

## Verification

Use deterministic request/response fixtures plus identity/upsert, category, pagination,
locale and failure tests. Authorized live checks supplement fixtures; report them
separately rather than claiming fixtures prove live availability.
