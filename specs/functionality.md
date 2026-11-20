# Product requirements

Release behavior for the extension and the website. All requirements are mandatory
unless marked optional. Stable IDs connect requirements to the
[acceptance scenarios](#12-release-acceptance) and the
[delivery checklist](../implementation/requirement-checklist.md).

## 1. Scope

- A Chrome Manifest V3 extension with a toolbar popup, a full-page library and settings.
- A standalone website with catalog search, add, edit, delete, filters and backup. It uses the same domain rules as the extension.
- Anime, films and TV series.
- English and Russian interfaces, with localized catalog metadata when available.
- Offline persistence in the extension. Online access on the website.
- Catalog entries and manual entries. A manual entry does not need a catalog match.
- Current-format JSON backup and restore. Migration of old data is not in scope.

These capabilities are also required. Other specs define them:

| Capability                          | Spec                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Google accounts and sessions        | [Backend](backend.md#accounts-and-sessions)                                            |
| Extension replication               | [Backend](backend.md#extension-replication), [Extension storage](extension-storage.md) |
| Unlisted sharing                    | [Backend](backend.md#unlisted-read-only-sharing)                                       |
| Server-managed parser configuration | [Backend](backend.md#server-managed-parser-configuration)                              |
| Catalog and metadata cache          | [Catalog](catalog-spec.md)                                                             |
| External list synchronization       | [External list sync](user-list-sync-spec.md)                                           |

A guest does not need to sign in or connect an external account. Extension guest data
stays in RxDB. Google login gives server access. Device replication needs explicit linking.
Optional ideas are in [Plans](plans.md). They are not in the release scope.

## 2. Surfaces and navigation

The [dark mockup](mockup-dark.png) defines the layout. The [light mockup](mockup-light.png)
defines colors only.

**NAV-01.** The popup has Page, Search and Settings, and an external link that opens the full page in a new tab. The popup starts on Page. Search must work when page parsing fails.

**NAV-02.** The full page and the website have Library and Catalog routes for anime, films and TV. They start on Library. Unknown and legacy paths go to the Anime Library. Popup Back follows [section 2.3](#23-popup-routes).

**NAV-03.** The website supports the core library operations without extension APIs. Only the extension reads the active tab. The website offers manual entry without a URL field.

**NAV-04.** Explain unavailable tabs, restricted URLs and parser failures. Offer Retry or manual entry. The Search tab stays available. Never show these failures as an empty search result.

**NAV-05.** Navigation does not close an open editor and does not ask about unsaved changes. Cancel and Escape close the editor and discard its changes without a prompt. Reload and close do not warn. Do not promise popup draft recovery.

### 2.1 Library layout

Use the supplied [Filecab logo](../apps/extension/public/wish-list-icon.png) and
[SVG icons](../apps/extension/public/icons). Keep their data. Do not redraw them.
[Library UI](library-ui.md) defines cards, lists, ordering and loading.

| Area         | Required behavior                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full page    | Fixed sidebar, flat navigation, language control at the bottom, clear library header.                                                                                                  |
| Results      | Poster cards with status, year, progress and rating. Search and filter toolbar, status tabs, grid and list switch, pagination.                                                         |
| Scrolling    | At a height of 732 CSS px or more, the page fits the viewport and only results scroll. Category and filter controls stay above. Sort by, Order and pagination stay below. No overlays. |
| Cards        | At 732 px, four columns show two complete rows with metadata. Titles keep two lines. Badges leave space for the menu.                                                                  |
| Data         | Show actual saved data. Never show bundled mockup samples. A poster failure keeps the actions.                                                                                         |
| Availability | Keep extension edit, delete, Undo and recovery available. The website reads the complete owner library and shows signed-out, empty and unavailable states separately.                  |

### 2.2 Settings

Follow the [Settings mockup](mockup-settings.png): Account, Sync and Appearance cards on
the full page, compact sections in the popup. Account and sign-in controls appear only
in Settings. Keep logout, session controls and diagnostics available. Do not clear drafts.

| Section      | Required behavior                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account      | Show real account state only. Do not invent name, email or avatar fields.                                                                                                                         |
| Sync         | Enable Sync now only for the linked, matching account. Explain signed-out, unlinked and suspended states. Show the last success only after an observed replication, with localized date and time. |
| Website sync | Refresh the online library. Label the time as a refresh, not as offline replication.                                                                                                              |
| Appearance   | Accessible Light and Dark segmented buttons and explicit language selection.                                                                                                                      |
| Icons        | Use the supplied navigation, theme, sync, rating and pagination SVGs. Shared copies keep the original data.                                                                                       |

### 2.3 Popup routes

- Offer Page, Search and Settings only. Show compact branding, header actions and Page and Search tabs.
- In Settings, replace the tabs with Back, the Settings title and the logo.
- Default, invalid and legacy routes, including Library, go to Page.
- Settings Back always goes to Page, not to the previous route.
- Back has the 34 px logo height, 12 px horizontal padding and a pointer cursor.
- The external-link action opens `full-page.html` in a new tab.
- Do not show library browsing or a Library tab in the popup.
- Popup navigation does not change full-page category and mode preferences.
- Background sync can stay mounted without a browsing interface.

## 3. Domain, identity and validation

### 3.1 Categories and statuses

Category is `anime`, `films` or `tv`. Catalog format is separate. For example, an anime
can have format `movie`, `tv`, `special`, `ova`, `ona` or `music` and stay in the anime category.

| Stored status | English  | Russian       |
| ------------- | -------- | ------------- |
| `planned`     | Planned  | Запланировано |
| `process`     | Watching | Смотрю        |
| `complete`    | Watched  | Просмотрено   |
| `drop`        | Dropped  | Брошено       |
| `hide`        | Hidden   | Скрыто        |
| `null`        | None     | Нет           |

**MODEL-01.** CRUD uses the immutable `entryId`. Matching uses a separate internal `catalogId` and verified namespaced references. Many source pages can identify one item. A later catalog association keeps the UUID of a manual entry.

**MODEL-02.** Keep provider namespaces and string IDs separate. Keep prefixes and leading zeros, for example IMDb `tt1234567`. IMDb, TMDB, MAL, Shikimori, Kinopoisk and internal IDs are not interchangeable.

**MODEL-03.** An entry keeps category, user title, at most one viewing link, status, rating, progress, comment, added and modified times, references and a snapshot. The snapshot has original and localized titles, poster, description, year, genre IDs, format and an optional episode total.

**MODEL-04.** A manual entry requires a category and a nonblank user title. A catalog entry needs a fallback title for display. Missing descriptions, posters, original titles, genres, years and totals must display safely.

**MODEL-05.** Rating is an integer 0–10. Rating 0 means unrated, with a Clear action. Progress is a nonnegative safe integer. Warn when progress is above a known total. Do not truncate it. An unknown or zero total means unknown.

**MODEL-06.** Keep the exact validated user title and comment. Trimming for the blank check must not change them. Refresh, locale changes and provider failures never overwrite user fields.

**MODEL-07.** Use UTC ISO timestamps. A semantic edit changes `updatedAt` and keeps `createdAt`. No-ops, locale changes and display refreshes change neither. Backups require valid timestamps. Do not infer them.

**MODEL-08.** Adding the same catalog item again opens the existing entry. Equal manual titles do not merge. A category disagreement on one catalog identity needs explicit resolution. Do not duplicate silently or change the category.

## 4. Page extraction and matching

**PAGE-01.** After a user action, read only the selected active HTTP or HTTPS tab. Exclude restricted pages and `mail.yandex.ru`. Check parsed host names, never URL substrings.

**PAGE-02.** Select site rules by the normalized host name without a leading `www.`. Return a typed title and optional category, references and episode data. A generic `{ id, idField }` does not establish internal identity.

**PAGE-03.** The supported hosts and their rules are in [page-rules.json](../packages/contracts/src/domain/page-rules.json). Add a host only after live checks of representative pages. A search-only rule gives a search seed. A save from that page has no link.

**PAGE-04.** An unknown or broken rule falls back to a heading or the document title. The user can correct the title and category, search the catalog or save manually. Without category evidence, require a category selection. Do not assume films. A catalog outage never blocks manual creation.

**MATCH-01.** Prefer verified catalog or provider identity, then conservatively normalized saved URLs. Case-insensitive title candidates need confirmation. A substring never proves identity. Conflicting identifiers give a conflict. The first match does not win.

**MATCH-02.** Search mode never uses the active URL for matching or saving. A saved result shows its stored metadata and an Edit action.

**MATCH-03.** A later catalog association keeps the UUID, user fields, sources and added date. If the item is already saved, preview both entries and the kept fields before an explicit merge.

## 5. Catalog search, editing and saving

**SEARCH-01.** Support category and text search on all surfaces with a 300 ms debounce. Reset the page when the query, category or locale changes. A blank search needs an advertised browse capability. Keep non-sensitive website filters in URL parameters.

**SEARCH-02.** Show loading, results, empty, offline and service error states separately. Retry keeps the query and the editor. An old response cannot replace newer results.

**SEARCH-03.** Selecting a new result prepares an unsaved editor. It sets a missing status to `planned` and fills an empty user title. Persist only after Save or an explicit Add. In the popup, select the result automatically when a search for a typed title returns exactly one result. Do this one time for each query. The user can go back to the results. Automatic selection does not save the entry and does not prove identity.

**SEARCH-04.** Full-page and website Add persist the entry. A saved result shows status, progress, rating and Edit instead of Add.

**EDIT-01.** Show status, a clearable rating, comment and episode progress. Rating and progress work the same in the popup, the full page and the website. Localize unknown totals. Hidden controls and status changes keep values. Reaching the total never marks the entry as watched, because the total of a series that is not complete can change.

**EDIT-02.** Enable Save only for a valid new or changed entry. Keep popup Save at the bottom without covering content. Block duplicate submissions. Clear the dirty state only after confirmed persistence. An error keeps the input and offers Retry.

**EDIT-03.** Only three operations add the viewing link: a save from the popup Page tab, a click on a saved card in the popup Page tab and an import. A Page tab save always adds the page URL to a new entry or to an existing entry. It replaces a different link of that entry. The Page tab editor does not show the page URL. A search save and a manual entry have no link. The editor shows the link as read-only and offers only Remove. Accept only HTTP and HTTPS links. Never run a URL as code.

**EDIT-04.** If the page URL already belongs to an entry, the Page tab shows that entry first with a link mark. It does not open the editor by itself. A click on the card opens the editor. The Page tab opens the editor by itself only for a title that is not in the library yet: the referenced record or the only search result. See [MATCH-01](#4-page-extraction-and-matching). If the user saves the page URL to a different entry from the Page tab, or clicks the card of a different saved entry there, the link moves to that entry. Before Save, the editor shows the title of the entry that loses the link. The save removes the link from that entry and adds it to the saved entry in one operation.

## 6. Library browsing

**LIB-01.** For the selected category, filter, then sort stably, then paginate. Cards show title, poster fallback, known year, episodes, status, rating, progress, the viewing link, genres and description. If the description is missing, show the comment, then a localized empty text. Keep notes visually different.

**LIB-02.** Local search is case-insensitive. It covers user, original and localized titles, descriptions and comments. Filtering of saved data works offline.

**LIB-03.** Provide text, status, rating, genre and year filters. Use OR inside positive statuses, ratings and years. Use AND for positive genres, exclusions and different fields. Rating bounds are inclusive. An empty group has no effect. A click on a genre applies a filter.

**LIB-04.** Hide hidden entries and their counts by default. An explicit status selection replaces the default hidden exclusion. Provide an accessible Hidden filter.

**LIB-05.** Sort by added date, modified date, displayed title, year, rating, status or episode count, in each direction. The default is added date, descending, with 20 entries. Page sizes are 12, 20, 50 and 100. Title order follows the locale. Unknown values sort last in both directions. Ties use the entry ID. Totals count all matches, not only the page.

**LIB-06.** Store filters, sort and page size for each category and for Library and Catalog mode. A change of query, filter, sort, category or size resets to page one. A deletion clamps the page. Show Previous, Next and Last only when the pagination data supports them.

**LIB-07.** Delete by entry UUID with a 10-second Undo. Undo restores the data and timestamps. Cancel or failure affects no other entries. Bulk deletion is optional.

## 7. Persistence, offline behavior and concurrency

**DATA-01.** Store extension data and settings in an MV3-compatible adapter. Workers must not use `window.localStorage`. The website keeps the library in online API state in memory. It never keeps a persistent library or mutation queue in RxDB, IndexedDB or localStorage.

**DATA-02.** Acknowledge an extension save after a durable RxDB write. Acknowledge a website save after the transaction commits. Store monotonic revisions and millisecond update times. Notify open extension surfaces.

**DATA-03.** Serialize writes or use revisions. Concurrent edits of different entries both survive. A conflict on one entry offers a reload or a deliberate overwrite preview. A stale backup preview must stop or ask for confirmation again.

**DATA-04.** Create empty storage only when storage is missing. A failed or damaged read keeps the bytes and shows Retry and a raw-data export. Never overwrite it with an empty library. Storage schema rules are in [Extension storage](extension-storage.md#schemas-and-recovery).

**DATA-05.** Offline extension workflows support browse, search, edit, delete, export, import and manual creation of saved data. Website failures keep input and offer Retry. They never claim a save. Catalog operations show offline. Failed requests never clear entries or metadata.

**DATA-06.** Acknowledged changes survive interface closure and worker suspension or restart. Cached genres and metadata stay readable after a failed refresh.

## 8. Backup and restore

**BACKUP-01.** Export `backup.json` in the [v1 format](domain-contract.md#backup-format). Include active UUIDs, optional catalog IDs, user fields, the viewing link, snapshots with provenance and timestamps. Exclude tombstones, per-entry `schemaVersion`, server versions, deletion state, credentials, account data and settings.

**BACKUP-02.** Round-trip only the current versioned format. Reject old arrays, grouped `data`, `_filecab` and unsupported versions. Do not convert old data or infer timestamps.

**BACKUP-03.** Validate the shape, categories, enums, types, bounds, dates, HTTP and HTTPS URLs, at most one link for each entry, and entry, catalog and link conflicts. Report errors with their index. Never discard or merge invalid entries silently.

**BACKUP-04.** Before replacement, show counts and conflicts and offer a pre-restore backup. Require confirmation bound to the owner, payload digest and revision. Invalid data cannot replace the library. An empty replacement needs a separate confirmation.

**BACKUP-05.** Replace atomically and publish replication tombstones. Cancel and failure keep the data. Settings and sharing stay separate. An empty file selection does nothing. Reject files over 10 MiB before parsing. Extension validation and restore work offline.

## 9. Backend and shared contracts

**API-01.** Use versioned shared models and server DTO validation. Catalog search returns `{ page, results, hasMore, total? }`: a one-based page, a boolean continuation and an optional exact count of unique matches. Provider limits are 1–50. Larger UI pages can combine provider pages without misrepresenting them.

**API-02.** Without an exact total, use Previous and Next from actual continuation. Do not show Last or page counts. `hasMore` describes deliverable normalized results after deduplication. Report uncertain continuation explicitly.

**API-03.** Enforce separate film and TV constraints. Disable and explain unsupported catalog filters and sorts. Personal statuses are not provider filters.

**API-04.** Keep internal catalog detail lookup separate from provider-reference resolution, in routes or typed parameters.

**API-05.** Upsert verified namespaced references into stable internal identities across categories and locales. Refresh catalog metadata without erasing known values or overwriting user fields.

**API-06.** Return structured validation and service errors for catalog, genres, backup and verification. Support nullable metadata. Keep transport failure, malformed response and empty result separate.

**API-07.** Support current versioned endpoints only. Do not keep legacy routes. Account sync uses the [backend replication contract](backend.md#extension-replication).

## 10. English and Russian

**LANG-01.** Select the first supported browser base language. Fall back to English. Store an explicit selection and do not let the browser language override it later. Update open surfaces without losing drafts. Interface preferences are not replicated with the library. See [Interface preferences](conventions.md#interface-preferences).

**LANG-02.** Translate owned labels, accessible names, validation, messages, dialogs, notifications and extension metadata into English and Russian. Keep domain keys stable. Missing owned text falls back to English. Never show raw provider failures. Localize plurals, dates and numbers.

**LANG-03.** Use the requested locale for titles, descriptions and genres.

| Field       | Fallback order                                          |
| ----------- | ------------------------------------------------------- |
| Title       | Original, another translation, localized "unavailable"  |
| Description | Another translation, card comment, localized empty text |
| Genre       | Another label, stable key                               |

The original title is not automatically English.

**LANG-04.** Catalog search, details and genres require `locale: en | ru`. Reject a missing or unsupported value. Return the requested locale and the actual field language, including unknown. Machine translation is optional.

**LANG-05.** Keep several translations or locale-keyed projections under stable media and genre IDs. A Russian refresh must not overwrite English. Snapshots keep provenance. An unknown language is not the current UI locale.

**LANG-06.** Send query text unchanged. Cross-language remote search is not guaranteed. Local search reads all available translations. A locale switch keeps identities, user fields, timestamps, sources and filter keys. Offline fallbacks never erase data.

## 11. Platform, privacy and usability

**PLAT-01.** Use Manifest V3 and only the permissions that implemented workflows need. Consider `activeTab`, `scripting` and `storage`. Remove bookmarks access. List backend origins explicitly. Do not add broad host access for on-demand parsing.

**PLAT-02.** Extract only after a user action. Do not add persistent page behavior, history collection or full-page transmission. Send only the query, locale and references that the operation needs. Sending URLs or comments needs a disclosed operation.

**PLAT-03.** Treat provider, page and import text as untrusted. Render it safely. Sanitize supported rich content. Validate link schemes. Never evaluate content or rules as code.

**UX-01.** Support keyboard operation, visible focus, semantic labels, error and result announcements and 200% zoom on all surfaces and dialogs. Keep context during loading and errors. Handle poster failures and give suitable alt text.

## 12. Release acceptance

Each scenario must pass in the extension. Scenarios that apply to the website must also
pass on the website. Page extraction needs extension checks. Provider integrations need
contract or fixture checks, and live checks when available.

| ID   | Scenario and expected result                                                                                                                                                             | Requirements               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC01 | Open a supported page. Extract an editable title, category and namespaced references. A parser failure offers the generic fallback.                                                      | PAGE-01–04                 |
| AC02 | On an unknown host or offline, create a manual entry. Open it again with all user fields unchanged.                                                                                      | MODEL-04, PAGE-04, DATA-05 |
| AC03 | Catalog identity and URL suggest different entries. Show the conflict. Do not edit or merge silently.                                                                                    | MATCH-01                   |
| AC04 | Equal numeric IDs from IMDb, TMDB, Kinopoisk and internal namespaces do not identify or delete each other.                                                                               | MODEL-01–02                |
| AC05 | Add from the popup, the full-page library and the website. Adding the same catalog item again opens the one existing entry.                                                              | MODEL-08, SEARCH-03–04     |
| AC06 | A failed save keeps the changed values and Retry. A successful edit changes only the modified date.                                                                                      | MODEL-07, EDIT-02          |
| AC07 | Change the status or locale with an unsaved editor. Rating, progress, comment and dirty state stay.                                                                                      | EDIT-01, LANG-01           |
| AC08 | Invalid ratings and noninteger or negative progress are blocked. Excess progress warns without truncation. Rating clears to 0. Reaching the total does not change the status.            | MODEL-05, EDIT-01          |
| AC09 | Remove a link in the editor. Save keeps the entry without a link. A popup Page tab save adds or replaces the page link and removes it from another entry. Other edits cannot add a link. | EDIT-03, EDIT-04           |
| AC10 | Search titles, descriptions and comments in all available languages. Check the OR, AND and exclusion rules and the hidden default.                                                       | LIB-02–04                  |
| AC11 | Change filters, sort and page size, delete the last item on a page, reopen and switch categories. Pagination and preferences stay valid.                                                 | LIB-05–06                  |
| AC12 | Delete and Undo within 10 seconds restores exactly the selected record.                                                                                                                  | LIB-07                     |
| AC13 | A backup round-trip keeps manual and catalog entries, user fields, links, metadata, provenance and timestamps.                                                                           | BACKUP-01–03               |
| AC14 | Malformed JSON, a wrong schema, conflicting identities or an oversized file leave the library unchanged with actionable errors.                                                          | BACKUP-03–05               |
| AC15 | Cancel replacement or simulate a persistence failure. The library stays. An empty entries array needs explicit confirmation.                                                             | BACKUP-04–05               |
| AC16 | Two interfaces edit different entries. Both persist. A same-entry conflict and a stale import need deliberate resolution.                                                                | DATA-03                    |
| AC17 | A storage read fails. Recovery state appears. An empty store does not overwrite existing bytes.                                                                                          | DATA-04                    |
| AC18 | Restore a backup and restart the MV3 worker. Acknowledged data stays without duplicates.                                                                                                 | BACKUP-05, DATA-06         |
| AC19 | A search returns no total. Next works from `hasMore`. Last and the page count are absent. TV results obey TV filtering.                                                                  | API-01–03                  |
| AC20 | A search fails or an older response arrives late. The error is different from an empty result. The newest query keeps control.                                                           | SEARCH-02, API-06          |
| AC21 | New browser languages select Russian or English correctly. An explicit selection persists. Plurals for 1, 2, 5, 11 and 21 are correct.                                                   | LANG-01–02                 |
| AC22 | Switch between English and Russian for the same title online and offline. Identity and user data stay. Field fallback and provenance stay true.                                          | LANG-03–06                 |
| AC23 | Restore nullable metadata and separate provider namespaces. Reject missing or invalid timestamps and old backup formats without library changes.                                         | MODEL-02–07, BACKUP-02–03  |
| AC24 | On the signed-in website without extension APIs, search, add, edit, delete, export and import work. A network failure keeps unsaved input and offers Retry.                              | NAV-03, DATA-01            |
| AC25 | Keyboard-only editing, 200% zoom, poster failure and malicious imported text do not block core workflows or run content.                                                                 | PLAT-03, UX-01             |

Incomplete core requirements must not be described as working features. Record provider
exclusions before release.
