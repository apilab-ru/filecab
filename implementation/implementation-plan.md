# FileCab — Implementation Plan

## 1. Define requirements

- [x] Align product and technical specifications.
- [x] Define data, authentication, synchronization, and backup rules.
- [x] Create the requirement checklist.

## 2. Set up the workspace

- [x] Configure Nx, pnpm, and TypeScript.
- [x] Configure PostgreSQL, Prisma, and migrations.
- [x] Add environment configuration.
- [x] Set up tests, builds, and CI.

## 3. Define shared models

- [x] Create shared models for entries, catalogs, sources, and synchronization.
- [x] Define IDs, statuses, ratings, and progress.
- [x] Add validation and data helpers.
- [x] Support multiple languages and missing metadata.

## 4. Implement database operations

- [x] Create database models and constraints.
- [x] Implement atomic create, update, delete, and restore operations.
- [x] Handle duplicate entries and version conflicts.
- [x] Track changes for synchronization.

## 5. Implement the API

- [x] Add API endpoints and request validation.
- [x] Configure CORS, CSRF, and secure error handling.
- [x] Add health checks and OpenAPI documentation.
- [x] Protect credentials and sensitive data.

## 6. Implement Google authentication

- [x] Add Google sign-in for the website and extension.
- [x] Implement secure sessions and token refresh.
- [x] Support logout and session revocation.
- [x] Isolate data between accounts.
- [x] Verify live website Google consent.

## 7. Implement the library API

- [x] Add entry CRUD and complete library snapshots.
- [x] Include hidden entries in private snapshots.
- [x] Support entry merges and source reassignment.
- [x] Handle concurrent updates.

## 8. Implement offline extension storage

- [x] Set up RxDB with Dexie.
- [x] Support offline CRUD and settings.
- [x] Keep data after browser restart.
- [x] Implement Undo and local recovery.

## 9. Implement library synchronization

- [x] Implement RxDB pull/push replication.
- [x] Track changes and deletions.
- [x] Preserve local changes after failures and conflicts.
- [x] Sync on open, edit, reconnect, and manual refresh.
- [x] Show synchronization status and errors.
- [x] Implement safe reset recovery.
- [x] Require confirmation before linking a local library to an account.
- [x] Prevent data transfer between accounts.

## 10. Implement shared UI

- [x] Create shared UI components and themes.
- [x] Support English and Russian.
- [x] Add navigation for anime, films, and TV.
- [x] Add Library, Catalog, and Settings views.
- [x] Save user preferences.
- [x] Support responsive layouts and draft protection.

## 11. Complete library browsing and editing

- [ ] Connect website and extension data to shared screens.
- [ ] Implement complete entry editors and manual creation.
- [ ] Display cards with metadata, progress, and ratings.
- [x] Add search, filters, sorting, and pagination.
- [x] Save user preferences.
- [ ] Add Undo and conflict dialogs.
- [x] Match the dark mockup and verify layouts at 732px height.
- [ ] Test website and extension workflows.

## 12. Implement catalog services

- [x] Define provider capabilities and catalog IDs.
- [x] Implement catalog search and reference resolution.
- [x] Add metadata and search caching.
- [x] Support cache expiration and stale data.
- [x] Add genre management and provider limits.
- [ ] Complete catalog integration tests.
- [ ] Verify genre mappings with providers.

## 13. Implement Smotret anime catalog

- [x] Verify the public API.
- [x] Implement anime search, details, and reference lookup.
- [x] Support filters and pagination.
- [x] Normalize titles, posters, ratings, and episodes.
- [x] Test missing data and provider failures.

**Limitations:** Genre filtering and original-title language are unavailable.

## 14. Implement Kinopoisk film/TV catalog

- [x] Implement film/TV classification.
- [x] Add search, filters, sorting, and pagination.
- [x] Normalize titles, genres, ratings, and posters.
- [x] Verify details, identifiers, and API access.
- [x] Handle missing metadata and season data.
- [x] Pass adapter tests and typecheck.

**Limitations:** Canonical genre mapping, genre filtering, and episode totals are unavailable. Production API access is not confirmed.

## 15. Connect catalog search and editing

- [ ] Connect catalog search to all clients.
- [ ] Add debounce, cancellation, pagination, and error states.
- [ ] Open the editor when a user selects a title.
- [ ] Show saved entries and personal progress in search results.
- [ ] Match catalog results with manual entries.
- [ ] Add merge confirmation and preserve user data.

## 16. Implement page extraction

- [ ] Extract titles and IDs from supported websites.
- [ ] Use safe parser rules without remote code execution.
- [ ] Add parser configuration, validation, and rollback.
- [ ] Support manual search when extraction fails.
- [ ] Confirm source URLs before saving.
- [ ] Limit extension permissions.
- [ ] Test all required websites.

## 17. Implement backup and restore

- [ ] Export the current library to JSON.
- [ ] Validate imported files and reject unsupported formats.
- [ ] Show a preview and conflicts before replacement.
- [ ] Require confirmation before restore.
- [ ] Apply changes atomically and support rollback.
- [ ] Support offline backup and restore in the extension.

## 18. Implement library sharing

- [ ] Generate private read-only links.
- [ ] Exclude hidden entries and private data.
- [ ] Add a public read-only library page.
- [ ] Support link revocation and rotation.
- [ ] Prevent access to private APIs through shared links.

## 19. Implement external list synchronization

- [ ] Add provider connections and secure token storage.
- [ ] Match local entries with remote entries.
- [ ] Preview imports and resolve duplicates.
- [ ] Sync selected fields in both directions.
- [ ] Detect and resolve conflicts.
- [ ] Add background jobs, retries, and manual sync.
- [ ] Prevent accidental deletions and repeated writes.
- [ ] Support pause, resume, and disconnect.
- [ ] Show synchronization progress and errors.

## 20. Implement Shikimori synchronization

- [ ] Add Shikimori OAuth authentication.
- [ ] Import anime lists and statuses.
- [ ] Match anime with catalog entries.
- [ ] Sync status, score, and progress.
- [ ] Preserve unsupported remote fields and private data.
- [ ] Handle API limits, token refresh, and conflicts.
- [ ] Add connection settings and manual sync.
- [ ] Test synchronization and recovery.

## 21. Verify release readiness

- [ ] Verify all required features.
- [ ] Run unit, integration, and browser tests.
- [ ] Test offline behavior, account isolation, and recovery.
- [ ] Verify security, accessibility, and responsive layouts.
- [ ] Test database migrations, backup, and restore.
- [ ] Verify external provider integrations.
- [ ] Update documentation and the requirement checklist.
