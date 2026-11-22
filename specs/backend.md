# Backend

## Purpose

This document defines the private library API, Google sessions, extension replication,
the public library and parser configuration. [Domain contract](domain-contract.md) owns shared
models. [Catalog](catalog-spec.md) owns catalog services. [Extension storage](extension-storage.md)
owns the client side of replication.

## Accounts and sessions

### Google authentication

Use Google login only. Do not add password registration or password reset.
Identify an account by its verified Google `sub`. Do not identify it by email.

`GET /api/v1/auth/google/start` accepts `client=website|extension` and an allowlisted `returnTo`:

| Client    | Allowed `returnTo`                                          | Additional input                                   |
| --------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Website   | A configured website origin plus `/`                        | None                                               |
| Extension | `https://<configured-extension-id>.chromiumapp.org/filecab` | Random 43-character `attempt` and S256 `challenge` |

The server generates state, nonce, a Google PKCE verifier and an HttpOnly browser-binding
cookie. Store each login attempt in PostgreSQL. A login attempt is single-use.

The Google callback is `/api/v1/auth/google/callback`. Configure its exact public URL and
register it in Google Cloud. Validate state, code and error separately. Ignore other
callback parameters.

Exchange authorization codes only at the fixed Google HTTPS token endpoint. Verify the
ID-token signature with the fixed Google JWKS endpoint and RS256. Verify issuer, audience,
expiry, issue time, nonce, subject and authorized party when present. Limit request time
and response size. Create the account and its library in one transaction. Do not return
Google tokens to clients. Do not keep Google tokens as Filecab credentials.

### Website and extension login

The website starts login with a redirect. The extension starts login with
`identity.launchWebAuthFlow` in the privileged worker.

Website login sets two HttpOnly cookies with `Path=/` and `SameSite=Lax`:

| Environment | Access cookie           | Refresh cookie           | Secure |
| ----------- | ----------------------- | ------------------------ | ------ |
| Production  | `__Host-filecab-access` | `__Host-filecab-session` | Yes    |
| Local HTTP  | `filecab-access`        | `filecab-session`        | No     |

Website redirects contain no credentials.

The extension callback returns only a single-use exchange code and the initiating attempt.
`POST /auth/exchange` requires the code, the attempt and the original verifier.
Reusable extension tokens appear only in the JSON exchange and refresh responses.
Never put reusable credentials in URLs. Never expose them to content scripts.

Before the extension opens the login window, it reads
`GET /api/v1/auth/extension/config?extensionId=<id>`. This anonymous endpoint:

- validates the 32-letter Chrome extension ID;
- checks database availability and returns HTTP 503 when the database is unavailable;
- returns only the schema version, Google enablement and whether the extension origin is allowed;
- does not read credentials or library data.

When this check fails, the extension keeps its stored credentials and does not open the login window.

### Credentials and session lifetimes

Filecab access and refresh tokens are independent random 256-bit opaque values.
Store them as HMAC-SHA256 hashes with the server session key.

| Value            | Default            | Setting                 |
| ---------------- | ------------------ | ----------------------- |
| Access token     | 900 s (15 min)     | `AUTH_ACCESS_SECONDS`   |
| Absolute session | 2,592,000 s (30 d) | `AUTH_SESSION_SECONDS`  |
| Idle session     | 604,800 s (7 d)    | `AUTH_IDLE_SECONDS`     |
| Login attempt    | 600 s (10 min)     | `AUTH_LOGIN_SECONDS`    |
| Exchange code    | 60 s               | `AUTH_EXCHANGE_SECONDS` |

Each setting must be a validated, bounded positive integer. A session ends at the first
of its absolute or idle expiry. Google and provider tokens follow the expiry from their issuer.

Refresh rotates the credential. Refresh never extends the absolute expiry. Keep consumed
refresh hashes until the session expires, for replay detection. A replayed refresh or a
concurrent duplicate refresh revokes the complete session family, including the new
access token. Commit the revocation before the 401 response. A lost refresh response can
therefore require a new login.

Refresh, issue, logout and owner-wide revocation lock the account row. Library locks stay
independent of account locks.

### Session endpoints

`GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` and `POST /auth/logout-all`
use the authenticated credential. They never use a submitted owner ID.

- Bearer access is for the extension only. Access cookies are for the website only.
- Reject a request that carries both a bearer token and a cookie credential.
- A refresh credential cannot authorize owner reads.
- The website refreshes with cookies. The extension refreshes with a JSON body.
- Responses use `Cache-Control: no-store`.

### Extension credential storage

- Store the refresh token in `storage.local`, restricted to `TRUSTED_CONTEXTS`.
- Store the access token in trusted `storage.session`.
- Serialize login, refresh and logout in the worker.
- Clear local credentials before the refresh request. Worker suspension or an uncertain result then requires a new login, not a replay.
- Reject messages from content scripts and other extensions.
- Never return credentials to popup or full-page messages.
- A missing worker reply is a recoverable error. It must not replace account state with `undefined`.

Trusted sender checks compare the extension identity, protocol, host and exact path.
They allow query strings and fragments.

### Authentication diagnostics

An authentication failure reports:

- the stage: storage, configuration, browser login, callback, exchange, refresh, account or logout;
- a stable diagnostic code;
- the HTTP status and correlation ID, when available.

Worker console logs contain only these fields and static outcome labels. Never log raw
exception messages, authorization or callback URLs, codes, state, nonce, verifiers,
tokens or response bodies. The UI shows safe guidance. It also shows collapsed public
connection details: extension ID and origin, callback URL and API origin.

### Account changes

An account change clears in-memory website queries and client account state.
Sign-out in one tab immediately shows signed-out state in other tabs. It also removes
private cached queries and mutations. Account observers stay subscribed during this
reset. After the reset, they read the server identity again.

Guest adoption and library replication are separate from login. See [Guest adoption](#guest-adoption).

## Library data

### Entry identity

CRUD addresses immutable entry UUIDs. A client can generate the UUID. Keep owner,
category, optional internal `catalogId` and namespaced provider references separate.
Equal provider numbers do not prove identity. Entry IDs stay reserved after deletion.

### Ownership

Get the owner from the authenticated credential. Never use a submitted owner ID or entry ID
to select the owner.

Website library requests include `X-Filecab-Owner` as an account precondition.
Authenticate the session first. If the header differs from the session owner, reject the
request before any read or write. The header does not select an owner or give access.

An owner can have only one active entry for each internal catalog item.

### Viewing sources

Keep viewing sources separate from catalog links. Normalize them with
[Source normalization](domain-contract.md#viewing-source-normalization).
An entry has at most one link. One normalized link can belong to only one active entry
for each owner. A create, a replicated create, a PATCH and a replicated update can add,
replace or remove the link. If another active entry of the owner has the same normalized
link, remove the link from that entry in the same transaction. Give that entry a new
version and a change record. Do not delete it.

### Transactional persistence

- Each library write locks the owner `UserLibrary` row until commit.
- The same transaction increments a bigint owner revision for each changed document.
- The transaction stores the complete server document in the change history.
- Versions and revisions cross the service boundary as decimal strings.
- No-op edits keep the timestamps and the revision.
- Any failure rolls back documents, claims, history and revisions together.

Database uniqueness constraints, scoped to the owner, protect active catalog associations
and normalized source claims. The source claim index uses the SHA-256 digest of the
normalized URL. PostgreSQL checks the digest against the stored URL. URLs up to 8192
characters therefore fit the index key.

A deleted entry keeps its complete document but releases its active claims. Restore fails
atomically if another entry now claims the same catalog identity or source.

Catalog references are unique by namespace, entity and exact string ID. Catalog
translations and genre mappings keep their language and provenance.

`User` owns account identity and sessions. A separate one-to-one `UserLibrary`, keyed by
owner UUID, owns the revision, entries and change history. Account creation creates the
library in the same transaction. Account deletion cascades through the library to entries,
sources and history.

The Prisma schema documents each model, JSON payload shape, ownership relation and
ordering rule. Describe SQL-only constraints next to their Prisma field or model and
refer to their migration. Comments must show which guarantee the database enforces and
which guarantee the mutation service enforces.

## Library operations

All `/api/v1/library` routes require authentication. All mutations use the common owner
transaction and change feed. Manual and stored-library operations must work when catalog
providers are unavailable.

### Read the library

`GET /library` returns `{ schemaVersion: 1, revision, entries }` from one RepeatableRead
transaction. The revision and the entries are from the same committed snapshot.

- Include hidden entries. Exclude tombstones.
- Sort by entry UUID for a stable transport order. This order is not a display order.
- Reject request bodies and all query parameters, including filters, order and pagination.

`GET /library/entries/:entryId` returns an active owned entry. Otherwise it returns a
404 that does not show if the entry exists.

Clients filter, sort and paginate the complete library. See [Library browsing](functionality.md#6-library-browsing).

### Create

`POST /library/entries` accepts editable fields, a required category, an optional entry
UUID and an optional internal catalog UUID.

- The server generates a UUID when the request has none.
- The server copies metadata only from its catalog store.
- Reject a submitted owner, snapshot, timestamp, version or deletion state.
- A manual entry requires a nonblank user title. Keep the exact input.
- A catalog entry can have an empty title. Its catalog item must exist and have the same category.

### Update, delete and restore

`PATCH /library/entries/:entryId` requires a canonical positive decimal-string
`expectedVersion` and accepts editable fields.

- A PATCH cannot change the catalog identity or the snapshot.
- A manual title must stay nonblank after an edit or a merge.
- Clearing rules are in [Mutation semantics](domain-contract.md#mutation-and-clearing-semantics).

`DELETE /library/entries/:entryId` and `POST /library/entries/:entryId/restore` accept
only `expectedVersion`. They return the complete resulting document, including the tombstone.

Delete writes a tombstone. Undo is available for 10 seconds. Restore checks ownership,
version and the current catalog and source claims. It restores the exact entry.

Semantic edits update the modification time. No-ops and catalog refresh do not.
Client timestamps never set the replication order.

### Merge

| Operation | Preview                        | Apply                        | Input                                                         |
| --------- | ------------------------------ | ---------------------------- | ------------------------------------------------------------- |
| Merge     | `POST /library/merges/preview` | `POST /library/merges/apply` | Survivor and removed UUIDs, both versions, chosen user fields |

Preview rules:

- Check ownership, active state, category and catalog compatibility.
- Do not change entries, revisions or history.
- Keep the link of the entry with the latest modified time. If that entry has no link, keep the link of the other entry.
- Category changes and source replacement are separate operations.
- Return the before and proposed documents. Proposed documents have a null `serverVersion`.
- Return a token that expires after five minutes. The token is an HMAC bound to the owner, operation, both versions and documents, and the chosen fields.

Apply rules:

- Accept the same input and the preview token.
- Check the signature, expiry, owner, choices and current versions inside the library transaction that applies the change.
- Fail atomically on changed choices, stale versions, conflicting identities or new source claims.
- A merge keeps the survivor UUID and publishes the removed entry as a tombstone.

Preview tokens appear only in request and response bodies. Never log them.

### Catalog association

`POST /library/catalog/preview` accepts an entry ID, its expected version, an internal
catalog ID and optional chosen user fields. It can also accept a merge entry ID and its version.

- Load catalog metadata on the server. Never accept a client catalog snapshot.
- Reject a category conflict or a different existing catalog ID.
- Return the before and proposed entries with an expiring confirmation token.

`POST /library/catalog/apply` checks the same input, token and entry versions again.
It applies the association or merge in one owner transaction. It publishes the donor
tombstone before the survivor. The survivor keeps its UUID and creation time.

## Extension replication

The extension uses native RxDB replication with stable IDs, tombstones, checkpoint pull,
assumed-master push and conflict responses. RxDB metadata is the only client queue.
The client side is in [Extension storage](extension-storage.md#replication).

### Pull

Authenticated `POST /replication/pull` uses the v1 shared contract.

- The limit is 1–100.
- Decimal cursors are limited to the PostgreSQL bigint range.
- A checkpoint cursor identifies one owner revision. `entryId` in the checkpoint is information only.
- Read the owner revision and change feed in one RepeatableRead snapshot.
- Return changes in revision order, including complete tombstones.
- When one batch has several changes for one entry, return only its last state. Move the checkpoint over every consumed revision.
- A null checkpoint starts at zero.
- The client continues while `hasMore` is true.
- A missing next revision or a cursor after the current revision returns `SYNC_RESET_REQUIRED`.

### Push

Authenticated `POST /replication/push` accepts 1–100 rows with distinct entry IDs.

1. Validate the complete request shape first. An invalid shape rejects the request and commits nothing.
2. Apply rows in request order through the common owner-locked mutation service.
3. Commit each row independently. An earlier committed row stays committed when a later row fails.

Row results:

| Case                                    | Result                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| Stale assumed version                   | Conflict with the current owner document. The row is not changed.     |
| Identity or source conflict             | Conflict with the proposed ID and the current owned document, if any. |
| Invalid row content                     | Indexed validation issue for that row.                                |
| Equivalent retry of an applied proposal | No-op, including creates, deletes and restores.                       |
| UUID owned by another account           | Conflict. Never show the other owner's document.                      |

A row can propose only editable fields, deletion state and an existing catalog
association. Snapshots belong to the server. The server ignores a proposed snapshot and
stores its own snapshot for the proposed catalog association. The client gets that
snapshot with the next pull.

Accepted changes keep the creation time and get a server modification time and version.
`deleted` is the transport deletion field.

### Change tracking

CRUD, replication, imports, merges, deletes and restores use the same mutation service.
They publish changes atomically. Owner revisions are serialized through commit.
A timestamp or sequence allocated before commit cannot prove commit order. Cursors must
not lose JavaScript integer precision.

### Conflicts and rejected intent

On a stale-version conflict, keep the current server document. The client keeps rejected
local intent for visible, deliberate reapplication. Client and server conflict rules must agree.

### Sync lifecycle and retention

Replicate only for the explicitly linked authenticated account. Replicate when a surface
opens, after local changes, on reconnect and on manual refresh. Live transport is optional.
Scope replication metadata by account and schema. Never submit pending edits from another account.

Keep history and tombstones for at least 90 days. Until a verified cleanup exists, keep
them without a time limit. Reset after `SYNC_RESET_REQUIRED` keeps pending intent and
prevents resurrection of deleted entries.

### Guest adoption

Keep one fixed device library visible across login, logout and account changes,
including unsaved input. Linking and import require a revision-bound preview, explicit
confirmation, identity and source conflict checks and retry-safe writes.

## Public library

### Username

An owner can set a username in Settings. The username is the address of a public
read-only copy of the owner's server library. There are no share tokens or share links to
manage.

- A username has 3 to 32 characters: lowercase Latin letters, digits, `-` and `_`. It starts with a letter or a digit.
- Store the username in lowercase. Compare usernames without case. A username belongs to one account only.
- A username that another account uses gets a `CONFLICT` error.
- An empty username turns public access off. This is the default.
- A changed username stops the old address at once. The new address works at once.
- Account deletion removes the username.

| Operation      | Route                              | Access                                |
| -------------- | ---------------------------------- | ------------------------------------- |
| Read username  | `GET /account/username`            | Owner session                         |
| Set or clear   | `PUT /account/username`            | Owner session, `{ username: string }` |
| Public library | `GET /public/libraries/{username}` | Anonymous                             |

The extension shows the username field only when the device is linked to an account. The
public library shows the server library of that account, not the device library.

### Shared data

| Include                                 | Exclude                                                |
| --------------------------------------- | ------------------------------------------------------ |
| Title, category                         | Hidden and deleted entries                             |
| Poster, year and format, when available | Notes and viewing URLs                                 |
| Status, rating, progress                | Account and email data, sessions, replication metadata |

Apply filters, order and counts only to the shared projection. The public route gives no
write, owner lookup or sync access. Public pages have no persistent offline library.

### Freshness and privacy

- Anyone who knows or guesses a username can see that public library. Settings tells the owner this before they save a username.
- Serve committed data with `Cache-Control: no-store`, `noindex` and a restrictive referrer policy.
- Exclude public libraries from discovery and sitemaps.
- An unknown username and an empty username get the same not-found response.
- Limit the rate of public library requests from one client.

A cleared or changed username blocks later requests. It cannot remove content that a
viewer already saw or copied.

## Backup and restore

Use the [backup rules](functionality.md#8-backup-and-restore) and the
[v1 format](domain-contract.md#backup-format).

- Reject backup bodies larger than 10 MiB before parsing.
- Bind restore confirmation to the owner, payload digest and library revision.
- An empty replacement needs a separate confirmation.
- Apply the replacement atomically and publish tombstones. A failure keeps the library unchanged.
- Set server versions again through the common mutation service. Never trust versions from a backup.
- Ordinary synchronization never replaces the complete library.

| Operation | Route                          | Body                                                   | Result                     |
| --------- | ------------------------------ | ------------------------------------------------------ | -------------------------- |
| Export    | `GET /library/backup`          | None                                                   | `Backup` of active entries |
| Preview   | `POST /library/backup/preview` | `Backup`                                               | `BackupPreview`            |
| Restore   | `POST /library/backup/restore` | `backup`, `confirmationToken`, optional `confirmEmpty` | `OwnerSnapshot`            |

Validation:

- DTO validation rejects unknown fields, wrong types, bounds and enums. Issue paths start with `entries` and the entry index.
- Each link is an absolute HTTP or HTTPS URL without credentials. `normalizedUrl` must equal the `generic-v1` result.
- Reject duplicate entry UUIDs, catalog IDs and normalized links in the file.
- A manual entry needs a title. A catalog ID must exist in the server catalog with the same category.
- An entry UUID that belongs to another owner is not available.

Preview:

- The preview compares the backup with the active library. It reports the counts of current, incoming, added, updated, unchanged and removed entries.
- A conflict is an updated entry whose current `updatedAt` is later than the backup copy.
- The confirmation token is signed and expires after 5 minutes. It binds the owner, the SHA-256 digest of the canonical backup and the library revision.

Restore:

- Restore checks the token, the digest and the revision again under the owner lock. A change after the preview returns `CONFLICT`.
- A backup without entries needs `confirmEmpty: true`.
- One transaction publishes tombstones for removed entries first, then the added and updated entries. Unchanged entries keep their versions.
- Each published entry gets a new server version and a change record. The server stores its catalog snapshot. A manual entry gets an empty snapshot. Timestamps come from the backup.

## Server-managed parser configuration

### Declarative rules

Serve versioned hostname and path mappings, selectors, approved attributes, known fields
and fixed fallbacks for the bundled extraction engine.

- Never serve executable JavaScript, expressions or interpreter commands.
- A new capability requires a new engine release.
- Configuration cannot grant permissions or start background page collection.

### Source and publication

- The configuration is one JSON file in the repository: `packages/contracts/src/domain/page-rules.json`. Review it like code.
- The API validates the file at startup. An invalid file stops the startup.
- `GET /api/v1/page-rules` serves the file without sign-in. Send an `ETag` and `Cache-Control`. Answer a matching `If-None-Match` with HTTP 304.
- A reviewed commit publishes a change. The live page rule checks (`pnpm test:page-rules`) must pass before the merge.
- Git history is the audit history.
- A rollback reverts the file in a new commit and deploys it. Increase the revision in each change, also in a rollback.

### Compatibility

- Include the schema version, the revision and the minimum engine version.
- The extension uses a served configuration only when it supports the schema and the engine version.
- The extension keeps the last valid configuration and a bundled default. The bundled default is the same file at build time.

### Page data minimization

Extract data in the extension after a user action. Send only the structured metadata
that matching needs. Never send full HTML or browsing history. Page parsers and catalog
providers are independent.

## API foundation

### Routes and health

- All routes use `/api/v1`.
- Anonymous `GET /api/v1/health/live` returns `{ schemaVersion: 1, status: "ok" }` without database or provider access.
- `GET /api/v1/health/ready` runs a bounded database probe. It returns the same body on success and a generic retryable 503 on failure.
- Both health routes reject unknown query parameters.

### Requests and errors

- Every response has a server-generated UUID `X-Correlation-ID`. Never trust a submitted ID.
- Error bodies contain `schemaVersion`, `code`, `status`, `message`, `correlationId` and `retryable`. They can contain field issues and a retry delay.
- Framework, parser and service failures use the same error body. Do not include raw exception messages or rejected values.
- Distinguish authentication, validation, conflict, throttling, service failure and empty results.
- Limit JSON bodies to 1 MiB. Backup routes use their own 10 MiB limit.
- Limit DTO nesting to 32 levels before transformation.
- DTO validation rejects unknown and reserved properties. It does not coerce values.
- Unsafe requests with a body require a JSON content type.
- Define optional, null and clearing semantics for each field. TypeScript types alone do not validate requests.

### CORS and CSRF

- CORS allows only the exact configured website and extension origins, with credentials. It exposes the correlation header.
- A disallowed origin gets a structured 403.
- An unsafe request with cookies requires an allowlisted `Origin` and `X-Filecab-Request: 1`. This applies also when the request has an `Authorization` header.
- Requests without cookies also reject untrusted origins.
- When `NODE_ENV` is `development`, accept any origin. CORS returns the request origin with credentials. Skip the cookie check for `Origin` and `X-Filecab-Request`. Never use this mode on a public host. `test` and `production` keep the exact allowlist.
- Preflight allows only supported methods and explicit headers.

### Production transport

- Run the API behind an HTTPS-terminating proxy. Bind the API to loopback.
- Trust the forwarded protocol only from loopback.
- Reject requests reported as insecure with 403. Send HSTS.
- Operators must block external access to the internal listener.
- Health probes use the same HTTPS proxy.
- Development and test environments can use local HTTP.

### Startup configuration

- Validate the database, origins, ports, integrations and production secrets before listening.
- A configuration failure names the invalid fields and gives static guidance. Never print values.
- An unexpected startup error uses a generic message. Never log raw driver or framework messages.
- `WEBSITE_ORIGINS` holds website URLs. `EXTENSION_ORIGINS` accepts exact Chrome extension origins only. It can be empty before an extension ID exists.
- After listening, log the bound address with scheme, host and port. Do not log paths, queries or credentials.
- Keep development and production credentials and storage separate.

### Logging and error reporting

Request logs contain only the correlation ID, method, status and elapsed time. Never log
URLs, query strings, headers, bodies, exception objects, credentials, codes, tokens,
notes or page content.

The API can report failures to Sentry when `SENTRY_DSN` is set. A missing DSN disables
reporting and does not stop startup.

- Report only unexpected errors and 5xx responses. Do not report expected client errors.
- Also report a missing catalog genre mapping as a warning. See [Catalog genres](catalog-spec.md#genres).
- Report each response once, through one common path for controllers and middleware.
- Include the HTTP method and the Express route template. Do not include path parameter values or query text.
- Omit request bodies, headers, parameter values, user identity, extra data and breadcrumbs.
- Keep controlled error codes and messages with the stack trace. Replace unknown exception messages with a generic description.
- Provider diagnostics keep only the origin, operation, failure stage, elapsed time, upstream status and a bounded network error code. Provider schema failures add the schema stage and bounded field paths.
- Never include URLs with queries, response bodies, headers, search text, field values or credentials.

Test event creation with an isolated Sentry transport. Tests must not send events to the
configured project.

### Swagger

Generate OpenAPI with `@nestjs/swagger`. Serve the UI at `/api/docs` and JSON at
`/api/docs-json` outside production only. Disable YAML.

Document actual parameters, bodies, responses, status codes, bounds and nullable fields.
Document anonymous and authenticated access, the bearer and cookie security schemes and
the CSRF header. Use synthetic examples. Add the DTO and its documentation in the same change.

## Verification

Test ownership, identity collisions, concurrent duplicates, stale versions, atomic source
moves, merges and restores, delete and Undo, commit-safe checkpoints, batch retries,
rejected-intent recovery, account switching, history reset, OAuth replay, public library privacy
and revocation, provider failure and parser rollback.

Test idle and absolute expiry, rotation, replay, concurrent refresh, logout and all-session
revocation. Test database migrations and backup recovery. Use deterministic fixtures.
Report authorized live checks separately.
