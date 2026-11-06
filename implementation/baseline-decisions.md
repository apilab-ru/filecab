# Implementation Baseline Decisions

These decisions complete implementation-plan step 1 and are normative alongside the linked specifications. They define target behavior, not implemented functionality. Future changes must update the affected specifications and requirement checklist before implementation.

## Scope and client storage

Required delivery includes Google accounts, extension replication, sharing, server-managed parser configuration, provider metadata caching, and optional owner-connected Shikimori personal-list synchronization. Connecting an account is optional for an extension guest; delivering these capabilities is required. `plans.md` and the remaining recommendations in Functionality section 13 are excluded from this delivery.

The extension uses one fixed-name, device-local RxDB/Dexie database and supports offline library operations. Sign-in/sign-out keep the same library and editor visible; future account replication requires explicit linking and account-bound synchronization metadata. The authenticated website uses online API operations and an in-memory TanStack Query cache; it has no persistent library or offline mutation queue. Network failures preserve unsaved form input and offer retry. Interface preferences may persist independently and are not replicated with the library.

## Progress and provider roles

Progress is a nonnegative JavaScript-safe integer. Exceeding a known positive total produces a warning and remains saveable. Unknown/zero provider totals normalize to null. No progress action automatically changes viewing status.

Catalog defaults are `anime=smotret`, `films=kinopoisk-dev`, and `tv=kinopoisk-dev`, expressed explicitly in deployment configuration. Activation still requires provider verification. A disabled default produces an unavailable-provider error rather than silent switching. Shikimori is exclusively a personal-list connection, not a general catalog or genre provider. Catalog availability never gates manual library CRUD.

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
