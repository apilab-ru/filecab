# Implementation plan

Delivery order. The [checklist](requirement-checklist.md) records status and evidence.
Rules are in [specs](../specs/index.md).

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

- [ ] Connect catalog search to all clients.
- [ ] Debounce, cancellation, pagination and error states.
- [ ] Open the editor when a user selects a title.
- [ ] Select a single popup result automatically, one time for each query.
- [ ] Popup search: category select, title field and compact results.
- [ ] Merge keeps the link of the entry with the latest modified time.
- [ ] Remove the URL field from website manual entry.
- [ ] Show saved entries and personal progress in results.
- [ ] Match catalog results with manual entries.
- [ ] Merge confirmation that keeps user data.

## 16. Page extraction

- [ ] Extract titles and IDs from supported sites.
- [ ] Safe parser rules without remote code.
- [ ] Parser configuration, validation and rollback.
- [ ] Manual search when extraction fails.
- [ ] Complete entry editors and manual creation.
- [ ] Confirm source URLs before saving.
- [ ] Replace and move the page link on a Page tab save (server and extension).
- [ ] Limit extension permissions.
- [ ] Test all required sites.

## 17. Backup and restore

- [ ] Export the library to JSON.
- [ ] Validate imports. Reject unsupported formats.
- [ ] Preview and conflicts before replacement.
- [ ] Confirmation before restore.
- [ ] Atomic apply and rollback.
- [ ] Offline backup and restore in the extension.

## 18. Library sharing

- [ ] Private read-only links.
- [ ] Exclude hidden entries and private data.
- [ ] Public read-only library page.
- [ ] Revocation and rotation.
- [ ] Block private API access through shared links.

## 19. External list synchronization

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

- [ ] Shikimori OAuth.
- [ ] Import anime lists and statuses.
- [ ] Match anime with catalog entries.
- [ ] Sync status, score and progress.
- [ ] Keep unsupported remote fields and private data.
- [ ] API limits, token refresh and conflicts.
- [ ] Connection settings and manual sync.
- [ ] Test sync and recovery.

## 21. Release readiness

- [ ] Verify all required features.
- [ ] Run unit, integration and browser tests.
- [ ] Test offline behavior, account isolation and recovery.
- [ ] Verify security, accessibility and responsive layouts.
- [ ] Test database migrations, backup and restore.
- [ ] Verify provider integrations.
- [ ] Update documentation and the checklist.
