# Filecab — Technology Stack

## Scope

Filecab is a personal library for anime, films, and TV series, available as a browser extension and a standalone website. Entries contain text metadata and links, not uploaded video files.

This document records the chosen architecture. It does not claim that the planned integrations are implemented. The initial repository scope is empty applications and shared libraries only.

## Core stack

| Area                 | Technology                                                                | Responsibility                                                                    |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Monorepo             | Nx + pnpm workspaces                                                      | Project organization, shared packages, task execution and caching                 |
| Language             | TypeScript, strict mode                                                   | Frontend, extension, backend, shared contracts                                    |
| Website              | React + Vite                                                              | Standalone browser application                                                    |
| Routing              | React Router                                                              | Website and full library navigation where needed                                  |
| Extension            | WXT + React, Manifest V3                                                  | Popup, full page, background worker, content scripts                              |
| Styling              | Plain SCSS with BEM                                                       | Shared styles and components; no CSS Modules                                      |
| Backend              | NestJS REST API                                                           | Accounts, library operations, catalog adapters and parser configuration           |
| Database             | PostgreSQL 17                                                             | Persistent server-side application data                                           |
| ORM                  | Prisma                                                                    | Database access and versioned migrations                                          |
| Extension database   | RxDB with the free Dexie storage adapter over IndexedDB                   | Extension-only offline persistence, reactive queries, migrations, and replication |
| Local UI state       | Zustand                                                                   | Component and application UI state in the website and extension                   |
| Website server state | TanStack Query                                                            | Fetching, caching, and mutations through NestJS; no durable offline editing       |
| Authentication       | Google OAuth through NestJS                                               | Google-only sign-in and application sessions                                      |
| UI primitives        | Base UI (`@base-ui/react`)                                                | Accessible, unstyled interactive components wrapped in `packages/ui`              |
| API validation       | class-validator + class-transformer                                       | Runtime validation of NestJS DTOs                                                 |
| Tests                | Vitest where supported; NestJS-supported runner; Playwright for later E2E | Appropriate checks for each project                                               |

## Repository structure

```text
filecab/
  apps/
    web/                 # React + Vite website
    extension/           # WXT extension
    api/                 # NestJS API
  packages/
    ui/                  # Shared React components and SCSS
    library/             # Shared library screens and application logic
    contracts/           # Plain TypeScript request/response types
```

Use workspace imports between packages. Frontend bundles must not import backend implementations, database clients, secrets, or server-only DTO dependencies.

Nx orchestrates the projects; it does not require one bundler for every application. Vite builds the website, WXT manages extension builds, and the NestJS application retains its supported Nx builder.

## Shared UI components

The application SHALL use `@base-ui/react` for accessible, unstyled
interactive primitives.

Shared components SHALL reside in `packages/ui` and use plain SCSS
with BEM naming. Tailwind and CSS Modules SHALL NOT be required.

Colors, typography, spacing, and other design tokens SHALL use shared
CSS variables.

Application code SHALL consume Filecab UI wrappers rather than import
Base UI primitives directly. Simple controls MAY use native HTML elements.

Shared components SHALL support the website, extension popup, and full
extension page, including keyboard navigation, visible focus states,
and appropriate accessible labels.

Injected page interfaces SHALL isolate styles using Shadow DOM.
Portaled overlays SHALL render within the appropriate styled container.

The UI package SHALL remain independent of RxDB, TanStack Query,
authentication, and backend data access.

## Styling convention

Use ordinary `.scss` files imported by components, example:

```scss
.filecab-media-card {
  &__title {
    font-weight: 600;
  }

  &.-selected {
    outline: 2px solid var(--color-accent);
  }
}
```

Keep shared colors, spacing, and typography in CSS variables. Prefix reusable blocks to reduce global collisions. Use Shadow DOM isolation for injected extension UI when needed; BEM alone does not isolate styles from a host page.

### Client-side routes

Use React Router with hash-based URLs for website and full-page extension routes. Represent each page as a separate React component and render pages through route definitions rather than branching the application shell's page content on route state. Keep library data adapters mounted across page navigation so synchronization state and unsaved editors survive page changes. Keep popup-only views compatible with the extension's fixed popup surface.

## Extension surfaces

| Surface                   | Responsibility                                                            |
| ------------------------- | ------------------------------------------------------------------------- |
| Popup                     | Quick capture and editing for the active tab                              |
| Full extension page       | Browse and maintain the library                                           |
| Background service worker | Privileged messaging, persistent capture coordination and resumable tasks |
| Content script            | Extract page metadata and optionally render page integration              |

## Data ownership and database usage

Offline support is required only for the extension. PostgreSQL is the authoritative server database for authenticated libraries and shared views. RxDB stores one device-local extension library; account synchronization is explicitly linked separately. Neither the website nor the extension connects directly to PostgreSQL.

| Client                   | Data access                                                     | Offline behavior                                                 |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| Extension owner or guest | React → RxDB → Dexie adapter → IndexedDB                        | Browse and edit locally; authenticated changes synchronize later |
| Website owner            | React → TanStack Query → NestJS → Prisma → PostgreSQL           | Requires connectivity for supported library operations           |
| Shared-list viewer       | React → TanStack Query → read-only NestJS endpoint → PostgreSQL | No offline support required                                      |

### Extension persistence and replication

- Save library changes durably in RxDB before reporting success.
- Use RxDB replication metadata rather than building a second custom mutation queue.
- NestJS exposes checkpoint-based pull and conflict-aware push handlers scoped to the authenticated owner.
- Apply writes and change-tracking metadata atomically in PostgreSQL. Pull ordering and checkpoints must not skip committed updates, including equal timestamps or concurrently committed writes.
- Retain deletion tombstones until the replication retention/reset policy allows cleanup.
- Define deterministic conflict resolution and return conflicting server documents through the replication protocol.
- Resume replication on opening, reconnecting, and manual refresh. Live notifications are deferred.
- Validate the chosen storage and multi-instance behavior across popup, full page, and MV3 worker. Do not rely on an always-running worker.
- Use one device-local extension library with a fixed database name. Authentication does not switch, clear or copy local entries. Future account replication must require explicit linking/import confirmation and must never send pending changes to a different account automatically.
- A guest library can remain local without authentication. Account synchronization requires login and connectivity.

### Website server state

- Use TanStack Query for owner-library queries and mutations, and for shared read-only queries.
- Use its ordinary in-memory cache; persistent query caching and durable offline mutation queues are out of scope.
- Refresh or invalidate relevant queries after successful mutations. Optimistic updates, if introduced, must handle rollback and reconciliation.
- Website mutations and extension replication must use the same backend ownership rules, conflict/version checks, and change tracking. Website edits and deletions must be visible to extension pull replication.
- Do not persist the website library in RxDB, IndexedDB, or localStorage. This restriction does not prohibit necessary authentication mechanisms or non-sensitive interface preferences.
- On logout/account change, clear account-scoped query caches. Query keys must distinguish account and list identity.
- A network failure must preserve unsaved form input and show retry feedback; it must not report an edit as saved.

### Read-only sharing through unlisted links

- The owner can enable sharing and obtain a link such as `/shared/:token`.
- Anyone with the link can view without signing in. Unlisted links are bearer access, not private invitations.
- Generate cryptographically random, unguessable tokens; store a hash server-side. Support disabling sharing and rotating the token.
- The shared endpoint returns an explicit allowlisted projection of the list. Exclude private notes and account details by default.
- Enforce read-only access on the backend. A sharing token must not authorize owner endpoints or mutations.
- Fetch shared data through NestJS, without replicating the owner's database or exposing its sync credentials.
- Shared pages show the latest server-committed state. Offline extension edits appear only after successful synchronization.
- Do not publish shared lists in public discovery or sitemaps. Apply `noindex` and a restrictive referrer policy, avoid logging tokens, and initially use `Cache-Control: no-store` on shared responses.
- Revocation blocks subsequent server requests; it cannot retract data already viewed or copied. Do not promise instant removal from an already open page.

### Temporary UI state and shared packages

React state owns dialogs, tabs, and unsaved form values. URL parameters may hold non-sensitive filters and sorting. Authentication credentials remain separate from replicated collections.

Share UI components, plain contracts, and domain rules between clients. Keep extension RxDB repositories/replication and website TanStack Query hooks behind separate adapters; shared screens must not require one persistence mechanism.

## Identity and catalog integration

- Every user entry has an immutable locally generated UUID.
- A catalog association is optional; parsed or manually entered titles can be saved without one.
- Internal catalog IDs and external provider IDs are distinct.
- External IDs retain their provider namespace and string format.
- Viewing URLs are source associations, not entry primary keys.
- Catalog adapters and page parsers are separate concerns.
- Exact verified identities can recognize existing entries; title similarity should produce suggestions rather than automatic merges.

Catalog defaults are Smotret for anime and Kinopoisk Dev for films/TV; Shikimori is exclusively an optional personal-list connection. Distinct installments remain separate identities; relationships shall not automatically merge seasons, films, specials, remakes, or editions.

## Parser configuration

Keep the extraction engine bundled with the extension. NestJS shall serve narrow, versioned configuration containing hostname mappings, selectors, allowed attributes, and fixed fallbacks.

Cache the last valid configuration and bundle defaults for offline operation. Do not fetch executable JavaScript, evaluate expressions, or build an interpreter for remote commands. Remote JSON is not automatically policy-compliant; new capabilities and permissions can still require an extension release and store review.

## Google authentication

NestJS owns the Google OAuth authorization-code flow. The website starts it with a redirect; the extension starts it through `identity.launchWebAuthFlow`.

Use verified Google identity to establish application sessions. Keep client secrets on the server. Use secure HttpOnly cookies for website session credentials and an extension-specific single-use code exchange for application tokens. Restrict extension credentials to privileged contexts. Do not expose reusable tokens in redirect URLs or to content scripts.

Google sign-in does not grant Google Drive access. PostgreSQL is the selected primary server storage; Google Drive backup/export is optional future work.

## Local development on macOS

### Workspace infrastructure and verification

The workspace SHALL provide `check:boundaries`, `test`, `test:contracts`,
`test:integration`, and `test:e2e` commands alongside build/typecheck.
Boundary checks SHALL reject client imports of backend source, Prisma,
server environment files, and server-only dependencies, including relative
imports and re-exports. UI SHALL remain independent of library/data adapters.

Vitest SHALL run unit and contract suites separately from PostgreSQL integration
tests. Integration tests SHALL require an explicitly configured dedicated test
database and SHALL fail rather than silently skip when it is unavailable.
Playwright SHALL provide an initial website smoke check; later feature steps
SHALL expand it into product workflows. CI SHALL run these checks with
PostgreSQL 17 and synthetic credentials; provider/Google credentials SHALL NOT
be needed for infrastructure verification.

Prisma SHALL expose generate, validate, development-migration, deployment-migration,
and migration-status commands. The first migration SHALL create a minimal
infrastructure marker, leaving application domain tables to their delivery step.
Generated Prisma source SHALL stay backend-only and out of version control.

Backend configuration SHALL load a backend-local environment file, validate
required database and origin settings before listening, reject invalid ports,
and validate enabled integrations and production secrets. Errors SHALL identify
configuration field names without printing their values. Disabled integrations
SHALL need no credentials. Frontend configuration SHALL expose only a public API
origin. Development, test, and production SHALL use distinct database targets.

Synthetic `.env.example` files SHALL document local setup. CI SHALL validate
schema generation, apply committed migrations to PostgreSQL 17, verify migration
status, and exercise the generated client against that database.

Infrastructure tests SHALL verify Filecab configuration, dependency boundaries,
migration compatibility, and application startup. Tests of third-party behavior
alone, such as Prisma's generic transaction rollback, SHALL wait until an
application operation needs regression coverage. CI SHALL run the real-workspace
boundary check once through its contract suite; the standalone command remains
available for local use.

Use native Homebrew PostgreSQL 17. Add this optional `Brewfile` entry:

```ruby
brew "postgresql@17"
```

Root package scripts:

```json
{
  "scripts": {
    "db:start": "brew services run postgresql@17",
    "db:stop": "brew services stop postgresql@17",
    "db:status": "brew services info postgresql@17"
  }
}
```

These commands control the whole Homebrew PostgreSQL 17 service, including databases used by other projects. Stopping the service preserves data. `run` does not enable automatic startup at login.

Once PostgreSQL commands are available on PATH, create local development credentials interactively:

```bash
createuser --pwprompt filecab_dev
createdb --owner=filecab_dev filecab_dev
```

Example backend environment variable:

```dotenv
DATABASE_URL=postgresql://filecab_dev:YOUR_PASSWORD@localhost:5432/filecab_dev
```

Use URL encoding for special characters in credentials. Keep actual environment files out of git and never expose database credentials through Vite frontend variables.

### Shared domain contracts

`packages/contracts` SHALL expose plain TypeScript v1 models, framework-independent
domain rules as defined in [Shared Domain Contract](domain-contract.md).
Clients SHALL use typed models directly without shared runtime parsers.
NestJS DTOs SHALL use class-validator/class-transformer with
unknown-field rejection and no implicit coercion. Server DTO dependencies SHALL
remain backend-only. Later client adapters and services SHALL call these rules.

### Local persistence decisions (step 8)

The popup and full page SHALL open the same RxDB/Dexie database directly with
multi-instance notifications. No library write SHALL depend on the MV3 worker
remaining alive. Web Locks SHALL serialize repository reads/writes across these
surfaces; missing Web Locks or failed storage access SHALL enter recovery, never
fall back to volatile storage. The extension SHALL use the fixed RxDB name `filecab-local` and one device-local
library. Sign-in, sign-out and account changes SHALL leave the same entries,
settings and unsaved editor visible; authentication SHALL NOT select storage.
Account credentials remain separate. Future synchronization requires explicit
account linking/import confirmation and account-bound replication metadata;
signing in alone SHALL NOT upload or replace local data. The preceding scoped
preview storage was never used and requires no compatibility or relocation code.
Future migrations of supported storage versions remain required.

Persist one document per entry, including snapshots, sources, tombstones and local
revision metadata. Each single-entry write SHALL atomically store its next local
revision and millisecond update time in that document. The library revision is
the maximum revision over all documents, including retained tombstones; do not
physically remove them. This avoids a separate counter write or mutation queue.
Expected local revisions SHALL prevent stale edits. Active catalog/source claims
SHALL be checked under the same scope lock. Semantic no-ops SHALL preserve time
and revision. Local revisions SHALL remain safe integers and fail on exhaustion.

Deletion SHALL persist the previous entry and a ten-second Undo deadline alongside
the tombstone. Undo SHALL check that exact deletion revision and deadline, restore
the previous entry data/timestamps, and allocate a new local revision. Conflicting
active source/catalog claims SHALL block restoration without changing data.
Settings SHALL live in a separate collection, keyed by category and Library/Catalog
mode, using expected revisions; credentials SHALL never enter either collection.

Storage schema version zero is the first supported format. Register RxDB's schema
migration plugin and an explicit empty version-zero strategy map; future schema
changes must increase the version and supply preservation-tested migrations.
Use build-time AJV standalone validators for storage writes, compatible with the
extension CSP; these are extension-private persistence schemas, not shared request
parsers or client DTO validation. Reads SHALL check persisted records against the
same storage schemas before exposing data. A failure SHALL preserve all bytes,
show Retry and allow best-effort raw IndexedDB export, including unreadable-store
errors. Never remove/recreate a failed database automatically.

Verify real unpacked Chromium popup/full-page concurrency, restart durability,
worker suspension, account isolation, stale edits, no-op/clearing, Undo expiry and
recovery. Editing/filtering interfaces, replication, backup replacement and
retention cleanup remain their subsequent implementation steps.

### Extension replication decisions (step 9)

Replicate the existing `entries` collection with RxDB 17.6.0's replication plugin.
Transport handlers map wrapper documents to v1 entries; local revision and Undo
fields never reach the API. Wrapper documents use RxDB's ordinary `_deleted`
field (always false for retained application records); `entry.deleted` maps to the
API's application tombstone. The conflict equality function compares entry state
and ignores wrapper bookkeeping. Before resolving to the master, persist any
differing editable/deletion intent in a separate review collection. That collection
is a recovery log, never a mutation queue. A failed recovery write must prevent
resolution. A conflict with no owned master becomes a local application tombstone;
its original proposal remains available for deliberate editing and reapplication.

Store one durable account binding and reset generation in a separate collection.
The fixed device library stays visible on logout/account switches. Only the bound
account may replicate this library; another account sees a suspended link and
cannot adopt the previous account's pending intent. Initial linking requires an
owner/revision-bound local+remote preview and explicit confirmation. Confirmation
rechecks both revisions before persisting the binding. No upload starts from login
alone. Link restart resumes RxDB metadata; partial network outcomes use retry-safe
server writes. The privileged worker serializes allowlisted replication/library
requests with authentication, checks the requested owner against the credential,
and never returns tokens. Content scripts cannot invoke these operations.

Run replication while a library surface is open, elect one synchronization surface using a Web Lock, retry
failures and resync on reconnect, a periodic open-surface timer and manual refresh.
Closing surfaces or suspending the worker must not lose saved pending state.
Display active/error/suspended/reset states and durable rejected-intent counts.
Keep the same editor mounted through authentication/status changes.

A history-reset error pauses uploads and requires explicit reconciliation. Preserve
all local documents in a labeled reset recovery log before replacing any entry
with a fresh revision-bound server snapshot. Mark absent local documents as local
tombstones, preventing resurrection; do not push uncommitted local tombstones.
Persist reset-in-progress before changing entries so interruption requires retry
rather than normal replication. Use a new metadata generation with the snapshot
revision as the initial pull checkpoint. Recovery records remain until explicitly
dismissed or reapplied. Reapplication checks the current local revision and uses
the current server identity/version; it never silently overwrites a newer edit.

### Replication failure diagnostics

Replication SHALL preserve specific transport failures through RxDB's wrapped
error events instead of replacing them with a generic retry message. The UI and
worker logs MAY expose only an allowlisted failure code, operation, HTTP status,
validated correlation UUID and RxDB error code. Never log native error objects,
request/response bodies, credentials or library documents. Network/messaging,
authentication, forbidden origin/CSRF, missing API routes, invalid documents,
body-size limits and malformed successful responses SHALL remain distinguishable.
Non-JSON HTTP failures SHALL retain their HTTP status rather than be misreported
as network failures. Internal storage errors SHALL include a safe RxDB code for
recovery diagnosis. A new sync cycle may clear its prior error after progress;
receiving a wrapping error event SHALL NOT erase the specific cause.

The extension worker SHALL recognize reset-required response codes through a local
type guard that narrows unknown data to the code-bearing shape only; it SHALL NOT
assert that the full API error envelope has been validated.
