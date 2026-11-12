# Implementation Baseline Decisions

These decisions complete implementation-plan step 1 and are normative alongside the linked specifications. They define target behavior, not implemented functionality. Future changes must update the affected specifications and requirement checklist before implementation.

## Scope and client storage

Required delivery includes Google accounts, extension replication, sharing, server-managed parser configuration, provider metadata caching, and optional owner-connected Shikimori personal-list synchronization. Connecting an account is optional for an extension guest; delivering these capabilities is required. `plans.md` and the remaining recommendations in Functionality section 13 are excluded from this delivery.

The extension uses one fixed-name, device-local RxDB/Dexie database and supports offline library operations. Sign-in/sign-out keep the same library and editor visible; future account replication requires explicit linking and account-bound synchronization metadata. The authenticated website uses online API operations and an in-memory TanStack Query cache; it has no persistent library or offline mutation queue. Network failures preserve unsaved form input and offer retry. Interface preferences may persist independently and are not replicated with the library.

## Progress and provider roles

Progress is a nonnegative JavaScript-safe integer. Exceeding a known positive total produces a warning and remains saveable. Unknown/zero provider totals normalize to null. No progress action automatically changes viewing status.

Catalog defaults are `anime=smotret`, `films=kinopoisk`, and `tv=kinopoisk`, expressed explicitly in deployment configuration. Activation still requires provider verification. A disabled default produces an unavailable-provider error rather than silent switching. Shikimori is exclusively a personal-list connection, not a general catalog or genre provider. Catalog availability never gates manual library CRUD.

## Viewing-source normalization

Each entry has zero or more viewing sources, each with its original URL and normalized URL. Uniqueness is per owner and normalized URL among active entries. Reassignment requires explicit confirmation and an atomic version-checked change retaining both entries.

Generic normalization parses an absolute HTTP(S) URL, rejects embedded credentials, lowercases scheme/hostname, and applies standard URL serialization including default-port removal. Preserve scheme differences, path case, trailing slash, query parameters and their order, and fragments because their meaning is unknown. Do not equate HTTP with HTTPS or remove `www` globally. Exact matching uses the resulting serialized URL.

Only fixture-verified host/path adapters may additionally normalize episode paths to title paths or remove specifically allowlisted tracking parameters. Preserve the original URL. Version the normalization policy; changing it must preview collisions and apply a migration rather than silently transferring ownership. Home/search URLs are optional viewing sources and do not prove media identity.

## Current-format backup

Export `backup.json` as `{ schemaVersion: 1, entries: [...] }`. Entries retain UUID, optional catalog ID, category, user fields, all ordered sources, metadata/provenance and valid creation/modification timestamps. Exclude per-entry schemaVersion, serverVersion, deletion state, credentials, account data and settings. CatalogId null identifies manual entries; no separate manual marker is needed.

Restore accepts only this format. Old arrays/grouped data, `_filecab`, timestamp inference, legacy payload retention and staged migration are out of scope. Unsupported versions or invalid data fail without replacement. Validate identities/source conflicts, preview and confirm against the current revision, then replace atomically. Reestablish server versions through the common mutation service; never trust backup versions. Database and RxDB schema migrations remain required.

## Mutation and clearing semantics

PATCH omission means unchanged. Explicit null clears optional catalog association, status, and nullable metadata where that operation permits it; it does not clear required category/title/identity/version fields. Empty notes are an explicit empty string. Rating zero clears personal rating; progress zero resets progress. An empty source array removes all viewing sources. Server-owned timestamps, ownership, and catalog provenance cannot be overwritten through ordinary entry PATCH. Snapshot refresh is a separate catalog operation.

Setting a catalog association requires verified resolution and duplicate/category conflict checks. Detaching it preserves the snapshot, entry UUID, and user fields. Clearing the association requires a valid manual title. Source changes and entry changes commit together; no-op edits do not change user modification timestamps.

## Sessions

Initial application access-token lifetime is 15 minutes. Website sessions and extension refresh-session families have a 30-day absolute lifetime and 7-day idle limit, whichever expires first. Refresh rotates credentials and cannot extend absolute expiry. Login state/nonce and extension attempt binding expire after 10 minutes; extension exchange codes expire after 60 seconds and are single-use. Application lifetimes are validated server configuration; Google/provider token expiry follows the issuer response.

Clients serialize refresh per session; the backend atomically consumes and replaces each refresh credential. Reuse of a consumed credential revokes its session family and requires login. Concurrent duplicate refresh attempts are treated as replay, not issued multiple successors; a lost refresh response may therefore require login. Website cookies use HttpOnly, Secure in production, SameSite=Lax, and CSRF validation on mutations. Session tests must cover idle/absolute expiry, rotation, replay, concurrent requests, logout, and all-session revocation.

## Replication batch semantics

Authenticate and validate the entire bounded push batch before applying writes. Any structurally invalid/unauthorized row rejects the batch with indexed validation errors and commits no rows. Reject duplicate document IDs within a push batch. An ownership violation must not disclose another owner's document.

For a valid batch, evaluate assumed-master-state comparisons under one transaction and owner serialization. Version conflicts leave their rows unchanged and return current owner-scoped server documents using the installed RxDB protocol. Non-conflicting rows commit atomically together with change tracking; a database failure rolls back all accepted rows. Retrying accepted rows must converge without additional semantic writes. Retain rejected local intent durably outside the server-master result so it remains reviewable. Step 3 defines the transport-neutral v1 models and initial 100-row batch limit in [Shared Domain Contract](../specs/domain-contract.md). RxDB is installed in step 8; step 9 must document and verify the native wire adaptation against that installed version before claiming protocol compatibility.

## Installment boundaries

A provider's independently identified series, season, film, special, remake, and edition remain distinct catalog records. Format is separate from library category; an anime movie remains anime. A provider-wide series is not equivalent to another provider's season. Relationships describe links, never automatic merges. Cross-provider equivalence requires a trusted explicit reference or verified crosswalk with compatible granularity; title similarity and numeric equality are insufficient. Unknown installment granularity remains unresolved. Rich rewatch history and automated installment grouping are outside this baseline.

## Evidence and external dependencies

The requirement checklist records pending implementation, code, verification evidence, and blockers separately. Provider schema/version, credentials, permissions, quotas, and usage conditions must be verified during their integration steps; this document makes no live availability claims. Google consent configuration and provider credentials are activation dependencies, not reasons to mark fixture-tested integrations complete.

## Local persistence

The popup and full page SHALL open the same RxDB/Dexie database directly with
multi-instance notifications. No library write SHALL depend on the MV3 worker
remaining alive. Web Locks SHALL serialize repository reads/writes across these
surfaces; missing Web Locks or failed storage access SHALL enter recovery, never
fall back to volatile storage. The extension SHALL use the fixed RxDB name `filecab-local` and one device-local
library. Sign-in, sign-out and account changes SHALL leave the same entries,
settings and unsaved editor visible; authentication SHALL NOT select storage.
Account credentials remain separate. Synchronization requires explicit
account linking/import confirmation and account-bound replication metadata;
signing in alone SHALL NOT upload or replace local data. Future migrations of supported storage versions remain required.

Persist one document per entry, including snapshots, sources, tombstones and local
revision metadata. Each single-entry write SHALL atomically store its next local
revision and millisecond update time in that document. The library revision is
the maximum revision over all documents, including retained tombstones; do not
physically remove them. This avoids a separate counter write or mutation queue.
Expected local revisions SHALL prevent stale edits. Active catalog/source claims
SHALL be checked under the same scope lock. Semantic no-ops SHALL preserve time
and revision. Local revisions SHALL remain safe integers and fail on exhaustion.

Deletion SHALL persist the previous entry and a ten-second Undo deadline alongside
the tombstone. Undo SHALL check that exact deletion revision and deadline, restore
the previous entry data/timestamps, and allocate a new local revision. Conflicting
active source/catalog claims SHALL block restoration without changing data.
Settings SHALL live in a separate collection, keyed by category and Library/Catalog
mode, using expected revisions; credentials SHALL never enter either collection.

Storage schema version zero is the first supported format. Register RxDB's schema
migration plugin and an explicit empty version-zero strategy map; future schema
changes must increase the version and supply preservation-tested migrations.
Use build-time AJV standalone validators for storage writes, compatible with the
extension CSP; these are extension-private persistence schemas, not shared request
parsers or client DTO validation. Reads SHALL check persisted records against the
same storage schemas before exposing data. A failure SHALL preserve all bytes,
show Retry and allow best-effort raw IndexedDB export, including unreadable-store
errors. Never remove/recreate a failed database automatically.

Verify unpacked Chromium popup/full-page concurrency, restart durability, worker
suspension, account isolation, stale edits, no-op/clearing, Undo expiry and recovery.

## Extension replication

Replicate the existing `entries` collection with RxDB 17.6.0's replication plugin.
Transport handlers map wrapper documents to v1 entries; local revision and Undo
fields never reach the API. Wrapper documents use RxDB's ordinary `_deleted`
field (always false for retained application records); `entry.deleted` maps to the
API's application tombstone. The conflict equality function compares entry state
and ignores wrapper bookkeeping. Before resolving to the master, persist any
differing editable/deletion intent in a separate review collection. That collection
is a recovery log, never a mutation queue. A failed recovery write must prevent
resolution. A conflict with no owned master becomes a local application tombstone;
its original proposal remains available for deliberate editing and reapplication.

Store one durable account binding and reset generation in a separate collection.
The fixed device library stays visible on logout/account switches. Only the bound
account may replicate this library; another account sees a suspended link and
cannot adopt the previous account's pending intent. Initial linking requires an
owner/revision-bound local+remote preview and explicit confirmation. Confirmation
rechecks both revisions before persisting the binding. No upload starts from login
alone. Link restart resumes RxDB metadata; partial network outcomes use retry-safe
server writes. The privileged worker serializes allowlisted replication/library
requests with authentication, checks the requested owner against the credential,
and never returns tokens. Content scripts cannot invoke these operations.

Run replication while a library surface is open, elect one synchronization surface using a Web Lock, retry
failures and resync on reconnect, a periodic open-surface timer and manual refresh.
Closing surfaces or suspending the worker must not lose saved pending state.
Display active/error/suspended/reset states and durable rejected-intent counts.
Keep the same editor mounted through authentication/status changes.

A history-reset error pauses uploads and requires explicit reconciliation. Preserve
all local documents in a labeled reset recovery log before replacing any entry
with a fresh revision-bound server snapshot. Mark absent local documents as local
tombstones, preventing resurrection; do not push uncommitted local tombstones.
Persist reset-in-progress before changing entries so interruption requires retry
rather than normal replication. Use a new metadata generation with the snapshot
revision as the initial pull checkpoint. Recovery records remain until explicitly
dismissed or reapplied. Reapplication checks the current local revision and uses
the current server identity/version; it never silently overwrites a newer edit.

## Replication failure diagnostics

Replication SHALL preserve specific transport failures through RxDB's wrapped
error events instead of replacing them with a generic retry message. The UI and
worker logs MAY expose only an allowlisted failure code, operation, HTTP status,
validated correlation UUID and RxDB error code. Never log native error objects,
request/response bodies, credentials or library documents. Network/messaging,
authentication, forbidden origin/CSRF, missing API routes, invalid documents,
body-size limits and malformed successful responses SHALL remain distinguishable.
Non-JSON HTTP failures SHALL retain their HTTP status rather than be misreported
as network failures. Internal storage errors SHALL include a safe RxDB code for
recovery diagnosis. A new sync cycle may clear its prior error after progress;
receiving a wrapping error event SHALL NOT erase the specific cause.

The extension worker SHALL recognize reset-required response codes through a local
type guard that narrows unknown data to the code-bearing shape only; it SHALL NOT
assert that the full API error envelope has been validated.
