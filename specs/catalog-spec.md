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
`anime=smotret`, `films=kinopoisk`, `tv=kinopoisk`.
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
explicit stale marker and cache timestamp. Configure search freshness with
`CATALOG_SEARCH_CACHE_TTL_SECONDS`. Default to 86400 seconds (24 hours). Accept a
positive integer up to 2592000 seconds (30 days). After freshness expires, allow
stale fallback for another 24 hours. Bound search cache storage to
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

### Client search and confirmation

Read provider capabilities before search. A blank query is permitted only when the
provider sets `browse` to true. Use the filters and orders for the selected operation.
Wait 300 ms after a query change. Abort the previous request and reject its result
when any search input changes. Reset the page when category, locale, provider, query,
filter or order changes. Use `hasMore` for Next. Show Last only with an exact total.
Keep website search options in the route query. Do not include private notes or page URLs.

Keep the full owner library separate from catalog results. Match a result by internal
identity or a verified reference. Show personal fields only from the matched entry.
Title matches are suggestions. They require user confirmation. A category conflict or
contradictory identity must stop the operation.

Add title saves the catalog result directly with planned status, zero personal rating
and progress, and a title from the requested locale. Do not open the editor. Keep the
result in place. After save, hide Add and show its saved library state and a personal
rating control. Save rating changes with the current entry version. A failed write
shows an error and allows retry. Prevent duplicate submissions. Edit opens the saved
entry. Manual creation does not require a provider response.

Catalog association uses the entry version and preserves its UUID, added date and user
fields. If a second entry owns the catalog identity, show both entries and the selected
user fields before merge. The manual entry survives. Combine sources in their saved
order. Confirm the preview before apply. Recheck both versions before apply. Website
association and merge use one server transaction. Local merge uses a durable journal;
complete journal recovery before reads, writes or replication. If a newer row conflicts
with recovery, stop and retain the journal for raw recovery export. A failed preview or stale
version must retain the draft and must not release a source claim.

### Search filter presentation

Use the library toolbar style for catalog search controls. Show manual entry creation
only in library mode. Do not show the manual-entry button in catalog mode. Do not show provider,
release season, MyAnimeList ID or provider rating controls. Use the deployment default
provider. Do not send removed filter values from saved route parameters.

Keep the popup Search tab as a placeholder. Full-page and website catalog search remain
available.

Show Release year and Format as compact library-style filters. Use placeholders
instead of labels above the controls. Use the shared select control for Format.

Use the library pagination panel style for catalog results. Put Order in this panel.
Keep Next based on `hasMore`. Do not show an exact page count when the total is unknown.

Offer card and list views in catalog and search. Use one shared result collection
component and one result component for both views. Keep the selected view when the
query or page changes.

Use one configurable filter toolbar for library and catalog pages. Put one view
switch at the right end of the category bar. Apply its selected layout to the active page.

Use the same card component for library entries and catalog results. Match the dark
mockup: put the poster above the title and year, overlay the saved status and action
menu, and show personal progress and rating below. Show personal values only for
saved entries. Keep catalog add and association actions available.

Use one result layout for catalog and library cards. At desktop width, show four
columns with equal gaps. Put Add at the bottom of an unsaved catalog card. Keep
Edit and association actions in the poster action menu. Use the same poster height, text sizes, status badge,
rating row and progress track in both modes. Use one column for list mode.

Hide the year when it is unknown. For unsaved results in catalog and search, show an approximate provider
rating on a 10-point scale. Convert each positive score with a valid scale to this
scale, then use their arithmetic mean. Round the displayed value to one decimal
place and mark it as approximate. If no score is available, show Unrated. Keep the
personal rating in library mode. Do not save the provider score as a personal rating.

### List rows and ordering

Use the light list mockup for list mode. Show compact rows with a small poster,
title, year, saved status, episode progress, rating and actions. Align rows with a
sticky column header. Keep grid mode unchanged. Allow horizontal scrolling on
small screens. Keep Add and personal rating controls available in list mode.

Library column headers sort the complete filtered library before pagination. A
header click selects its field and toggles its direction. Keep the pagination sort
and order controls in sync and reset the page after an order change. In catalog
mode, enable a header only for ordering values advertised for the current provider
and search operation. Show arrows only for supported directions. Send catalog
ordering to the server; do not sort one result page locally. Plain unsupported
headers have no sort action.

### Personal rating picker

For saved cards and list rows, use the light card mockup's rating popup. Open it
from the star and current score. Show Your rating, Clear, and scores 1 to 10 in two
rows of five buttons. Highlight the saved score. Clear saves zero. Save a selected
score immediately with the current entry version. Keep the popup open with an
error after a failed save. Close it after a successful save and return focus to the
trigger. Escape and an outside click close the popup without a write. Mark the
active grid card with an accent outline. Use the same picker in library mode and
saved catalog results. Provider scores are display-only.

### Grid card dimensions

Use the light grid mockup as the size reference. At its desktop size, grid cards
are 326 CSS pixels wide and approximately 327 pixels high. Limit each grid column
to 326 pixels. Keep a 20-pixel gap. Use a 25:16 landscape ratio for the cover and
crop the image to fill it. Reserve 118 pixels for the card body. Use the same sizes
for library and catalog cards, including unsaved results with Add. Scale covers
with card width on small screens. Do not stretch narrow covers to a fixed height.
Allow error text to increase card height. Keep list thumbnails at 40 by 40 pixels.

In the catalog pagination panel, separate Sort by from Order as in library mode.
Offer provider-default sorting and only supported sort fields. Offer only supported
directions for the selected field. A field change keeps the direction if supported;
otherwise select its first supported direction. Column headers and both controls
use the same order value and reset pagination when it changes.

Label the provider-default sort option Default in English and По умолчанию in Russian.

Keep the catalog pagination panel visible during initial loads and replacement
requests. Keep it at the bottom of the result region. Disable navigation and sort
controls while loading. Do not use stale continuation flags for a new request.

Show skeleton cards or rows during catalog loading, matching the selected layout
and result dimensions. Keep pagination visible. Hide skeleton shapes from assistive
technology and retain the loading status announcement. Disable skeleton animation
when reduced motion is requested. Remove skeletons on success, failure or offline state.
