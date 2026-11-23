# Kinopoisk Dev integration

## Purpose

Film and TV search, reference resolution and metadata through Kinopoisk Dev.
All [Catalog rules](catalog-spec.md) apply. This file defines the adapter differences.
Streaming, provider accounts and watchlist synchronization are not in scope. To add personal
Kinopoisk data, use the [library import from CSV](library-import.md).

## Requirements

### Configuration and scope

- Provider key `kinopoisk`. References use the Kinopoisk title namespace.
- The default origin is `https://api.poiskkino.dev`. The old origin `https://api.kinopoisk.dev` redirects there with HTTP 301.
- A replacement origin must keep existing identity mappings. Do not use `kinopoiskapiunofficial.tech`.
- Follow HTTP redirects within the Fetch redirect limit and the request timeout.
- Authenticate with the `X-API-KEY` header. Keep the key on the server.
- The adapter is opt-in: `KINOPOISK_ENABLED` and `KINOPOISK_API_KEY`.
- Google login needs no Kinopoisk account.
- The demo plan permits development and home use only: 200 requests a day and pages up to 10. Production use needs a suitable plan.

### Simplified scope

These exceptions override the shared catalog rules for this adapter:

- Each upstream request has a fixed 30-second timeout and a fixed payload limit. Configurable budgets and Retry-After handling are not in scope.
- Additional TMDB verification, filter-value validation and nested provider DTO validation are not in scope.

### Operations

| Operation         | Route                                                      | Notes                                                     |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Text search       | `GET /v1.4/movie/search`                                   | `query`, `page`, `limit`. Rejects all filters and orders. |
| Discovery         | `GET /v1.4/movie`                                          | Page and limit, repeated `type`, `selectFields`, filters  |
| Ordered discovery | v1.5 cursor endpoint                                       | Opaque `next` cursor and `hasNext`                        |
| Details           | `GET /v1.4/movie/{id}`                                     | Documents 401, 403 and 404                                |
| Genre dictionary  | `GET /v1/movie/possible-values-by-field?field=genres.name` | Names only                                                |

Text search and discovery are separate capabilities. Use only the filters of each
operation. Enforce the category on every result. Never label mixed results as filtered.
Do not send a locale parameter upstream.

### Film and TV classification

| Category | Provider types                               |
| -------- | -------------------------------------------- |
| Films    | `movie`, `cartoon`                           |
| TV       | `tv-series`, `animated-series`               |
| Anime    | Not supported. Never treat `anime` as films. |

Keep category and format separate. Report unknown types. Check that `isSeries` agrees
with the type. Exclude anime and unknown types.

### Details and external references

- Resolve Kinopoisk title IDs and the exact IMDb and TMDB fields.
- Keep the IMDb `tt` prefix and leading zeros.
- TMDB references have a `movie` or `tv` scope. An ambiguous scope stays unresolved.
- Kinopoisk HD IDs and playback URLs are not title IDs or internal keys.
- An empty or invalid reference must not become an unrestricted search.
- Check the returned title ID on every detail request. Check an external reference again after its detail read. Reject a mismatch before persistence.

### Metadata normalization

- Normalize Russian and international names, aliases, description, poster, year, format, genres, ratings, catalog URL and references.
- Catalog URLs use `/film/{id}/` for films and `/series/{id}/` for TV.
- Map only verified EN and RU name tags to `en` and `ru`. Other tags can be countries. They become `und`.
- Do not assume that `alternativeName` is original or English.
- A missing poster stays null. Do not use a placeholder.
- Scores must be positive finite values up to 10. Zero means no score.
- IMDb and TMDB scores need a valid matching identifier before you make a link.
- Keep personal ratings, provider scores and popularity separate.
- Watch-provider and HD links are optional metadata. They never replace saved sources.

### Year

- A present year must be a positive integer. Missing and null years are permitted.
- Year 0 means unknown. Store null.
- Reject negative and noninteger years. Do not coerce text.
- An invalid year in one result must not reject the complete search.

### Episode totals

The adapter reports unknown episode counts. Missing, partial or duplicate season data
never gives a total. A provider series is not automatically an anime season from another catalog.

### Genres

- Genre names are case-normalized provider identities. Remove duplicates in each snapshot.
- Map genres through `GenreMapping` with the namespace `kinopoisk` and the lowercase name as the external ID.
- Ignore `церемония`. It is a broadcast format, not a genre.
- Map `игра` to the internal `game-show` genre. It names TV game shows. It is not the anime `game` theme.
- Delete numeric Kinopoisk mappings. Catalog records never contain numeric genre IDs.
- Use Russian labels for verified dictionary names. New labels have an unknown language.
- Dictionary slugs and detail slugs are different. Do not use them as a crosswalk.
- Genre filtering stays unavailable until internal mappings are verified.
- Translated labels do not create new genre identities.

### Filters and ordering

| Capability        | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Discovery filters | `year`, `format`, `providerRating` (Kinopoisk score) |
| Discovery orders  | `year-asc`, `year-desc`, `rating-desc`               |
| Text search       | No filters, no orders                                |

- Do not offer `rating-asc`. Continuation through missing scores times out upstream. Reject it before fetching. Do not drop unrated records or change the order.
- Send only the selected sort field and direction. Keep the provider order for equal values.
- Do not add an ID sort. Compound sorts can exceed the upstream timeout.
- Never sort one returned page locally.
- Reject filters and orders that are not advertised.
- Provider rating filters never use personal ratings.

### Pagination

Unordered discovery and text search use bounded replay from upstream page 1 for each display page:

1. Read fixed 50-record upstream pages.
2. Classify the records and remove duplicate series by title ID.
3. Slice the requested display page.
4. Read at most 20 upstream pages. Stop when one more eligible result proves `hasMore`.

No continuation state is shared between requests. When the limit prevents a decision,
return `lookahead-exhausted` and omit the total. A short filtered page alone does not
prove the end. Totals describe eligible Filecab results.

Ordered discovery uses the v1.5 cursor endpoint:

- Request the display page size plus one lookahead record, at most 50 records.
- Keep this upstream size constant across display pages.
- Follow the `next` cursor and `hasNext`. Do not request a total or use offset pages.
- Reject a missing or repeated continuation cursor.

### Localization

Use the requested `en` or `ru` for available fields with the shared fallbacks. Do not
invent a language parameter, English descriptions or language provenance. Keep verified
translations, references and user fields when incoming metadata is missing.

### Failures and quotas

Keep these errors separate: missing or invalid credentials, insufficient access, quota,
provider failure, missing title and malformed response. Obey throttling. Never switch keys
to avoid limits. Keep secrets out of URLs, visible headers, logs and Swagger examples.

## Verification

Verify the API version before activation. Check text search, discovery, details and the
genre dictionary separately. Test TV and category enforcement, filter combinations, IMDb
strings, TMDB scope, incomplete episodes, null posters, genre mapping, filtered
pagination, authentication failures and locale fallback.

## Provider documentation

- [Current API documentation](https://api.poiskkino.dev/documentation)
- [Text search](https://kinopoiskdev.readme.io/reference/moviecontroller_searchmoviev1_4)
- [Filtered discovery](https://kinopoiskdev.readme.io/reference/moviecontroller_findmanybyqueryv1_4)
- [Details](https://kinopoiskdev.readme.io/reference/moviecontroller_findonev1_4)
- [Pricing and usage](https://poiskkino.dev/)
