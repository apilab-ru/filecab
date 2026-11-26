# Requirement checklist

Delivery status and evidence for the [specs](../specs/index.md). Steps refer to the
[implementation plan](implementation-plan.md).

- **Done**: the complete linked section works and has evidence.
- **Partial**: some clauses work. The note names what is missing.
- **Pending**: no delivery yet.

Each item is one line: checkbox, linked section, delivery steps, status and note. Do not use tables in this file.

Record fixture tests and live provider checks separately. Git history keeps the detailed
change logs before 18 November 2026.

## Product requirements

- [x] [NAV-01–05](../specs/functionality.md#2-surfaces-and-navigation) (steps 10, 11, 16): Done. [Step 16](#step-16-page-extraction)
- [ ] [MODEL-01–08](../specs/functionality.md#3-domain-identity-and-validation) (steps 3, 4, 11): Partial. Contracts, server rules and editor validation done. Category conflict review pending.
- [ ] [PAGE-01–04](../specs/functionality.md#4-page-extraction-and-matching) (step 16): Partial. Rules, engine and fixtures done. Live checks of Kinopoisk, hd.kinopoisk, jut.su, Crunchyroll and a kino.mail.ru series page are open. [Check report](page-rules-check.md)
- [x] [MATCH-01–03](../specs/functionality.md#4-page-extraction-and-matching) (steps 4, 15, 16): Done. [Step 16](#step-16-page-extraction)
- [x] [SEARCH-01–04](../specs/functionality.md#5-catalog-search-editing-and-saving) (steps 12–15): Done. [Step 15](#step-15-catalog-search-and-editing)
- [ ] [EDIT-01–04](../specs/functionality.md#5-catalog-search-editing-and-saving) (steps 7, 8, 11): Partial. Editor, validation, conflict choices, the read-only link, and the Page tab link save, replacement and move done. Restore adds links. [Step 17](#step-17-backup-and-restore)
- [ ] [LIB-01–07](../specs/functionality.md#6-library-browsing) (steps 10, 11): Partial. All clauses done except bulk deletion, which is optional. Release check pending.
- [x] [DATA-01–06](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) (steps 7–9, 11, 17): Done. A stale backup preview stops the restore. [Step 17](#step-17-backup-and-restore)
- [x] [BACKUP-01–05](../specs/functionality.md#8-backup-and-restore) (step 17): Done. The client does not limit the file size. The API limits backup bodies to 10 MiB. [Step 17](#step-17-backup-and-restore)
- [ ] [API-01–07](../specs/functionality.md#9-backend-and-shared-contracts) (steps 3, 5, 7, 9, 12–15): Partial. Backup errors done. Verification errors pending.
- [ ] [LANG-01–06](../specs/functionality.md#10-english-and-russian) (steps 3, 10–15): Partial. Interface languages done. Metadata localization partly done.
- [x] [PLAT-01–03](../specs/functionality.md#11-platform-privacy-and-usability) (steps 5, 6, 16): Done. [Step 16](#step-16-page-extraction)
- [ ] [UX-01](../specs/functionality.md#11-platform-privacy-and-usability) (steps 10, 11, 21): Partial. Keyboard, focus and zoom tests for the shell.
- [ ] [AC01–AC25](../specs/functionality.md#12-release-acceptance) (step 22): Pending. Run at release.

## Backend

- [x] [Accounts and sessions](../specs/backend.md#accounts-and-sessions) (step 6): Done. [Step 6](#step-6-google-authentication)
- [x] [Library data](../specs/backend.md#library-data) (steps 4, 7): Done. [Step 4](#step-4-transactional-persistence), [step 7](#step-7-library-api)
- [x] [Library operations](../specs/backend.md#library-operations) (step 7): Done. [Step 7](#step-7-library-api)
- [x] [Extension replication](../specs/backend.md#extension-replication) (step 9): Done. [Step 9](#step-9-extension-replication). History is kept without a time limit.
- [x] [Public library](../specs/backend.md#public-library) (step 18): Done. [Step 18](#step-18-public-library)
- [x] [Backup and restore](../specs/backend.md#backup-and-restore) (step 17): Done. [Step 17](#step-17-backup-and-restore)
- [x] [Server-managed parser configuration](../specs/backend.md#server-managed-parser-configuration) (step 16): Done. [Step 16](#step-16-page-extraction)
- [x] [API foundation](../specs/backend.md#api-foundation) (step 5): Done. [Step 5](#step-5-api-foundation)

## Extension storage

- [x] [Local database](../specs/extension-storage.md#local-database) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Entries and revisions](../specs/extension-storage.md#entries-and-revisions) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Delete and Undo](../specs/extension-storage.md#delete-and-undo) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Settings](../specs/extension-storage.md#settings) (step 8): Done. [Step 8](#step-8-extension-storage)
- [ ] [Schemas and recovery](../specs/extension-storage.md#schemas-and-recovery) (step 8): Partial. Issue and merge journal schema version 1 upgrades have no automated test.
- [ ] [Backup and restore](../specs/extension-storage.md#backup-and-restore) (step 17): Partial. Validation has unit tests. The device restore has no browser test. [Step 17](#step-17-backup-and-restore)
- [x] [Replication](../specs/extension-storage.md#replication) (step 9): Done. [Step 9](#step-9-extension-replication)
- [x] [Diagnostics](../specs/extension-storage.md#diagnostics) (step 9): Done. [Step 9](#step-9-extension-replication)

## Library UI

- [x] [Catalog search](../specs/library-ui.md#catalog-search) (step 15): Done. [Catalog UI](#catalog-ui)
- [x] [Popup search](../specs/library-ui.md#popup-search) (step 15): Done. [Step 15](#step-15-catalog-search-and-editing)
- [x] [Matching results to the library](../specs/library-ui.md#matching-results-to-the-library) (step 15): Done. [Step 15](#step-15-catalog-search-and-editing)
- [x] [Add and rating](../specs/library-ui.md#add-and-rating) (step 15): Done. [Catalog UI](#catalog-ui)
- [x] [Association and merge](../specs/library-ui.md#association-and-merge) (step 15): Done. [Step 15](#step-15-catalog-search-and-editing)
- [x] [Toolbar and views](../specs/library-ui.md#toolbar-and-views) (step 11): Done. [Catalog UI](#catalog-ui)
- [x] [Cards](../specs/library-ui.md#cards) (step 11): Done. [Catalog UI](#catalog-ui)
- [x] [Ordering](../specs/library-ui.md#ordering) (step 11): Done. [Catalog UI](#catalog-ui)
- [x] [Personal rating picker](../specs/library-ui.md#personal-rating-picker) (step 11): Done. [Catalog UI](#catalog-ui)
- [x] [Pagination and loading](../specs/library-ui.md#pagination-and-loading) (step 11): Done. [Catalog UI](#catalog-ui)

## Catalog

- [x] [Provider adapters and capabilities](../specs/catalog-spec.md#provider-adapters-and-capabilities) (step 12): Done. [Step 12](#step-12-catalog-services)
- [x] [Routing](../specs/catalog-spec.md#routing) (step 12): Done.
- [x] [Search contract](../specs/catalog-spec.md#search-contract) (step 12): Done.
- [x] [Pagination integrity](../specs/catalog-spec.md#pagination-integrity) (step 12): Done. Adapter fixtures in steps 13 and 14.
- [x] [Identity and cross-provider references](../specs/catalog-spec.md#identity-and-cross-provider-references) (step 12): Done.
- [x] [Installment boundaries](../specs/catalog-spec.md#installment-boundaries) (step 12): Done. Granularity stored on `CatalogItem`.
- [x] [Details and safe enrichment](../specs/catalog-spec.md#details-and-safe-enrichment) (step 12): Done.
- [x] [Normalized media metadata](../specs/catalog-spec.md#normalized-media-metadata) (step 12): Done.
- [ ] [Localization](../specs/catalog-spec.md#localization) (step 12): Partial. Original-title language unknown for Smotret.
- [ ] [Genres](../specs/catalog-spec.md#genres) (step 12): Partial. Mappings verified. No refresh adapter wired.
- [x] [Provider resilience](../specs/catalog-spec.md#provider-resilience) (step 12): Done.
- [x] [Metadata cache](../specs/catalog-spec.md#metadata-cache) (step 12): Done.
- [x] [API boundaries](../specs/catalog-spec.md#api-boundaries) (step 12): Done.
- [x] [Verification](../specs/catalog-spec.md#verification) (step 12): Done. [Step 12](#step-12-catalog-services)

## Smotret adapter

- [x] All [requirement sections](../specs/integration-smotret-anime-spec.md#requirements) (step 13): Done. [Step 13](#step-13-smotret-adapter)
- [ ] Genre filtering and original-title language (step 13): Not available. Provider does not supply them.

## Kinopoisk adapter

- [ ] [Configuration and scope](../specs/integration-kinopoisk-spec.md#configuration-and-scope) (step 14): Partial. Production entitlement of the account is unknown.
- [ ] [Genres](../specs/integration-kinopoisk-spec.md#genres) (step 14): Partial. Mappings verified. Genre filter disabled.
- [x] All other [requirement sections](../specs/integration-kinopoisk-spec.md#requirements) (step 14): Done. [Step 14](#step-14-kinopoisk-adapter)

## External list synchronization and Shikimori

- [x] [External list sync](../specs/user-list-sync-spec.md) (step 19): Done. Step 20 registers Shikimori, so the Settings card shows when `SHIKIMORI_ENABLED=true`. [Step 19](#step-19-external-list-synchronization)
- [x] [Shikimori](../specs/integration-shikimori-spec.md) (step 20): Done with a mocked provider. Not checked against the live API. [Step 20](#step-20-shikimori-synchronization)
- [x] [Library import from CSV](../specs/library-import.md) (step 21): Done on the website and in the extension. [Step 21](#step-21-library-import-from-csv)

## Evidence

Check counts are from the delivery date. CI execution on GitHub is not yet confirmed.

### Step 2: workspace

- Dependency boundaries: [checker](../scripts/check-boundaries.mjs) and [negative cases](../tests/unit/boundaries.test.ts).
- Configuration validation: [environment](../apps/api/src/config/environment.ts), [tests](../tests/unit/environment.test.ts). Invalid values are not printed.
- Test targets: [Vitest](../vitest.config.ts), [Playwright](../playwright.config.ts).
- Database: [Prisma schema](../apps/api/prisma/schema.prisma), [readiness test](../apps/api/src/health/readiness.integration.test.ts).
- Setup: [README](../README.md), [Brewfile](../Brewfile).

### Step 3: shared contracts

Typed models and domain helpers without runtime parsers. Tests cover identity matching,
semantic edits and no-ops, source normalization, language fallback and metadata
enrichment. Old-format backup compatibility was removed from scope.

### Step 4: transactional persistence

- [Mutation service](../apps/api/src/library/mutation.service.ts) with the owner library lock, bigint revisions and change feed.
- Separate `User` and `UserLibrary` tables. Account deletion cascades.
- [Integration tests](../tests/integration/library-mutations.test.ts): concurrent source, catalog and UUID duplicates, owner lock order, rollback, bigint cursors, long URLs, independent account lock, cascade deletion.

### Step 5: API foundation

- [Application](../apps/api/src/http/application.ts): `/api/v1`, CORS, 1 MiB body limit, CSRF, production HTTPS, Swagger outside production.
- [Error boundary](../apps/api/src/http/api-error.ts) and [validation pipeline](../apps/api/src/http/validation.ts).
- [Health](../apps/api/src/health/health.controller.ts) with bounded readiness.
- [HTTP tests](../apps/api/src/http/application.unit.test.ts).

### Step 6: Google authentication

- [Google adapter](../apps/api/src/auth/google.ts), [service](../apps/api/src/auth/auth.service.ts), [guard](../apps/api/src/auth/auth.guard.ts), [controller](../apps/api/src/auth/auth.controller.ts).
- [Website session](../apps/web/src/auth/session.ts) and [extension worker](../apps/extension/src/auth/worker.ts).
- Tests: [token verification](../apps/api/src/auth/google.unit.test.ts), [HTTP and PostgreSQL](../apps/api/src/auth/auth.integration.test.ts), [browser](../tests/e2e/website.spec.ts).
- Live checks: extension sign-in confirmed by the user on 6 November 2026. Website consent verified in step 6.
- The extension config endpoint returns 503 when the database is unavailable. The worker keeps credentials and does not open the login window.

### Step 7: library API

- [Library controller](../apps/api/src/library/library.controller.ts) with CRUD, snapshots, merges and catalog association.
- [Preview signer](../apps/api/src/library/preview.ts): five-minute HMAC tokens.
- [HTTP tests](../apps/api/src/library/library.integration.test.ts) and [catalog association tests](../tests/integration/catalog-association.test.ts).

### Step 8: extension storage

- [Database](../apps/extension/src/library/database.ts), [repository](../apps/extension/src/library/repository.ts), [recovery export](../apps/extension/src/library/recovery.ts).
- [Validator generation](../apps/extension/scripts/build-storage-validators.mjs) for the CSP.
- [Chromium storage tests](../tests/e2e/extension-storage.spec.ts): concurrency, stale edits, quota failure, clearing, Undo, settings, restart.
- The issue schema upgrade from version 0 to 1 has no automated test. Version 0 was not released.

### Step 9: extension replication

- Server: [replication controller](../apps/api/src/library/replication.controller.ts), [DTOs](../apps/api/src/library/replication.dto.ts).
- Client: [native adapter](../apps/extension/src/library/replication.ts), [link, account replacement and reset](../apps/extension/src/library/sync-session.ts), [conflict recovery](../apps/extension/src/library/sync-recovery.ts), [sync controls](../apps/extension/src/library/components/sync-controls/sync-controls.tsx).
- Tests: [Chromium protocol tests](../tests/e2e/extension-storage.spec.ts) and the [full-stack test](../tests/replication/extension.test.ts) (`pnpm test:replication`).
- Signing in to a different account replaces the linked device library after the download succeeds. The merge journal completes an interrupted replacement. The previous account's server data stays unchanged.
- Account replacement checks: 46 browser tests and 211 unit tests passed. Browser tests cover retry, account isolation, migration from the previous binding, restart recovery and an empty account. A focused Chrome test against the real PostgreSQL API verified download and edits for the new account. The separate full-stack Undo assertion failed after server deletion. The extension typecheck reports its existing popup translation-key error.
- Limits: sync needs an open library surface. History is kept without a time limit.
- 18 November 2026: the server stores its own snapshot for a stale client snapshot, so "Use this device copy" resolves the issue.

### Step 10: shared UI

Shared shell for website, popup and full page. Light and dark themes, English and Russian,
settings and supplied SVG icons. The draft guard was removed later: closing an editor discards its changes without a prompt. Chromium tests cover locale and theme
propagation, browser-locale start, draft retention, Escape and focus, responsive width and
200% zoom.

### Step 11: library editing

- `LibraryBrowser` reads rows, Add, Edit and Delete from the shared workspace on the website and in the extension.
- [Workspace provider](../packages/library/src/providers/workspace-provider/workspace-provider.tsx) deletes through the platform adapter and shows a shared 10-second [Undo bar](../packages/library/src/components/undo-bar/undo-bar.tsx).
- [Editor](../packages/library/src/components/workspace-editor/workspace-editor.tsx): Save only for a changed entry, a nonblank manual title, HTTP and HTTPS links only, a clearable rating, the episode total and a warning above it. A version conflict offers Reload entry or Keep my draft.
- [Cards](../packages/library/src/components/library-card/library-card.tsx) show genre icons from the genre icon font over the poster. A click applies the genre filter. The details overlay shows the description, or the comment marked as a note, or empty text, and genres and viewing links.
- The extension Settings sync card shows the account link, refresh, recovery and review controls. They were hidden. Replication stays mounted on the Library page and in the popup.
- An entry has at most one viewing link. Only a create adds it, an update can only remove it, and a merge keeps the survivor link (19 November 2026). Source reassignment is removed.
- Browser tests (18 November 2026): the website editor conflict, delete and Undo, and the extension offline add, validation, conflict, quota failure, delete, Undo and restart. All 37 browser tests pass with one worker and in parallel.
- Editor rating picker: Chromium checks passed for clearing the draft rating on the website, selecting a rating offline in the extension, and saving from cards in grid and list mode. Formatting, workspace boundaries, type checking, and all 256 unit tests passed.
- Editor layout: Chromium verified the 460 px dialog, the 16 px margins, the single-column view on a narrow screen, and the action buttons during field scroll. All 37 browser tests in the catalog, extension storage and page capture suites passed. Formatting, workspace boundaries, type checking, and all 256 unit tests passed.

### Step 12: catalog services

- Code in `apps/api/src/catalog/`: capabilities, routing, identity upserts, enrichment, continuation limits.
- [Cache](../apps/api/src/catalog/catalog-cache.service.ts) with configurable freshness and stale fallback.
- [Genre administration](../apps/api/src/catalog/catalog-genre.service.ts) behind `CATALOG_OPERATOR_ACCOUNT_IDS`.
- Seed: 112 internal genres and 135 unverified provider mappings from 117 source rows (11 November 2026). 12 conflicting Smotret claims are not seeded.
- [Genre resolver](../apps/api/src/catalog/catalog-genre-resolver.ts) replaces provider genres with mapped internal genres before a snapshot is stored, with Smotret ignore and convert rules. Smotret search now returns genres. A migration maps 31 Kinopoisk genre names (19 November 2026).
- [Integration tests](../apps/api/src/catalog/catalog-services.integration.test.ts) on PostgreSQL 17: identity across locales, concurrent upserts, reference and category conflicts, genre replacement, cache hits by locale, stale fallback, empty-page replacement, invalid pages, cache clear by provider, genre refresh, candidates, review conflicts and retry budgets. All 50 integration tests pass (19 November 2026).
- Live genre check (19 November 2026): the Kinopoisk dictionary returned 32 names. All 31 mapped names exist, and `церемония` is ignored. Smotret series pagination read 29,723 series on 61 pages and found 74 genre IDs. All have mappings.
- [Verification migration](../apps/api/prisma/migrations/20261119020000_verify_catalog_genres/migration.sql): 31 Kinopoisk and 68 Smotret mappings are verified. Kinopoisk `игра` names TV game shows, so it maps to the new `game-show` genre, not to the anime `game` theme. The migration deletes numeric Kinopoisk mappings and the mappings of ignored and converted Smotret IDs. Smotret IDs 12, 26 and 28 do not occur in public series and stay unverified. IMDb mappings stay unverified.

### Step 13: Smotret adapter

- [Adapter](../apps/api/src/catalog/smotret-anime.adapter.ts) and [fixtures](../apps/api/src/catalog/smotret-anime.adapter.unit.test.ts).
- Live checks: the `.online` and `.org` origins returned the same series IDs (12 November 2026). 37 order variants had no effect except `order=id` (16 November 2026). Root poster URLs were blocked by Chromium ORB (18 November 2026).

### Step 14: Kinopoisk adapter

- 54 Kinopoisk unit tests cover classification, references, normalization, years, genres, pagination, cursors, ordering and failures.
- Live checks: details, genre dictionary, discovery with sort and IMDb lookup returned HTTP 200 (12 November 2026). `rating-asc` timed out upstream. The other three directions returned two pages without overlap in 0.36–1.09 s (16 November 2026).
- Year 0 caused HTTP 502 on a TV search. It is now unknown (15 November 2026).

### Catalog UI

Shared `LibraryCard` and `TitleResults` for library and catalog. Website and extension
browser tests cover card dimensions, list rows, column ordering, the rating picker,
direct Add with retry, duplicate submission, separate Sort by and Order controls,
pagination during loading and skeletons (15–16 November 2026).

- Light mockup update (21 November 2026). The shared toolbar, card rating and progress rows, and full-card details overlay passed browser checks. All 41 browser tests and 203 unit tests passed. Formatting, workspace boundaries, and the library package type check passed. Workspace type checking reported a translation key type error in the extension popup.
- Card controls follow-up (21 November 2026). Browser tests verified the trash button and Undo, editing from card surfaces and the keyboard, and independent status, rating, progress, and details controls. All 41 browser tests and 203 unit tests passed. Formatting, workspace boundaries, and the library package type check passed.
- Search card follow-up (21 November 2026). Browser tests verified that search cards have no submenu, the card surface opens the editor, Add saves directly, and Find catalog title opens the association flow. All 41 browser tests and 203 unit tests passed. Formatting, workspace boundaries, and the library package type check passed.
- Expanded details poster (21 November 2026). Browser tests verified bright and dark posters, the fallback for missing or failed posters, unchanged grid geometry, and a fixed info button during scrolling. All 42 browser tests passed. Formatting, workspace boundaries, and tool type checking passed.
- Saved catalog deletion (21 November 2026). Three focused browser tests passed. They covered Delete, Undo, adding again, and retries after a failed or lost Add response. Formatting, workspace boundaries, and type checking for the library and tools passed.

### Step 15: catalog search and editing

- [Popup search](../packages/library/src/pages/popup-search-page/popup-search-page.tsx) with [category tabs](../packages/library/src/components/category-tabs/category-tabs.tsx), a title field, [popup cards](../packages/library/src/components/popup-card/popup-card.tsx) that save status, rating and progress directly, Previous and Next, and the shared search hook, messages and editor.
- [Selection](../packages/library/src/hooks/use-catalog-select.ts) opens the saved entry, or an unsaved editor with status `planned` and the catalog title. Full-page cards offer Select and edit. The popup selects a single result for a typed title one time for each query.
- [Merge link rule](../packages/contracts/src/domain/rules.ts) (`mergedLink`) on the server and in the extension: the link of the entry with the latest modified time.
- Website manual entry has no URL field. The editor shows the link only for saved entries.
- Browser tests (19 November 2026): popup search with automatic selection, Cancel, Save and the saved state; full-page Select and edit; merge preview with the kept link; local merge recovery. All 38 browser tests pass. Unit 197, contracts 12, integration 50 pass.

### Step 16: page extraction

- [Page rules](../packages/contracts/src/domain/page-rules.json): one reviewed JSON file with 12 site rules and a fallback. Revision 2 adds Netflix and Crunchyroll (20 November 2026). Rules contain host names, selectors, fixed cleanup strings and URL path patterns, never code.
- [API](../apps/api/src/page-rules/): validates the file at startup and serves `GET /api/v1/page-rules` with `ETag`, `Cache-Control` and HTTP 304.
- [Extension engine](../apps/extension/src/page/extract-page.ts) runs through `chrome.scripting.executeScript` with the `activeTab` grant. The [rule store](../apps/extension/src/page/page-rules-store.ts) uses the served rules, the last valid rules or the bundled default. Permissions: `identity`, `storage`, `activeTab`, `scripting`. The persistent example content script is removed.
- [Page tab](../packages/library/src/pages/page-capture-page/page-capture-page.tsx): editable title and category, [matching](../packages/library/src/domain/page-match.ts) by reference, then link, then exact title suggestions, reference resolution, title search, manual entry, and Retry and Search for restricted pages.
- Link move: the server (`releaseSources`) and the device repository remove the link from the other entry before the save. Restore, merge and association do not move links.
- [Check report](page-rules-check.md) (20 November 2026): 9 hosts checked live, 4 cases synthetic. The live check found a broken `kino.mail.ru` rule and redirects to `animego.me`, `ivi.tv` and `kino.mail.ru`.
- Tests (20 November 2026): page rules 17, Page tab 2 and all browser tests 57 pass. Unit 203, contracts 12, integration 50 pass. The replication catalog test passes. The replication extension test fails: Undo shows "Undo failed" after the sync acknowledges the delete. This step did not change the delete, Undo or sync code.

### Step 17: backup and restore

- [Contracts](../packages/contracts/src/domain/backup.ts): `toBackup` and `compareBackup`. `BackupPreview`, `BackupComparison` and `BackupRestoreRequest` models.
- [API](../apps/api/src/library/library.controller.ts): `GET /library/backup`, `POST /library/backup/preview` and `POST /library/backup/restore`. [DTOs](../apps/api/src/library/backup.dto.ts) reject unknown fields and old formats. [File checks](../apps/api/src/library/backup-validation.ts) report links and duplicate identities by entry index. The service checks catalog IDs and UUIDs of other owners. Backup routes have a 10 MiB body parser.
- Restore: one owner-locked transaction releases claims, publishes tombstones, then added and updated entries. The signed token binds the owner, the canonical backup digest and the revision. An empty backup needs `confirmEmpty`.
- [Extension](../apps/extension/src/library/backup.ts): AJV standalone validator from [`backup.schema.json`](../apps/extension/src/library/backup.schema.json) and device checks. The [repository](../apps/extension/src/library/repository.ts) restores through one merge journal. The merge journal schema is version 1 without a row limit.
- [Settings UI](../packages/library/src/components/backup-settings/backup-settings.tsx): Export, Restore, issue list, preview counts and conflicts, download of the current library, empty confirmation. The popup opens the full-page settings for restore. The website sends the file text to the server without parsing.
- Tests (22 November 2026): unit 210, integration 54 (4 backup tests) and browser 44 pass. Format, lint and boundaries pass. Typecheck has one existing error in `apps/extension/src/popup/components/popup/popup.tsx` that this step did not change. No browser test covers the extension restore yet.

### Step 18: public library

- [Migration](../apps/api/prisma/migrations/20261122000000_public_library_username/migration.sql): unique nullable `User.username` with a lowercase format check.
- [Account routes](../apps/api/src/auth/account.controller.ts): `GET` and `PUT /account/username`. A taken username returns 409. An empty value turns public access off.
- [Public route](../apps/api/src/library/public-library.controller.ts): anonymous `GET /public/libraries/{username}`. The [projection](../apps/api/src/library/public-library.ts) excludes hidden and deleted entries, notes, links, entry UUIDs, catalog IDs and versions. [Middleware](../apps/api/src/http/public-rate-limit.ts) adds `no-store`, `noindex` and `no-referrer` and limits each client to 60 requests for each minute.
- [Settings](../packages/library/src/components/public-library-settings/public-library-settings.tsx): username field with the privacy notice and the public address. Settings shows the section after sign-in. It uses the signed-in account independently of the device link. The worker uses `read-username` and `save-username`. `WXT_PUBLIC_WEBSITE_ORIGIN` gives the address origin.
- [Public page](../apps/web/src/public-library/components/public-library/public-library.tsx): `/u/:username` and `/u/:username/:category` in the full-page layout without Catalog. Cards are read-only. The browser test checks that the title precedes the category tabs on desktop and sits above them on mobile.
- Tests (22 November 2026): unit 211, integration 55 and browser 45 pass. Browser tests cover username loading before device linking, while a different account owns the link, and when the website library request fails. They verify that sign-out hides the section. After the Retry change, all 9 authentication and website browser tests passed, including recovery after HTTP 503. A temporary development account loaded its username in Chrome against the running API. Format, lint and boundaries pass. Typecheck has the existing error in `apps/extension/src/popup/components/popup/popup.tsx`.

### Step 19: external list synchronization

- [Migration](../apps/api/prisma/migrations/20261124000000_list_sync/migration.sql): `ListSyncConnection`, `ListSyncAuthorization`, `ListSyncItem` and `ListSyncJob`. A partial unique index permits one queued or running job for each connection. Disconnect deletes the connection, its mappings and jobs.
- [Adapter interface](../apps/api/src/list-sync/list-sync-adapter.ts): consent, refresh, revoke, complete-list read, record read, create and partial update. No delete operation. [Cipher](../apps/api/src/list-sync/credential-cipher.ts): AES-256-GCM with `PROVIDER_ENCRYPTION_KEY`, bound to the connection ID.
- [Service](../apps/api/src/list-sync/list-sync.service.ts) and [controller](../apps/api/src/list-sync/list-sync.controller.ts): overview, consent with a hashed single-use state, callback redirect to Settings, pause, resume, disconnect, export, import preview, apply and cancel.
- [Runner](../apps/api/src/list-sync/list-sync-runner.ts): `SKIP LOCKED` claims, lock renewal, retries with backoff, one token refresh, generation checks before writes, read before and verify after each export write. [Plan](../apps/api/src/list-sync/list-sync-plan.ts): export skips `hide` and null statuses, import ignores unrepresentable remote statuses and does not unhide entries.
- Matching: confirmed mapping first, then exactly one verified reference from the entry snapshot or its catalog item. Titles never match.
- [Settings card](../packages/library/src/components/list-sync-settings/list-sync-settings.tsx) with [import preview](../packages/library/src/components/list-sync-preview/list-sync-preview.tsx): Connect, Export (confirmation), Import, Pause, Resume and Disconnect, job progress, counts and skipped items. The website and the extension worker use the [route table](../packages/contracts/src/domain/list-sync-routes.ts). The worker accepts only valid provider keys.
- Tests (23 November 2026): unit 222, integration 61 (6 list sync tests with an in-memory adapter) pass. Browser tests: 45 pass. `extension-auth.spec.ts` "link confirmation starts replication…" fails with and without this change. Browser mocks now answer `/list-sync` with no providers. Format, lint and boundaries pass. Typecheck has the existing error in `apps/extension/src/popup/components/popup/popup.tsx`.
- Limits: no real provider yet. The Settings card was not checked in a browser with a provider.

### Step 20: Shikimori synchronization

- [Adapter](../apps/api/src/list-sync/shikimori-list.adapter.ts): OAuth with the `user_rates` scope, form token exchange and refresh, account check through `whoami`. A token without `user_rates` is rejected. The expiry comes from `created_at` and `expires_in`, or one day.
- List read: `GET /api/users/:id/anime_rates` with `limit=5000`, all statuses, no `censored` filter, at most 20 pages. Duplicate rates keep the newest version. A 403 list or a repeated page is an incomplete scan. Manga records and records of other owners are excluded.
- Projection: `watching` and `rewatching` become `process`, `on_hold` becomes null. Metadata keeps the rate ID, remote status, rewatches, target ID and timestamps. Notes and `text_html` are never stored.
- Writes: `POST` and `PATCH /api/v2/user_rates` with only the changed fields, explicit zeros kept. No PUT, DELETE or increment. `hide`, fractional scores and negative progress are rejected before a request. A 422 response is an unsupported value. The owner and `target_type=Anime` are checked on every rate response.
- Failures: 401 refreshes once. A 403 with `insufficient_scope` and a rejected refresh token need reconnection without a refresh (`ListSyncAuthorizationError.refreshable`). A 429 waits for Retry-After up to 30 seconds inside the call, then goes back to the job queue. Reads retry network and 5xx failures twice. Uncertain writes are not repeated: the job retry reads the list again first.
- [Rate limiter](../apps/api/src/list-sync/provider-rate-limiter.ts): 4 requests a second and 80 a minute for all accounts and instances, through `ProviderRequestSlot` rows and an advisory lock.
- Matching (owner decision, 23 November 2026): compare the `shikimori/anime` ID from the entry references or its catalog item. The verified flag does not matter, so Shikimori links on Smotret pages match. MAL numbers and titles never match. Specs: [list sync](../specs/user-list-sync-spec.md#identity-resolution), [Shikimori](../specs/integration-shikimori-spec.md), [Smotret](../specs/integration-smotret-anime-spec.md).
- Runner: export compares with the scan first and reads a record again only before a write, so a repeated export makes no record reads. Imported entries get localized titles and the episode total.
- Settings: the card shows the linked title count. [Stories](../packages/library/src/components/list-sync-settings/list-sync-settings.stories.tsx) cover not connected, finished export, running import, open preview, expired authorization and paused states.
- Tests (23 November 2026): unit 237 (15 Shikimori adapter tests), integration 62, browser 46 pass. Format, lint and boundaries pass. Typecheck has the existing error in `apps/extension/src/popup/components/popup/popup.tsx`.
- Fix (23 November 2026): imports from Shikimori failed with "service not available". Imported entries had no `userTitle` when the provider sent localized titles, so `validateEntry` rejected them. The runner reported the internal error as a provider failure. Now imported entries keep `userTitle` and the snapshot titles. A rejected entry fails only its item (`invalid-entry`). An unexpected error ends the job with `internal-error`. Job failures go to Sentry; before, the runner only wrote to the console.
- Limits: not run against the live Shikimori API. The page signal and the token response fields are not documented, so the adapter handles both forms.

### Step 21: library import from CSV

- Decisions (24 November 2026): flexible format (comma, semicolon or tab; English and Russian aliases for columns, categories and statuses); a row without a status gets `complete` with a rating and `planned` without one; website and extension.
- [Parser and plan](../packages/contracts/src/domain/library-import.ts): RFC 4180 records with physical line numbers, 10 MiB and 10,000-row limits, issue codes with line and column, reference formats and categories, duplicates by reference, link and title with year. Both platforms use it.
- API: `POST /library/import/preview` returns issues or planned rows with a token bound to the owner, the SHA-256 of the file and the library revision. `POST /library/import` checks the token, plans again and publishes each selected row in one transaction. Skipped rows are never added. The body limit is 11 MiB for these routes.
- Extension: `previewImport` and `importRows` check the account and the local revision, then write one journal document.
- Settings: Import from CSV section with file errors (20 shown), a preview dialog with Select all and Select none, possible duplicates not selected, and a result toast. The popup links to the full page.
- Sample: `my-films.csv` (352 rows, `;`, Title/Type/Rating/Year) parses with no issues: 266 films, 53 TV series, 33 anime; 166 rated rows become completed.
- Catalog data job (24 November 2026, owner decisions: exact matches only, a background server job, accounts only): `CatalogMatchJob` table with one active job for each account, [runner](../apps/api/src/catalog-match/catalog-match-runner.ts), [exact match rule](../packages/contracts/src/domain/catalog-match.ts), routes `GET/POST /library/catalog-match` and `POST /library/catalog-match/stop`, Settings section [Catalog data](../packages/library/src/components/catalog-match-settings/catalog-match-settings.tsx). An import starts the jobs for its new entries. One job for each account and provider (24 November 2026, owner request: a broken provider must not stop another provider); new entries join the active job of their provider; an invalid provider response fails only its entry; a provider timeout pauses the job. Tests: 6 match rule unit tests, 3 integration tests (link, duplicate, several matches, not found, title-only match without a year, alternative provider name, reference, Kinopoisk quota pause while anime links, invalid response, joining an active job, waiting for sync, Stop), Kinopoisk adapter tests for titles and genres without a name. A Settings item with several matches or no match opens the [resolve dialog](../packages/library/src/components/catalog-match-resolve/catalog-match-resolve.tsx); e2e test: the dialog searches the entry title and links at Save in the editor. An association without a merge applies at Save without a preview (owner request, 24 November 2026); a merge still shows the preview.
- Catalog match dialog: the [mockup](../specs/mockup-catalog-match-resolve-dialog.png) guides the fixed header, search controls and responsive result cards. All 21 website catalog tests, 3 extension catalog tests and 6 catalog match unit tests passed. The extension build, UI, library and website type checks, formatting and package boundary checks passed.
- Reduced dialog scale: Chromium verifies the 32 by 32 CSS pixel delete button, the narrow layout and the regular catalog card geometry. All 4 targeted browser tests and the format check passed.
- Tests (24 November 2026): unit 248 (10 import parser and plan tests), integration 65 (2 CSV import API tests: outcomes, selection, replication changes, no outside requests, line errors, stale previews, changed files, 10 MiB limit), browser 47 (device import with a possible duplicate and a stale preview). Format, lint and boundaries pass. Typecheck has the existing error in `apps/extension/src/popup/components/popup/popup.tsx`.

### Tooling

TypeScript checks unused locals and parameters in all workspaces (18 November 2026).

### Toast limit

The shared Undo bar keeps a maximum of three messages. New messages remove the
oldest messages. Error messages count toward the limit. Targeted ESLint, Prettier
and library TypeScript checks passed (19 November 2026).
