# Shared domain contracts

Plain TypeScript v1 models and framework-independent domain helpers. This package
has no runtime dependencies or parsers. Use typed models directly; server request
validation stays in `apps/api` with class-validator/class-transformer.

`previewEntryPatch` builds a draft from an `EntryPatch` without mutating the entry.
`applyEntryPatch` applies the supplied server time/version only for semantic edits.
The caller supplies authoritative time/version and handles ownership and transactions.
URL normalization uses the standard `URL` serializer.

Display helpers preserve language and provenance. Metadata enrichment preserves known
values, other translations and user fields. Identity matching reports conflicts
instead of merging ambiguous entries.

Backup and replication envelopes remain TypeScript models. Persistence, native RxDB
adaptation and atomic backup restore belong to their later implementation steps.

Shared enums each live in a separate module, re-exported from `src/index.ts`.
Use `ApiErrorCode` for API failures (including `SyncResetRequired`),
`SyncErrorCode` for synchronization-specific failures, and `SyncOperation` for
worker/page operation names. `SyncDiagnostic` carries their typed safe metadata.
Consumers reference enum members; serialized values remain unchanged. Application
message maps and private storage/logging constants stay with their owning app.
