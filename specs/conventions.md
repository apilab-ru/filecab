# Conventions

Implementation patterns for the [Stack](stack.md). [Contributing](contributing.md) owns
the workflow. [Functionality](functionality.md) owns user behavior.

## Repository structure

| Package              | Responsibility                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `apps/web`           | React and Vite website with online adapters                      |
| `apps/extension`     | WXT popup, full page, worker, content scripts and device storage |
| `apps/api`           | NestJS API and Prisma                                            |
| `packages/ui`        | Shared primitives and styles. No auth, data or library adapters. |
| `packages/library`   | Shared screens, hooks and application logic                      |
| `packages/contracts` | Framework-independent models and domain rules                    |

- Use workspace imports and public exports.
- Never import backend code, Prisma, secrets, server environment files or server DTO dependencies into clients.
- Vite, WXT and NestJS keep their own build tools. Nx runs the targets.

## Folder structure

Organize code by feature, then by responsibility, then by component or module:
`src/<feature>/<group>/<item>/`. For example, `src/library/components/device-sync/`.

- An app or package with one feature omits the feature level, for example `src/components/`.
- `packages/library` uses top-level `components/`, `providers/`, `pages/`, `hooks/` and `models/`. Translations stay in `i18n/`.
- The website uses `auth/` and `online-library/`. The extension uses `auth/`, `library/` and `popup/`. The API uses `auth/`, `health/`, `catalog/` and `library/`.
- Shared contracts use `models/` and `domain/`.
- Keep the styles, types, hooks and utilities of a component in its folder. Keep shared hooks and models in their responsibility groups.
- Use `.tsx` for React components and `.ts` for logic and types. Name hooks `useSomething`.

## UI components and styles

- Use the Filecab Base UI wrappers. Simple controls can be native.
- Keep keyboard operation, visible focus and focus restoration.
- Dialog overlays use the theme tokens inside their styled container on all surfaces.
- Use colocated SCSS, BEM classes and shared CSS variables. Each layout owns its root styles.
- Share declarations through mixins or dedicated stylesheets. Imports do not scope classes.
- Injected UI uses Shadow DOM. BEM alone cannot isolate host styles. Keep portals inside the styled container.

## Client routes

Entry points compose `ApplicationShell` with a layout. They pass icons, links and the
library adapter directly. The shell owns routing, preferences, sync settings and
`IconProvider`. `ApplicationShellContent` owns draft registration and confirmation.
Do not select the layout with a `popup` boolean. Do not forward layout-specific props.

| Component   | Location and role                                                         |
| ----------- | ------------------------------------------------------------------------- |
| `FullPage`  | `packages/library/src/pages/full-page/`: full-page navigation             |
| `Popup`     | `apps/extension/src/popup/components/popup/`: popup routes and navigation |
| `PopupPage` | `apps/extension/src/popup/pages/popup-page/`: popup Page route            |

- Use hash-based React Router routes and page components.
- Get category and mode from the route. Do not use interface context or a second parser.
- `FullPage` passes the category through `renderLibrary`. `Popup` navigates directly.
- Keep adapters and editors mounted during navigation.

## Unsaved draft guard

`useDraftGuard` owns registration, route blocking, the save or discard decision and
`beforeunload`. Editors call `Context.setDirty`. The shell shows the confirmation.

## Interface preferences

- Each shell has one `useInterfacePreferences` provider for locale, theme and setters. Do not pass them as route props.
- Preference storage is independent of accounts and replication.
- Defaults are the first supported browser language and the system theme.
- Store explicit choices. Synchronize surfaces and document attributes. Keep mounted editors.
- A storage failure must not stop live updates.

## Local state

- Use component-scoped Zustand stores. Surfaces do not share drafts or filters.
- URLs can hold non-sensitive filters and sort. Keep website query parameters.
- Publish sync settings through `useSyncSettings`, not through interface context or page props.
- Store only serializable status. Callbacks stay in memory.
- Restored state cannot enable refresh until a live adapter registers it.
- Cleanup clears status. Storage errors do not break live controls.

## Authentication controls

Settings renders the shared `AuthControls` from `AuthProvider` and `AuthRepository`.

- Repositories expose observable account, busy and error state and sign-in, sign-out and sign-out-all operations.
- Repositories own platform logic, never presentation.
- Website adapters reuse account queries and cookies, cross-tab invalidation and private cache cleanup.
- Extension adapters use worker messages and auth notifications. Credentials stay privileged.
- Unsubscribe on unmount.
- Both adapters report `AuthError`. Controls show localized safe guidance and collapsed public connection details. Never show raw errors or private payloads.

## Internationalization

- Use react-i18next `useTranslation` with matching typed English and Russian catalogs, bundled for offline use.
- Each shell has one i18next instance, synchronized with its preference provider.
- Do not add remote catalogs or another language detector or storage.
- Use i18next interpolation and plurals. The preference hook supplies the locale for metadata, numbers, dates and sorting.
- Unknown dynamic messages use explicit defaults. Sentence keys include their punctuation.
- Chrome `_locales` stays separate.
- Refresh translated sync status without remounting editors or routing.

## Data ownership

- PostgreSQL owns authenticated server libraries. Clients never access it directly.
- The extension owns one device library in RxDB and Dexie. See [Extension storage](extension-storage.md).
- The website uses online API state.
- Keep persistence behind platform adapters.

## Website server state

- Use in-memory TanStack Query queries, scoped by owner or list. Do not keep a persistent library or offline mutation queue in RxDB, IndexedDB or localStorage.
- Clear private queries and mutations when the account changes.
- Refresh or invalidate after writes. Optimistic changes need rollback and reconciliation.
- Website writes use the backend ownership, version and change-feed rules, so they reach replication.
- Keep failed-write input and offer Retry. Never claim that a failed write was saved.

## Configuration

- Server environment files and Prisma generation stay on the backend and are not committed.
- Disabled integrations need no credentials.
- Frontend configuration exposes only public origins.
- Keep development, test and production databases separate. Provide synthetic `.env.example` files.
- Prisma exposes generate, validate, dev-migrate, deploy-migrate and status commands.
- Use the [README setup](../README.md#postgresql-and-migrations-macos). Do not duplicate scripts.

## Verification

- Run the relevant build, typecheck, boundary, unit, contract, integration and E2E checks.
- Boundary tests cover aliases, relative paths and re-exports. Run the real-workspace boundary check once in contracts. Keep its local command.
- Keep unit and contract tests separate from PostgreSQL integration tests. Integration tests fail without their database. They never skip silently.
- CI uses PostgreSQL 17 and synthetic credentials. It checks generation, committed migrations, migration status and generated-client access.
- Test application behavior, not third-party internals.
