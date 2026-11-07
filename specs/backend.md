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

Synchronization SHALL run on opening, local changes, reconnecting, and manual refresh when authenticated and the device library is explicitly linked to that account. Live transport is not required. Replication state SHALL be scoped by account and compatible document schema. Account switching SHALL NOT submit one account's pending changes under another account.

Tombstones and change history SHALL initially be retained for at least 90 days. If a checkpoint is older than available history, the server SHALL return `SYNC_RESET_REQUIRED`. Reset SHALL reconcile a fresh snapshot while preserving pending intent and preventing deleted entries from being resurrected.

### Requirement: Guest adoption

The extension SHALL retain one device-local library in a fixed-name database. Sign-in, sign-out and account changes SHALL leave that library visible and SHALL NOT silently replace it or change unsaved input. Linking it to an account for synchronization SHALL require explicit confirmation. Importing guest entries into an account SHALL require a preview and explicit confirmation, apply identity/source conflict rules, and be retry-safe.

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

## Transactional persistence decisions (step 4)

All library writes SHALL lock the owner's `UserLibrary` row through commit. The same transaction SHALL increment a bigint owner revision for each changed document and store its complete server document in change history. Versions and revisions SHALL cross the service boundary as decimal strings. No-op edits SHALL preserve timestamps and revision. Entry IDs SHALL remain globally reserved after deletion.

Active catalog associations and normalized source claims SHALL have database uniqueness constraints scoped to the owner. Source claims SHALL index the SHA-256 digest of the normalized URL, checked against the stored URL by PostgreSQL, so accepted URLs up to 8192 characters do not exceed PostgreSQL index-key bounds. Deleted entries SHALL retain their complete document but release active claims; restore SHALL fail atomically if another entry claimed a catalog identity or source. Source reassignment and merges SHALL check both expected versions, preserve the selected survivor ID and publish each affected document. Merge callers SHALL explicitly select the surviving user fields; sources SHALL be combined in stable order. Any failure SHALL roll back documents, claims, history and revisions together.

Catalog references SHALL be unique by namespace, entity and exact string ID. Catalog translations and genre mappings SHALL preserve language and provenance. Session storage SHALL reserve hashed refresh credentials; authentication policy and endpoint wiring remain steps 5–7.

The Prisma schema SHALL document each persisted model, JSON payload shape, ownership relationship and ordering rule. SQL-only constraints SHALL be described beside the corresponding Prisma fields/models, with a reference to their migration; comments SHALL distinguish database enforcement from mutation-service guarantees.

Account identity and sessions SHALL belong to `User`. Library coordination SHALL belong to a separate one-to-one `UserLibrary`, keyed by owner UUID, containing the revision and relations to entries and change history. Account creation SHALL create its library in the same transaction. Deleting an account SHALL cascade through its library to entries, sources and history. Existing account revisions SHALL be preserved when moving to the library table; entries remain individual rows.

## API foundation decisions (step 5)

Routes SHALL use `/api/v1`. Anonymous `GET /api/v1/health/live` SHALL return `{ schemaVersion: 1, status: "ok" }` without database/provider access. `GET /api/v1/health/ready` SHALL execute a bounded database probe and return the same payload on success or a generic retryable 503 on failure. Both SHALL reject unknown query parameters.

Every response SHALL carry a server-generated UUID `X-Correlation-ID`; submitted identifiers SHALL NOT be trusted. Error bodies SHALL contain `schemaVersion`, `code`, `status`, `message`, `correlationId` and `retryable`, with optional field issues and retry delay. Framework/parser/service failures SHALL use this same envelope without raw exception messages or rejected values. Diagnostics SHALL log only correlation ID, method, status and elapsed time; URLs, query strings, headers, bodies, exception objects and credentials SHALL be omitted.

JSON request bodies SHALL initially be limited to 1 MiB, without implicit value coercion. DTO input nesting SHALL be limited to 32 levels before transformation. DTO validation SHALL reject unknown properties, including reserved property names, and return value-free field issues. Unsafe requests with bodies SHALL require JSON content type. Larger backup routes SHALL define their separate 10 MiB bound when implemented.

CORS SHALL use exact configured website and extension origins with credentials and expose the correlation header. Disallowed origins SHALL receive a structured 403. Unsafe requests carrying cookies SHALL require an allowlisted Origin and `X-Filecab-Request: 1`, even when an Authorization header is present. Requests without cookies SHALL still reject untrusted origins; authenticated bearer access is implemented in step 6. Preflight SHALL allow only supported methods and explicit headers. Website cookies SHALL use Secure/HttpOnly in production when authentication is implemented.

Production SHALL run behind an HTTPS-terminating proxy on loopback, bind the API to loopback and trust forwarded protocol only from loopback. Requests reported as insecure SHALL receive 403, and responses SHALL carry HSTS. Operators SHALL prevent external access to the internal listener. Liveness/readiness probes SHALL use the same trusted HTTPS proxy. Development/test SHALL support local HTTP.

Swagger UI SHALL be mounted at `/api/docs`, JSON at `/api/docs-json`, and YAML disabled, only outside production. The document SHALL describe actual endpoints, anonymous access, structured errors, bearer/cookie security schemes and the cookie CSRF header requirement. Future endpoints SHALL add their runtime DTOs, bounds, nullable fields and OpenAPI responses together. No authentication or library mutation endpoint is introduced by this foundation step.

Startup configuration failures SHALL identify invalid environment field names and provide static corrective guidance without printing their values. Unexpected startup exceptions SHALL retain a generic message; raw driver/framework messages and exception objects SHALL NOT be logged. Website URLs belong in `WEBSITE_ORIGINS`; `EXTENSION_ORIGINS` accepts exact Chrome extension origins only and MAY be empty before an extension ID is configured.

Successful startup SHALL log the actual bound API address returned by the HTTP server after listening, including scheme, host and port. This startup address SHALL NOT include request paths, query strings or credentials.

## Google authentication decisions (step 6)

`GET /api/v1/auth/google/start` SHALL accept `client=website|extension` and an allowlisted `returnTo`. Website returns SHALL be exactly a configured website origin plus `/`; extension returns SHALL be exactly `https://<configured-extension-id>.chromiumapp.org/filecab`. Extension requests SHALL also supply a random 43-character `attempt` and S256 `challenge`. The server SHALL generate state, nonce, a Google PKCE verifier and an HttpOnly browser-binding cookie. Ten-minute, single-use login attempts SHALL be persisted in PostgreSQL. Google callback SHALL be `/api/v1/auth/google/callback`, with its exact public URL configured and registered in Google Cloud. Ancillary Google callback parameters SHALL be ignored, with state/code/error validated separately.

The server SHALL exchange authorization codes only at Google's fixed HTTPS token endpoint and verify ID-token signatures using Google's fixed JWKS endpoint, RS256, issuer, audience, expiry, issuance time, nonce, subject and authorized party where present. Requests SHALL have bounded time and response size. Account identity SHALL use only verified `sub`, with account and library created atomically. Google tokens SHALL NOT be returned to clients or retained as reusable Filecab credentials.

Website login SHALL set separate HttpOnly access and refresh cookies (`__Host-filecab-access`, `__Host-filecab-session` in production; unprefixed `filecab-access`, `filecab-session` on local HTTP), with Path=/, SameSite=Lax and Secure in production. Website redirects SHALL contain no credentials. Extension callbacks SHALL return only a single-use, 60-second exchange code and initiating attempt. `POST /auth/exchange` SHALL require code, attempt and original verifier before creating a session. Reusable extension tokens SHALL appear only in the JSON exchange/refresh response.

Filecab credentials SHALL be independent random 256-bit opaque access/refresh tokens, stored as HMAC-SHA256 hashes using the server session key. Access defaults to 900 seconds; session absolute expiry to 2592000 seconds; idle expiry to 604800 seconds; login attempt to 600 seconds; exchange code to 60 seconds. `AUTH_ACCESS_SECONDS`, `AUTH_SESSION_SECONDS`, `AUTH_IDLE_SECONDS`, `AUTH_LOGIN_SECONDS` and `AUTH_EXCHANGE_SECONDS` SHALL be validated positive bounded configuration. Refresh SHALL never extend absolute expiry. Consumed refresh hashes SHALL remain until session expiry for replay detection. Refresh, issuance, logout and owner-wide revocation SHALL serialize on the account row; library locks SHALL remain independent. Replayed or concurrent duplicate refreshes SHALL revoke the session family, including its newly issued access token, with the revocation committed before returning 401.

`GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` and `POST /auth/logout-all` SHALL use the authenticated credential context rather than submitted owner IDs. Bearer access SHALL be extension-only; access cookies SHALL be website-only. Ambiguous bearer/cookie credentials SHALL be rejected. Refresh credentials SHALL not authorize owner reads. Website refresh SHALL use cookies; extension refresh SHALL submit JSON. Cookie CSRF controls apply even if bearer headers are present. All endpoints SHALL document bounds and response schemas in OpenAPI and emit no-store responses and value-free diagnostics.

Extension authentication SHALL run in the privileged worker using `identity.launchWebAuthFlow`. Durable refresh tokens SHALL use `storage.local` restricted to `TRUSTED_CONTEXTS`; access tokens SHALL use trusted `storage.session`. Client login/refresh/logout SHALL serialize; local credentials SHALL be cleared before a refresh network request so suspension or uncertain outcomes require login rather than replay. Content-script messages SHALL be rejected and no credentials returned to popup/full-page UI messages. Account changes SHALL invalidate in-memory website queries and client account state; guest adoption and library replication remain separate later capabilities.

Cross-tab sign-out SHALL immediately update mounted account controls to signed-out state as well as remove private cached queries and mutations. Account observers SHALL remain subscribed during this reset; incoming account changes SHALL refetch the server identity after clearing prior owner data.

## Extension authentication diagnostics

The extension SHALL check Google enablement and its exact extension-origin allowlist before opening the Google window. Anonymous `GET /api/v1/auth/extension/config?extensionId=<id>` SHALL validate the 32-letter Chrome extension ID and return only schema version, Google enablement and whether that origin is allowed; it SHALL NOT access credentials or private library data. Existing CORS/origin enforcement SHALL remain in effect.

Authentication failures SHALL identify the failed stage (storage, configuration, browser login, callback, exchange, refresh, account or logout), a stable diagnostic code, optional HTTP status and correlation ID. Worker console diagnostics SHALL contain only these allowlisted fields and static outcome labels, never raw exception messages, authorization/callback URLs, codes, state, nonce, verifiers, tokens or response bodies. The UI SHALL display safe corrective guidance and collapsed public connection details (extension ID/origin, callback URL and API origin). Missing worker replies SHALL remain recoverable rather than replacing account state with undefined.

Trusted popup/full-page sender checks SHALL compare extension identity, protocol, host and exact pathname while permitting query strings or fragments used during debugging. Content-script and foreign-extension contexts SHALL remain rejected. Diagnostic requests SHALL return only public configuration metadata, and shall not require reading stored credentials.

## Owner library API decisions (step 7)

All `/api/v1/library` routes SHALL require AuthGuard and derive the owner solely from its credential context. Reads SHALL reject request bodies and all query parameters, including display filters, ordering and pagination. `GET /library` SHALL return `{ schemaVersion: 1, revision, entries }` from one PostgreSQL RepeatableRead transaction; the revision and complete active documents SHALL represent the same committed snapshot. Hidden entries SHALL be included, tombstones excluded and transport order SHALL be stable by entry UUID without claiming display ordering. `GET /library/entries/:entryId` SHALL return an active owned entry or non-enumerating 404.

`POST /library/entries` SHALL accept editable entry fields, required category, optional entry UUID and optional internal catalog UUID. The server SHALL generate a UUID when omitted and source metadata only from its catalog store; caller-supplied owner, snapshots, timestamps, versions or deletion state SHALL be rejected. Manual entries SHALL require a nonblank user title, preserving exact input. Catalog-backed entries MAY have an empty title and SHALL use a matching-category existing catalog identity. Metadata/provider availability SHALL not gate manual operations. User text/source limits remain the existing PATCH bounds.

`PATCH /library/entries/:entryId` SHALL accept a required canonical positive decimal-string `expectedVersion` plus editable fields. `DELETE /library/entries/:entryId` and `POST /library/entries/:entryId/restore` SHALL accept only expectedVersion and return the resulting complete server document, including the deletion tombstone. No-op updates SHALL preserve time/revision; all mutations SHALL use the common owner-library transaction and change feed. Manual titles SHALL remain nonblank after edits/merges. Ordinary PATCH SHALL not change catalog identity or snapshots. Status null, rating/progress zero, empty comments and empty source arrays retain their explicit-clearing meanings.

`POST /library/merges/preview` SHALL accept survivor/removed UUIDs, both expected versions and explicit editable field choices. Sources SHALL be combined in stable order without loss; category changes and source replacements SHALL be separate operations. `POST /library/sources/reassignment/preview` SHALL accept from/to UUIDs, both versions and the normalized source URL to move. Previews SHALL validate ownership, active state, category/catalog compatibility and resulting source bounds without changing entries, revisions or history. A combined result above 100 viewing sources SHALL be rejected, with no truncation; the owner may reduce sources before retrying.

Previews SHALL return before/proposed documents, a five-minute expiry and an HMAC confirmation token bound to owner, operation, both current versions/documents and selected choices. Proposed documents SHALL have null serverVersion to identify unsaved intent. Apply endpoints `/library/merges/apply` and `/library/sources/reassignment/apply` SHALL accept the same choices plus the preview token. They SHALL revalidate its signature, expiry, owner, choices and current entry versions inside the same library lock/transaction used to apply changes. Changed choices, stale previews, conflicting identities or newly claimed sources SHALL fail atomically. Merge SHALL preserve the selected survivor UUID and publish the removed UUID as a tombstone. Preview tokens SHALL appear only in request/response bodies and SHALL NOT be logged.

All request/response DTOs SHALL have OpenAPI coverage, including nullable metadata, string versions, complete snapshots, structured errors and synthetic examples. UI editing/Undo controls remain step 11; this step delivers the authenticated API boundary.

## Replication transport decisions (step 9, server foundation)

Authenticated `POST /replication/pull` and `POST /replication/push` use the v1 shared contracts. Pull limits are 1–100; push batches contain 1–100 distinct entry IDs. Decimal cursors are bounded to PostgreSQL bigint. `deleted` is the transport deletion field. The extension wrapper adapter retains application tombstones as ordinary wrapper records and maps `entry.deleted` to this field; native `_deleted` remains false for retained records. A checkpoint cursor identifies a unique owner revision; `entryId` is informational and never controls ordering.

Pull reads a RepeatableRead snapshot of the owner revision and change feed, returns changes in revision order, and includes complete tombstones. Repeated changes to one entry within a batch are collapsed to its last state, while the checkpoint advances over every consumed revision. Clients must continue when `hasMore` is true. A null checkpoint starts from zero. A missing next revision or a cursor beyond the owner's current revision returns `SYNC_RESET_REQUIRED`; history and tombstones remain retained indefinitely until a separately verified retention/reset implementation exists.

Push validates the whole request before applying rows in request order. Each row commits independently through the common owner-serialized mutation service. A stale assumed version returns the current owner document as a conflict, leaving it unchanged. Identity/source conflicts report the proposed ID and current owned document when one exists; another owner's document is never disclosed. Invalid row semantics return a validation error; earlier committed rows remain committed. Retrying an already applied equivalent proposal is a no-op, including creates, deletes and restores. Clients must retain the batch until acknowledged. There is no second client outbox.

Only editable fields, deletion state and an existing catalog association may be proposed. Snapshots are server-authoritative: manual proposals must carry the empty snapshot and catalog proposals the current server catalog snapshot. Updates preserve creation time; accepted changes receive server modification time and version. Cross-account UUID collisions are conflicts without disclosure. Extension linking, durable rejected-intent handling, reset reconciliation and adoption remain required before replication can be enabled in the extension.
