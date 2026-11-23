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
| 11   | Library browsing and editing: search, filters, sorting, pagination, editors, cards, Undo, one read-only link   |
| 12   | Catalog services: capabilities, search, reference resolution, cache, genre administration                      |
| 13   | Smotret anime catalog (no genre filter, no original-title language)                                            |
| 14   | Kinopoisk film and TV catalog (no genre mapping or filter, no episode totals, production access not confirmed) |
| 15   | Catalog search and editing: all clients, popup search, matching, merge with the latest link                    |
| 16   | Page extraction: safe parser rules, page link save and move, limited permissions, Netflix and Crunchyroll      |
| 17   | Backup and restore: export, validation, preview, confirmation, atomic replacement, offline extension restore   |
| 18   | Public library: username in Settings, read-only page at `/u/:username`, private data excluded, rate limit      |

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
