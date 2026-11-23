# External list synchronization

## Purpose

Manual one-way transfers between a Filecab library and an external account that the owner
connects. The owner starts each transfer with one of two separate actions:

| Action | Direction                 | Rule for different values                    |
| ------ | ------------------------- | -------------------------------------------- |
| Export | Filecab to remote account | Filecab values replace remote values         |
| Import | Remote account to Filecab | The owner selects changes in a preview first |

Shikimori is the first adapter. This is separate from catalog providers and from
extension replication. There is no automatic or two-way synchronization.

## Requirements

### Provider abstraction

Use adapters behind one backend service. Each adapter declares:

- connect, refresh and disconnect;
- verified account lookup;
- complete-list and item reads;
- create and partial update support;
- limits of categories, fields, statuses, pagination, rate and mutations.

Unsupported behavior returns a capability result. Provider HTTP DTOs stay on the backend.

### Separation from catalog providers

A list connection reads and writes personal lists. It does not provide catalog discovery.
Connecting a provider does not change Filecab login or give another service access.
Embedded title metadata can support import and identity. It does not enable catalog search.

### Account connection

- Only the authenticated owner can connect, inspect, export, import, pause or disconnect.
- Use provider authorization, state validation and minimum scopes.
- Verify the remote identity through the authorized API. Never trust a submitted name or ID.
- Google stays the Filecab login.
- Encrypt provider credentials with a server key. They must be recoverable for upstream refresh, so a hash is not sufficient.
- Exclude credentials from client responses, logs, backups, the public library, replication and content scripts.
- One connection for each provider and Filecab account. One Filecab owner for each remote account.
- Linking a different remote account needs confirmation, a new generation and new mappings.

### Sync records

For each connection, store the account ID, scopes and capabilities, expiry, generation,
field policy, state, last successful export and last successful import.

For each item, store the Filecab UUID, the verified media reference, the separate remote
record ID, the last acknowledged remote values and the provider-only metadata.

Common fields are status, score and episode progress. Keep provider-only statuses and
rewatch data in namespaced metadata. Do not change unrelated fields.

### Identity resolution

Only verified references or confirmed mappings permit links and writes. Titles and equal
numbers do not. Unresolved entries stay usable. Export skips them and reports them as
items that need identification. Imports keep stable UUIDs, verified references and usable
snapshots without duplicates. Optional catalog enrichment must not block a valid import.

### Export

1. The owner selects Export and confirms that Filecab values replace remote values.
2. Read the complete remote list. If the scan is not complete, stop and write nothing.
3. For each identified Filecab entry, compare the enabled fields with the remote record.
4. Create a remote record when it is missing and the entry has a supported status.
5. Update only the fields that differ. The Filecab value replaces the remote value.
6. Show the result: created, updated, unchanged, skipped and failed counts, with the skipped and failed items.

Export does not show a field preview. Export never deletes a remote record. A remote record
without a Filecab entry stays unchanged. Export uses the committed server library. Offline
edits that are not replicated yet are not exported.

### Import

1. The owner selects Import.
2. Read the complete remote list. If the scan is not complete, stop and change nothing.
3. Show a preview of additions and changed fields. An addition is a remote record without a Filecab entry. A change is an enabled field with a different value on each side.
4. The owner selects the additions and field changes to apply, or cancels. Cancel changes nothing.
5. Apply only the selected changes. The remote value replaces the Filecab value.
6. Show the result: added, updated, unchanged and failed counts.

Import never deletes a Filecab entry. A Filecab entry without a remote record stays unchanged.
Imports use the ordinary ownership and version checks and publish replication changes.
If a Filecab entry changes after the preview, skip that change and report it.

### Field policy and privacy

- Transfer only enabled, representable status, score and progress fields.
- By default, do not export notes, viewing URLs, hidden-state meaning or local-only fields.
- Keep remote fields that Filecab does not own.
- An unsupported value becomes a recoverable item issue. Never convert, clamp, clear or delete it silently.
- Keep the original value behind a lossy projection. A display difference alone must not change the remote value on export or appear as a change in the import preview.

### Jobs

- Export and import start only by an owner action. There is no periodic or debounced transfer.
- CRUD never waits for a provider.
- Durable PostgreSQL jobs run the reads and writes and continue after restart. They are separate from RxDB metadata.
- Run one job at a time for each connection. Disable Export and Import while a job runs.
- Jobs carry the connection generation. Check the generation and permissions before each write.
- An import preview stays valid until the owner applies or cancels it, or a new job starts.

### Retry safety

- Use provider idempotency, or read the remote record again before you retry an uncertain write.
- Write absolute progress. Never write increments.
- Record the acknowledged remote value after each verified write.
- Repeated exports without changes write nothing.

### Complete scans

Read all statuses and pages. Partial, interrupted, filtered, private or throttled reads
are not complete. Remove duplicates from changing pagination across bounded passes. Do not
claim a point-in-time view without provider support.

### Deletion policy

Export and import never delete data on either side. The absence of a record on one side
changes nothing on the other side. A local delete or Undo never starts a remote deletion.

### Pause, disconnect and authorization loss

- Pause blocks new jobs and keeps connection data.
- Disconnect changes the generation, cancels jobs, removes credentials and keeps Filecab entries. Revoke upstream tokens if the provider supports it.
- Work in progress can finish. Do not promise to undo it.
- Invalid authorization pauses the connection until reconnection.
- A provider failure never erases a library.

### Visible state and API documentation

Show account and connection state, enabled fields, last successful export and import,
running job and its progress, unresolved mappings and retryable failures. Show Export and
Import as two separate buttons. Owners can connect, pause, resume, disconnect, export,
import, review the import preview and resolve item issues.

Swagger covers Filecab authentication, provider consent, field mappings and asynchronous
job status. Client operations never require provider tokens.

## Verification

Test export creates and updates, export of unresolved and hidden entries, import preview,
selection and cancel, entries changed after the preview, duplicates, relinking, refresh,
restart, uncertain responses, throttling, interrupted scans and repeated exports without writes.
