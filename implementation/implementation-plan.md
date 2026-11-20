# Implementation plan

Delivery order. The [checklist](requirement-checklist.md) records status and evidence.
Rules are in [specs](../specs/index.md). Each open step lists its specs, code and tests.
Read these first. Search the code only when the list is not sufficient.

## Done

| Step | Scope                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| 1    | Requirements and checklist                                                                                     |
| 2    | Workspace: Nx, pnpm, TypeScript, PostgreSQL, Prisma, environment, tests, CI                                    |
| 3    | Shared models and domain rules                                                                                 |
| 4    | Transactional database operations and change tracking                                                          |
| 5    | API foundation: validation, CORS, CSRF, errors, health, OpenAPI                                                |
| 6    | Google authentication, sessions and account isolation                                                          |
| 7    | Library API: CRUD, snapshots, merges                                                                           |
| 8    | Offline extension storage with RxDB and Dexie                                                                  |
| 9    | Extension replication, linking, conflict recovery and reset                                                    |
| 10   | Shared UI, English and Russian, navigation, settings, preferences                                              |
| 13   | Smotret anime catalog (no genre filter, no original-title language)                                            |
| 14   | Kinopoisk film and TV catalog (no genre mapping or filter, no episode totals, production access not confirmed) |

## 11. Library browsing and editing

- [x] Search, filters, sorting and pagination.
- [x] Store user preferences.
- [x] Match the dark mockup and verify layouts at 732 px height.
- [x] Connect website and extension data to the shared screens.
- [x] Complete entry editors and manual creation.
- [x] Show cards with metadata, progress and ratings.
- [x] Add Undo and conflict dialogs.
- [x] Test website and extension workflows.
- [x] One read-only viewing link that an edit can only remove (EDIT-03, EDIT-04).
- [x] Show description, genres and viewing links (LIB-01).
- [x] Update the old browser tests to the current routes and controls.

## 12. Catalog services

- [x] Provider capabilities and catalog IDs.
- [x] Catalog search and reference resolution.
- [x] Metadata and search cache with expiry and stale data.
- [x] Genre administration and provider limits.
- [x] Complete catalog integration tests.
- [x] Verify genre mappings with providers.

## 15. Catalog search and editing

Specs: [MATCH-01–03](../specs/functionality.md#4-page-extraction-and-matching), [SEARCH and EDIT](../specs/functionality.md#5-catalog-search-editing-and-saving), [Catalog search](../specs/library-ui.md#catalog-search), [Popup search](../specs/library-ui.md#popup-search), [Matching](../specs/library-ui.md#matching-results-to-the-library), [Add and rating](../specs/library-ui.md#add-and-rating), [Association and merge](../specs/library-ui.md#association-and-merge), [Merge](../specs/backend.md#merge), [Catalog association](../specs/backend.md#catalog-association), [Search contract](../specs/catalog-spec.md#search-contract).

Code: `packages/library/src/components/catalog-result/`, `packages/library/src/components/popup-card/`, `packages/library/src/components/category-tabs/`, `packages/library/src/pages/popup-search-page/`, `packages/library/src/hooks/use-catalog-select.ts`, `packages/library/src/components/catalog-results/`, `packages/library/src/components/workspace-editor/`, `packages/library/src/pages/catalog-page/`, `packages/library/src/hooks/use-catalog-search.ts`, `packages/library/src/domain/catalog-selection.ts`, `apps/extension/src/popup/`, `apps/web/src/online-library/`, `apps/api/src/library/proposals.ts`, `apps/api/src/library/mutation.service.ts`, `apps/extension/src/library/repository.ts`, `apps/extension/src/library/merge-recovery.ts`.

Tests: `tests/e2e/catalog.spec.ts`, `tests/e2e/catalog-extension.spec.ts`, `tests/integration/catalog-association.test.ts`.

- [x] Connect catalog search to all clients.
- [x] Debounce, cancellation, pagination and error states.
- [x] Open the editor when a user selects a title.
- [x] Select a single popup result automatically, one time for each query.
- [x] Popup search: category select, title field and compact results.
- [x] Merge keeps the link of the entry with the latest modified time.
- [x] Remove the URL field from website manual entry.
- [x] Show saved entries and personal progress in results.
- [x] Match catalog results with manual entries.
- [x] Merge confirmation that keeps user data.

## 16. Page extraction

Specs: [PAGE-01–04 and MATCH-01–03](../specs/functionality.md#4-page-extraction-and-matching), [EDIT-03–04](../specs/functionality.md#5-catalog-search-editing-and-saving), [Popup routes](../specs/functionality.md#23-popup-routes), [PLAT-01–03](../specs/functionality.md#11-platform-privacy-and-usability), [Parser configuration](../specs/backend.md#server-managed-parser-configuration), [Viewing sources](../specs/backend.md#viewing-sources), [Source normalization](../specs/domain-contract.md#viewing-source-normalization), [Entries and revisions](../specs/extension-storage.md#entries-and-revisions).

Code: `packages/contracts/src/domain/page-rules.json`, `packages/contracts/src/models/page-rules.ts`, `apps/extension/src/page/`, `apps/api/src/page-rules/`, `packages/library/src/pages/page-capture-page/`, `packages/library/src/domain/page-match.ts`, `apps/extension/src/popup/`, `apps/extension/src/library/repository.ts`, `apps/api/src/library/mutation.service.ts`.

Tests: `tests/page-rules/page-rules.spec.ts` (live, `pnpm test:page-rules`), `tests/e2e/page-capture.spec.ts`, `apps/api/src/page-rules/served-page-rules.unit.test.ts`, `apps/api/src/library/library.integration.test.ts`, `tests/e2e/extension-storage.spec.ts`.

- [x] Extract titles and IDs from supported sites.
- [x] Safe parser rules without remote code.
- [x] Parser configuration, validation and rollback.
- [x] Manual search when extraction fails.
- [x] Complete entry editors and manual creation.
- [x] Save the page URL with every Page tab save, without a confirmation (owner decision).
- [x] Replace and move the page link on a Page tab save (server and extension).
- [x] Limit extension permissions.
- [x] Netflix and Crunchyroll rules (revision 2).
- [x] Test all required sites. Live checks of `kinopoisk.ru`, `hd.kinopoisk.ru`, `jut.su`, `crunchyroll.com` and a `kino.mail.ru` series page are open. See the [check report](page-rules-check.md).

## 17. Backup and restore

Specs: [BACKUP-01–05](../specs/functionality.md#8-backup-and-restore), [Backup and restore](../specs/backend.md#backup-and-restore), [Schemas and recovery](../specs/extension-storage.md#schemas-and-recovery), [Domain contract](../specs/domain-contract.md).

Code: `apps/api/src/library/`, `apps/extension/src/library/recovery.ts`, `apps/extension/src/library/database.ts`, `packages/library/src/pages/settings-page/`. No backup code exists yet.

- [ ] Export the library to JSON.
- [ ] Validate imports. Reject unsupported formats.
- [ ] Preview and conflicts before replacement.
- [ ] Confirmation before restore.
- [ ] Atomic apply and rollback.
- [ ] Offline backup and restore in the extension.

## 18. Library sharing

Specs: [Unlisted read-only sharing](../specs/backend.md#unlisted-read-only-sharing).

Code: `apps/api/src/library/`, `apps/api/src/auth/`, `apps/web/src/`. No sharing code exists yet.

- [ ] Private read-only links.
- [ ] Exclude hidden entries and private data.
- [ ] Public read-only library page.
- [ ] Revocation and rotation.
- [ ] Block private API access through shared links.

## 19. External list synchronization

Specs: [External list sync](../specs/user-list-sync-spec.md).

Code: `apps/api/src/config/environment.ts`. No sync code exists yet.

- [ ] Provider connections and secure token storage.
- [ ] Match local and remote entries.
- [ ] Preview imports and resolve duplicates.
- [ ] Two-way sync of selected fields.
- [ ] Detect and resolve conflicts.
- [ ] Background jobs, retries and manual sync.
- [ ] Prevent accidental deletions and repeated writes.
- [ ] Pause, resume and disconnect.
- [ ] Progress and error display.

## 20. Shikimori synchronization

Specs: [Shikimori](../specs/integration-shikimori-spec.md), [External list sync](../specs/user-list-sync-spec.md).

Code: `apps/api/src/config/environment.ts` (`SHIKIMORI_*`). No adapter code exists yet.

- [ ] Shikimori OAuth.
- [ ] Import anime lists and statuses.
- [ ] Match anime with catalog entries.
- [ ] Sync status, score and progress.
- [ ] Keep unsupported remote fields and private data.
- [ ] API limits, token refresh and conflicts.
- [ ] Connection settings and manual sync.
- [ ] Test sync and recovery.

## 21. Release readiness

Specs: [Release acceptance](../specs/functionality.md#12-release-acceptance) and the Verification section of each feature spec.

Code: `tests/`, `README.md`, `.github/`.

- [ ] Verify all required features.
- [ ] Run unit, integration and browser tests.
- [ ] Test offline behavior, account isolation and recovery.
- [ ] Verify security, accessibility and responsive layouts.
- [ ] Test database migrations, backup and restore.
- [ ] Verify provider integrations.
- [ ] Update documentation and the checklist.
