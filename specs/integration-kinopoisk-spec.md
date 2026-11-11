# Kinopoisk Dev integration

## Purpose

Film/TV search, reference resolution and metadata through Kinopoisk Dev.
Apply all shared [Catalog rules](catalog-spec.md); this file defines adapter differences.
Streaming, provider accounts and watchlist synchronization are out of scope.

## Requirements

### Configuration and scope

Use provider key `kinopoisk-dev` but the Kinopoisk title-reference namespace.
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
