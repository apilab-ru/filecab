# Smotret Anime Integration Specification

## Purpose

Provide anime discovery and metadata resolution through the Smotret Anime / Anime 365 series catalog, configured for an approved API origin such as `https://smotret-anime.online`. The adapter SHALL conform to [Catalog Specification](catalog-spec.md).

## Requirements

### Requirement: Configuration and provider identity

The adapter SHALL use provider key `smotret` and entity type `series`. Public/API origins, credentials when required, limits, and timeouts SHALL be configurable server-side. Approved provider mirrors SHALL share the namespace only after verifying that their series IDs belong to the same catalog.

The adapter SHALL use HTTPS when supported. If no validated secure provider endpoint is available, it SHALL be disabled rather than silently downgrade credential-bearing requests. It SHALL not fetch user-supplied arbitrary origins.

### Requirement: Series search

The adapter SHALL support title search, pagination, detail by series ID, and verified external-reference lookup when supported by the selected API. Search SHALL return anime formats without treating format `movie` as the Filecab films category.

Page-based Filecab requests SHALL map to upstream pagination consistently; for an offset-based upstream contract, offset SHALL be `(page - 1) × limit` before any normalization/lookahead bookkeeping. Limits SHALL respect both Filecab and verified provider limits.

Year/season, genre, and external-ID filters SHALL use documented provider parameters only. User-supplied arbitrary filter keys SHALL not be forwarded.

### Requirement: External-reference separation

The provider series ID SHALL map to `{ provider: "smotret", entityType: "series", id }`. `myAnimeListId` SHALL map to the MyAnimeList anime namespace, never to Shikimori. `aniDbId` SHALL map to the AniDB anime namespace. A Shikimori reference SHALL be added only from a verified explicit mapping.

Search by a MyAnimeList reference SHALL use the verified MAL filter when available. A Shikimori ID SHALL NOT be passed as a MAL filter merely because the numbers look compatible. Unsupported reference lookup SHALL return a capability error or unresolved outcome.

### Requirement: Titles and descriptions

The adapter SHALL preserve available localized titles/aliases and their actual languages. It SHALL not assume `titles.en` is the original title. Original-title language SHALL remain unknown unless established.

Descriptions SHALL preserve provider/source attribution. If several descriptions are available, selection SHALL use requested language first, then a documented deterministic source preference. The preference SHALL not mislabel an untranslated description as requested-language text. Empty description arrays SHALL return missing metadata safely.

### Requirement: Media and episode metadata

The adapter SHALL normalize available poster, catalog URL, release year, format, genres, declared episode total, available episode count, and provider scores. Score origin SHALL remain explicit; MAL and World Art ratings SHALL not be combined into an unlabeled popularity value.

An episode-array length SHALL be treated as available-record count unless the verified provider contract establishes that the array is complete and represents the declared total. Missing/truncated arrays SHALL not set a false total or erase an existing known total. Translations/dubs SHALL not be counted as separate anime episodes.

### Requirement: Genre normalization

Provider genre IDs and labels SHALL be preserved and associated with stable internal genre IDs using explicit mappings. Any semantic remapping or exclusion SHALL be documented and SHALL retain the original provider references. The adapter SHALL not silently equate unrelated genres to fit an existing list.

If genres must be discovered from series rather than a dedicated dictionary, collection SHALL use complete bounded pagination or a separately managed mapping. A single fixed sample SHALL not be described as the complete genre dictionary.

### Requirement: Persistence and pagination integrity

Results SHALL be normalized before a reliable page/continuation response is formed. Deduplication SHALL use verified provider identity, not name. Results without optional cross-provider references SHALL remain usable when they have a valid Smotret series identity.

`hasMore` SHALL be determined from actual eligible continuation and SHALL not compare requested limit with grouped observables or the number of provider-ID buckets. Empty lists SHALL complete normally. Detail resolution SHALL await required catalog persistence before returning a stable internal identity.

### Requirement: Failure handling

The adapter SHALL distinguish missing series, invalid response, unsupported filter, provider denial, throttling, and transport failure. No failure SHALL clear the owner library. Metadata cache and genre refresh failures SHALL not prevent manual entry storage.

Private owner notes, watch status, personal ratings, and viewing progress SHALL not be sent to the provider. The integration SHALL not retrieve playback streams, subtitles, translation media, or provider account data for catalog operations.

### Requirement: Verification and documentation

Activation SHALL verify the configured mirror's current API schema, detail lookup semantics, pagination, credential requirements, and usage conditions. Mirrors SHALL not be switched blindly to bypass access restrictions.

Tests SHALL cover MAL/Shikimori separation, offset arithmetic, empty arrays, missing localized titles, incomplete episode lists, source-language descriptions, genre mapping, records without cross-provider IDs, persistence completion, and correct continuation.

## Provider documentation

- https://smotret-anime.org/api-docs

Exact selected mirror, upstream request parameters, and payload examples SHALL be recorded in implementation design after API verification; credentials SHALL not be included.
