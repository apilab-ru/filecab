# Smotret Anime integration

## Purpose

Anime discovery and metadata through Smotret Anime (Anime 365).
All [Catalog rules](catalog-spec.md) apply. This file defines the adapter differences.

## Requirements

### Configuration and identity

- Provider `smotret`, entity `series`.
- The origin is `SMOTRET_API_ORIGIN`. The default is `https://smotret-anime.online`.
- Configure origins, optional credentials, limits and timeouts on the server.
- A mirror shares identity only after you verify that it uses the same series IDs. Never switch mirrors to avoid restrictions.
- Use HTTPS. Disable credential access without a validated secure endpoint.
- Never fetch an origin that a user supplies.
- Follow HTTP redirects within the Fetch redirect limit and the request timeout.
- Send a descriptive `User-Agent` that identifies Filecab.

### Operations

The public catalog routes need no credentials:

| Route                  | Use               |
| ---------------------- | ----------------- |
| `GET /api/series`      | Search and lookup |
| `GET /api/series/{id}` | Series details    |

User data, playback and embed APIs need a token and are not in scope. Catalog operations
exclude playback, subtitles, translation media and provider accounts.

Filecab exposes the provider through:

- `GET /api/v1/catalog/search`
- `GET /api/v1/catalog/provider-items/smotret/{id}?locale=en|ru`
- `GET /api/v1/catalog/providers/{namespace}/{entity}/{id}?locale=en|ru`

Persist each accepted record through the shared identity service before you return its
internal catalog ID.

### Search, filters and ordering

- Forward only the documented exact filters `myAnimeListId`, `type`, `year` and `season`. Never forward `chips` or other user keys.
- The only verified order is `order=id`, ascending. Do not offer year, title or score order. Other values return HTTP 200 but have no effect.
- The provider limit is 1000. Filecab requests at most 50 results.
- Use offset `(page - 1) × limit` and one bounded lookahead row, before normalization.
- Anime movies stay in the anime category.

### Search details

- Search reads the series details of each result that has no stored catalog identity. The catalog stores the identity when it has the `smotret/series` reference of the series.
- A stored identity has no age limit. Search does not read the details of a stored series again. The [detail refresh job](#detail-refresh-job) updates stored series.
- Search reads at most `CATALOG_PROVIDER_CONCURRENCY` details at the same time.
- Use the detail only when it has the same series ID. Otherwise, use the search row.
- A failed detail request does not fail the search. The result then contains only the search data.
- A search result of a stored series contains the stored metadata, enriched with the search data.

### Detail refresh job

A durable server job reads the details of stored Smotret series again. It finds missing
descriptions and changed episode counts.

| Setting     | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Interval    | `CATALOG_REFRESH_INTERVAL_SECONDS`, default 86400 (24 h), minimum 3600, maximum 2592000 |
| Active jobs | One queued or running job                                                               |
| Pace        | 300 ms after each provider request                                                      |
| Batch       | 25 series in each claim                                                                 |

- The job selects a stored series when one of these conditions is true:
  - The snapshot has no description.
  - The declared episode total is unknown.
  - The available episode count is unknown.
  - The available episode count is less than the declared total.
- The server starts a job when no job is active and the last job started before the interval.
- `POST /api/v1/catalog/admin/refresh` with `{ "provider": "smotret" }` starts a job at once. When a job is active, the route returns the active job. A queued job starts at once, also when it waits for the provider. The pause count stays. A running job continues.
- `GET /api/v1/catalog/admin/refresh?provider=smotret` returns the last job, or null.
- Only an account in `CATALOG_OPERATOR_ACCOUNT_IDS` can use these routes. See [Genres](catalog-spec.md#genres) for the development exception.
- The job continues after a server restart. A lock that expires lets another instance continue the job.
- A rate limit, an outage or a timeout pauses the job. Use the waits of the catalog data job. After 40 pauses, the job fails.
- A missing series, an invalid response or an identity conflict fails only that series. The job continues.
- Report each failed series to Sentry as a warning. The report contains the job ID, the provider, the series ID, the catalog ID and the reason: the error code, the HTTP status, the safe message and the validation issues.
- After each refreshed series, update the linked library entries. See [Details and safe enrichment](catalog-spec.md#details-and-safe-enrichment).

### External references

| Source field    | Reference namespace                                 |
| --------------- | --------------------------------------------------- |
| Series ID       | `{ provider: "smotret", entityType: "series", id }` |
| `myAnimeListId` | MyAnimeList anime. Never Shikimori.                 |
| `aniDbId`       | AniDB anime                                         |
| Shikimori ID    | Only from a Shikimori link of the series            |

- Never pass Shikimori IDs as MAL IDs because the numbers are equal.
- `myAnimeListId: 0` means no MAL match. Do not create a MAL reference or a MAL score for it.
- `aniDbId: 0` means no AniDB match. Accept the value. Do not create an AniDB reference for it.
- Reject negative and noninteger MAL IDs. Keep the series ID and the other results usable.
- Ordinary search keeps MAL IDs as unverified references. An exact MAL lookup verifies a reference only when the returned record has that exact ID.
- IDs parsed from provider links stay unverified for catalog identity. List synchronization compares the Shikimori ID from these links. See [Identity resolution](user-list-sync-spec.md#identity-resolution).
- An unsupported lookup returns a capability or unresolved state.

### Titles and descriptions

- Keep localized titles, aliases and their actual languages. `titles.en` is not necessarily the original title.
- An unknown original language stays unknown.
- Keep description attribution. Select the requested language, then a documented fixed source order. Do not mislabel the language.
- An empty array means missing metadata.

### Media and episodes

- Normalize poster, catalog URL, year, format, genres, declared total, available episodes and attributed scores.
- Do not combine MAL and World Art scores into an unlabeled popularity value.
- A poster URL with no path other than `/` is missing. Use a valid small poster instead. If neither exists, return null.
- `numberOfEpisodes` is the declared total.
- The available count includes only listed narrative episode types. The episode array is not a complete total unless verified.
- Missing or truncated arrays never invent or erase totals.
- Dubs and translations are not separate episodes.
- `descriptions`, `genres` and `episodes` are not in the OpenAPI schema. Accept them only as optional validated fields. Request `genres` in search. Use `descriptions` and `episodes` only in detail.

### Genres

- Map genres through `GenreMapping` by the Smotret genre ID.
- Ignore IDs 46 (award winners) and 50 (adult cast). They do not describe a genre.
- Convert subgenre IDs before the lookup: 54 to 17 (martial arts), 74 to 22 (romance), 77 to 30 (sports) and 79 to 11 (games).
- Genre capability and genre filtering stay disabled.
- Never treat unrelated genres as equal. Document any semantic remapping and keep the original reference.
- Without a dictionary endpoint, use complete bounded pagination or a managed mapping. Never describe a sample as complete.
- Delete the mappings of ignored and converted IDs. The resolver never reads them.
- IDs 12, 26 and 28 do not occur in public series. Keep their mappings unverified.

### Persistence and pagination

- Normalize before you build the continuation.
- Remove duplicates by verified identity, not by title.
- A valid series ID is usable without cross-provider references.
- Get `hasMore` from eligible continuation, not from grouped observables or ID bucket counts.
- Empty lists complete normally.

### Failures

Keep these errors separate: missing series, malformed response, unsupported filter,
denial, throttling and transport failure. Never clear libraries. Catalog, cache and genre
failures cannot block manual saves. Do not send notes, status, personal ratings or
progress upstream.

The site terms prohibit unauthorized bulk collection and automation that bypasses the
API or its limits. Use documented routes only. Apply Filecab timeout, payload, retry,
concurrency and page-size limits.

## Verification

Verify the mirror schema, lookup, pagination, credentials and usage conditions before
activation. Test namespace separation, offset arithmetic, empty titles, descriptions and
episodes, incomplete totals, genre mapping, records without cross-provider IDs,
persistence completion and continuation.

## Provider documentation

- [API documentation](https://smotret-anime.org/api-docs)
- [OpenAPI description](https://smotret-anime.org/api/openapi.yaml)
- [Usage conditions](https://smotret-anime.org/docs/terms)
