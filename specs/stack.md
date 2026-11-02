# Filecab — Technology Stack

## Scope

Filecab is a personal library for anime, films, and TV series, available as a browser extension and a standalone website. Entries contain text metadata and links, not uploaded video files.

This document records the chosen architecture. It does not claim that the planned integrations are implemented. The initial repository scope is empty applications and shared libraries only.

## Core stack

| Area                 | Technology                                                                | Responsibility                                                                    |
|----------------------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
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

## Extension surfaces

| Surface                   | Responsibility                                                            |
|---------------------------|---------------------------------------------------------------------------|
| Popup                     | Quick capture and editing for the active tab                              |
| Full extension page       | Browse and maintain the library                                           |
| Background service worker | Privileged messaging, persistent capture coordination and resumable tasks |
| Content script            | Extract page metadata and optionally render page integration              |

## Data ownership and database usage

Offline support is required only for the extension. PostgreSQL is the authoritative server database for authenticated libraries and shared views. RxDB stores the extension's local working copy and guest library. Neither the website nor the extension connects directly to PostgreSQL.

| Client                   | Data access                                                     | Offline behavior                                                 |
|--------------------------|-----------------------------------------------------------------|------------------------------------------------------------------|
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
- Keep guest data and each account's data isolated. Import guest entries only through an explicit user action; never synchronize one account's pending changes into another account.
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

Catalog providers and the precise season/installation model remain product decisions.

## Parser configuration

Keep the extraction engine bundled with the extension. NestJS may serve narrow, versioned configuration containing hostname mappings, selectors, allowed attributes, and fixed fallbacks.

Cache the last valid configuration and bundle defaults for offline operation. Do not fetch executable JavaScript, evaluate expressions, or build an interpreter for remote commands. Remote JSON is not automatically policy-compliant; new capabilities and permissions can still require an extension release and store review.

## Google authentication

NestJS owns the Google OAuth authorization-code flow. The website starts it with a redirect; the extension starts it through `identity.launchWebAuthFlow`.

Use verified Google identity to establish application sessions. Keep client secrets on the server. Use secure HttpOnly cookies for website session credentials and an extension-specific single-use code exchange for application tokens. Restrict extension credentials to privileged contexts. Do not expose reusable tokens in redirect URLs or to content scripts.

Google sign-in does not grant Google Drive access. PostgreSQL is the selected primary server storage; Google Drive backup/export is optional future work.

## Local development on macOS

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
