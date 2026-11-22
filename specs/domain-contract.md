# Shared domain contract v1

## Purpose

`packages/contracts` owns framework-independent models and domain rules.
[Functionality](functionality.md#3-domain-identity-and-validation) owns the product data rules.

## Representation

| Concern          | Rule                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation       | Shared models are types only. No runtime parsers and no client DTO validation. Server DTOs use class-validator and class-transformer without implicit coercion. |
| Identity         | UUIDs, provider IDs, timestamps, versions and cursors are primitive strings. No branded types or aliases. Keep namespaces, prefixes and leading zeros.          |
| Envelopes        | Use `schemaVersion: 1`. UTC timestamps include milliseconds.                                                                                                    |
| Versions         | Canonical decimal strings, at most 128 digits. Versions start at 1. Cursors start at 0. Guest and new entries have a null `serverVersion`.                      |
| Missing metadata | Use null scalars and null array collections. Never invent numeric zeros.                                                                                        |
| Metadata meaning | Keep category and format, declared and available episodes, personal and provider ratings, and original and localized text separate.                             |
| Language         | Request `Locale.En` or `Locale.Ru` explicitly. Display values report requested and actual language, provenance and origin: catalog, user or fallback.           |

## Viewing-source normalization

An entry has no viewing link or one viewing link. The link keeps its original URL and its
normalized URL. One normalized URL can belong to only one active entry of an owner.

- A save from the popup Page tab can add the link to an entry or replace the link of an entry. An import can add the link.
- Other edits cannot add or change the link. They can only remove it.
- When a Page tab save uses a link of another active entry, the link moves. One operation removes it from the other entry and adds it to the saved entry. Both entries get a new version.
- A merge keeps the link of the entry with the latest modified time. If that entry has no link, the merge keeps the link of the other entry.

The `generic-v1` policy:

1. Parse an absolute HTTP or HTTPS URL. Reject embedded credentials.
2. Change the scheme and host name to lowercase.
3. Serialize with the standard URL rules, which remove default ports.
4. Keep all other parts: scheme differences, path case, trailing slash, query parameters and their order, and fragments.

Do not treat HTTP and HTTPS as equal. Do not remove `www`. Exact matching uses the
serialized result.

Only fixture-verified host and path adapters can also change episode paths to title
paths or remove allowlisted tracking parameters. Keep the original URL. Version the
policy. A policy change must preview collisions and apply a migration. It must not
silently move ownership. Home and search URLs can be viewing sources, but they do not
prove media identity.

## Mutation and clearing semantics

An ordinary PATCH accepts `category`, `userTitle`, `status`, `rating`, `progress`,
`comment` and `sourceUrls`. `sourceUrls` holds at most one URL. In a PATCH it can repeat
the current link, be empty, or set a new link. Only the popup Page tab sends a new link.

| Input            | Meaning                   |
| ---------------- | ------------------------- |
| Field omitted    | No change                 |
| `status: null`   | Clear the status          |
| `rating: 0`      | Clear the personal rating |
| `progress: 0`    | Reset progress            |
| `comment: ""`    | Empty note                |
| `sourceUrls: []` | Remove the viewing link   |

Null never clears a required category, title, identity or version. A PATCH cannot change
server timestamps, ownership or catalog provenance. Snapshot refresh is a separate
catalog operation.

- A no-op keeps timestamps and version.
- A semantic edit needs a server time that does not decrease and a version that increases.
- Entry changes and source changes commit together.
- Setting a catalog association requires verified resolution and duplicate and category checks.
- Removing a catalog association keeps the snapshot, UUID and user fields. The entry then needs a valid manual title.
- A metadata refresh is not a user edit. It keeps user fields, known metadata and other translations.

## Matching

Match in this order: catalog identity, then verified compatible references, then saved
sources. Report contradictions and category conflicts deterministically. Unverified
references do not prove identity.

## Replication models

- `ConflictReason` values: `VERSION`, `IDENTITY`, `SOURCE`, `CATEGORY`.
- Checkpoints contain a cursor and an entry ID.
- Push rows contain an assumed document and a proposed document. A batch has at most 100 rows.
- Reject duplicate or mismatched IDs and invalid batches.
- Pull includes tombstones. Private snapshots include hidden entries and exclude tombstones.
- Keep rejected intent separately.

## Backup format

A backup is `{ schemaVersion: 1, entries: [...] }`. Each entry keeps its UUID, optional
catalog ID, category, user fields, ordered sources, metadata with provenance and valid
creation and modification timestamps. A null `catalogId` identifies a manual entry.

Exclude per-entry `schemaVersion`, `serverVersion`, deletion state, account data,
settings and credentials. Reject missing or invalid timestamps, unknown fields and old
formats. Product rules are in [Backup and restore](functionality.md#8-backup-and-restore).

`toBackup` builds a backup from active entries. `compareBackup` reports the counts and
conflicts of a replacement for the server and the extension. Neither is a parser.
Validation stays in the API DTOs and in the extension backup validator.

## Errors

HTTP errors include a numeric `status`, a boolean `retryable`, a stable code, a safe
message and a correlation ID. Keep forbidden, body size, content type, unavailable and
unexpected failures separate. Validation details never contain submitted values.

## Enums

- Keep each domain enum in its own module and re-export it.
- `SyncErrorCode` reuses `ApiErrorCode` values. Do not duplicate them.
- Use `SyncOperation` and `SyncDiagnostic` for operation names and safe diagnostics.
- Production code uses enum members. Derive allowlists with `Object.values`.
- Sanitization stays in the extension.
- Keep serialized values unchanged.
- Storage keys, UI text and private runtime constants stay in their application.

## Build

Server builds use generated contract declarations, so build contracts first. Tools that
compile DTO imports must enable NestJS-compatible legacy decorators.
