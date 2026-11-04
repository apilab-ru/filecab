# Filecab Backend Specification

## Purpose

Filecab SHALL provide a personal library of anime, films, and TV series through a browser extension and a standalone website. Users SHALL be able to save catalog-backed or manual entries, track viewing information, synchronize the extension with their account, and share a read-only library using an unlisted link.

The backend SHALL use NestJS, PostgreSQL 17, and Prisma. The extension SHALL use RxDB with the free Dexie/IndexedDB adapter for offline data. The website SHALL use TanStack Query for online server state. API DTOs SHALL be validated with class-validator and class-transformer. Shared contracts SHALL use strict TypeScript in the Nx workspace.

SHALL and MUST indicate required behavior. SHOULD indicates a recommendation. These requirements describe the target behavior of the system.

## Capability: Accounts and sessions

### Requirement: Google authentication

The system SHALL authenticate users through Google. It SHALL identify a Google account by its verified subject identifier rather than email address alone. Password registration, password login, and password reset SHALL NOT be required.

The backend SHALL validate the Google authorization response and applicable issuer, audience, expiration, state, and nonce properties. Google client secrets SHALL remain on the backend.

### Requirement: Website and extension login

The website SHALL start the backend authentication flow through a redirect. The extension SHALL start it through `identity.launchWebAuthFlow`.

Website session credentials SHALL use secure HttpOnly cookies in production with appropriate SameSite and CSRF protections. Extension login SHALL return a short-lived, single-use exchange code bound to the initiating login attempt using a verifier/challenge or equivalent binding. Callback destinations SHALL be allowlisted. Reusable credentials SHALL NOT be placed in redirect URLs or exposed to content scripts.

### Requirement: Session lifecycle

The system SHALL support current-account lookup, session refresh, current-session logout, and revocation of all account sessions. Extension access tokens SHALL be short-lived. Refresh credentials SHALL rotate, support replay detection, and be stored server-side as hashes when opaque. Session lifetimes and concurrent-refresh behavior SHALL be documented and tested.

## Capability: Library identity and data

### Requirement: Independent entry identity

Every library entry SHALL have an immutable UUID `entryId`, an owner, and a category. Clients MAY generate UUIDs before sending entries to the backend. Entry CRUD SHALL address `entryId`, never a provider ID.

A catalog association SHALL be optional and represented by a separate internal `catalogId`. External references SHALL preserve `{ provider, entityType, id }`, with string IDs and explicit namespaces. Equal numeric values from different providers SHALL NOT imply identity.

### Requirement: Library fields

An entry SHALL retain category, user title, available catalog snapshot, status, rating, progress, notes, viewing links, creation/modification timestamps, server version, and deletion state.

Category SHALL be `anime`, `films`, or `tv`. Media format SHALL remain separate from category. Distinct seasons, movies, specials, editions, and remakes SHALL NOT be merged solely because their names are similar.

Status SHALL be `planned`, `process`, `complete`, `drop`, `hide`, or null. Rating SHALL be an integer from 0 to 10, where 0 means unrated. Progress SHALL be a nonnegative safe integer. Unknown episode totals SHALL be null. Exceeding a known total SHALL produce a warning without silently truncating progress. Reaching the total SHALL NOT automatically change status.

### Requirement: Ownership and duplicate protection

Every private operation SHALL derive ownership from the authenticated session. Entry IDs and submitted owner fields SHALL NOT grant access. At most one active entry per owner and internal catalog item SHALL exist.

## Capability: Viewing sources

### Requirement: Multiple viewing links

An entry SHALL support multiple viewing-source associations independently of its catalog URL. Each association SHALL retain its original URL and a conservatively normalized URL. Only HTTP(S) viewing URLs SHALL be accepted.

Known site adapters MAY normalize episode URLs to title-level associations and remove tracking parameters. Unknown parameters SHALL NOT be removed blindly. Generic home/search pages SHALL NOT establish anime identity.

Within one account, a normalized title-level source association SHALL belong to one active entry. Reassignment SHALL be explicit and atomic.

## Capability: Library operations

### Requirement: Create, read, update, and delete

The backend SHALL provide owner-scoped entry creation, retrieval, listing, updates, deletion, and restoration. Updates and deletes SHALL require an expected server version. Explicit field-clearing and mixed replication-batch behavior SHALL be documented and tested. Changes to an entry and its source associations SHALL commit atomically.

User edits SHALL update the modification timestamp without changing creation time. Catalog refresh alone SHALL NOT be presented as a user edit. Client timestamps SHALL NOT determine replication order.

### Requirement: Delete and undo

Deletion SHALL create a synchronization-visible tombstone. The product SHALL provide a 10-second Undo action that restores the exact deleted entry through ownership and version checks. Restores SHALL also enforce current catalog/source uniqueness constraints.

### Requirement: Retrieve the complete owner library

The backend SHALL provide the authenticated owner's complete active library, including hidden entries and metadata required for client-side search, filtering, and sorting. Deleted entries SHALL be excluded from the ordinary owner snapshot and delivered as tombstones through replication.

The website SHALL cache the complete owner-library response in memory using TanStack Query. The extension SHALL query its local RxDB library, maintained through replication. Display pagination SHALL NOT limit which entries are downloaded or synchronized. Incremental extension replication MAY use transport batches independently of display pagination.

The owner-library response SHALL NOT apply display filters, sorting, or display pagination. Remote catalog search and shared-list retrieval SHALL remain separate contracts with their own access and query rules.

### Requirement: Client-side search, filters, sorting, and pagination

The client SHALL apply search and filters to the complete locally available owner library, then sort matching entries, then paginate the sorted results.

Search SHALL cover user titles, available catalog aliases/translations, descriptions, and private notes. Hidden entries SHALL be excluded from ordinary displayed results unless explicitly requested; they SHALL remain in the owner dataset.

Positive statuses, exact ratings, and years SHALL use OR within their field. Positive genres SHALL use AND. All exclusions SHALL apply. Different fields SHALL combine with AND. Rating ranges SHALL be inclusive.

Supported ordering SHALL include creation date, modification date, displayed title, year, rating, and status, with an entry ID tie-breaker. Title ordering SHALL respect the selected application locale.

Defaults SHALL be creation date descending, page 1, and page size 20. Supported page sizes SHALL be 12, 20, 50, and 100. Displayed totals SHALL equal the number of entries matching the current filters, not the current page size.

Changing search, filters, sorting, or page size SHALL reset pagination to page 1. After data changes, the current page SHALL be clamped to the available range.

## Capability: Catalog search and details

### Requirement: Provider adapters

The backend SHALL expose a common catalog interface through independently configurable provider adapters. Anime catalog integration SHALL support Smotret Anime; film/TV integration SHALL support Kinopoisk Dev. Shikimori SHALL serve optional owner-connected personal-list synchronization only, as required by the User List Synchronization and Shikimori specifications; it SHALL NOT serve general catalog search/browse/genre refresh. Only adapters verified against current provider contracts, credentials, and applicable usage conditions SHALL be enabled. A capability response SHALL identify enabled providers and supported operations/filters/locales.

Search SHALL route to the configured provider rather than assume automatic multi-provider aggregation. Provider configuration SHALL NOT affect manual-entry availability. Provider keys SHALL remain server-side; key rotation SHALL NOT be used to evade quotas.

### Requirement: Search contract

Catalog search SHALL accept category, text, locale, one-based page, page size from 1 to 50, and supported filters. Film and TV queries SHALL apply distinct category constraints. Unsupported filters/sorts SHALL be rejected or explicitly reported as unapplied; they SHALL NOT be silently ignored.

Responses SHALL use `{ page, results, hasMore, total? }`. Total SHALL be omitted when an exact normalized count is unknown. Continuation SHALL be established from deliverable normalized results and provider continuation evidence, using bounded lookahead where necessary. It SHALL NOT be computed from unrelated intermediate grouping counts. Capability limitations SHALL be explicit.

### Requirement: Catalog identity and metadata refresh

Internal catalog detail lookup and provider-ID resolution SHALL be separate typed operations. Provider references SHALL be upserted with namespace-aware uniqueness and concurrency protection. Verified aliases/crosswalks MAY link multiple provider records to one internal identity; uncertain mappings SHALL remain unresolved.

Refresh SHALL update available metadata with provenance and freshness information without erasing known values when upstream fields are missing. It SHALL NOT overwrite user title, notes, progress, status, rating, or viewing links. Missing catalog data SHALL NOT make saved entries disappear.

### Requirement: Genres

Genres SHALL have stable internal identities, localized labels, and namespaced provider mappings. Label equality alone SHALL NOT establish identity. Unknown mappings SHALL preserve diagnostic information without failing the entire media result.

Genre refresh SHALL be an authenticated operator action, not a publicly accessible mutating GET operation.

## Capability: Matching and enrichment

### Requirement: Candidate identification

The system SHALL identify existing owned entries using internal catalog identity, verified provider references, normalized saved source associations, and title candidates in that confidence order.

A verified identity match MAY directly recognize an entry. Title similarity SHALL only suggest candidates. Normalization SHALL preserve significant season numbers, editions, years, and formats. A single search result SHALL NOT by itself prove equivalence.

### Requirement: Manual entry reconciliation

Users SHALL be able to associate manual entries with catalog results later. If the target catalog item is already in the account, the system SHALL offer an explicit merge preview showing surviving entry identity, field choices, and source associations. Applying the merge SHALL be version-checked and atomic, with tombstones for removed identities.

## Capability: Extension offline data and synchronization

### Requirement: Durable local extension state

The extension SHALL use RxDB as its local library source of truth. It SHALL allow offline creation, browsing, filtering, editing, deletion, import, and export using available snapshots. Catalog-dependent requests SHALL show an offline state. A save SHALL be acknowledged only after durable local persistence.

Pending changes SHALL survive popup closure, browser restart, and MV3 worker suspension. Storage read failure SHALL show recovery behavior rather than overwrite existing data with an empty library.

### Requirement: RxDB pull and push

The backend SHALL implement the installed RxDB version's replication protocol, including stable document IDs, deletion representation, checkpoint-based pull, assumed-master-state push, and conflict responses. RxDB replication metadata SHALL be used instead of a second custom mutation outbox.

Pull SHALL return only the authenticated owner's changed documents in deterministic batches. Push SHALL validate ownership and fields and atomically compare the client's assumed server state. Invalid writes SHALL be distinguished from version conflicts; mixed-batch semantics SHALL be documented.

### Requirement: Commit-safe change tracking

Website CRUD, replication pushes, imports, merges, deletes, and restores SHALL use the same backend rules and atomically publish synchronization changes.

Checkpoints SHALL never skip a committed change. Use per-owner transactional serialization/counters held through commit, or an equivalent proven mechanism. Timestamps alone and sequences allocated before commit SHALL NOT be assumed to provide commit-safe order. Cursor numbers SHALL use a representation safe from JavaScript precision loss.

### Requirement: Conflict recovery

For a stale assumed server version, automatic conflict resolution SHALL retain the current server document. The rejected local intent SHALL remain durably recoverable and visible to the user for deliberate reapplication or overwrite. Client and server conflict handling SHALL agree on this policy.

### Requirement: Sync lifecycle and retention

Synchronization SHALL run on opening, local changes, reconnecting, and manual refresh when authenticated. Live transport is not required. Replication state SHALL be scoped by account and compatible document schema. Account switching SHALL NOT submit one account's pending changes under another account.

Tombstones and change history SHALL initially be retained for at least 90 days. If a checkpoint is older than available history, the server SHALL return `SYNC_RESET_REQUIRED`. Reset SHALL reconcile a fresh snapshot while preserving pending intent and preventing deleted entries from being resurrected.

### Requirement: Guest adoption

An unsigned extension user SHALL be able to retain a local library. Login SHALL NOT silently replace it. Importing guest entries into an account SHALL require a preview and explicit confirmation, apply identity/source conflict rules, and be retry-safe.

## Capability: Unlisted read-only sharing

### Requirement: Sharing controls

The owner SHALL be able to enable sharing of the personal library, obtain an unlisted link, inspect sharing state, disable sharing, and rotate the link. Viewers SHALL NOT need an account.

Tokens SHALL contain at least 128 bits of cryptographic entropy and SHALL be stored server-side as hashes. Plaintext links SHALL be returned on creation/rotation; an unrecoverable existing token SHALL be replaced rather than reconstructed from its hash.

### Requirement: Shared data projection

The shared endpoint SHALL return only allowlisted media fields: title, category, available poster/year/format, status, rating, and progress. Hidden/deleted entries, private notes, viewing-site URLs, email/account identifiers, sessions, and replication metadata SHALL be excluded.

Shared filters, ordering, and counts SHALL operate only on the visible projection. Sharing tokens SHALL authorize no mutation, owner lookup, or synchronization access. The shared website SHALL use TanStack Query without a persistent offline library.

### Requirement: Shared freshness and privacy

Shared responses SHALL represent server-committed data only. Responses SHALL use `Cache-Control: no-store`, noindex directives, and restrictive referrer policy. Tokens SHALL be redacted from logs. Unknown/revoked links SHALL receive non-enumerating not-found responses.

## Capability: Backup and restore

### Requirement: Export and import formats

The system SHALL export `backup.json` as `{ schemaVersion: 1, entries: [...] }` containing active entry identities, user fields, ordered sources, snapshots/provenance and timestamps. Exclude per-entry schemaVersion, server versions, deletion state, credentials and account/settings data. Restore SHALL accept only this current format; old-data migration and compatibility adapters are out of scope.

The importer SHALL validate JSON shape, categories, enums, bounds, dates, URL schemes, duplicate IDs, catalog duplicates, and source conflicts. The initial maximum import size SHALL be 10 MiB. Missing or invalid timestamps and unknown fields SHALL be rejected without inference.

### Requirement: Preview and atomic replacement

Server-library replacement SHALL require validation, a preview of errors/conflicts/counts, a downloadable pre-replacement backup, and explicit confirmation tied to the owner, payload digest, and expected library revision. Empty-library replacement SHALL require distinct confirmation.

Apply SHALL be atomic and publish all replication changes, including tombstones. Sharing configuration and interface settings SHALL remain separate from entry-array replacement. Ordinary synchronization SHALL NOT replace the entire library.

## Capability: English and Russian metadata

### Requirement: Locale-aware API

Catalog search/detail and genre operations SHALL accept explicit `en` or `ru` locale. New clients SHALL always send it. Missing or unsupported locale values SHALL be rejected.

Metadata SHALL preserve actual field language and provenance, including unknown. Internal catalog and genre identities SHALL remain stable across locales. Original title SHALL be separate and SHALL NOT be assumed to be English.

### Requirement: Preserve user text

User-entered titles, notes, and links SHALL remain unchanged by language selection or metadata refresh. Provider query text SHALL remain as entered unless an explicitly specified provider adapter requires transformation. Machine translation and universal cross-language search coverage are not required.

## Capability: Server-managed parser configuration

### Requirement: Declarative extraction configuration

NestJS SHALL serve versioned parser configuration containing hostname/path mappings, selectors, approved attributes, known fields, and fixed fallbacks supported by the bundled extension engine.

Configuration SHALL NOT contain executable JavaScript, expressions, arbitrary command sequences, or remote interpreter logic. New parsing capabilities SHALL require an extension engine release. Configuration SHALL NOT grant website permissions or trigger background browsing collection.

### Requirement: Configuration compatibility and rollback

Configurations SHALL include schema version, revision, engine compatibility, and HTTP cache validators. The extension SHALL cache the last valid version and bundle defaults. Publication SHALL be an authenticated operator action with fixture checks and audit history. Rollback SHALL be supported.

### Requirement: Page data minimization

Page extraction SHALL occur in the extension after user interaction. Backend matching SHALL require only necessary structured metadata, not full page HTML or browsing history. A supported page parser SHALL not require the page's website to be a catalog provider.

## Capability: API contracts and operational behavior

### Requirement: Validated, versioned contracts

The backend SHALL expose versioned REST contracts with generated OpenAPI documentation and runtime-validated DTOs. Inputs SHALL enforce ownership, field allowlists, sizes, enums, IDs, URL schemes, pagination, and batch bounds. Optional/nullable fields and explicit clearing semantics SHALL be defined. Shared TypeScript interfaces alone SHALL NOT substitute for validation.

### Requirement: Actionable errors

Errors SHALL include a stable code, HTTP status, correlation ID, optional validation details, and retryability. Authentication, validation, conflict, throttling, provider failures, and valid empty results SHALL remain distinguishable. Raw stack traces, credentials, and private payloads SHALL NOT be returned.

### Requirement: Provider resilience and cache

Provider operations SHALL have bounded timeouts, response sizes, concurrency, and retries. Rate-limit instructions SHALL be respected. Catalog/genre caches SHALL be locale-aware and separate from private library data. Freshness TTLs SHALL be configurable. Stale fallback SHALL be identified explicitly.

### Requirement: Secure operations

The backend SHALL validate required configuration at startup, allow only configured website/extension origins, protect cookie-authenticated mutations against CSRF, use HTTPS in production, and restrict diagnostics/refresh operations to authorized operators.

Logs SHALL redact OAuth codes, credentials, sharing tokens, notes, and page contents. Liveness SHALL not depend on providers. Readiness SHALL report database availability. Database migrations and external backups SHALL support tested recovery. Development and production SHALL use separate credentials and PostgreSQL storage.

## Verification

Implementation SHALL include contract and integration tests for ownership isolation, manual persistence, namespaced identity collisions, concurrent duplicates, source reassignment, optimistic concurrency, deletion/restore, checkpoint ordering, retry safety, conflict recovery, account switching, history reset, OAuth exchange replay, sharing revocation/projection, restore atomicity, locale fallback, provider failure, and parser rollback.

Live provider tests SHALL supplement deterministic fixtures when credentials and service availability permit. A successful local fixture SHALL NOT be represented as proof that a live provider is available.

### Requirement: Swagger API documentation

The backend SHALL use `@nestjs/swagger` to generate OpenAPI documentation
and provide Swagger UI at `/api/docs` and OpenAPI JSON at `/api/docs-json`.

Documentation SHALL cover all supported endpoints and describe:

- Parameters and request bodies.
- Response schemas and status codes.
- Validation constraints and nullable fields.
- Authentication requirements.
- Structured errors.
- Examples using synthetic data.

Swagger UI SHALL allow supplying an application bearer access token.
Cookie authentication and CSRF requirements SHALL be documented separately.
Anonymous endpoints SHALL be clearly identified.

Documentation SHALL reflect actual runtime contracts and remain synchronized
with controllers and DTOs.

Swagger SHALL be enabled for local development. In production, Swagger UI
and OpenAPI JSON SHALL be disabled or protected by operator authentication
by default.
