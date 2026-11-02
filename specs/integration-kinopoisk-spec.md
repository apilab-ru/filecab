# Kinopoisk Dev Integration Specification

## Purpose

Provide film and TV catalog search, detail lookup, external-reference resolution, and metadata through the Kinopoisk Dev API. The adapter SHALL conform to [Catalog Specification](catalog-spec.md).

## Requirements

### Requirement: Configuration and scope

The adapter SHALL use provider key `kinopoisk-dev`; catalog references SHALL use the Kinopoisk title namespace rather than treat a transport/vendor name as a different film identity. The provider-key-to-reference-namespace distinction SHALL be explicit in contracts.

The API origin/version SHALL be configurable, with `https://api.kinopoisk.dev` as the requested integration origin. Server credentials SHALL be sent through the provider's documented authentication mechanism and never exposed to clients. Documented replacement origins MAY be configured after verification without rewriting existing verified Kinopoisk title references.

This integration SHALL not be conflated with `kinopoiskapiunofficial.tech`. Google login SHALL not require a Kinopoisk account. Streaming, account access, and watchlist synchronization with Kinopoisk are excluded.

### Requirement: Text search and filtered discovery

The adapter SHALL distinguish title text search from structured filtered discovery. It SHALL map query text to a documented text-search operation and filters to operations that actually support them. It SHALL not assume that every filter supported by discovery is available on text search.

Filecab category constraints SHALL apply to every returned result, including text-search results. If upstream text search cannot combine filters, the adapter SHALL implement bounded continuation-aware filtering or report the combination unsupported. It SHALL not return mixed categories as if the category filter worked.

### Requirement: Film and TV classification

Default films selection SHALL include provider `movie` and `cartoon` records; default TV selection SHALL include `tv-series` and `animated-series`. Provider `anime` records SHALL not be silently assigned to films; anime-category use requires an explicit supported classification policy. Unknown provider types SHALL remain diagnosable and SHALL not be guessed.

Category and media format SHALL be normalized independently. Provider `isSeries`, where verified, SHALL be used for consistency checks rather than ignored. A boolean named `isTv` in backend code SHALL not substitute for an actual enforced upstream/result constraint.

### Requirement: Detail and external-reference lookup

The adapter SHALL support detail retrieval by Kinopoisk title ID. Verified IMDb/TMDB lookup SHALL use the exact documented reference field. An IMDb reference SHALL retain its `tt` prefix and leading zeros. TMDB references SHALL retain their movie/TV entity scope; ambiguous scope SHALL not produce an invented mapping.

Kinopoisk HD IDs SHALL be separate from numeric Kinopoisk title IDs. Neither provider IDs nor a Kinopoisk HD playback URL SHALL be used as the internal catalog primary key. Empty/invalid references SHALL not produce unrestricted search.

### Requirement: Metadata normalization

The adapter SHALL normalize available Russian name, alternative/international names, aliases, description, poster, release year, media format, genres, episode metadata, provider ratings, catalog URL, and external references.

`alternativeName` SHALL not automatically be labeled original title or English without evidence. Missing posters SHALL return nullable metadata rather than store a frontend placeholder as authoritative content. IMDb/Kinopoisk scores SHALL remain attributed provider ratings, separate from personal rating and generic popularity.

The canonical catalog link SHALL identify the correct title and film/series path when established. Watch-provider links and Kinopoisk HD links SHALL remain distinct optional metadata and SHALL not overwrite saved viewing sources.

### Requirement: Episode totals

Season episode counts SHALL be fetched only when required and supported. Summing season counts SHALL produce a total only when coverage is known complete and the counting policy handles specials/season zero and duplicates explicitly. Missing season data SHALL mean unknown rather than zero.

Provider-wide series entries SHALL not be automatically equated to anime season-level entries from another provider. Cross-provider reconciliation SHALL account for granularity.

### Requirement: Genres, filters, and ordering

The adapter SHALL map stable internal genre IDs to verified provider genre values. Documented year, genre, format, reference, rating, and ordering filters SHALL be advertised per operation, not as a global unsupported promise. Provider rating filters SHALL be explicitly labeled and SHALL not use the owner's rating.

Unknown genre labels SHALL be retained for mapping rather than silently dropped. Language differences in genre labels SHALL not create new internal genre identities.

### Requirement: Pagination

The adapter SHALL map Filecab page/limit to verified upstream pagination and normalize provider documents, page count, and total. Returned total SHALL describe Filecab's eligible normalized result set; provider totals SHALL not be exposed unchanged after category post-filtering or deduplication that changes the result count.

A short filtered page SHALL not imply end-of-results if additional eligible records remain upstream. Any continuation mapping SHALL follow the shared catalog contract and reset when request identity changes.

### Requirement: Localization and enrichment

Requested `en` or `ru` locale SHALL control presentation of available stored fields. The adapter SHALL not fabricate English descriptions or send an invented language parameter. Unknown language SHALL remain unknown. Missing requested-language metadata SHALL use shared fallback rules.

Enrichment SHALL preserve existing translations and user fields. Missing external IDs or description SHALL not erase previously verified data automatically.

### Requirement: Authentication failures and quotas

The adapter SHALL distinguish absent/invalid API credentials, insufficient access, quota exhaustion, provider failure, missing title, and malformed response. It SHALL honor throttling and not randomly switch API keys to evade limits. URLs, headers, logs, and Swagger examples SHALL not expose secrets.

### Requirement: Contract verification

The implementation SHALL select and verify a supported API version before activation. Operation capabilities SHALL be based on that version's actual documentation and fixtures. Text search, discovery, detail lookup, and any genre dictionary operation SHALL have separate contract checks.

Tests SHALL cover TV filtering, text-search/filter combinations, IMDb string preservation, TMDB scope, missing episode totals, poster nullability, mapped/unmapped genres, post-filter pagination, credential errors, and locale fallback.

## Provider documentation

- https://kinopoiskdev.readme.io/reference/moviecontroller_searchmoviev1_4
- https://kinopoiskdev.readme.io/reference/moviecontroller_findmanybyqueryv1_4
- https://kinopoiskdev.readme.io/reference/moviecontroller_findonev1_4

Exact paths, headers, query serialization, and payload examples SHALL be maintained in implementation design for the selected supported version, not inferred from a previous adapter version.
