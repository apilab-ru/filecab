# User List Synchronization Specification

## Purpose

Provide a common backend capability for bidirectional synchronization between a Filecab account's library and a connected external account's personal media list. Shikimori SHALL be the first implementation. This capability SHALL remain separate from catalog search providers and from RxDB extension-to-Filecab replication.

## Requirements

### Requirement: Provider abstraction

External list synchronization SHALL use provider adapters behind one common application service. Each adapter SHALL define connection/refresh/disconnection behavior, verified remote account lookup, complete-list reading, per-item reading, creation, partial update, and supported deletion behavior.

Capabilities SHALL describe supported categories, fields, statuses, pagination, rate limits, revision information, mutation semantics, and known limitations. Unsupported behavior SHALL return an explicit capability result rather than simulate success. Provider-specific fields and HTTP DTOs SHALL remain backend-only.

### Requirement: Separation from catalog providers

Catalog providers SHALL supply discovery/metadata; list-sync providers SHALL read and update an explicitly connected user's external list. A provider MAY implement one role without implementing the other.

Connecting a list provider SHALL NOT make it a catalog search provider, change Filecab login, or grant another external service access. Minimal title metadata supplied with list records MAY support import and identity reconciliation without enabling general catalog search.

### Requirement: Account connection

Only an authenticated Filecab owner SHALL connect, inspect, synchronize, pause, or disconnect their external account. Connection SHALL use the provider's supported authorization flow with state validation and least required scopes. Verify remote account identity through the authorized provider API rather than trust a submitted username or user ID.

Google remains Filecab authentication. Provider authorization SHALL be a separate optional account connection. Access/refresh credentials SHALL be encrypted at rest with a server-held encryption key, excluded from logs/responses/backups/shared projections, and never sent to extension content scripts. Unlike opaque Filecab refresh-session credentials, provider refresh tokens must be recoverable for upstream refresh and therefore cannot merely be hashed.

A Filecab account SHALL have at most one active connection per list provider initially. The same remote provider account SHALL not be connected to multiple Filecab accounts concurrently. Reconnecting a different remote account SHALL create a new connection generation, require confirmation, and never reuse old mappings or pending jobs.

### Requirement: Common sync records

For each connection, persist verified remote account ID, granted capabilities/scopes, authorization expiry, connection generation, selected field policy, sync state, and last successful synchronization time.

For each linked item, persist Filecab entry ID, verified remote media reference, remote list-record ID, last common synchronized values, remote revision/time when supplied, and last acknowledged operation. Remote media ID and remote list-record ID SHALL be distinct.

Supported common fields SHALL include viewing status, personal score, and episode progress. Provider-only statuses/rewatch metadata SHALL be preserved in namespaced synchronization metadata without changing unrelated Filecab fields.

### Requirement: Identity resolution

Items SHALL be linked only by verified media references or explicit confirmed mappings. Title similarity or numerical equality across namespaces SHALL not authorize remote writes. An unresolved local entry SHALL remain locally usable and SHALL be shown as requiring identification before export.

Imported remote entries SHALL retain a stable Filecab UUID, verified provider reference, and a usable minimal snapshot. Catalog enrichment SHALL be optional; a catalog outage SHALL not discard an otherwise valid list record. Repeated imports SHALL not duplicate linked entries.

### Requirement: Initial synchronization

First synchronization SHALL read the remote list and the server-committed Filecab library, then present an initial reconciliation preview. Non-conflicting additions from either side MAY be proposed; overlapping entries with different synchronized values SHALL require explicit resolution before overwriting.

Users SHALL be able to confirm selected changes, retain unresolved entries, or cancel without external writes. A successful initial import SHALL pass through ordinary Filecab ownership/version validation and publish RxDB replication changes.

### Requirement: Field policy and privacy

Status, score, and episode progress SHALL synchronize bidirectionally where representable. Private Filecab notes, viewing URLs, hidden-state semantics, and local-only fields SHALL NOT be exported by default. An adapter SHALL update only explicitly enabled fields and SHALL preserve unowned remote fields.

Unrepresentable statuses, values, or progress SHALL produce a recoverable item issue rather than silent conversion, clamping, clearing, or deletion. Lossy display projections SHALL retain the original remote value and SHALL not be exported back solely because their representation differs.

### Requirement: Three-way reconciliation

The service SHALL compare current Filecab values and current remote values against the last acknowledged common baseline, per field. One-sided changes SHALL propagate; identical changes SHALL converge; independent changes to different fields MAY combine. Conflicting changes to the same field SHALL pause that field and require a user decision.

Cross-system wall-clock timestamps SHALL NOT decide winners by themselves. Explicit conflict resolution SHALL revalidate both sides before applying. A provider with no conditional-write API SHALL use a fresh read before write and post-write verification, but the system SHALL NOT claim atomic protection from simultaneous edits on that provider.

### Requirement: Scheduling and asynchronous writes

Manual synchronization and debounced scheduling after relevant server-committed Filecab edits SHALL be supported. Periodic remote checks SHALL run at a configurable interval, initially 15 minutes while connected and enabled, subject to provider quotas and fair scheduling. This is eventual synchronization, not a realtime guarantee.

Only changes already committed to the Filecab backend SHALL be eligible for export. Offline extension changes SHALL first pass through RxDB replication. Filecab CRUD success SHALL not wait for the external provider to become available.

A durable PostgreSQL job/outbox SHALL coordinate external side effects and retries after server restart. This backend job mechanism SHALL NOT duplicate or replace RxDB's client replication metadata. Jobs SHALL reference connection generation and relevant entry version, coalesce superseded work, and re-evaluate state before execution.

### Requirement: Retry safety and feedback-loop prevention

Serialize reconciliation/mutations for the same connection and remote target. Use idempotency where supported; otherwise read/reconcile before retrying an uncertain create/update. Progress writes SHALL use absolute values rather than non-idempotent increments.

Store acknowledged remote values and operation provenance. A change imported from the provider SHALL update its synchronization baseline and SHALL not be exported immediately as a fresh user edit. Repeated scans SHALL converge without unnecessary writes.

### Requirement: Complete scans and missing records

List acquisition SHALL account for all supported statuses and pages. Partial, interrupted, filtered, private, or throttled responses SHALL NOT establish a complete snapshot. Mutable remote pagination SHALL be deduplicated and reconciled across bounded passes where necessary; the service SHALL not claim point-in-time snapshot isolation without provider support.

Remote absence SHALL only be recognized after a successful complete scan, and SHALL create a deletion/removal issue rather than silently delete Filecab data. Newly imported identities SHALL not repeatedly recreate items deliberately removed on one side while their removal remains unresolved.

### Requirement: Explicit deletion policy

Automatic destructive deletion propagation SHALL be disabled by default. Deleting an entry in Filecab SHALL NOT immediately delete its remote list record. Removing a remote item SHALL NOT automatically delete its Filecab entry.

The user SHALL be able to resolve a detected removal by restoring/recreating the missing side, retaining one side with a durable suppression/unlink decision, or explicitly confirming deletion on the other side. Confirmed remote deletion SHALL address the verified owner's mapped list record and revalidate it before sending. Local delete/undo SHALL not trigger an irreversible remote operation without that decision.

### Requirement: Pause, disconnect, and authorization loss

Pause SHALL prevent new provider side effects while retaining connection data. Disconnect SHALL invalidate the connection generation, cancel pending jobs, remove stored provider credentials, and retain Filecab entries. Token revocation SHALL be attempted only if supported by the provider.

Before every external mutation, recheck connection generation and permission. Already in-flight remote operations may complete; disconnect SHALL not claim to undo them. Invalid authorization SHALL pause synchronization and request reconnection. Provider failures SHALL never erase local/server libraries.

### Requirement: User-visible state and API documentation

Expose connection status, remote account identity, enabled fields, last successful scan, pending/in-progress counts, per-item conflicts/unresolved mappings, and retryable failures through authenticated API operations. Users SHALL be able to connect, pause/resume, disconnect, request a sync, inspect preview/results, and resolve conflicts/removals.

Swagger SHALL describe these operations, application authentication, provider-consent redirects, asynchronous job status, and field mappings. Provider access tokens SHALL not be needed in client-facing Swagger requests.

### Requirement: Reliability verification

Verification SHALL cover initial reconciliation, duplicate prevention, independent/same-field edits, remote race limitations, suppressed removals, delete/undo, account relinking, token refresh, process restart, ambiguous request outcomes, rate limiting, interrupted scans, and feedback-loop prevention. No scenarios are required in this specification file.
