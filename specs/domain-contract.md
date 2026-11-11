# Shared domain contract v1

`packages/contracts` owns framework-independent models and domain rules.
See [Product data rules](functionality.md#3-domain-identity-and-validation),
[Conventions](conventions.md) and [Baseline decisions](../implementation/baseline-decisions.md).

## Representation

| Concern          | Contract                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation       | Typed shared models only; no runtime parsers/client DTO validation. Server DTOs use class-validator/class-transformer without implicit coercion            |
| Identity         | Primitive strings for UUIDs, provider IDs, timestamps, versions and cursors; no branding/primitive aliases. Preserve namespace, prefixes and leading zeros |
| Envelopes        | `schemaVersion: 1`; UTC timestamps include milliseconds                                                                                                    |
| Versions/cursors | Canonical decimal strings, at most 128 digits. Versions start at 1; cursors at 0. Guest/new entries have null serverVersion                                |
| Missing metadata | Null scalars and array collections; never invent numeric zeros                                                                                             |
| Metadata meaning | Separate category/format, declared/available episodes, personal/provider ratings and original/localized text                                               |
| Language         | Request explicit `Locale.En`/`Locale.Ru`; display selections report requested/actual language, provenance and catalog/user/fallback origin                 |
| Sources          | `generic-v1` [normalization](../implementation/baseline-decisions.md#viewing-source-normalization), original URLs/order and duplicate rejection            |

## Edits and replication

Ordinary PATCH accepts category, userTitle, status, rating, progress, comment and sourceUrls.
No-ops preserve timestamps/version; semantic edits require nondecreasing server time and
increasing versions. Metadata refresh is not a user edit and preserves user fields,
known metadata and other translations. Match catalog identity → verified compatible
references → saved sources; report contradictions/category conflicts deterministically.
Unverified references do not prove identity.

Replication uses `ConflictReason` values `VERSION`, `IDENTITY`, `SOURCE`, `CATEGORY`,
cursor/entry-ID checkpoints, assumed/proposed documents and batches up to 100 rows.
Reject duplicate/mismatched IDs and invalid batches. Pull includes tombstones; private
snapshots include hidden entries but exclude tombstones. Preserve rejected intent separately.

## Backup and errors

Backups contain `{ schemaVersion: 1, entries: [...] }` with active entry data, excluding
per-entry schemaVersion, serverVersion, deletion state, account/settings data and credentials.
Reject missing/invalid timestamps, unknown fields and legacy formats; see
[Backup behavior](functionality.md#8-backup-and-restore).

HTTP errors include numeric `status`, boolean `retryable`, stable code, safe message and
correlation ID. Distinguish forbidden/body-size/content-type/unavailable/unexpected failures;
validation details never contain submitted values.

## Shared enum organization

Keep each domain enum in its own module and re-export it. Use `ApiErrorCode`, with
`SyncErrorCode` reusing existing API codes rather than duplicating them.
Shared operation names and safe diagnostics use `SyncOperation`/`SyncDiagnostic`.
Use enum members in production consumers/message maps and derive allowlists with
`Object.values`; sanitization stays extension-owned. Preserve serialized values.
Keep storage keys, UI copy and private runtime constants in their owning application.

Server builds consume generated contract declarations and build contracts first.
Tools compiling DTO imports must enable NestJS-compatible legacy decorators.
