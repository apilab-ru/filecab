# Product requirements

Release behavior for the extension and website. Requirements are mandatory unless
marked optional; stable IDs support the [acceptance checklist](#12-release-acceptance-and-defect-resolution).
Implementation status belongs in the [delivery checklist](../implementation/requirement-checklist.md).

## 1. Scope

### 1.1 Release scope

- Chrome Manifest V3 extension: toolbar popup, full-page library, and settings.
- A standalone website with catalog search, add, edit, delete, filtering, and backup/restore using the same domain rules as the extension.
- Anime, films, and TV series.
- English and Russian application interfaces, with available localized catalog metadata.
- Extension offline persistence, online website access, current-format JSON backup/restore. Old-data migration is out of scope.
- Catalog-backed entries and manual entries that do not require a catalog match.

Google accounts, extension replication, unlisted sharing, server-managed parser configuration, metadata caches, and owner-connected external list synchronization are required delivery capabilities defined in the adjacent specifications. Guests need not sign in or connect an external account.

### 1.2 Explicit product defaults

Defaults below define target behavior, not implementation status.

| Topic                        | Release decision                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Data                         | Extension guest data stays in RxDB; authenticated libraries replicate with PostgreSQL. Website library access is online through TanStack Query. |
| Accounts and synchronization | Extension guests can work offline without server storage. Google login enables server access; device replication requires explicit linking.     |
| Unsupported pages            | Offer editable extracted metadata and manual entry creation; never require a catalog match.                                                     |
| Uncertain media category     | Ask for a category rather than silently assuming films.                                                                                         |
| Hidden titles                | Excluded from ordinary library results; an explicit Hidden filter reveals them.                                                                 |
| Progress and completion      | No automatic status changes; preserve progress when statuses change.                                                                            |
| Rating and progress fields   | Consistent across popup, full-page library, and website; rating is always editable, progress applies to episodic media.                         |
| Page URL ownership           | Multiple viewing sources per entry; one active entry per owner and normalized source URL, with explicit atomic reassignment.                    |
| Delete                       | Immediate deletion with Undo for 10 seconds.                                                                                                    |
| Backup format                | Versioned current-format JSON; no legacy array or grouped-data import.                                                                          |

## 2. Users, surfaces, and navigation

Visual references: [dark theme mockup](mockup-dark.png) defines the current
layout; [light theme mockup](mockup-white.png) supplies colors only. Use these
alongside the behavior requirements below.

**NAV-01.** Offer popup Page/Search and Settings, plus an external full-page link opening a new tab. Start on Page; keep Search usable when parsing fails.

**NAV-02.** Provide anime/films/TV Library and Catalog routes in the full page and website. Start on Library; redirect unknown/legacy paths to canonical Anime Library. Popup Back follows section 2.3.

**NAV-03.** Support core library operations on the website without extension APIs. Active-tab reading is extension-only; provide manual and optional URL entry on the website.

**NAV-04.** Explain unavailable tabs, restricted URLs and parser failures with Retry, Search or manual-entry actions. Never show these failures as successful empty searches.

**NAV-05.** Block navigation from dirty editors with Save, Discard and Continue editing. Save proceeds only after persistence; Discard clears the draft; Continue cancels navigation. Keep reload/closure `beforeunload` protection; do not promise popup draft recovery unless implemented.

### 2.1 Library layout

Use the supplied [Filecab logo](../apps/extension/public/wish-list-icon.png) and
[SVG icons](../apps/extension/public/icons), preserving their data rather than redrawing.
The [dark mockup](mockup-dark.png) defines layout; light references define colors.

| Area            | Required behavior                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full page       | Fixed sidebar, flat navigation, bottom-aligned language control and clear library header                                                                                         |
| Results         | Responsive poster cards with status/year/progress/rating; search/filter toolbar, status tabs, grid/list toggle and pagination                                                    |
| Scrolling       | At heights ≥732 CSS px, the page fits the viewport; only results scroll. Category/filter controls stay above, Sort by/Order/pagination below, without overlays                   |
| Cards           | At 732px, the four-column layout shows two complete rows including metadata. Poster height follows available results height; titles retain two lines and badges leave menu space |
| Page size       | Default 20 entries; see LIB-05 for supported sizes                                                                                                                               |
| Assets and data | Use actual saved data, never bundled mockup samples. Poster fallback must preserve actions; view toggle aligns with categories                                                   |
| Availability    | Keep extension editing/delete/Undo/recovery accessible. Website reads the complete owner snapshot and distinguishes signed-out, empty and unavailable states                     |

### 2.2 Settings and supplied icons

Follow the [Settings mockup](mockup-settings.png): full-page Account/Sync/Appearance
cards and compact popup sections. Account/sign-in controls appear only in Settings.
Keep logout/session controls and diagnostics accessible without clearing drafts.

| Section      | Required behavior                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account      | Real account state only; do not invent name/email/avatar fields absent from the contract                                                                                                  |
| Sync         | Enable extension Sync now only for the linked matching account; explain signed-out/unlinked/suspended states. Show last success only after observed replication, with localized date/time |
| Website sync | Refresh the online library and label the timestamp as a refresh, not offline replication                                                                                                  |
| Appearance   | Accessible Light/Dark segmented buttons and explicit locale selection                                                                                                                     |
| Icons        | Use supplied navigation/theme/sync/rating/pagination SVGs; shared copies retain the original data                                                                                         |

### 2.3 Popup routes

- Offer Page, Search and Settings only, with compact branding/header actions and Page/Search tabs. Settings replaces tabs with Back/Settings plus the logo.
- Default and invalid/legacy routes, including Library, go to Page. Settings Back always goes directly to Page, not the previously visited route.
- Back matches the 34px logo height, has 12px horizontal padding and a pointer cursor.
- The external-link action opens `full-page.html` in a new tab; do not render library browsing or a Library navigation tab in the popup.
- Popup navigation does not overwrite full-page category/mode preferences. Background sync may remain mounted without a browsing interface.

## 3. Domain, identity, and validation

### 3.1 Categories and statuses

Category must be `anime`, `films`, or `tv`. Catalog subtype is separate: an anime may have subtype `movie`, `tv`, `special`, `ova`, `ona`, or `music` without leaving the anime library category.

| Stored status | English  | Russian       |
| ------------- | -------- | ------------- |
| `planned`     | Planned  | Запланировано |
| `process`     | Watching | Смотрю        |
| `complete`    | Watched  | Просмотрено   |
| `drop`        | Dropped  | Брошено       |
| `hide`        | Hidden   | Скрыто        |
| `null`        | None     | Нет           |

**MODEL-01.** Use immutable `entryId` for CRUD and separate internal `catalogId` plus verified namespaced references for matching. Multiple source pages may identify one item. Later catalog association preserves a manual entry’s UUID.

**MODEL-02.** Keep provider namespaces and string IDs distinct, preserving prefixes/leading zeros (for example IMDb `tt1234567`). IMDb, TMDB, MAL, Shikimori, Kinopoisk and internal IDs are not interchangeable.

**MODEL-03.** Retain category, user title, viewing sources, status/rating/progress/comment, added/modified timestamps, references and a snapshot with original/localized titles, poster, description, year, genre IDs, format and optional episode total.

**MODEL-04.** Manual entries require category and a nonblank user title. Catalog entries need a displayable fallback title. Missing descriptions/posters/original titles/genres/years/totals must render safely.

**MODEL-05.** Rating is integer 0–10; 0 is unrated with a Clear action. Progress is a nonnegative safe integer. Warn above a known total without truncating existing/new progress; unknown or zero totals mean unknown.

**MODEL-06.** Preserve exact validated user title/comment; trimming for blank checks must not rewrite them. Refresh, locale changes and provider failures never overwrite user fields.

**MODEL-07.** Use UTC ISO timestamps. Semantic edits refresh `updatedAt`, preserving `createdAt`; no-ops, locale changes and display refreshes change neither. Backups require valid timestamps without inference.

**MODEL-08.** Repeated catalog addition opens the existing entry. Equal manual titles do not merge. Category disagreement on a catalog identity needs explicit resolution, not silent duplication or category changes.

## 4. Page extraction and matching

**PAGE-01.** After user interaction, read only the selected active HTTP(S) tab. Exclude restricted pages and `mail.yandex.ru`; check parsed hostnames, never URL substrings.

**PAGE-02.** Choose site rules by normalized hostname without initial `www.`. Return typed title, optional category/references/episode data. Generic `{ id, idField }` does not establish internal identity.

**PAGE-03.** Support the hosts below only after representative fixture checks; the source description does not establish live compatibility.

| Hosts                                                                                               | Expected seed                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `animego.org`, `animesss.com`, `smotret-anime.online`, `shikimori.io`, `dreamerscast.com`, `jut.su` | Anime title; heading/selector or cleaned document title, with safe fallback.                            |
| `kino.mail.ru`, `afisha.mail.ru`                                                                    | Film title; allow user category correction.                                                             |
| `ivi.ru`                                                                                            | Film or TV title, using available page evidence.                                                        |
| `kinopoisk.ru`, `hd.kinopoisk.ru`                                                                   | Title, film/TV evidence, and a namespaced Kinopoisk reference when extractable.                         |
| `mirf.ru`                                                                                           | Nonblank selected text as an anime search seed; Search mode must not attach the page URL automatically. |

**PAGE-04.** Unknown/broken rules fall back to a heading/document title. Allow title/category correction, catalog search or manual save. Require category selection without evidence; catalog outages never block manual creation.

**MATCH-01.** Prefer verified catalog/provider identity, then conservatively normalized saved URLs. Case-insensitive title candidates require confirmation; substrings never prove identity. Conflicting identifiers produce a conflict, not first-match wins.

**MATCH-02.** Search mode never uses the active URL for matching/saving. Selecting a saved result shows its stored metadata and editing action.

**MATCH-03.** Later catalog association preserves UUID, user metadata, sources and added date. If already saved, preview both entries and retained fields before an explicit merge.

## 5. Catalog search, editing, and saving

**SEARCH-01.** Support category/text search across surfaces with 300ms debounce. Reset pages on query/category/locale changes. Blank search needs an advertised browse capability. Keep non-sensitive website filters in URL parameters.

**SEARCH-02.** Distinguish loading, results, empty, offline and service errors. Retry preserves query/editor; stale responses cannot replace newer results.

**SEARCH-03.** Selecting a new result prepares an unsaved editor, defaults absent status to `planned` and fills an empty user title. Persist only after Save or explicit Add.

**SEARCH-04.** Wire full-page and website Add to persistence. Saved results show status/progress/rating and Edit instead of duplicate Add.

**EDIT-01.** Expose status, clearable rating, comment and episodic progress; localize unknown totals. Hidden controls/status changes preserve values. Reaching total never automatically marks watched.

**EDIT-02.** Enable Save only for valid new/changed entries. Keep popup Save reachable at the bottom without covering content; block duplicate submissions. Clear dirty state after confirmed persistence only; errors preserve input and Retry.

**EDIT-03.** Page saves attach URLs only after acceptance. Search saves omit URLs unless explicitly entered. Accept HTTP(S) viewing links only; never execute URLs as code.

**EDIT-04.** If a normalized URL belongs elsewhere, show its owner and request reassignment confirmation. Atomically move the association, retain both entries and update both changed timestamps. Cancel changes neither.

## 6. Library browsing

**LIB-01.** For the selected category, filter → stable sort → paginate. Cards show title/poster fallback, known year, relevant episodes, status/rating/progress, viewing links, genres and description. Description fallback is comment then localized empty text; keep notes distinguishable.

**LIB-02.** Case-insensitive local search covers user/original/localized titles, descriptions and comments. Saved-data filtering works offline.

**LIB-03.** Provide text/status/rating/genre/year filters. Use OR within positive statuses/ratings/years; AND for positive genres, exclusions and different fields. Rating bounds are inclusive; empty groups impose no restriction. Genre clicks apply filters.

**LIB-04.** Hide hidden entries/counts by default. Explicit status selection replaces implicit hidden exclusion; provide an accessible Hidden filter.

**LIB-05.** Sort added/modified date, displayed title, year, rating or status in either direction. Default: added descending, 20 entries; sizes 12/20/50/100. Titles follow locale; unknown values sort last both ways and ties use entry ID.

**LIB-06.** Persist filters/sort/page size per category and Library/Catalog mode. Query/filter/sort/category/size changes reset page one; deletion clamps the page. Offer Previous/Next/Last only when pagination data supports them.

**LIB-07.** Delete by entry UUID with 10-second Undo restoring its data/timestamps. Cancellation/failure affects no unrelated entries. Bulk deletion is optional.

## 7. Persistence, offline behavior, and concurrency

**DATA-01.** Persist extension data/settings in an MV3-compatible adapter; workers must not depend on `window.localStorage`. Website library operations use online API state in memory, never a persistent RxDB/IndexedDB/localStorage library or mutation queue.

**DATA-02.** Acknowledge extension saves after durable RxDB writes and website saves after transaction commit. Persist monotonic revisions/millisecond update values and notify open extension surfaces.

**DATA-03.** Serialize writes or use revisions. Concurrent different-entry edits both survive; same-entry conflicts offer reload or deliberate overwrite preview. Stale backup previews must abort or renew confirmation.

**DATA-04.** Initialize empty storage only when missing. Failed/corrupt reads preserve bytes and show Retry/raw-data export, never overwrite with an empty library.

**DATA-05.** Offline extension workflows support saved-data browse/search/edit/delete/export/import/manual creation. Website failures retain input and Retry without claiming a save. Catalog operations show offline; failed requests never clear entries/metadata.

**DATA-06.** Acknowledged changes survive interface closure and worker suspension/restart. Cached genres/metadata stay readable after failed refresh.

## 8. Backup and restore

**BACKUP-01.** Export `backup.json` as `{ schemaVersion: 1, entries: [...] }` with active UUIDs, optional catalog IDs, user fields, ordered sources, snapshots/provenance and timestamps. Exclude tombstones, per-entry schemaVersion, server versions, deletion state, credentials and account/settings.

**BACKUP-02.** Round-trip only the current versioned format. Reject old arrays/grouped `data`/`_filecab` and unsupported versions; do not convert legacy data or infer timestamps.

**BACKUP-03.** Validate shape, categories/enums/types/bounds/dates/HTTP(S) URLs and entry/catalog/source conflicts. Report indexed errors; do not silently discard or merge invalid entries.

**BACKUP-04.** Before replacement, show counts/conflicts, offer a pre-restore backup and require owner/payload-digest/revision-bound confirmation. Invalid data cannot replace; empty replacement needs separate confirmation.

**BACKUP-05.** Replace atomically and publish replication tombstones. Cancel/failure preserves data; settings/sharing stay separate. Empty file selection does nothing. Reject over 10 MiB before parsing; extension validation/restore works offline.

## 9. Backend and shared contracts

**API-01.** Use versioned shared models and server DTO validation. Catalog search returns `{ page, results, hasMore, total? }`: one-based page, boolean continuation, optional exact nonnegative unique-match count. Provider limits are 1–50; larger UI pages may aggregate without misrepresenting upstream pages.

**API-02.** Without exact total, use Previous/Next from actual continuation and omit Last/page counts. `hasMore` describes deliverable normalized results after deduplication, never unrelated intermediate counts; report uncertain continuation explicitly.

**API-03.** Enforce distinct film/TV constraints. Disable/explain unsupported catalog filters/sorts rather than pretend they apply. Personal-library statuses are not provider filters.

**API-04.** Separate internal catalog detail lookup from provider-reference resolution in routes or typed parameters.

**API-05.** Upsert verified namespaced references into stable internal identities across categories/locales. Refresh available catalog metadata without erasing known values or overwriting user fields.

**API-06.** Return structured validation/service errors for catalog, genres, backup/restore and verification. Support actual nullable metadata; distinguish transport failure, malformed response and empty results.

**API-07.** Support current versioned endpoints only; no legacy-route compatibility. Use the [backend replication contract](backend.md#extension-offline-data-and-synchronization) for account sync.

## 10. English and Russian

**LANG-01.** Choose the first supported browser base language, falling back to English. Persist explicit en/ru without later browser overrides; update open surfaces without losing drafts. Website/extension preferences stay independent of library replication. See [Preference conventions](conventions.md#interface-preferences).

**LANG-02.** Translate owned labels, accessible names, validation, messages/dialogs/notifications and supported extension metadata into en/ru. Keep domain keys stable. Missing owned text falls back to English; never expose raw provider failures. Localize plurals, dates and numbers.

**LANG-03.** Use requested locale for titles/descriptions/genres. Title fallback: original → other translation → localized unavailable. Description fallback: another translation → card comment → localized empty. Genre fallback: another label → stable key. Original title is not automatically English.

**LANG-04.** Require explicit `locale: en | ru` for search/details/genres; reject missing/unsupported values. Return requested locale and actual field language, including unknown. Machine translation is optional.

**LANG-05.** Retain multiple translations or locale-keyed projections under stable media/genre IDs. Refreshing Russian must not overwrite English. Snapshots keep provenance; unknown language is not the current UI locale.

**LANG-06.** Pass query text unchanged; universal cross-language remote search is not guaranteed. Local search inspects available translations. Locale switches preserve identities, user fields, timestamps, sources and filter keys; offline fallbacks never erase data.

## 11. Platform, privacy, and usability

**PLAT-01.** Use Manifest V3 and permissions required by implemented workflows. Consider `activeTab`/`scripting`/`storage`; remove unused bookmarks access. List backend origins explicitly; do not add broad page-host access for on-demand parsing.

**PLAT-02.** Extract only after user interaction, without persistent page behavior, history collection or full-page transmission. Send only necessary query/locale/references; URLs/comments need a disclosed operation.

**PLAT-03.** Treat provider/page/import text as untrusted. Render safely, sanitize supported rich content, validate link schemes and never evaluate content/rules as code.

**UX-01.** Support keyboard operation, visible focus, semantic labels, error/result announcements and 200% zoom across surfaces/dialogs. Preserve context during loading/errors; provide poster failures and appropriate alt text.

## 12. Release acceptance and defect resolution

Each scenario must pass on the extension; website-applicable cases must also pass on the website. Page extraction cases require extension checks. Provider integrations must have contract/fixture checks in addition to live smoke checks when available.

| ID   | Scenario and expected outcome                                                                                                                                                                | Requirements               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC01 | Open a supported page: extract editable title/category and namespaced references; parser failure offers generic fallback.                                                                    | PAGE-01–04                 |
| AC02 | On an unknown host or offline, create a manual entry and reopen it with all user fields intact.                                                                                              | MODEL-04, PAGE-04, DATA-05 |
| AC03 | Catalog/provider identity and URL suggest different entries: display the conflict; no silent edit or merge.                                                                                  | MATCH-01                   |
| AC04 | Equal numeric IDs from IMDb/TMDB/Kinopoisk/internal namespaces do not identify or delete one another.                                                                                        | MODEL-01–02                |
| AC05 | Add from popup, full-page library, and website; repeated catalog addition opens one existing entry.                                                                                          | MODEL-08, SEARCH-03–04     |
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

The [source defect mapping](../implementation/implementation-plan.md#source-defect-mapping)
links historical defects to the requirement IDs in this document.

### 12.2 Delivery order

1. Identity/model adapters, validation, safe storage, timestamps, backup recovery, and versioned API contracts.
2. Manual/catalog add flows, functional full-page library Add, page fallback/matching, consistent editing, and error handling.
3. Library filters/pagination, backup restore, bilingual UI and metadata, and standalone website parity.
4. Execute AC01–AC25; document any provider-specific exclusions before release. Incomplete core requirements must not be described as working features.

## 13. Suggested improvements after the baseline

Optional improvements are listed in [Plans](plans.md#optional-improvements).
They do not expand the release scope.

## 14. Evidence and implementation traceability

Map current code and verification results to the requirement IDs above. Record fixture tests and live-provider evidence separately; neither old code nor route names establish implemented behavior.
