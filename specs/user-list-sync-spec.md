# External list synchronization

## Purpose

Bidirectional synchronization between a Filecab library and an explicitly connected
external account. Shikimori is the first adapter. This is separate from catalog
providers and extension-to-Filecab RxDB replication.

## Requirements

### Provider abstraction

Use adapters behind one backend service. Each declares connection/refresh/disconnect,
verified account lookup, complete-list/item reads, create/partial-update/delete support,
and category/field/status/pagination/rate/revision/mutation limitations.
Unsupported behavior returns a capability result; provider HTTP DTOs remain backend-only.

### Separation from catalog providers

List connections read/write personal lists, not catalog discovery. Connecting a provider
must not alter Filecab login or grant another service access. Embedded title metadata
may support import/identity without enabling general catalog search.

### Account connection

Only the authenticated owner may connect, inspect, sync, pause or disconnect.
Use provider authorization, state validation and minimum scopes; verify identity through
the authorized API, never submitted names/IDs. Google remains Filecab login.
Encrypt recoverable provider credentials with a server key; exclude them from client
responses, logs, backups, sharing, replication and content scripts. They cannot merely
be hashed because upstream refresh needs them.
Allow one connection per provider per Filecab account and one Filecab owner per remote
account. Relinking a different account needs confirmation, a new generation and fresh
mappings/jobs.

### Common sync records

Persist account ID, scopes/capabilities, expiry, generation, field policy, state and last
success per connection. Per item, retain Filecab UUID, verified media reference, separate
remote list-record ID, common field baseline, remote revision/time and acknowledged
operation. Common fields are status, score and episode progress. Preserve provider-only
statuses/rewatch data in namespaced metadata without changing unrelated fields.

### Identity resolution

Only verified references or confirmed mappings authorize links/writes; titles and equal
numbers do not. Unresolved entries stay usable and require identification before export.
Imports retain stable UUIDs, verified references and usable snapshots without duplicates.
Optional catalog enrichment must not gate a valid import.

### Initial synchronization

Read the full remote list and server-committed Filecab library, then preview additions
and conflicts. Require explicit resolution for overlapping unequal fields. Users may
confirm selected changes, retain unresolved items or cancel without external writes.
Imports use ordinary ownership/version validation and publish replication changes.

### Field policy and privacy

Sync enabled, representable status/score/progress fields only. Do not export private
notes, viewing URLs, hidden-state semantics or local-only fields by default; preserve
unowned remote fields. Unsupported values become recoverable item issues, never silent
conversion/clamping/clearing/deletion. Preserve original values behind lossy projections;
a display difference alone must not trigger reverse export.

### Three-way reconciliation

Compare each field on both sides with its last acknowledged baseline. Propagate one-sided
changes, converge identical changes and combine independent fields; pause conflicting
same-field edits for user resolution. Revalidate both sides before applying a decision.
Wall-clock timestamps alone do not choose winners. Without conditional writes, read
before and verify after writing; do not claim atomic protection from remote races.

### Scheduling and asynchronous writes

Support manual sync and debounced scheduling after relevant committed Filecab edits.
Check remote lists every configurable 15 minutes initially, subject to quotas/fairness;
this is eventual, not realtime. Offline edits replicate to Filecab before export.
CRUD never waits for provider availability. Durable PostgreSQL jobs/outbox handle
side effects and restart retries; they are distinct from RxDB metadata. Jobs carry
connection generation and entry version, coalesce superseded work and recheck state.

### Retry safety and feedback-loop prevention

Serialize per connection/target. Use provider idempotency or reconcile uncertain outcomes
before retrying; write absolute progress, never increments. Retain acknowledged remote
values and operation provenance. Imports update the baseline rather than immediately
re-exporting as new user edits. Repeated scans converge without unnecessary writes.

### Complete scans and missing records

Read all statuses/pages. Partial, interrupted, filtered, private or throttled reads are
not complete snapshots. Deduplicate mutable pagination across bounded passes; do not
claim point-in-time isolation without provider support. Only a complete scan establishes
absence, which creates a removal issue rather than deleting Filecab data. Unresolved
removals must not repeatedly recreate deliberately removed items.

### Explicit deletion policy

Disable automatic destructive propagation. Resolve removals by restoring/recreating,
retaining one side with durable suppression/unlink, or explicitly confirming deletion
on the other side. Remote deletion requires verified ownership/mapping and fresh checks.
Local delete/Undo never triggers irreversible remote deletion without this decision.

### Pause, disconnect, and authorization loss

Pause blocks new side effects but keeps connection data. Disconnect invalidates generation,
cancels jobs, removes credentials and retains Filecab entries; revoke upstream tokens
only if supported. Recheck generation/permissions before every mutation. In-flight work
may finish and cannot be promised undone. Invalid authorization pauses for reconnection;
provider failure never erases libraries.

### User-visible state and API documentation

Expose account/connection state, enabled fields, last successful scan, pending/running
counts, unresolved mappings, conflicts/removals and retryable failures. Owners can
connect, pause/resume, disconnect, request sync, preview and resolve issues.
Swagger covers Filecab auth, provider consent, field mappings and asynchronous status;
client-facing operations never require provider tokens.

## Reliability verification

Test initial sync, duplicates, independent/same-field edits, remote races, suppressed
removals, delete/Undo, relinking, refresh, restart, uncertain responses, throttling,
interrupted scans and feedback-loop prevention.
