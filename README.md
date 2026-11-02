# Filecab

The [specification](specs/index.md).

## Setup

Requires Node.js 22.12+ and pnpm 12.16.1. Run these commands from the repository root:

```sh
npm install -g pnpm@12.16.1
pnpm install
```

## Development

```sh
pnpm dev:web        # React + Vite, http://localhost:5173
pnpm dev:extension  # WXT + React (Chrome)
pnpm dev:api        # NestJS, http://localhost:3001
pnpm dev            # Extension + API
```

See the [extension README](apps/extension/README.md) for loading the extension in Chrome and debugging it.

## Build and check

```sh
pnpm build
pnpm typecheck
```

Nx also accepts individual targets: `pnpm exec nx build web`, `pnpm exec nx build extension`, `pnpm exec nx build api`, and `pnpm exec nx typecheck library`. Libraries have build and typecheck targets too.

- `apps/web`: minimal React page with Vite.
- `apps/extension`: WXT popup, full page (`full-page.html`), background, and content script. The empty content script matches only `https://example.com/*`.
- `apps/api`: NestJS bootstrap and empty module. No application routes; `/` returns 404. Override the port with `PORT`.
- `packages/ui`: shared React panel.
- `packages/library`: shared React placeholder composed from UI and contract types.
- `packages/contracts`: framework-independent TypeScript types.
