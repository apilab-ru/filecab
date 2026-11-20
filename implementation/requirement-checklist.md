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
- [ ] [EDIT-01–04](../specs/functionality.md#5-catalog-search-editing-and-saving) (steps 7, 8, 11): Partial. Editor, validation, conflict choices, the read-only link, and the Page tab link save, replacement and move done. Import adds the link in step 17.
- [ ] [LIB-01–07](../specs/functionality.md#6-library-browsing) (steps 10, 11): Partial. All clauses done except bulk deletion, which is optional. Release check pending.
- [ ] [DATA-01–06](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) (steps 7–9, 11): Partial. Extension and website editing done. Backup preview checks pending.
- [ ] [BACKUP-01–05](../specs/functionality.md#8-backup-and-restore) (step 17): Pending.
- [ ] [API-01–07](../specs/functionality.md#9-backend-and-shared-contracts) (steps 3, 5, 7, 9, 12–15): Partial. Backup and verification errors pending.
- [ ] [LANG-01–06](../specs/functionality.md#10-english-and-russian) (steps 3, 10–15): Partial. Interface languages done. Metadata localization partly done.
- [x] [PLAT-01–03](../specs/functionality.md#11-platform-privacy-and-usability) (steps 5, 6, 16): Done. [Step 16](#step-16-page-extraction)
- [ ] [UX-01](../specs/functionality.md#11-platform-privacy-and-usability) (steps 10, 11, 21): Partial. Keyboard, focus and zoom tests for the shell.
- [ ] [AC01–AC25](../specs/functionality.md#12-release-acceptance) (step 21): Pending. Run at release.

## Backend

- [x] [Accounts and sessions](../specs/backend.md#accounts-and-sessions) (step 6): Done. [Step 6](#step-6-google-authentication)
- [x] [Library data](../specs/backend.md#library-data) (steps 4, 7): Done. [Step 4](#step-4-transactional-persistence), [step 7](#step-7-library-api)
- [x] [Library operations](../specs/backend.md#library-operations) (step 7): Done. [Step 7](#step-7-library-api)
- [x] [Extension replication](../specs/backend.md#extension-replication) (step 9): Done. [Step 9](#step-9-extension-replication). History is kept without a time limit.
- [ ] [Unlisted read-only sharing](../specs/backend.md#unlisted-read-only-sharing) (step 18): Pending.
- [ ] [Backup and restore](../specs/backend.md#backup-and-restore) (step 17): Pending.
- [x] [Server-managed parser configuration](../specs/backend.md#server-managed-parser-configuration) (step 16): Done. [Step 16](#step-16-page-extraction)
- [x] [API foundation](../specs/backend.md#api-foundation) (step 5): Done. [Step 5](#step-5-api-foundation)

## Extension storage

- [x] [Local database](../specs/extension-storage.md#local-database) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Entries and revisions](../specs/extension-storage.md#entries-and-revisions) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Delete and Undo](../specs/extension-storage.md#delete-and-undo) (step 8): Done. [Step 8](#step-8-extension-storage)
- [x] [Settings](../specs/extension-storage.md#settings) (step 8): Done. [Step 8](#step-8-extension-storage)
- [ ] [Schemas and recovery](../specs/extension-storage.md#schemas-and-recovery) (step 8): Partial. Issue schema version 1 upgrade has no automated test.
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

- [ ] [External list sync](../specs/user-list-sync-spec.md) (step 19): Pending.
- [ ] [Shikimori](../specs/integration-shikimori-spec.md) (step 20): Pending.

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
- Client: [native adapter](../apps/extension/src/library/replication.ts), [link and reset session](../apps/extension/src/library/sync-session.ts), [conflict recovery](../apps/extension/src/library/sync-recovery.ts), [sync controls](../apps/extension/src/library/components/sync-controls/sync-controls.tsx).
- Tests: [Chromium protocol tests](../tests/e2e/extension-storage.spec.ts) and the [full-stack test](../tests/replication/extension.test.ts) (`pnpm test:replication`).
- Limits: sync needs an open library surface. History is kept without a time limit. No detach or rebind UI.
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

### Tooling

TypeScript checks unused locals and parameters in all workspaces (18 November 2026).

### Toast limit

The shared Undo bar keeps a maximum of three messages. New messages remove the
oldest messages. Error messages count toward the limit. Targeted ESLint, Prettier
and library TypeScript checks passed (19 November 2026).
