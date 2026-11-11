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
arbitrary user-provided origins.

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

Record the verified mirror, parameters and safe response fixtures in the adapter design.
