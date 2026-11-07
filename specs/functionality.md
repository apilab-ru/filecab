# Filecab — Product Requirements

Version: 1.1 · 3 November 2026 · Status: agreed implementation baseline

### 1.1 Release scope

- Chrome Manifest V3 extension: toolbar popup, full-page library, and settings.
- A standalone website with catalog search, add, edit, delete, filtering, and backup/restore using the same domain rules as the extension.
- Anime, films, and TV series.
- English and Russian application interfaces, with available localized catalog metadata.
- Extension offline persistence, online website access, current-format JSON backup/restore. Old-data migration is out of scope.
- Catalog-backed entries and manual entries that do not require a catalog match.

Google accounts, extension replication, unlisted sharing, server-managed parser configuration, metadata caches, and owner-connected external list synchronization are required delivery capabilities defined in the adjacent specifications. Guests need not sign in or connect an external account.

### 1.2 Explicit product defaults

The following choices resolve ambiguities in the supplied description and are implementation defaults, rather than claims about existing behavior:

| Topic                        | Release decision                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Data                         | Extension guest data stays in RxDB; authenticated libraries replicate with PostgreSQL. Website library access is online through TanStack Query. |
| Accounts and synchronization | Extension guests can work offline without server storage. Google sign-in enables account persistence and extension replication.                 |
| Unsupported pages            | Offer editable extracted metadata and manual entry creation; never require a catalog match.                                                     |
| Uncertain media category     | Ask for a category rather than silently assuming films.                                                                                         |
| Hidden titles                | Excluded from ordinary library results; an explicit Hidden filter reveals them.                                                                 |
| Progress and completion      | No automatic status changes; preserve progress when statuses change.                                                                            |
| Rating and progress fields   | Consistent across popup, cabinet, and website; rating is always editable, progress applies to episodic media.                                   |
| Page URL ownership           | Multiple viewing sources per entry; one active entry per owner and normalized source URL, with explicit atomic reassignment.                    |
| Delete                       | Immediate deletion with Undo for 10 seconds.                                                                                                    |
| Backup format                | Versioned current-format JSON; no legacy array or grouped-data import.                                                                          |

## 2. Users, surfaces, and navigation

Visual references: [light theme mockup](white-mockup.png) and
[dark theme mockup](dark-mockup.png). Use these mockups as the visual reference
for layout, colors, typography, and component appearance alongside the behavior
requirements below.

**NAV-01.** The popup shall offer Page and Search modes, plus links to Library and Settings. The full-page library link shall open the extension's `full-page.html` in a new browser tab. Page shall be the initial mode when a usable HTTP(S) tab exists. Search shall remain available regardless of page parsing success.

**NAV-02.** The full-page library and website shall provide anime, films, and TV routes, each with Library and Catalog Search modes. Library shall be the initial mode. Unknown routes shall redirect to anime without modifying data.

**NAV-03.** The website shall support every core library operation without extension APIs. Reading the current browser tab shall be an extension-only enhancement; the website shall offer manual entry and optional URL entry instead.

**NAV-04.** Unavailable active-tab access, restricted URLs, and parser failures shall display a localized explanation and actions to retry, search, or create a manual entry. They shall not masquerade as a successful search with no results.

**NAV-05.** Navigation away from an unsaved editor shall offer Save, Discard, and Continue editing where navigation is controllable. The product shall not imply unsaved popup edits survive closing the popup unless draft recovery is implemented.

## 3. Domain, identity, and validation

### 3.1 Categories and statuses

Category shall be `anime`, `films`, or `tv`. Catalog subtype is separate: an anime may have subtype `movie`, `tv`, `special`, `ova`, `ona`, or `music` without leaving the anime library category.

| Stored status | English  | Russian       |
| ------------- | -------- | ------------- |
| `planned`     | Planned  | Запланировано |
| `process`     | Watching | Смотрю        |
| `complete`    | Watched  | Просмотрено   |
| `drop`        | Dropped  | Брошено       |
| `hide`        | Hidden   | Скрыто        |
| `null`        | None     | Нет           |

**MODEL-01.** Each saved library entry shall have an immutable entryId for editing and deletion. Cross-source matching shall use a canonical catalogId and verified, namespaced provider references. Multiple source pages may refer to the same catalog item. Manual entries may initially lack a catalog identity and shall retain their entryId when subsequently matched.

**MODEL-02.** Provider references shall be namespaced values, for example `{ provider: "imdb", id: "tt1234567" }`. IMDb strings, TMDB IDs, MyAnimeList IDs, Shikimori IDs, Kinopoisk IDs, and internal catalog IDs shall never be interchangeable. Preserve identifiers as strings, including prefixes and significant leading zeros.

**MODEL-03.** An entry shall contain category, display metadata snapshot, user name, zero or more viewing-source associations, status, rating, progress, comment, added and modified timestamps, and provider references when known. The metadata snapshot shall support original title, available translations, poster, description, year, genre IDs, subtype, and optional episode count.

**MODEL-04.** A valid manual entry shall require category and a nonblank user title. A catalog entry shall have a displayable title after fallback. Missing descriptions, posters, original titles, genres, years, and episode totals shall be supported without rendering failures.

**MODEL-05.** Rating shall be an integer from 0 to 10; 0 means unrated and shall have a Clear rating action. Progress shall be a nonnegative safe integer. Progress above a known positive episode total shall be allowed with a visible warning; historical excess progress shall also be preserved and flagged rather than silently truncated. Unknown or zero provider totals shall be treated as unknown.

**MODEL-06.** User-entered name and comment shall be preserved exactly after validation; trimming for blank checks shall not rewrite their contents. Catalog refresh, locale changes, and provider failures shall not overwrite user fields.

**MODEL-07.** New timestamps shall be UTC ISO 8601 values. Every successful semantic user edit shall refresh `updatedAt`; `createdAt` shall remain unchanged. A no-op save, locale switch, or metadata display refresh shall not alter those timestamps. Backups shall include valid timestamps; missing or invalid dates shall be rejected without inference.

**MODEL-08.** Repeated addition of an already resolved catalog identity shall open the existing entry. Manual entries may share a title; equal titles alone shall not trigger merging. Category disagreement for an existing catalog identity shall require explicit resolution rather than creating a silent duplicate or changing category automatically.

## 4. Page extraction and matching

**PAGE-01.** After the user opens the popup, Page mode shall obtain the active tab URL and extract metadata only from the selected tab. Only HTTP(S) pages shall be eligible. Restricted browser pages and the explicitly excluded `mail.yandex.ru` host shall not be parsed. Host exclusions shall use parsed hostnames, not substring matching against the full URL.

**PAGE-02.** Site-specific rules shall be selected by normalized hostname, ignoring an initial `www.`. A rule shall return typed metadata: title, optional category, provider references, and optional episode information. A generic `{ id, idField }` shall not be accepted as an internal catalog identity.

**PAGE-03.** The initial supported-rule set shall cover the following hosts. Extraction behavior shall be checked against representative fixtures before a host is advertised as supported; the source description does not prove live compatibility.

| Hosts                                                                                               | Expected seed                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `animego.org`, `animesss.com`, `smotret-anime.online`, `shikimori.io`, `dreamerscast.com`, `jut.su` | Anime title; heading/selector or cleaned document title, with safe fallback.                             |
| `kino.mail.ru`, `afisha.mail.ru`                                                                    | Film title; allow user category correction.                                                              |
| `ivi.ru`                                                                                            | Film or TV title, using available page evidence.                                                         |
| `kinopoisk.ru`, `hd.kinopoisk.ru`                                                                   | Title, film/TV evidence, and a namespaced Kinopoisk reference when extractable.                          |
| `mirf.ru`                                                                                           | Nonblank selected text as an anime search seed; Search mode shall not attach the page URL automatically. |

**PAGE-04.** Unknown hosts and broken site rules shall fall back to a usable heading or document title. Users shall be able to correct the name and category, search the catalog, or save a manual entry. Missing category evidence shall require selection. A catalog outage shall not prevent manual creation.

**MATCH-01.** Existing-entry matching shall prefer verified catalog/provider identity, then conservatively normalized saved source URL. Name matches shall be case-insensitive suggestions requiring confirmation; a substring shall never silently establish identity. Conflicting identifiers shall produce a conflict state instead of accepting whichever match is found first.

**MATCH-02.** Search mode shall not use the active page URL for matching or persistence. Selecting a result already in the library shall show its saved metadata and offer editing.

**MATCH-03.** Converting a manual entry into a catalog-backed entry shall preserve its entry ID, user metadata, URL, and added date. If the catalog title already has an entry, show both records and require an explicit merge decision with a preview of retained fields.

## 5. Catalog search, editing, and saving

**SEARCH-01.** Popup, cabinet, and website shall allow category selection and text search. Name input shall debounce requests by 300 ms. New search/category/locale changes shall reset pagination. Blank queries shall not issue arbitrary search requests unless a documented browse capability is enabled.
The website shall keep non-sensitive browsing filters in URL parameters.

**SEARCH-02.** Results shall distinguish loading, success, empty, offline, and service-error states. Errors shall provide Retry and preserve the query and editor. Stale responses shall not replace results for newer search inputs.

**SEARCH-03.** Selecting a new catalog result shall prepare an editor, initialize absent status to `planned`, and fill an empty user name from the selected title. It shall not persist until Save or explicit Add is invoked.

**SEARCH-04.** Cabinet and website Add actions shall be connected and persist successfully. Already-saved results shall show their status/progress/rating and an Edit action instead of a duplicate Add action.

**EDIT-01.** All editors shall expose status, rating including clear, comment, and progress for episodic titles. Unknown episode total shall display a localized “unknown” indicator. Hiding a control or changing status shall not erase saved values. The product shall not automatically mark a title watched when progress reaches its total.

**EDIT-02.** Save shall be available only for a valid new entry or changed valid entry. Popup Save shall remain accessible at the bottom without covering content. While saving, repeated submissions shall be prevented. Dirty state shall clear only after confirmed persistence; errors shall retain values and permit retry.

**EDIT-03.** Page-mode saves shall include the page URL only when the user has accepted that association. Search-mode saves shall omit it unless entered explicitly. URLs shall be validated as HTTP(S) viewing links; no URL shall execute as script.

**EDIT-04.** If a normalized viewing-source URL belongs to another entry, show the current owner and request confirmation before reassignment. Confirming shall clear the old association and save the new one in one persistence operation, retaining both entries and updating timestamps for both changed records. Cancel shall change neither entry.

## 6. Library browsing

**LIB-01.** The library shall show entries in the selected category and apply filters, then stable sorting, then pagination. Cards shall show title, poster/fallback, year when known, episode total when relevant, status, rating, progress, viewing link when present, genres, and description. Description fallback shall be comment, then a localized empty-description message. Comments shall remain distinguishable from catalog descriptions.

**LIB-02.** Local text search shall be case-insensitive and match user name, original title, all available localized titles and descriptions, and comments. Filtering shall operate locally on saved data and work offline.

**LIB-03.** Expose text, status, rating, genre, and year filters. Positive statuses, ratings, and years shall use OR within each group. Positive genres shall require all selected genres. Exclusions shall require every excluded value to be absent. Different groups shall combine with AND; rating bounds shall be inclusive. An empty selection shall impose no restriction. Genre clicks shall apply a working genre filter.

**LIB-04.** Hidden entries shall be excluded by default, including from ordinary result counts. Selecting Hidden shall include hidden entries according to the selected status filter; explicit status inclusion shall replace the implicit hidden exclusion. The interface shall provide a clear way to view hidden entries.

**LIB-05.** Sorting shall support date added, date modified, displayed title, year, rating, and status, ascending or descending. Default: date added descending, page size 20. Allowed sizes: 12, 20, 50, 100. Title comparison shall follow the application locale. Unknown sort values shall appear last in both directions; equal values shall use entry ID as a stable tie-breaker.

**LIB-06.** Filter, sort, and page-size settings shall persist separately by category and Library/Catalog mode. Filter, search, sort, category, or page-size changes shall reset to page one. Deletion shall clamp the page to the last valid page. Previous, Next, and Last shall be available only when the available pagination data supports them.

**LIB-07.** Deleting shall remove the selected entry by entry ID and offer Undo for 10 seconds. Undo shall restore its data and timestamps. Cancellation or failure shall not delete unrelated entries. Bulk deletion is not required.

## 7. Persistence, offline behavior, and concurrency

**DATA-01.** The extension shall persist library data and settings through an MV3-compatible persistent adapter; no service-worker workflow shall depend on `window.localStorage`. The website shall use TanStack Query in-memory server state with the same validated domain model; library reads and writes require connectivity. It shall not persist its library or a mutation queue in RxDB, IndexedDB, or localStorage.

**DATA-02.** Popup and cabinet operations shall acknowledge success only after durable RxDB writes; website operations shall acknowledge success only after the backend transaction commits. Each persisted library mutation shall increment a monotonic library revision and record a millisecond last-update value. Open extension surfaces shall receive updates.

**DATA-03.** Writes shall be serialized or use revision checks to prevent stale whole-library replacement. Editing different entries concurrently shall retain both edits. Conflicting edits to the same entry shall offer reload or deliberate overwrite with a preview. Backup replacement shall abort or request a renewed preview if the library revision changed.

**DATA-04.** A missing store shall initialize an empty library. A failed read or corrupt store shall show a recovery state and preserve the existing bytes; it shall not initialize and overwrite them as an empty library. Recovery shall allow retry and export of recoverable raw data.

**DATA-05.** Offline extension users shall be able to browse, search, edit, delete, export, import, and create manual entries using saved snapshots. Website network failures shall preserve unsaved input and offer retry without claiming persistence. Remote catalog operations shall show an offline state. Failed requests shall never clear existing entries or metadata.

**DATA-06.** Closing an interface or suspending/restarting the service worker after an acknowledged save shall not lose the saved mutation. Cached genres and metadata shall remain readable when remote refresh fails.

## 8. Backup and restore

**BACKUP-01.** Export shall create `backup.json` as `{ schemaVersion: 1, entries: [...] }`, retaining entry IDs, optional catalog associations, all user fields, ordered sources, metadata/provenance, and creation/modification timestamps. Exclude deleted entries, per-entry schemaVersion, server versions, deletion state, credentials and account/settings data.

**BACKUP-02.** Restore shall accept only the current versioned format and round-trip its entry data. Old arrays, grouped `data`, `_filecab` extensions and unsupported versions shall be rejected. No old-data conversion, timestamp inference or migration workflow is required.

**BACKUP-03.** Before applying, validate JSON shape, categories, enums, field types, numeric bounds, timestamps, URLs, duplicate entry/catalog IDs and source ownership. Report indexed errors; invalid entries shall not be discarded or merged silently.

**BACKUP-04.** Before replacement, show counts/conflicts, offer a downloadable pre-restore backup and require confirmation tied to the owner, payload digest and expected revision. Invalid data shall not replace the library. An empty entries array requires distinct confirmation.

**BACKUP-05.** Replacement shall be atomic and publish replication changes, including tombstones. Failure/cancellation preserves the library; settings/sharing remain independent. Empty file selection does nothing. Reject files over 10 MiB before parsing. Current-format validation and restore shall work offline in the extension.

## 9. Backend and shared contracts

**API-01.** New client/backend boundaries shall use a versioned shared TypeScript contract with server request validation. Canonical search responses shall be `{ page, results, hasMore, total? }`, where page is one-based, `hasMore` is boolean, and total, when known, is a nonnegative exact count of matching unique records. Page size shall be bounded to 1–50 for provider-backed operations; larger UI pages may aggregate multiple requests without misrepresenting page numbers.

**API-02.** Without total, show Previous/Next using actual `hasMore`; omit Last and exact page counts. `hasMore` shall reflect deliverable normalized results after grouping/deduplication; uncertain provider continuation shall be handled explicitly, not derived from an unrelated intermediate count.

**API-03.** Film and TV searches shall apply distinct provider category filters. Unsupported filters/sorts shall be disabled or explained in Catalog mode; controls shall not suggest that a setting was applied when the backend ignored it. User-library statuses shall not be submitted as provider catalog filters.

**API-04.** Detail lookup shall distinguish internal catalog lookup from provider lookup in the route or typed parameters.

**API-05.** Backend catalog upsert shall use verified namespaced references, return stable internal identities across categories/locales, and refresh available catalog fields without overwriting populated fields with absent provider values. User metadata shall remain outside catalog refresh operations.

**API-06.** Catalog, genre, backup/restore, and verification endpoints shall return structured validation and service errors. Shared models shall allow actual nullable/absent provider fields. Transport errors, invalid responses, and valid empty results shall be distinguishable.

**API-07.** Support only the versioned endpoints defined by the current contracts. Account replication shall use the Backend specification’s RxDB pull/push contracts; old route compatibility is not required.

## 10. English and Russian

**LANG-01.** First use shall choose the first supported browser language by base language (`ru-RU` → `ru`); fallback shall be English. Settings shall allow an explicit English/Russian selection. Persist that selection and update all open interfaces without losing unsaved edits. Browser language changes shall not override an explicit selection. Website and extension interface preferences remain independent; library replication does not synchronize these preferences.

**LANG-02.** All application-owned labels, accessible names, messages, validation, dialogs, notifications, and browser-supported extension metadata shall have complete English/Russian translations. Stored categories/statuses shall remain stable keys. Missing UI translations shall fall back to English, never raw keys or provider errors. Counts shall use correct plural forms; dates/numbers shall use locale-aware presentation.

**LANG-03.** Catalog title, description, and genre shall prefer the requested locale. Title fallback: original title, another available translation, localized unavailable-title label. Description fallback: another available translation, comment when rendering a library card, localized empty label. Genre fallback: another available label, then stable genre key. Original title shall remain separate and shall not be assumed to be English.

**LANG-04.** Search/detail/genre requests shall send `locale: en | ru`. Missing or unsupported locale values shall produce a structured validation error. Responses shall identify requested locale and actual language per localized field, including `unknown` when language is unverified. Machine translation is not required.

**LANG-05.** Backend storage and cache shall retain multiple translations or key localized projections by locale while preserving stable media/genre IDs. Fetching Russian text shall not overwrite English text. Local snapshots shall preserve available translations and provenance. Text of unknown language shall not be labeled using the current UI language.

**LANG-06.** Remote query text shall be passed unchanged, with locale controlling presentation; universal cross-language provider search coverage is not guaranteed. Local search shall inspect available translations. Changing language shall preserve identity, user fields, timestamps, associations, and stable filter values. Offline switching shall use cached translations/fallbacks without erasing data.

## 11. Platform, privacy, and usability

**PLAT-01.** The extension shall use Manifest V3 and request only permissions required by implemented workflows. `activeTab`, `scripting`, and `storage` are candidates; unused bookmarks permission shall be removed. Required backend origins shall be explicit; broad page-host access shall not be introduced merely for on-demand parsing.

**PLAT-02.** Page extraction shall run only following user interaction and shall not inject persistent page behavior. Do not collect browsing history or transmit full page contents. Catalog requests shall send only necessary query, locale, and verified references; viewing URLs/comments shall not be sent unless required by a clearly disclosed operation.

**PLAT-03.** Provider text, page text, and imported data shall be treated as untrusted. Render text safely, sanitize any intentionally supported rich content, validate link schemes, and avoid evaluating imported rules or content as code.

**UX-01.** Popup, full-page library, dialogs, and website shall support keyboard operation, visible focus, semantic labels, screen-reader announcements for errors/results, and usable layouts at 200% zoom. Loading and error states shall preserve context. Posters shall have failure fallbacks and appropriate alternative text.

## 12. Release acceptance and defect resolution

Each scenario shall pass on the extension; website-applicable cases shall also pass on the website. Page extraction cases require extension checks. Provider integrations shall have contract/fixture checks in addition to live smoke checks when available.

| ID   | Scenario and expected outcome                                                                                                                                                                | Requirements               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC01 | Open a supported page: extract editable title/category and namespaced references; parser failure offers generic fallback.                                                                    | PAGE-01–04                 |
| AC02 | On an unknown host or offline, create a manual entry and reopen it with all user fields intact.                                                                                              | MODEL-04, PAGE-04, DATA-05 |
| AC03 | Catalog/provider identity and URL suggest different entries: display the conflict; no silent edit or merge.                                                                                  | MATCH-01                   |
| AC04 | Equal numeric IDs from IMDb/TMDB/Kinopoisk/internal namespaces do not identify or delete one another.                                                                                        | MODEL-01–02                |
| AC05 | Add from popup, cabinet, and website; repeated catalog addition opens one existing entry.                                                                                                    | MODEL-08, SEARCH-03–04     |
| AC06 | Failed save retains dirty values and retry; successful edits update modified date only.                                                                                                      | MODEL-07, EDIT-02          |
| AC07 | Change status or locale with an unsaved editor: retain rating/progress/comment and dirty state.                                                                                              | EDIT-01, LANG-01           |
| AC08 | Invalid ratings/noninteger or negative progress are blocked; excess progress warns without truncation; rating clears to 0; reaching known total does not change status.                      | MODEL-05, EDIT-01          |
| AC09 | Reassign a URL: cancellation changes nothing; confirmation atomically retains both entries with one URL owner.                                                                               | EDIT-04                    |
| AC10 | Search titles/descriptions/comments across available languages; verify OR/AND/exclusion rules and hidden default.                                                                            | LIB-02–04                  |
| AC11 | Change filters/sort/page size, delete last item on a page, reopen and switch categories: pagination and preferences remain valid.                                                            | LIB-05–06                  |
| AC12 | Delete and Undo within 10 seconds restores exactly the selected record.                                                                                                                      | LIB-07                     |
| AC13 | Current-format backup/restore round-trip retains manual/catalog entries, user fields, ordered sources, metadata/provenance and timestamps.                                                   | BACKUP-01–03               |
| AC14 | Malformed JSON, wrong schema, conflicting identities, or oversized file leaves the library unchanged with actionable errors.                                                                 | BACKUP-03–05               |
| AC15 | Cancel replacement or simulate a persistence failure: existing library remains. An empty entries array needs explicit confirmation.                                                          | BACKUP-04–05               |
| AC16 | Two interfaces edit different entries: both persist. Same-entry conflict and stale import require deliberate resolution.                                                                     | DATA-03                    |
| AC17 | Storage read fails: recovery state appears; existing bytes are not overwritten by an empty store.                                                                                            | DATA-04                    |
| AC18 | Restore a current-format backup and restart the MV3 worker: acknowledged data remains intact without duplicates.                                                                             | BACKUP-05 , DATA-06        |
| AC19 | Search returns no total: Next works from hasMore; Last/exact page count is absent. TV results obey TV filtering.                                                                             | API-01–03                  |
| AC20 | Search fails or older response arrives late: error is distinct from empty results and newest query retains control.                                                                          | SEARCH-02, API-06          |
| AC21 | Fresh browser languages choose ru/en correctly; explicit selection persists; plurals for 1/2/5/11/21 are correct.                                                                            | LANG-01–02                 |
| AC22 | Switch en/ru for the same title online/offline: identity/user data stay stable; field fallback/provenance remain truthful.                                                                   | LANG-03–06                 |
| AC23 | Restore nullable metadata and distinct provider namespaces; reject missing/invalid timestamps and old backup formats without changing the library.                                           | MODEL-02–07, BACKUP-02–03  |
| AC24 | On the authenticated online website without extension APIs, search/add/edit/delete/export/import work against the account library; network failure preserves unsaved input and offers retry. | NAV-03, DATA-01            |
| AC25 | Keyboard-only editing, 200% zoom, poster failure, and malicious imported text do not block core workflows or execute content.                                                                | PLAT-03, UX-01             |

### 12.1 Problems in the source and required resolutions

| Source problem                                               | Target resolution          |
| ------------------------------------------------------------ | -------------------------- |
| Cabinet Add event unconnected; no saved-state decoration     | SEARCH-04                  |
| Generic-page Search lacks initialized context                | NAV-04, PAGE-04, SEARCH-01 |
| Kinopoisk parser ID mapped as internal ID                    | PAGE-02, MODEL-02          |
| Internal/provider IDs collide during import/update/delete    | MODEL-01–02                |
| Cabinet edits skip timestamp updates                         | MODEL-07                   |
| Hidden status does not hide entries                          | LIB-04                     |
| Pending save flag cleared before persistence                 | EDIT-02                    |
| Unguarded backup restore; immediate replacement              | BACKUP-03–05               |
| Genres and genre-click filters not wired                     | LIB-03                     |
| Errors shown as empty results; stale requests can win        | SEARCH-02, API-06          |
| No rating reset or coherent progress rules                   | MODEL-05, EDIT-01          |
| Backend pagination mismatches frontend                       | API-01–02                  |
| TV route does not enforce TV-only selection                  | API-03                     |
| Provider identity namespaces overloaded                      | MODEL-02, API-05           |
| Catalog refresh leaves stale descriptive fields              | API-05                     |
| Single-language metadata/cache contradicts multilingual goal | LANG-03–06                 |
| Website parity and storage relationship unspecified          | NAV-03, section 1.2        |

### 12.2 Delivery order

1. Identity/model adapters, validation, safe storage, timestamps, backup recovery, and versioned API contracts.
2. Manual/catalog add flows, functional cabinet Add, page fallback/matching, consistent editing, and error handling.
3. Library filters/pagination, backup restore, bilingual UI and metadata, and standalone website parity.
4. Execute AC01–AC25; document any provider-specific exclusions before release. Incomplete core requirements shall not be described as working features.

## 13. Suggested improvements after the baseline

These are recommendations, not implied requirements or existing features.

| Priority | Suggestion                                                       | Benefit and boundary                                                                                                              |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| High     | Import merge mode with per-field conflict preview                | Avoid replacing the whole library for incremental transfers; retain replacement as a distinct action.                             |
| High     | Viewing-source usability enhancements                            | Multiple links are already required by Backend; optional enhancements may improve their presentation.                             |
| High     | Popup draft recovery                                             | Recover edits after accidental popup closure; drafts must be visibly distinct from saved entries.                                 |
| Medium   | Optional settings backup                                         | Extend the current versioned format with non-sensitive interface preferences.                                                     |
| Medium   | Additional declarative parser coverage                           | Versioned configuration, validation, caching, and rollback are required by Backend; additional hosts are optional beyond PAGE-03. |
| Medium   | Season/edition relationships and rewatch history                 | Avoid conflating a series, season, special, or remake; define identity and progress units before adding automation.               |
| Medium   | User-triggered metadata refresh UI                               | Provider caching and freshness are required by Catalog and Backend; an additional manual refresh interface is optional.           |
| Medium   | Optional local duplicate-review tool                             | Suggest ambiguous/manual matches with an explicit merge preview; never auto-merge by title.                                       |
| Low      | Tags, release schedules, notifications, keyboard search shortcut | Add after core reliability; notifications need their own permission and scheduling design.                                        |

## 14. Evidence and implementation traceability

Map current code and verification results to the requirement IDs above. Record fixture tests and live-provider evidence separately; neither old code nor route names establish implemented behavior.
