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

Code: `apps/api/src/list-sync/` (adapter interface, service, runner, controller), `packages/contracts/src/models/list-sync.ts`, `packages/contracts/src/domain/list-sync-routes.ts`, `packages/library/src/components/list-sync-settings/`, `packages/library/src/components/list-sync-preview/`, `apps/web/src/auth/list-sync-repository.ts`, `apps/extension/src/auth/list-sync-repository.ts`.

Tests: `apps/api/src/list-sync/list-sync.integration.test.ts` (in-memory adapter), `list-sync-plan.unit.test.ts`, `credential-cipher.unit.test.ts`, `apps/extension/src/auth/worker.unit.test.ts`.

- [x] Provider connections and secure token storage.
- [x] Match local and remote entries.
- [x] Export: Filecab values replace remote values, with a confirmation and a result report.
- [x] Import: preview additions and changed fields, apply the selected changes.
- [x] Separate Export and Import buttons.
- [x] Durable manual jobs, retries and one job for each connection.
- [x] Prevent deletions and repeated writes.
- [x] Pause, resume and disconnect.
- [x] Progress and error display.

## 20. Shikimori synchronization

Specs: [Shikimori](../specs/integration-shikimori-spec.md), [External list sync](../specs/user-list-sync-spec.md).

Code: `apps/api/src/list-sync/shikimori-list.adapter.ts`, `shikimori-list.dto.ts`, `provider-rate-limiter.ts`, `apps/api/src/app.module.ts` (adapter registration), `apps/api/src/config/environment.ts` (`SHIKIMORI_*`), `apps/api/prisma/migrations/20261125000000_provider_request_slot/`.

Tests: `apps/api/src/list-sync/shikimori-list.adapter.unit.test.ts`, `list-sync.integration.test.ts` (ID matching, shared rate limit), `packages/library/src/components/list-sync-settings/list-sync-settings.stories.tsx`.

- [x] Shikimori OAuth.
- [x] Import anime lists and statuses.
- [x] Match anime with catalog entries.
- [x] Export and import status, score and progress.
- [x] Keep unsupported remote fields and private data.
- [x] API limits and token refresh.
- [x] Connection settings with Export and Import buttons.
- [x] Test export, import and recovery.

## 21. Library import from CSV

Specs: [Library import](../specs/library-import.md).

Code: `packages/contracts/src/domain/library-import.ts` (parser, plan, new entry), `apps/api/src/library/mutation.service.ts` (`previewImport`, `importLibrary`), `library-import.dto.ts`, `library.controller.ts`, `apps/web/src/online-library/workspace-repository.ts`, `apps/extension/src/library/repository.ts` (`previewImport`, `importRows`), `packages/library/src/components/library-import-settings/`.

Tests: `packages/contracts/src/domain/library-import.unit.test.ts`, `apps/api/src/library/library.integration.test.ts` (CSV import), `tests/e2e/extension-storage.spec.ts` (device import), `library-import-settings.stories.tsx`.

- [x] CSV parser and validation of the documented columns and references, with line numbers in errors.
- [x] Preview: rows to add, skip and possible duplicates, with reasons and row selection.
- [x] Confirmation bound to the owner, file digest and library revision.
- [x] Add-only transaction through the common mutation service, with replication changes.
- [x] Import control in Settings, next to backup and restore.
- [x] Test format and reference errors, skipped rows, possible duplicates, cancel, stale previews and no provider requests.

## 22. Release readiness

Specs: [Release acceptance](../specs/functionality.md#12-release-acceptance) and the Verification section of each feature spec.

Code: `tests/`, `README.md`, `.github/`.

- [ ] Verify all required features.
- [ ] Run unit, integration and browser tests.
- [ ] Test offline behavior, account isolation and recovery.
- [ ] Verify security, accessibility and responsive layouts.
- [ ] Test database migrations, backup and restore.
- [ ] Verify provider integrations.
- [ ] Update documentation and the checklist.
