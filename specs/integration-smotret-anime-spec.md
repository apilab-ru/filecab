# Smotret Anime integration

## Purpose

Anime discovery and metadata through Smotret Anime / Anime 365.
Apply shared [Catalog rules](catalog-spec.md); this file defines adapter differences.

## Requirements

### Configuration and provider identity

Use provider `smotret`, entity `series`. Configure approved origins, optional credentials,
limits and timeouts server-side; `https://smotret-anime.online` is an example origin.
Mirrors share identity only after verifying they use the same series IDs. Use HTTPS;
disable credential-bearing access without a validated secure endpoint. Never fetch
arbitrary user-provided origins. Follow HTTP redirects using the Fetch implementation's
redirect limit within the configured request timeout.

### Series search

Support documented title search, pages, series details and verified reference lookup.
Anime movies stay in the anime category. For offset pagination use `(page - 1) × limit`
before normalization/lookahead, respecting both provider and Filecab limits.
Forward only documented year/season/genre/reference filters, never arbitrary user keys.

### External-reference separation

| Source field    | Reference namespace                                 |
| --------------- | --------------------------------------------------- |
| Series ID       | `{ provider: "smotret", entityType: "series", id }` |
| `myAnimeListId` | MyAnimeList anime, never Shikimori                  |
| `aniDbId`       | AniDB anime                                         |
| Shikimori ID    | Only a verified explicit mapping                    |

MAL lookup uses a verified MAL filter. Never pass Shikimori IDs as MAL IDs because
numbers match. Unsupported lookup returns capability/unresolved state.

### Titles and descriptions

Retain localized titles/aliases and actual languages; `titles.en` is not necessarily
original. Unknown original language stays unknown. Preserve description attribution;
select requested language, then a documented deterministic source preference without
mislabeling language. Empty arrays mean missing metadata.

### Media and episode metadata

Normalize poster, catalog URL, year, format, genres, declared total, available episodes
and attributed scores; do not combine MAL/World Art scores into unlabeled popularity.
Episode-array length is available-record count unless verified complete and authoritative
for the declared total. Missing/truncated arrays neither invent totals nor erase known
ones. Dubs/translations are not separate episodes.

### Genre normalization

Preserve provider IDs/labels and explicit internal mappings. Document semantic remapping
or exclusions while keeping original references; never equate unrelated genres.
Without a dictionary endpoint, use complete bounded pagination or a managed mapping,
not a fixed sample described as complete.

### Persistence and pagination integrity

Normalize before forming continuation. Deduplicate by verified identity, not title.
A valid series ID remains usable without cross-provider references. Determine `hasMore`
from eligible continuation, not grouped observables or provider-ID bucket counts.
Empty lists complete normally; required catalog persistence finishes before returning
an internal identity.

### Failure handling

Distinguish missing series, malformed response, unsupported filters, denial, throttling
and transport failure. Never clear libraries; catalog/cache/genre failure cannot block
manual saves. Do not send notes, status, personal ratings or progress upstream.
Catalog operations exclude playback, subtitles, translation media and provider accounts.

## Verification and documentation

Verify selected mirror schema, lookup, pagination, credentials and usage conditions
before activation. Do not switch mirrors to bypass restrictions. Test namespace separation,
offset arithmetic, empty/missing titles/descriptions/episodes, incomplete totals, genre
mapping, records without cross-provider IDs, persistence completion and continuation.

## Provider documentation

- [API documentation](https://smotret-anime.org/api-docs)
- [OpenAPI description](https://smotret-anime.org/api/openapi.yaml)
- [Usage conditions](https://smotret-anime.org/docs/terms)

### Verified catalog surface (12 November 2026)

The selected origin is the configured `SMOTRET_API_ORIGIN`, defaulting to
`https://smotret-anime.online`. The official OpenAPI document is served by
`smotret-anime.org`; a bounded public `GET /api/series?limit=1&fields=...`
request to both `.org` and the configured `.online` origin returned the documented
`{ data: [...] }` envelope and the same sample series ID. This confirms the current
configured host for the observed API surface only; mirrors must not be switched or
treated as generally interchangeable without further ID verification.

The documented public catalog operations are `GET /api/series` and
`GET /api/series/{id}`; they do not require credentials. Search accepts `query`,
`myAnimeListId`, `type`, `year`, `season`, `isActive`, `isAiring`, `chips`, `order=id`,
`limit`, and `offset`. Filecab supports only the documented exact fields
`myAnimeListId`, `type`, `year`, and `season`, and order `id`; it does not forward
arbitrary `chips` content. Provider limit is 1000; Filecab requests at most 50 results
and uses `(page - 1) * pageSize` with one bounded lookahead row. The API asks clients
to identify their application in `User-Agent`. Catalog routes are public; user data
and playback/embed APIs require an access token and are outside this integration.

Filecab exposes provider reads as `GET /api/v1/catalog/search`,
`GET /api/v1/catalog/provider-items/smotret/{id}?locale=en|ru`, and
`GET /api/v1/catalog/providers/{namespace}/{entity}/{id}?locale=en|ru`. Each accepted
record is persisted through the shared identity service before its internal catalog ID
is returned.

The documented `Series` schema exposes IDs, title translations, type, year, season,
declared episode total, poster URLs and MAL ID/score. One bounded live detail read also
returned `descriptions`, `genres` and `episodes`, but the OpenAPI schema does not define
these fields or promise episode completeness. Filecab accepts them only as optional,
validated detail fields; absence leaves metadata unknown. Returned provider genres keep
their Smotret IDs and labels as provider-scoped candidates until an operator verifies a
mapping; the genre capability and genre filter remain disabled. Available episode count
counts only listed narrative episode types, while `numberOfEpisodes` remains the
provider-declared total. Search results do not establish a Shikimori mapping: IDs parsed
from provider links remain unverified. MAL IDs from `myAnimeListId` are retained as
unverified references during ordinary search; exact MAL lookup can verify a reference
only when the returned record contains that exact ID.

The site's terms prohibit unauthorized bulk collection and automation that bypasses
the API or its limits. This adapter uses documented API routes only, sends a descriptive
User-Agent, and applies Filecab timeout, payload, retry, concurrency and page-size
budgets. No credentials are configured or needed for these public catalog operations.
