# External list synchronization

## Purpose

Two-way synchronization between a Filecab library and an external account that the owner
connects. Shikimori is the first adapter. This is separate from catalog providers and from
extension replication.

## Requirements

### Provider abstraction

Use adapters behind one backend service. Each adapter declares:

- connect, refresh and disconnect;
- verified account lookup;
- complete-list and item reads;
- create, partial update and delete support;
- limits of categories, fields, statuses, pagination, rate, revisions and mutations.

Unsupported behavior returns a capability result. Provider HTTP DTOs stay on the backend.

### Separation from catalog providers

A list connection reads and writes personal lists. It does not provide catalog discovery.
Connecting a provider does not change Filecab login or give another service access.
Embedded title metadata can support import and identity. It does not enable catalog search.

### Account connection

- Only the authenticated owner can connect, inspect, sync, pause or disconnect.
- Use provider authorization, state validation and minimum scopes.
- Verify the remote identity through the authorized API. Never trust a submitted name or ID.
- Google stays the Filecab login.
- Encrypt provider credentials with a server key. They must be recoverable for upstream refresh, so a hash is not sufficient.
- Exclude credentials from client responses, logs, backups, the public library, replication and content scripts.
- One connection for each provider and Filecab account. One Filecab owner for each remote account.
- Linking a different remote account needs confirmation, a new generation and new mappings and jobs.

### Sync records

For each connection, store the account ID, scopes and capabilities, expiry, generation,
field policy, state and last success.

For each item, store the Filecab UUID, the verified media reference, the separate remote
record ID, the common field baseline, the remote revision or time and the acknowledged operation.

Common fields are status, score and episode progress. Keep provider-only statuses and
rewatch data in namespaced metadata. Do not change unrelated fields.

### Identity resolution

Only verified references or confirmed mappings permit links and writes. Titles and equal
numbers do not. Unresolved entries stay usable. They need identification before export.
Imports keep stable UUIDs, verified references and usable snapshots without duplicates.
Optional catalog enrichment must not block a valid import.

### Initial synchronization

1. Read the complete remote list and the committed Filecab library.
2. Preview additions and conflicts.
3. Ask the user to resolve overlapping unequal fields.
4. The user confirms selected changes, keeps unresolved items or cancels. Cancel writes nothing externally.

Imports use the ordinary ownership and version checks and publish replication changes.

### Field policy and privacy

- Synchronize only enabled, representable status, score and progress fields.
- By default, do not export notes, viewing URLs, hidden-state meaning or local-only fields.
- Keep remote fields that Filecab does not own.
- An unsupported value becomes a recoverable item issue. Never convert, clamp, clear or delete it silently.
- Keep the original value behind a lossy projection. A display difference alone must not start a reverse export.

### Three-way reconciliation

Compare each field on both sides with its last acknowledged baseline.

| Change                         | Result                    |
| ------------------------------ | ------------------------- |
| One side changed               | Propagate it              |
| Both sides changed identically | Converge                  |
| Different fields changed       | Combine                   |
| Same field changed differently | Pause for user resolution |

Check both sides again before you apply a decision. Wall-clock time alone never selects a
winner. Without conditional writes, read before and verify after each write. Do not claim
atomic protection from remote races.

### Scheduling

- Support manual sync and debounced sync after committed Filecab edits.
- Check remote lists every 15 minutes by default. The interval is configurable and depends on quotas and fairness. This is eventual, not realtime.
- Offline edits replicate to Filecab before export.
- CRUD never waits for a provider.
- Durable PostgreSQL jobs handle side effects and retries after restart. They are separate from RxDB metadata.
- Jobs carry the connection generation and the entry version. Combine superseded work. Check state again before each job.

### Retry safety

- Serialize work for each connection and target.
- Use provider idempotency, or reconcile an uncertain result before a retry.
- Write absolute progress. Never write increments.
- Keep acknowledged remote values and operation provenance.
- An import updates the baseline. It does not export the change again as a new edit.
- Repeated scans converge without unnecessary writes.

### Complete scans and missing records

Read all statuses and pages. Partial, interrupted, filtered, private or throttled reads
are not complete. Remove duplicates from changing pagination across bounded passes. Do not
claim a point-in-time view without provider support.

Only a complete scan can prove that a record is absent. Absence creates a removal issue.
It never deletes Filecab data. An unresolved removal must not recreate an item that the
user removed.

### Deletion policy

Never propagate deletion automatically. Resolve a removal by one of these actions:

- restore or recreate the item;
- keep one side, with durable suppression or unlink;
- confirm deletion on the other side explicitly.

Remote deletion requires verified ownership and mapping and fresh checks. A local delete
or Undo never starts an irreversible remote deletion without this decision.

### Pause, disconnect and authorization loss

- Pause blocks new side effects and keeps connection data.
- Disconnect changes the generation, cancels jobs, removes credentials and keeps Filecab entries. Revoke upstream tokens if the provider supports it.
- Check the generation and permissions before each mutation.
- Work in progress can finish. Do not promise to undo it.
- Invalid authorization pauses the connection until reconnection.
- A provider failure never erases a library.

### Visible state and API documentation

Show account and connection state, enabled fields, last successful scan, pending and
running counts, unresolved mappings, conflicts, removals and retryable failures. Owners
can connect, pause, resume, disconnect, request sync, preview and resolve issues.

Swagger covers Filecab authentication, provider consent, field mappings and asynchronous
status. Client operations never require provider tokens.

## Verification

Test initial sync, duplicates, edits to different and same fields, remote races,
suppressed removals, delete and Undo, relinking, refresh, restart, uncertain responses,
throttling, interrupted scans and feedback-loop prevention.
