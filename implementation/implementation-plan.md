# Filecab — Implementation Plan

Status: execution baseline, 2 November 2026. Steps 1–8 are delivered. Extension Google sign-in is user-confirmed; separate live website consent verification remains pending. Steps 9–21 are pending. Checkboxes indicate completed delivery work, not unverified implementation claims.

## Baseline and scope

The initial workspace contained React/Vite, WXT, and NestJS scaffolds and placeholder shared packages. Steps 1–5 now provide shared contracts, transactional PostgreSQL persistence and the documented API foundation. Google authentication, session clients and the owner-library API are implemented. Extension Google sign-in is user-confirmed; separate live website consent verification remains pending. Extension local persistence and a basic manual editor are delivered; shared library UI, catalog providers, replication, and external list synchronization remain to be implemented. Old-data migration and old route compatibility are out of scope.

This plan covers required behavior in [Functionality](../specs/functionality.md), [Backend](../specs/backend.md), [Stack](../specs/stack.md), [Catalog](../specs/catalog-spec.md), [User List Synchronization](../specs/user-list-sync-spec.md), and all three integration specifications. [Plans](../specs/plans.md) is a separate future-feature backlog and is excluded from this implementation plan. Section 13 of Functionality contains recommendations rather than additional release requirements.

Implement in the order below. Each step must update its affected specifications first, deliver a reviewable code change, and record requirement coverage and verification results. Do not mark a capability complete from scaffolding, TypeScript compilation, or fixtures alone.

## 1. Resolve specification conflicts and establish traceability

- [x] Create the [Requirement Delivery Checklist](requirement-checklist.md), covering all 63 current product requirement IDs, AC01–AC25, every named backend/catalog/sync/provider requirement, and stack constraints. Implementation evidence remains pending.
- [x] Align website persistence: extension-only offline editing; website uses online TanStack Query and preserves unsaved input after network failure.
- [x] Align progress validation: accept nonnegative safe integers, warn above known totals, preserve historical values, and never automatically change status.
- [x] Align provider roles: Smotret supplies anime catalog data, Kinopoisk supplies films/TV, and Shikimori supplies optional owner-connected personal-list synchronization only.
- [x] Align multiple viewing-source associations and preserve all sources in current-format backups.
- [x] Align required scope: accounts, replication, sharing, declarative parser configuration, metadata caches, and personal-list synchronization are delivery capabilities. Future-feature plans and optional recommendations remain excluded.
- [x] Define URL normalization, current-format backup, clearing semantics, session lifetimes, replication batch behavior, provider defaults, and installment boundaries in [Baseline Decisions](baseline-decisions.md).

Exit satisfied: Functionality, Backend, Catalog, and Stack share the recorded baseline. This step changes specifications only; runtime capabilities and live provider verification remain pending in the checklist.

## 2. Establish workspace infrastructure and checks

Depends on step 1.

- [x] Keep Nx/pnpm and strict TypeScript; enforce workspace boundaries so clients cannot import Prisma, backend DTO implementations, or secrets.
- [x] Configure appropriate unit/integration runners and later Playwright targets; add CI targets for typecheck, build, contract checks, database integration tests, and E2E workflows.
- [x] Add validated environment configuration and synthetic example files for database, origins, Google, provider settings, encryption, and session keys.
- [x] Add PostgreSQL 17/Prisma setup, migrations, development database instructions, and the documented Homebrew scripts. Keep development and production storage separate.

Exit satisfied: frozen-lockfile install, boundary checks, 35 unit tests, one workspace contract check, one PostgreSQL 17 migration/client integration test, one Chromium smoke test, all six application/package builds, and seven Nx typecheck targets pass locally. Prisma schema validation, client generation, deployment migration, and migration status pass against an isolated PostgreSQL 17.11 cluster. CI is configured but has not yet run on GitHub. See [step 2 evidence](requirement-checklist.md#workspace-infrastructure-step-2).

## 3. Define shared domain contracts and rules

Depends on steps 1–2. Covers MODEL-01–08, API-01/04–06, LANG-03–06.

- [x] Replace placeholder contracts with versioned entry, snapshot, source, catalog, genre, locale/provenance, error, conflict, backup, and replication models.
- [x] Separate immutable entry UUID, backend catalog identity, provider namespace/entity/string ID, and remote list-record identity. Preserve string IDs and leading zeros.
- [x] Define categories, formats, statuses, nullable metadata, personal/provider ratings, progress, translations, timestamps, deletion state, and safe server versions/cursors.
- [x] Implement reusable domain helpers, title/description fallback, semantic-change detection, conservative URL normalization, and deterministic matching helpers.
- [x] Keep framework-independent rules shareable while using class-validator/class-transformer for server request validation. Use typed client models directly without shared runtime parsers.

Exit satisfied: plain TypeScript v1 models and domain helpers replace the placeholder. Shared rules and backend class-validator/class-transformer request validation are implemented without Zod. Meaningful tests cover identity collisions, nullable metadata, exact user-text preservation, no-op behavior, language fallback, safe enrichment. See [step 3 evidence](requirement-checklist.md#shared-domain-contracts-step-3). Persistence, endpoint wiring, native RxDB protocol adaptation and backup restore remain in their planned later steps.

## 4. Create database models and transactional mutation services

Depends on step 3. Covers Backend identity, sources, CRUD, and commit-safe tracking.

- [x] Model users, sessions, entries, source associations, catalog records/references/translations, genres/mappings, owner revisions, change history, and tombstones.
- [x] Enforce owner/catalog and owner/normalized-source uniqueness for active entries, namespace-aware catalog uniqueness, and concurrency-safe upserts.
- [x] Build one owner-scoped mutation service for create/update/delete/restore, source reassignment, merges, and later imports/replication.
- [x] Apply expected-version checks and atomic source changes; use server timestamps and preserve creation time. Define restore behavior under new uniqueness conflicts.
- [x] Publish changes in the same transaction using per-owner serialization/counters held through commit, or a demonstrated equivalent. Serialize cursor values safely across JavaScript boundaries.

Exit satisfied: PostgreSQL 17 integration tests prove ownership isolation, concurrent catalog/source/UUID duplicates, lost-update protection, atomic reassignment, failed-merge and restore rollback, owner locking through commit, and exact bigint revisions. See [step 4 evidence](requirement-checklist.md#transactional-persistence-step-4). HTTP endpoints, authentication, replication transport and import orchestration remain in their later steps.

## 5. Implement API foundation and OpenAPI

Depends on steps 3–4.

- [x] Add versioned controllers, request bounds/allowlists, structured errors with correlation IDs, safe diagnostics, configured CORS, cookie CSRF controls, and production HTTPS configuration.
- [x] Add database readiness and provider-independent liveness; redact credentials, codes, notes, page content, and share tokens from logs.
- [x] Generate Swagger UI at `/api/docs` and JSON at `/api/docs-json`; document bearer authentication, cookies/CSRF, nullable fields, errors, and synthetic examples. Disable or operator-protect both in production.
- [x] Add OpenAPI coverage alongside each subsequent endpoint, including anonymous versus authenticated access.

Exit satisfied: HTTP tests verify body/DTO bounds, allowlists, correlation IDs, safe errors/diagnostics, CORS, cookie CSRF, production HTTPS and documentation exclusion. PostgreSQL integration and compiled-runtime smoke checks verify readiness and actual documented routes. See [step 5 evidence](requirement-checklist.md#api-foundation-and-openapi-step-5). New endpoint coverage remains an ongoing rule for later steps.

## 6. Implement Google authentication and account isolation

Depends on steps 4–5.

- [x] Implement Google authorization-code validation, subject-based identity, state/nonce handling, allowlisted callbacks, and website secure HttpOnly sessions.
- [x] Implement extension `identity.launchWebAuthFlow` with a short-lived, single-use, attempt-bound exchange code; keep reusable credentials out of redirect URLs and content scripts.
- [x] Add account lookup, access expiry, serialized refresh/rotation, opaque refresh-token hashes, replay detection, logout, and all-session revocation.
- [x] Define privileged extension credential storage and clear website account caches on logout/account switch.

Automated exit satisfied: signed-token, HTTP/PostgreSQL, client and Chromium tests cover invalid issuer/audience/state/nonce/expiry, exchange replay, concurrent refresh, revoked sessions, CSRF, cross-account access and cross-tab cache clearing. The compiled API has database readiness and reaches Google’s sign-in screen using the configured OAuth client. See [step 6 evidence](requirement-checklist.md#google-authentication-and-account-isolation-step-6). The user subsequently confirmed successful extension sign-in after origin configuration was corrected. Separate live website consent and session-control verification remains pending; automated fixtures are recorded separately.

## 7. Deliver owner-library API and complete snapshots

Depends on steps 4–6.

- [x] Expose create/read/update/delete/restore and complete owner-library retrieval through the common mutation service.
- [x] Return hidden entries in the private snapshot; exclude tombstones there and deliver them through replication.
- [x] Keep display search/filter/sort/pagination out of the owner snapshot API; expose revision information for safe bulk replacement.
- [x] Implement version-checked explicit merge and source-reassignment previews, preserving the selected surviving identity and publishing removed identities as tombstones.

Exit satisfied: authenticated manual CRUD works with catalog providers disabled. Complete snapshots are consistent under concurrent writes and include hidden entries while excluding tombstones. Version-bound merge/source previews apply atomically through the common owner-scoped service. See [step 7 evidence](requirement-checklist.md#owner-library-api-and-complete-snapshots-step-7). Replication delivery of tombstones remains step 9; editing interfaces remain step 11.

## 8. Build extension offline persistence

Depends on steps 2–3. Can proceed alongside steps 4–7 after contracts stabilize.

- [x] Add RxDB with the free Dexie adapter, schema validation/migrations, one fixed-name device-local database, and reactive local repositories.
- [x] Validate multi-instance access from popup/full page and the chosen worker coordination approach under MV3 suspension. Do not depend on an always-running worker or worker localStorage.
- [x] Support durable manual CRUD, sources, snapshots, settings, local revisions, tombstones, and 10-second Undo. Report success only after durable persistence.
- [x] Preserve raw recoverable data after read/corruption failures; distinguish a missing database from a failed read.

Exit satisfied: real unpacked Chromium tests verify offline CRUD across popup/full-page surfaces, worker termination (Chrome reports STOPPED before and after local writes), browser restart, revision conflicts, ten-second Undo and recovery without resetting damaged records. The device library and category/mode preferences remain durable across authentication changes. See [step 8 evidence](requirement-checklist.md#extension-offline-persistence-step-8). Replication/guest adoption remain step 9; shared library navigation, filtering and full editing interfaces remain steps 10–11.

## 9. Implement extension-to-Filecab replication

Depends on steps 6–8.

- [ ] Implement the installed RxDB protocol's checkpoint pull and assumed-master-state push, deterministic owner-scoped batches, deletion representation, and documented invalid-write/conflict behavior.
- [ ] Use RxDB replication metadata rather than a second client mutation outbox. Cover all server mutation paths with the transactional change feed.
- [ ] Keep the server document on stale-version conflicts while durably retaining rejected local intent for visible, deliberate reapplication.
- [ ] Trigger synchronization on opening, edits, reconnect, and manual refresh; isolate account/schema state and show pending/failure/conflict status.
- [ ] Retain tombstones/history for at least 90 days; implement `SYNC_RESET_REQUIRED` recovery that preserves pending intent and prevents resurrection.
- [ ] Add explicit device-library linking/adoption preview and confirmation with retry-safe imports. Keep the local library visible on login/logout; never silently upload it, replace it or send one account’s pending changes to another account.

Exit: integration tests exercise concurrent commits, retry/restart, delete/restore, mixed batches, account switching, guest adoption, stale checkpoints, and conflict recovery.

## 10. Build shared UI, localization, and navigation

Depends on steps 2–3; connect data adapters after steps 7–9.

- [ ] Wrap Base UI primitives in `packages/ui`; add shared CSS-variable tokens and SCSS/BEM styling with responsive rules inside their selectors and class-based styling.
- [ ] Keep UI independent of authentication, RxDB, and TanStack Query. Put shared screens/domain behavior in `packages/library` behind separate client adapters.
- [ ] Implement English/Russian messages, accessible names, plural forms, locale formatting, browser-language initialization, explicit persisted selection, and cross-surface updates without losing drafts.
- [ ] Add anime/films/TV routes, Library/Catalog modes, popup Page/Search modes, settings, safe unknown-route fallback, and controllable unsaved-navigation prompts.
- [ ] Preserve non-sensitive website filters in the URL and persist category/mode preferences independently of library replacement.

Exit: keyboard navigation, focus/overlay behavior, popup layout, 200% zoom, and en/ru switching work across the three owner surfaces.

## 11. Deliver manual editing and library browsing

Depends on steps 7–10. Covers NAV, EDIT, LIB, DATA and AC02/06–12/16–17/21/24–25.

- [ ] Connect website TanStack Query complete snapshots/mutations and extension RxDB repositories to shared screens; website failures preserve drafts and require retry.
- [ ] Implement manual creation and consistent editors with status, clearable rating, progress, notes, multiple sources, unknown totals, dirty-state retention, and duplicate-submit prevention.
- [ ] Add cards with truthful metadata/comment fallback, poster failures, status/progress/rating, genres, and safe links.
- [ ] Implement local text search across all available translations and private notes; exact OR/AND/exclusion semantics; hidden defaults; locale-aware stable sorts with unknown values last.
- [ ] Filter then sort then paginate the complete owner dataset. Support sizes 12/20/50/100, matching totals, reset/clamp behavior, working genre clicks, persisted preferences, and 10-second Undo.
- [ ] Provide conflict/reload/explicit overwrite and source-reassignment dialogs with version revalidation.

Exit: manual library workflows work without catalog providers; different-entry edits survive concurrent interfaces and same-entry conflicts remain recoverable.

## 12. Implement catalog core, cache, and genre administration

Depends on steps 3–5 and the provider-role decision in step 1.

- [ ] Add capability discovery, explicit category defaults/provider selection, normalized search/details, and separate internal-ID versus provider-reference resolution operations.
- [ ] Persist stable catalog identities, verified crosswalk provenance, translations, nullable metadata, genre IDs/mappings, and declared versus available episode counts. Never merge installments by title or numerical equality.
- [ ] Implement bounded continuation/lookahead and consumed-upstream position tracking; invalidate cursor mappings when request identity changes. Omit inexact totals and return explicit limitations when continuation cannot be established.
- [ ] Add provider/locale/query/filter/order/page/schema-aware metadata caches, freshness/provenance, explicit stale fallback, and safe enrichment that cannot overwrite user fields or erase known metadata from missing fields.
- [ ] Add upstream validation, response-size/time/concurrency/retry budgets, throttling/Retry-After, and distinct structured provider errors.
- [ ] Implement protected genre refresh with verified mappings and preserved unknown source labels; public GET must not refresh data.

Exit: deterministic tests cover identity/upsert races, pagination, locale retention, mapping conflicts, provider failure versus valid empty results, and cache isolation from private data.

## 13. Implement Smotret anime catalog adapter

Depends on step 12. Covers all requirements in integration-smotret-anime-spec.md.

- [ ] Verify and document the selected secure mirror, usage conditions, API schema, credentials, request parameters, limits, and capabilities before enabling it.
- [ ] Implement title search, series detail, documented filters/reference lookup, offset mapping, bounded pagination, and persistence before returning stable internal identity.
- [ ] Preserve Smotret/MAL/AniDB namespace separation; establish Shikimori references only through verified mappings.
- [ ] Normalize language/source-aware titles/descriptions, posters, genres, scores, formats, and episode coverage without equating available episode arrays with declared totals.
- [ ] Add fixtures for empty/missing arrays, incomplete episodes, unmapped genres, absent cross-provider IDs, throttling/denial, and continuation.

Exit: verified operations are advertised accurately. Unverified/unavailable operations stay disabled with actionable capability feedback; fixtures alone do not establish live availability.

## 14. Implement Kinopoisk film/TV catalog adapter

Depends on step 12. Covers all requirements in integration-kinopoisk-spec.md.

- [ ] Verify the selected API version/origin, authentication, usage conditions, and separate text-search/discovery/detail/genre contracts before activation.
- [ ] Keep adapter key `kinopoisk-dev` separate from canonical Kinopoisk references; separate numeric title IDs, HD IDs, IMDb strings, and scoped TMDB IDs.
- [ ] Enforce films = movie/cartoon and TV = tv-series/animated-series, with explicit handling of anime/unknown types and verified `isSeries` consistency checks.
- [ ] Advertise filters/order per operation; implement continuation-aware category filtering or explicitly reject unsupported combinations. Never forward inaccurate provider totals after filtering.
- [ ] Normalize nullable posters, attributed provider scores, truthful title languages, canonical catalog links, genres, and episode totals only with known complete coverage.
- [ ] Test reference scope, text/filter combinations, classification, post-filter pagination, locale fallback, credentials, quotas, and incomplete season data.

Exit: film and TV results are distinct and credentials remain server-side; manual library operations survive adapter failure.

## 15. Connect catalog search, add, and reconciliation interfaces

Depends on steps 10–14.

- [ ] Implement 300 ms debouncing, stale-response cancellation/guards, category/provider/locale pagination reset, supported capability controls, and blank-query rules.
- [ ] Separate loading, success, empty, offline, and service-error states with retry and preserved input. Use actual `hasMore`; omit Last/exact page counts without total.
- [ ] Connect Add/Edit on popup, full page, and website; selecting a result opens an unsaved editor and repeated verified identities open existing entries.
- [ ] Decorate saved results with personal status/progress/rating. Keep owner-library filters separate from provider filters.
- [ ] Support manual-to-catalog reconciliation, category/identity conflicts, explicit merge preview, and preservation of all user fields and entry UUIDs.

Exit: AC03–05/19–20/22 pass with fixtures and available verified providers; provider failures never prevent manual saves.

## 16. Implement page extraction and parser configuration

Depends on steps 3, 5, 10–12, and 15.

- [ ] Build an extension-bundled declarative extraction engine with exact hostname handling, approved selectors/attributes, and fixed fallback operations; never evaluate remote code.
- [ ] Add operator publication, schema/engine compatibility, revisions, validators, audit history, fixture checks, and rollback on the backend; cache last valid configuration and bundle offline defaults.
- [ ] Implement user-initiated active-tab extraction, HTTP(S)/restricted-page checks, exact `mail.yandex.ru` exclusion, editable generic heading/title fallback, and required category selection when unknown.
- [ ] Add fixtures for every PAGE-03 host: animego.org, animesss.com, smotret-anime.online, shikimori.io, dreamerscast.com, jut.su, kino.mail.ru, afisha.mail.ru, ivi.ru, kinopoisk.ru, hd.kinopoisk.ru, and mirf.ru.
- [ ] Keep parsed provider IDs namespaced; preserve Kinopoisk HD distinctions and significant installment evidence. Mirf selected-text Search must not attach its page URL.
- [ ] Match verified identities before saved source associations and title suggestions; expose contradictory evidence. Require acceptance before attaching viewing URLs, and omit active-page context from Search mode.
- [ ] Restrict extension permissions/origins to implemented needs, remove unused permissions and scaffold content-script matching, keep credentials out of content scripts, and isolate any injected UI using Shadow DOM.

Exit: AC01/03/09 and parser rollback tests pass; unknown hosts, broken rules, offline configuration, and denied tab access retain useful manual/search workflows.

## 17. Deliver current-format backup and restore

Depends on steps 7–11.

- [ ] Export `backup.json` as `{ schemaVersion: 1, entries: [...] }` with current portable entry data; exclude tombstones, server versions, credentials and settings.
- [ ] Accept only the current format; validate required timestamps, identities, source ownership and all domain fields. Reject old formats/unsupported versions; no conversion or staged migration.
- [ ] Reject files above 10 MiB before parsing; show indexed errors, conflicts, counts and a downloadable pre-replacement backup/report.
- [ ] Tie confirmation to owner, digest and expected revision; require distinct empty-library confirmation. Apply atomically with rollback and replication tombstones; keep settings/sharing independent.
- [ ] Support current-format export/restore offline in the extension and preserve acknowledged results across restart.

Exit: AC13–18/23 pass, including round-trip, failure/cancellation, stale preview, malformed/old formats and restart durability.

## 18. Implement unlisted read-only sharing

Depends on steps 6–7 and 10–11.

- [ ] Add owner enable/state/disable/rotate operations with at least 128-bit random tokens, hashed storage, and one-time plaintext link presentation.
- [ ] Implement an anonymous allowlisted projection excluding hidden/deleted entries, notes, sources, private identity data, and synchronization metadata.
- [ ] Apply shared filters/counts/order only to that visible projection and render a TanStack Query read-only website page without durable offline state.
- [ ] Set no-store/noindex/referrer controls, redact tokens in logs, and return non-enumerating not-found for invalid/revoked links.

Exit: tests prove revocation/rotation, hidden-field privacy, server-committed freshness, and inability to use share tokens for owner APIs or writes.

## 19. Build common external-list synchronization

Depends on steps 4–7, 9, 12, and the common import/ownership validation rules. This is separate from RxDB replication.

- [ ] Define provider adapters/capabilities and persist connections, verified remote account identities, scopes, field policies, generations, mappings, remote list-record IDs, common per-field baselines, and issues.
- [ ] Encrypt recoverable provider credentials with a server-held key; exclude them from client responses, backups, logs, sharing, and replicated documents. Enforce one active connection per owner/provider and remote-account uniqueness across Filecab accounts.
- [ ] Build initial complete-scan reconciliation preview with selected confirmation/cancellation, verified identity linking, stable imported UUIDs/minimal snapshots, and unresolved export issues.
- [ ] Implement per-field three-way merge, same-field conflicts, preserved provider-only values, explicit removals, durable suppression/unlink decisions, and default-disabled destructive deletion propagation.
- [ ] Add a durable PostgreSQL job/outbox for external effects, debounced committed local edits, manual sync, and configurable periodic checks initially every 15 minutes. Coalesce superseded work and serialize targets/connections.
- [ ] Revalidate connection generation, permission, entry version, and remote state before writes. Handle uncertain outcomes with read/reconcile, absolute progress, acknowledged provenance, and feedback-loop prevention.
- [ ] Distinguish complete scans from partial/throttled/interrupted scans; account for mutable pagination without claiming snapshot isolation.
- [ ] Implement pause/resume/disconnect, generation invalidation/job cancellation/credential deletion, authorization-loss recovery, and truthful in-flight-operation limitations.
- [ ] Expose authenticated connection/preview/job/issue/conflict/removal operations with OpenAPI documentation and UI state.

Exit: tests cover initial overlap, independent/same-field edits, repeat scans, suppressed removals, delete/undo, restart, stale jobs, account relinking, partial scans, and uncertain writes without unnecessary repeat export.

## 20. Implement Shikimori personal-list adapter and settings UI

Depends on step 19. Covers all requirements in integration-shikimori-spec.md.

- [ ] Verify current OAuth/user-rate schemas, scopes, response semantics, limits, and configured origin before enabling writes. Implement independent OAuth consent with state checks, `user_rates`, registered User-Agent, `whoami`, and serialized atomic token rotation.
- [ ] Read all anime statuses/pages through the verified metadata-complete anime-rates operation; account for v2 user-rate pagination being ignored with `user_id`. Exclude manga/ranobe and other owners.
- [ ] Keep anime target IDs separate from mapped rate IDs; require verified references/crosswalks or confirmed mappings and preserve minimal imported metadata without general Shikimori catalog search.
- [ ] Implement the specified status mappings, preserved on_hold/rewatching/rewatches, hidden-entry shadow state, explicit status actions, score/progress zeros, and private-text exclusion.
- [ ] Create via POST, partially update via PATCH, and delete only on confirmed removal resolution; fresh-read and verify writes, reconcile uncertain creates, preserve untouched remote fields, and avoid increment endpoints.
- [ ] Share a limiter across users/instances, configured below the documented 5/second and 90/minute ceilings pending verification; respect stricter responses and Retry-After. Distinguish expired tokens from scope/access denial.
- [ ] Add connect/pause/resume/disconnect/manual-sync settings, selected field policy, initial preview, remote identity, last scan, pending counts, mapping/conflict/removal resolution, and reconnection flows in en/ru.

Exit: contract/integration tests cover every provider verification case, privacy, rate limiting, refresh/relink, remote races, and convergence. Live availability and actual enabled write capability are recorded separately from fixture results.

## 21. Complete release verification and operations

Depends on steps 1–20 for the agreed release scope.

- [ ] Execute AC01–AC25 against the aligned baseline on the extension and all applicable website flows. Record fixtures versus live-provider evidence separately.
- [ ] Complete the requirement checklist for Backend, Catalog, User List Sync, every provider, and Stack; inspect failures for cross-cutting privacy and concurrency regressions.
- [ ] Run focused tests, all required CI checks, build/typecheck, database integration tests, and Playwright scenarios. Include keyboard-only use, 200% zoom, locale plurals 1/2/5/11/21, unsafe imported/provider text, and poster/network failures.
- [ ] Verify real Chrome MV3 popup/full-page/worker lifecycle, least permissions, account isolation, reconnect, offline import/export, conflict recovery, and restore durability.
- [ ] Test deployment migrations, PostgreSQL backup/restore, rollback/recovery, secret configuration, redacted logs, health checks, tombstone retention cleanup, provider job recovery, and production Swagger protection.
- [ ] Update setup/API/user documentation, enabled-provider capabilities, known limitations, and release evidence. Document external credential/availability blockers precisely; do not mark disabled mandatory integrations complete.

Exit: every mandatory requirement in scope has implementation and verification evidence. Release/deployment is a subsequent action, not implied by preparing this plan.

## Delivery milestones

| Milestone                    | Steps | Reviewable outcome                                                                                            |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| Agreed foundation            | 1–5   | Consistent specs, validated contracts, database transactions, documented API foundation.                      |
| Manual library               | 6–11  | Google login, online website, durable guest/account extension library, safe replication, bilingual shared UI. |
| Discovery and capture        | 12–16 | Verified catalog capabilities, add/edit/reconciliation, safe page extraction/configuration.                   |
| Data portability and sharing | 17–18 | Current-format backup/restore and private unlisted read-only projection.                                      |
| External anime list          | 19–20 | Optional account connection with explicit, reliable bidirectional Shikimori synchronization.                  |
| Release readiness            | 21    | Complete requirement evidence and tested operational recovery.                                                |

No calendar estimate is assigned before the specification conflicts and external provider verification are resolved. External credentials can block live activation while deterministic domain, UI, and fixture work continues.
