# Kinopoisk Dev integration

## Purpose

Film/TV search, reference resolution and metadata through Kinopoisk Dev.
Apply all shared [Catalog rules](catalog-spec.md); this file defines adapter differences.
Streaming, provider accounts and watchlist synchronization are out of scope.

## Requirements

### Configuration and scope

Use provider key `kinopoisk` but the Kinopoisk title-reference namespace.
Configure origin/version and server-only documented authentication; requested origin
is `https://api.kinopoisk.dev`. Verified replacement origins must preserve existing
identity mappings. Do not substitute `kinopoiskapiunofficial.tech`. Google login
requires no Kinopoisk account.

### Text search and filtered discovery

Treat text search and structured discovery as separate capabilities. Use only filters
each operation supports. Enforce category on every result; when upstream text search
cannot combine filters, use bounded continuation-aware filtering or reject the combination.
Never label mixed results as correctly filtered.

### Film and TV classification

| Filecab category | Default provider types                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Films            | `movie`, `cartoon`                                                            |
| TV               | `tv-series`, `animated-series`                                                |
| Anime            | Requires a separately supported policy; never silently treat `anime` as films |

Keep category and format separate. Diagnose unknown types, check verified `isSeries`
consistency, and enforce actual constraints rather than relying on an `isTv` variable.

### Detail and external-reference lookup

Resolve Kinopoisk title IDs and exact documented IMDb/TMDB fields. Keep IMDb `tt`
prefixes/leading zeros and TMDB movie/TV scope; ambiguous scope stays unresolved.
Kinopoisk HD IDs/playback URLs are not numeric title IDs or internal primary keys.
Empty/invalid references must not become unrestricted searches.

### Metadata normalization

Normalize Russian/international names, aliases, description, poster, year, format,
genres, episodes, attributed ratings, catalog URL and references. Do not assume
`alternativeName` is original or English. Missing posters remain null, not placeholders.
Keep personal ratings, provider scores and popularity separate. Use verified film/series
catalog paths; watch-provider/HD links remain optional metadata, never saved-source replacements.

### Episode totals

Fetch season counts only when needed/supported. Sum only complete coverage with an
explicit specials/season-zero/deduplication policy; missing seasons mean unknown.
A whole provider series is not automatically an anime season from another catalog.

### Genres, filters, and ordering

Map internal genres to verified provider values and preserve unknown source labels.
Advertise year/genre/format/reference/provider-rating/order support per operation.
Provider rating filters must not use personal ratings. Translated labels do not create
new genre identities.

### Pagination

Map page/limit to verified upstream operations. Normalize documents, pages and totals
after category filtering/deduplication; totals must describe eligible Filecab results.
Short filtered pages are not necessarily the end. Follow shared continuation rules and
invalidate mappings when request identity changes.

Kinopoisk uses bounded replay from upstream page 1 for each display page: read fixed
50-record pages, classify and deduplicate series by KinoPoisk title ID, then slice the
requested display page. Read at most 20 upstream pages and stop once one additional
eligible result establishes `hasMore`. No continuation state is shared across requests.
When the bound prevents establishing continuation, return `lookahead-exhausted` and
omit exact totals; a short filtered page alone does not establish the end.

### Agreed simplified scope

Additional TMDB movie/TV verification, filter-value validation and nested provider DTO
validation are excluded from step 14. Existing namespace separation and category
classification remain. Kinopoisk uses fixed request timeout/payload limits; configurable
request budgets and Retry-After handling are excluded from this step. These exceptions
override the corresponding shared catalog/provider requirements for this adapter.

### Localization and enrichment

Use requested `en|ru` for available fields and shared fallbacks. Do not invent a language
parameter, English descriptions or language provenance. Preserve verified translations,
references and user fields when incoming metadata is absent.

### Authentication failures and quotas

Distinguish missing/invalid credentials, insufficient access, quota, provider failure,
missing title and malformed response. Honor throttling; do not evade limits by switching
keys. Keep secrets out of URLs, headers shown to users, logs and Swagger examples.

## Contract verification

Verify a supported API version before activation. Check text search, discovery, details
and any genre dictionary independently. Test TV/category enforcement, search/filter
combinations, IMDb strings, TMDB scope, incomplete episodes, nullable posters, genre
mapping, post-filter pagination, auth failures and locale fallback.

## Provider documentation

- [Text search](https://kinopoiskdev.readme.io/reference/moviecontroller_searchmoviev1_4)
- [Filtered discovery](https://kinopoiskdev.readme.io/reference/moviecontroller_findmanybyqueryv1_4)
- [Details](https://kinopoiskdev.readme.io/reference/moviecontroller_findonev1_4)

Record verified paths, headers, query serialization and payload fixtures in the adapter
design for the selected version. Do not infer compatibility from an older adapter.

### Documentation review (12 November 2026)

Response verification: bounded authenticated v1.4 discovery and text-search reads both
returned numeric release years. Validate a present `year` as a positive integer, while
allowing missing or null values; do not require a string or coerce malformed text.

Runtime correction: a direct probe of `api.kinopoisk.dev` returned HTTP 301 to
`api.poiskkino.dev`. The replacement is documented at
https://api.poiskkino.dev/documentation. A bounded authenticated v1.4 discovery request
to the replacement returned HTTP 200 with the configured key. The default and local
configured origin now use `https://api.poiskkino.dev`. Both catalog adapters follow HTTP
redirects using the Fetch implementation's redirect limit and the existing request timeout.
This probe does not verify
the adapter's remaining normalization and pagination contracts.

The current official reference pages document v1.4 text search at
`GET /v1.4/movie/search` with required `query`, `page`, and `limit` parameters; filtered
discovery at `GET /v1.4/movie` with page/limit, repeated `type`, `selectFields`, and
documented filters including `externalId.imdb`, `externalId.tmdb`, `year`, `rating.kp`,
and `genres.name`; and detail reads at `GET /v1.4/movie/{id}`. The documentation shows
`X-API-KEY` header authentication, and detail responses document 401, 403, and 404.
The configured key has now passed bounded discovery and text-search reads. This does
not establish the account's complete entitlement, quotas, or usage conditions. Detail
and genre contracts still need independent verification. The adapter remains opt-in via `KINOPOISK_ENABLED` and
`KINOPOISK_API_KEY`.

The initial adapter supports text search and year/format discovery, with category
classification for `movie`/`cartoon` and `tv-series`/`animated-series`. It intentionally
does not advertise genre filtering or ordering until a verified mapping and operation
contract are established. Anime and unknown provider types are excluded. IMDb IDs remain
strings; TMDB references are scoped to `movie` or `tv`; `kpHD` values are never treated
as title IDs. No season endpoint or complete episode policy is enabled, so episode totals
remain unknown. Seventeen deterministic tests cover release years, selected failures and bounded
pagination; the remaining contract scenarios are recorded
in the step 14 readiness review before it can be marked complete.
