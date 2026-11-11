# Conventions

Architecture and implementation conventions for the selected [technology stack](stack.md).
Follow [Contributing](contributing.md) for specification updates, code style,
component colocation, validation and formatting rules. Product behavior belongs
in [Functionality](functionality.md), API behavior in [Backend](backend.md), and
detailed persistence policies in [Baseline decisions](../implementation/baseline-decisions.md).

## Repository structure

```text
apps/
  web/          # React + Vite website
  extension/    # WXT popup, full page, worker and content scripts
  api/          # NestJS API and Prisma
packages/
  ui/           # Shared React primitives and styles
  library/      # Shared screens, hooks and application logic
  contracts/    # Framework-independent models and domain rules
```

Use workspace imports and public package exports. Frontend bundles must not import
backend code, Prisma, secrets, server environment files or server-only DTO dependencies.
Keep `packages/ui` independent of library adapters, authentication and data access.
Vite, WXT and NestJS retain their own build tools; Nx orchestrates their targets.

## Shared UI components

Use Filecab wrappers from `packages/ui` for Base UI primitives; simple controls may
use native HTML elements. Preserve keyboard operation, visible focus and focus
restoration across website, full-page and popup surfaces. Dialog overlays must
inherit theme tokens within their styled document.

## Styling convention

Use colocated SCSS, BEM classes and shared CSS variables for design tokens.
Regular stylesheets do not scope classes automatically. Shared declarations may
use Sass mixins or dedicated shared stylesheets. Each layout owns its root and
layout styles. Follow the detailed [style colocation rules](contributing.md#component-style-colocation).

Injected page UI must use Shadow DOM isolation; BEM alone does not isolate styles
from the host page. Portaled overlays must remain inside the styled container.

## Client-side routes

Entry points compose `ApplicationShell` with a chosen layout. The shell provides
routing, preferences, synchronization settings and the icon base URL through
`IconProvider`; `ApplicationShellContent` provides draft registration and confirmation.
Neither component selects a layout using a `popup` boolean or forwards layout-specific props.

- Shared `FullPage` lives in `packages/library/src/full-page/` and owns full-page navigation.
- Extension-owned `Popup` lives in `apps/extension/src/popup/` and owns popup routes and navigation.
- The popup Page route uses extension-owned `PopupPage` in `apps/extension/src/popup-page/`.
- Pass icons, full-page links and the library adapter directly to the chosen layout.

Use hash-based React Router routes and separate page components. Derive category
and mode from routes; do not store them in interface context or introduce a
parallel route parser. Full-page routes pass category to the library adapter
through `renderLibrary`. Popup navigation uses React Router directly.
Keep data adapters mounted across navigation so replication and draft editors survive.
Canonical routes, redirects and popup Back behavior are defined in
[Navigation](functionality.md#2-users-surfaces-and-navigation).

## Unsaved draft guard

`useDraftGuard` owns draft registration, router blocking, save/discard decisions
and `beforeunload`. Editors register their actions through `Context.setDirty`;
the shell renders the confirmation dialog. Save proceeds only after successful
persistence; Discard clears the draft; Continue editing cancels navigation.

## Interface preferences

`useInterfacePreferences` reads one live preference provider per shell. Components
read theme, locale and setters from the hook rather than receive them through props.
Keep preference storage independent of accounts and library replication.
Use the first supported browser language and system color scheme until explicit
preferences are saved. Synchronize changes across open surfaces and update document
attributes without remounting editors. Storage failures must not prevent live updates.

## Local state management

Use component-scoped Zustand stores for transient UI state. Independent surfaces
must not share drafts or filters. URL parameters may hold non-sensitive filters
and sorting; preserve website query parameters during navigation.

Publish synchronization settings through `useSyncSettings`, not interface context
or routed-page props. Persist only serializable status in localStorage; keep refresh
callbacks in memory. Restored status must not enable refresh until a live adapter
registers its action. Adapter cleanup clears its published settings. Storage errors
must not break live controls.

## Shared authentication controls

Settings renders the shared `AuthControls`. Applications supply an `AuthRepository`
through `AuthProvider`; do not pass account UI through the shell. The repository
exposes observable account state, busy/error state and sign-in, sign-out and
sign-out-all operations. Repositories contain platform logic, not presentation.

The website adapter reuses its account query and cookie-session functions, including
cross-tab invalidation and private-cache cleanup. The extension adapter uses privileged
worker messages and auth-change notifications; credentials stay in the worker.
Clean up subscriptions when consumers unmount. Both adapters report the same
`AuthError` model; shared controls render localized guidance, optional safe diagnostics
and collapsed public connection details. Do not expose raw errors or private payloads.

## Internationalization

Use `useTranslation` from react-i18next. Keep matching, typed English/Russian catalogs
in separate shared TypeScript modules and bundle both for offline operation.
Each shell owns an i18next instance synchronized with its preference provider;
do not add another language detector, persistence mechanism or remote catalog loader.

Use i18next interpolation and plural forms instead of manual replacement or plural
selection. Read locale from the preference hook for catalog text, dates, numbers and
sorting. Preserve unknown dynamic messages through an explicit default value and
treat existing sentence-shaped error keys literally, including punctuation.
Keep Chrome manifest `_locales` metadata separate. Language changes must refresh
translated synchronization status without remounting editors or recreating routing.

## Data ownership and database usage

The extension owns one device-local RxDB/Dexie library; the website uses online
NestJS operations through TanStack Query. PostgreSQL is authoritative for authenticated
server libraries. Clients never connect directly to PostgreSQL. Keep platform persistence
behind adapters so shared screens do not require RxDB or TanStack Query.

Extension writes must be durable before reporting success and must not depend on an
always-running MV3 worker. Authentication must not switch or clear device storage.
Account replication requires explicit linking; a guest library may remain local.
Use RxDB replication metadata instead of a second mutation queue. Preserve tombstones,
rejected intent, retry safety and explicit reset recovery as defined in
[Local persistence](../implementation/baseline-decisions.md#local-persistence),
[Extension replication](../implementation/baseline-decisions.md#extension-replication)
and [Backend replication](backend.md#capability-extension-offline-data-and-synchronization).

## Website server state

- Use TanStack Query's in-memory cache for owner and shared read-only queries.
- Do not persist website libraries in RxDB, IndexedDB or localStorage, or add durable offline mutation queues.
- Scope query keys by account/list identity and clear private queries and mutations on account changes.
- Refresh or invalidate relevant queries after successful writes; optimistic updates require rollback and reconciliation.
- Reuse backend ownership, version checks and change tracking so website writes reach extension replication.
- Preserve unsaved input and offer retry after network failure; never report a failed write as saved.

## Shared domain contracts

Use plain TypeScript models and framework-independent domain rules from
`packages/contracts`, without shared runtime parsers or client DTO validation.
Server request validation stays in NestJS DTOs using class-validator/class-transformer,
with unknown-field rejection and no implicit coercion. Follow the
[Shared domain contract](domain-contract.md) for identity, versions, clearing and serialization.

## Configuration and verification

Keep backend environment files and generated Prisma source backend-only and out of
version control. Validate database, origins, ports, enabled integrations and production
secrets before listening. Report invalid field names without printing values.
Disabled integrations need no credentials; frontend configuration exposes only public
API origins. Use distinct development, test and production database targets and
synthetic `.env.example` files.

Run build/typecheck, `check:boundaries`, unit, contract, integration and E2E checks as
appropriate. Boundary checks must cover relative imports, aliases and re-exports.
Keep Vitest unit/contract suites separate from PostgreSQL integration tests; integration
tests require an explicitly configured dedicated test database and must not silently skip.
CI uses PostgreSQL 17 and synthetic credentials and verifies schema generation,
committed migrations, migration status and generated-client access.

Test application behavior, configuration and dependency boundaries rather than
third-party internals. Run the real-workspace boundary check once through its contract
suite; the standalone command remains available locally. Prisma must expose generation,
validation, development/deployment migration and migration-status commands.

Use the [README](../README.md#postgresql-and-migrations-macos) for macOS setup and service
commands; do not duplicate operational scripts in architecture specifications.
