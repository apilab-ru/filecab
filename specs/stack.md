# Technology stack

Core technologies used by the website, browser extension, backend and shared packages.

## Core stack

| Area                 | Technology                                                |
| -------------------- | --------------------------------------------------------- |
| Monorepo             | Nx + pnpm workspaces                                      |
| Language             | TypeScript, strict mode                                   |
| Website              | React + Vite                                              |
| Extension            | WXT + React, Manifest V3                                  |
| Routing              | React Router, hash-based routes                           |
| UI primitives        | Base UI (`@base-ui/react`)                                |
| Styling              | SCSS with BEM; shared CSS variables                       |
| Local UI state       | Zustand                                                   |
| Website server state | TanStack Query                                            |
| I18n                 | i18next + react-i18next; bundled English/Russian catalogs |
| Backend              | NestJS REST API                                           |
| API validation       | class-validator + class-transformer                       |
| Server database      | PostgreSQL 17                                             |
| ORM and migrations   | Prisma                                                    |
| Extension storage    | RxDB + Dexie over IndexedDB                               |
| Authentication       | Google OAuth through NestJS                               |
| Tests                | Vitest + Playwright                                       |
| Formatting           | ESLint Stylistic + Prettier; Husky + lint-staged          |

Implementation rules are in [Conventions](conventions.md) and
[Contributing](contributing.md). Setup and commands are in the
[README](../README.md).
