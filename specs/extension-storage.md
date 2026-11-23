# Extension storage

## Purpose

This document defines device persistence and replication in the extension.
[Backend](backend.md#extension-replication) defines the server side of replication.

## Local database

- RxDB with Dexie is the source of truth for the device library.
- Use one database with the fixed name `filecab-local`.
- The popup and the full page open this database directly, with multi-instance notifications.
- No library write depends on a running MV3 worker.
- Web Locks serialize repository reads and writes across surfaces.
- When Web Locks are missing or storage access fails, enter recovery. Never use volatile storage instead.

Sign-out keeps the device entries and the open editor. First sign-in keeps a guest
library until the user confirms the first link. When a different account signs in
on a linked device, replace the device library as specified in Account binding.
Keep interface settings. Do not store credentials in library or settings collections.

Support these operations offline: manual CRUD, browsing, filters, import and export, and
available snapshots. Show catalog operations as offline. Acknowledge a save only after a
durable write. Keep pending changes after the interface closes, the browser restarts or
the worker stops.

## Entries and revisions

- Store one document for each entry. It contains the snapshot, sources, tombstone state and local revision data.
- Each single-entry write stores its next local revision and a millisecond update time in the same document.
- The library revision is the highest revision of all documents, including tombstones. Never remove tombstones physically.
- An expected local revision prevents stale edits.
- Check active catalog and source claims under the same lock.
- A link move from a popup Page tab save writes both entries under the same lock. Each entry gets its next local revision. Replicate the entry that loses the link before the entry that gets it.
- A semantic no-op keeps the time and revision.
- Local revisions are safe integers. Fail when they are exhausted.

## Delete and Undo

Deletion stores the previous entry and a 10-second Undo deadline with the tombstone.
Undo checks that exact deletion revision and the deadline. It restores the previous data
and timestamps and allocates a new local revision. A conflicting active source or catalog
claim blocks the restore without data changes.

## Settings

Store settings in a separate collection, keyed by category and Library or Catalog mode.
Use expected revisions for settings writes.

## Schemas and recovery

- Each collection has a versioned storage schema. Version zero is the first supported version.
- Register the RxDB migration plugin. Give each collection an explicit migration strategy map.
- A schema change increases the version and adds a migration. Test that the migration keeps existing data.
- The synchronization issue collection uses version 1. Its migration keeps version 0 issues and all entries unchanged.
- The merge journal collection uses version 2. It records an account replacement and its entries in one document. Its migration keeps earlier journals unchanged.
- The binding collection uses version 1. Its migration keeps version 0 bindings and their checkpoints.
- Validate storage writes with build-time AJV standalone validators that work under the extension CSP. Bundle a validator for each supported old schema version, because migration validates old documents.
- These validators are private to storage. They are not shared request parsers or client DTO validation.
- Check stored records against the same schemas before showing data.

Create empty storage only when no storage exists. When a read fails:

- keep all bytes;
- show Retry;
- allow a best-effort raw IndexedDB export, also when the store cannot be read;
- never remove or recreate the database automatically.

## Backup and restore

The extension exports, validates and restores the device library offline. Use the
[backup rules](functionality.md#8-backup-and-restore).

- Validate the backup shape with a build-time AJV standalone validator from `backup.schema.json`. It is private to the extension, like the storage validators.
- Extension checks then validate links, timestamps and duplicate UUIDs, catalog IDs and links. Each issue reports the entry index.
- The preview uses the same counts and conflicts as the server preview. The confirmation binds the bound account or the device, the SHA-256 digest of the file and the local library revision.
- Restore runs under the write lock. It checks the binding, the digest and the revision again.
- Restore stores all changed rows in one merge journal document, then applies them. An interruption finishes the journal on the next locked operation.
- Rows get new local revisions: tombstones for removed entries first, then added and updated entries. An existing UUID keeps its `serverVersion`. A new UUID gets a null `serverVersion`.
- Ordinary replication then pushes the rows. The server sets versions, timestamps and snapshots again.
- The popup shows Export. Restore opens the full-page settings, because a file picker closes the popup.

## Replication

Replicate the `entries` collection with the RxDB 17.6.0 replication plugin.

- Transport handlers map wrapper documents to v1 entries. Local revision and Undo fields never reach the API.
- Wrapper documents keep RxDB `_deleted` false for retained records. `entry.deleted` maps to the API tombstone field `deleted`.
- The conflict equality function compares entry state. It ignores wrapper data.

### Rejected intent

Before a conflict resolves to the server document, store any different editable or
deletion intent in a separate issue collection.

- The issue collection is a recovery log. It is not a mutation queue.
- A failed issue write prevents the resolution.
- A conflict without an owned server document becomes a local tombstone. Its original proposal stays available for editing and reapplication.
- A rejected row with a validation issue is stored as an issue of kind `validation`, with its problem path and message.
- Reapplication checks the current local revision and uses the current server identity and version. It never overwrites a newer edit.
- Issues stay until the user dismisses or reapplies them.

### Account binding

- Store one account binding and a reset generation in a separate collection.
- Only the bound account can replicate this library.
- When a different account signs in, download its server snapshot before changing device data.
- Replace the device entries with that snapshot. Discard the previous account's local entries, pending edits, recovery issues, Undo state and open drafts.
- Do not upload any data from the previous account. Do not change its server library.
- Record the replacement before it starts. Complete an interrupted replacement before another device write.
- Start a new replication generation from the downloaded snapshot. Do not upload the downloaded rows as local edits.
- If the download fails, keep the device entries and show Retry.
- First linking requires a preview of local and remote content, bound to the owner and both revisions, and explicit confirmation.
- Confirmation checks both revisions again before it stores the binding.
- After a restart, replication continues from RxDB metadata. Partial network results use retry-safe server writes.

### Worker bridge

The privileged worker serializes allowed replication and library requests with
authentication. It checks the requested owner against the credential and never returns
tokens. Content scripts cannot call these operations.

### Running replication

- Replicate while a library surface is open.
- Elect one synchronization surface with a Web Lock.
- Retry failures. Synchronize again on reconnect, on a periodic timer and on manual refresh.
- Closing a surface or stopping the worker must not lose pending state.
- Show active, error, suspended and reset states and the count of stored issues.
- Keep the same editor mounted during sign-out and status changes. Close the editor when the device library changes accounts.

### History reset

`SYNC_RESET_REQUIRED` stops uploads and requires explicit reconciliation.

1. Store reset-in-progress before any entry changes. An interruption then requires a retry, not normal replication.
2. Store all local documents in a labeled reset recovery log.
3. Replace entries with a fresh, revision-bound server snapshot.
4. Mark local documents that are absent from the server as local tombstones. Do not push these tombstones.
5. Start a new metadata generation. Use the snapshot revision as the first pull checkpoint.

## Diagnostics

Replication keeps specific transport failures from the RxDB wrapped error events. It does
not replace them with a generic retry message.

The UI and worker logs can show only an allowed failure code, the operation, the HTTP
status, a validated correlation UUID and the RxDB error code. Never log native error
objects, request or response bodies, credentials or library documents.

Keep these failures separate: network or messaging, authentication, forbidden origin or
CSRF, missing API route, invalid document, body size and malformed success response.
A non-JSON HTTP failure keeps its HTTP status. It is not a network failure. Storage errors
include a safe RxDB code.

A new sync cycle can clear its previous error after progress. A wrapping error event must
not erase the specific cause. The worker recognizes reset-required codes with a local type
guard. The guard checks only the code. It does not claim that the complete error body is valid.

## Verification

Test popup and full-page concurrency in unpacked Chromium, restart durability, worker
suspension, account isolation, stale edits, no-ops and clearing, Undo expiry and recovery.
