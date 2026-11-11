# Conventions

Implementation patterns for the [Stack](stack.md). [Contributing](contributing.md)
owns code/style/workflow rules; [Functionality](functionality.md) owns user behavior.

## Repository structure

| Package              | Responsibility                                                      |
| -------------------- | ------------------------------------------------------------------- |
| `apps/web`           | React/Vite website and online adapters                              |
| `apps/extension`     | WXT popup/full page, worker, content scripts and device persistence |
| `apps/api`           | NestJS API and Prisma                                               |
| `packages/ui`        | Shared primitives/styles, independent of auth/data/library adapters |
| `packages/library`   | Shared screens, hooks and application logic                         |
| `packages/contracts` | Framework-independent models and domain rules                       |

Use workspace imports and public exports. Never import backend code, Prisma, secrets,
server environment files or server DTO dependencies into clients. Vite/WXT/NestJS
retain their build tools; Nx orchestrates targets.

## Shared UI components

Use Filecab Base UI wrappers; simple controls may be native. Preserve keyboard operation,
visible focus and focus restoration. Dialog overlays inherit theme tokens inside their
styled container across website/full-page/popup surfaces.

## Styling convention

Use colocated SCSS, BEM classes and shared CSS variables. Each layout owns its root/styles;
share declarations through mixins or dedicated stylesheets. Imports do not scope classes.
Follow [colocation rules](contributing.md#component-style-colocation).
Injected UI uses Shadow DOM; BEM alone cannot isolate host styles. Keep portals inside
the styled container.

## Client-side routes

Entry points compose `ApplicationShell` with a layout and pass its icons/links/library
adapter directly. The shell owns routing, preferences, sync settings and `IconProvider`;
`ApplicationShellContent` owns draft registration/confirmation. Neither chooses layout
through a `popup` boolean or forwards layout-specific props.

| Component   | Location and role                                       |
| ----------- | ------------------------------------------------------- |
| `FullPage`  | `packages/library/src/full-page/`: full-page navigation |
| `Popup`     | `apps/extension/src/popup/`: popup routes/navigation    |
| `PopupPage` | `apps/extension/src/popup-page/`: popup Page route      |

Use hash-based React Router routes and page components. Derive category/mode from routes,
not interface context or a parallel parser. FullPage passes category via `renderLibrary`;
Popup navigates directly. Keep adapters/editors mounted across navigation.
[Navigation requirements](functionality.md#2-users-surfaces-and-navigation) define redirects/Back.

## Unsaved draft guard

`useDraftGuard` owns registration, route blocking, save/discard decisions and `beforeunload`.
Editors use `Context.setDirty`; the shell renders confirmation. Save requires successful
persistence, Discard clears the draft, Continue cancels navigation.

## Interface preferences

Read locale/theme/setters through one `useInterfacePreferences` provider per shell,
not routed props. Keep storage independent of accounts/library replication.
Defaults use the first supported browser language and system theme. Persist explicit
choices, synchronize surfaces and document attributes, and preserve mounted editors.
Storage failure must not prevent live updates.

## Local state management

Use component-scoped Zustand stores; surfaces do not share drafts/filters.
URLs may hold non-sensitive filters/sort; preserve website query parameters.
Publish sync settings through `useSyncSettings`, not interface context/page props.
Persist serializable status only; callbacks stay in memory. Restored state cannot enable
refresh until a live adapter registers it. Cleanup clears status; storage errors do not
break live controls.

## Shared authentication controls

Settings renders shared `AuthControls` from `AuthProvider`/`AuthRepository`, not injected
account UI. Repositories expose observable account/busy/error state and sign-in/out/all
operations; they own platform logic, never presentation. Website adapters reuse account
queries/cookies, cross-tab invalidation and private-cache cleanup. Extension adapters use
worker messages/auth notifications; credentials stay privileged. Unsubscribe on unmount.
Both report `AuthError`; controls localize safe guidance/diagnostics and collapsed public
connection details, never raw errors/private payloads.

## Internationalization

Use react-i18next `useTranslation` with matching typed en/ru TypeScript catalogs, bundled
offline. Each shell has an instance synchronized with its preference provider; do not
add remote catalogs or another detector/persistence mechanism. Use i18next interpolation/
plurals; the preference hook supplies locale for metadata, numbers, dates and sorting.
Unknown dynamic messages use explicit defaults; existing sentence keys include literal
punctuation. Chrome `_locales` stays separate. Refresh translated sync status without
remounting editors or recreating routing.

## Data ownership and database usage

PostgreSQL owns authenticated server libraries; clients never access it directly.
Extension RxDB/Dexie owns one device library; the website uses online API state.
Keep persistence behind platform adapters. Acknowledge durable saves only; do not rely
on a permanent MV3 worker. Login does not switch/clear device data. Guests may stay local;
replication needs explicit linking and native RxDB metadata, not another client queue.
Tombstones, rejected intent and reset/retry rules are defined in
[Local persistence](../implementation/baseline-decisions.md#local-persistence),
[Extension replication](../implementation/baseline-decisions.md#extension-replication)
and [Backend](backend.md#extension-offline-data-and-synchronization).

## Website server state

- Use TanStack Query in-memory owner/shared queries; no persistent library or offline mutation queue in RxDB/IndexedDB/localStorage.
- Scope keys by owner/list; clear private queries/mutations on account changes.
- Refresh/invalidate after writes; optimistic changes need rollback/reconciliation.
- Reuse backend ownership/version/change-feed rules so website writes reach replication.
- Preserve failed-write input and Retry; never claim a failed write was saved.

## Shared domain contracts

Use typed models/domain rules, not shared runtime parsers or client DTO validation.
NestJS class-validator/class-transformer rejects unknown fields without implicit coercion.
[Domain contracts](domain-contract.md) own identities, versions, clearing and serialization.

## Configuration and verification

Keep server env/Prisma generation backend-only and untracked. Validate database/origins/
ports/integrations/production secrets before listening; report field names, not values.
Disabled integrations need no credentials; frontend config exposes only public origins.
Separate dev/test/production databases and provide synthetic `.env.example` files.
Run relevant build/typecheck/boundary/unit/contract/integration/E2E checks. Boundary tests
cover aliases, relatives and re-exports. Keep unit/contracts separate from dedicated
PostgreSQL integration tests; fail rather than silently skip without their database.
CI uses PostgreSQL 17/synthetic credentials and checks generation, committed migrations,
status and generated-client access. Test application behavior, not third-party internals.
Run real-workspace boundary verification once in contracts; retain its local command.
Prisma exposes generate/validate/dev-migrate/deploy-migrate/status commands.
Use [README setup](../README.md#postgresql-and-migrations-macos), not duplicated scripts.
