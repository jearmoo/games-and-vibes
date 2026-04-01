# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm -r build             # Build all packages (shared-types → server-core → games → apps)
pnpm -r test              # Run all tests (server-core, client-core, adtaboo-server)
pnpm run lint             # ESLint across all packages
pnpm run typecheck        # tsc --noEmit in all packages
pnpm run format           # Prettier auto-format
pnpm run format:check     # Check formatting

# Game-specific
pnpm run dev:adtaboo      # Run adtaboo server (4040) + client (5173) concurrently
pnpm run dev:landing      # Run landing page (3000)

# Single test file
cd packages/server-core && npx vitest run src/BaseRoom.test.ts
cd games/adtaboo/server && npx vitest run src/AdtabooRoom.test.ts
```

## Architecture

pnpm monorepo for a multi-game party platform. Three layers: shared packages, game packages, and apps.

### Shared Packages (`packages/`)

- **`shared-types/`** — Pure TypeScript types, no runtime. Generic types in `index.ts`, game-specific in `adtaboo.ts`. Single source of truth for client+server.
- **`server-core/`** — Room infrastructure reused by all games:
  - `BaseRoom` (abstract) — player management, teams, host, settings, serialization
  - `RoomManager<T>` — room lifecycle, persistence via `RoomStore` interface, cleanup
  - `createGameServer()` — factory for Express + Socket.IO + health/metrics endpoints
  - `connectionHandlers` / `lobbyHandlers` — generic socket handlers with game callbacks
  - `JsonFileStore` — `RoomStore`/`MetricsStore` impl with atomic writes, crash recovery
  - `MetricsCollector` — in-memory metrics with disk persistence
- **`client-core/`** — Shared React + design primitives:
  - `createSocket()` — Socket.IO factory with auto-reconnect
  - `sessionStore` — localStorage session persistence
  - `clientLogger` — structured browser logging (category-based, level-gated)
  - Tailwind preset, shared CSS (glassmorphism), Timer/ReconnectBanner/ErrorToast components
- **`test-utils/`** — Shared test infrastructure:
  - `TestRoom` — concrete BaseRoom for testing abstract class
  - `MockStore` — in-memory RoomStore/MetricsStore
  - `MockSocketClient`/`MockIO`/`createMockSocketContext()` — Socket.IO mocks

### Games (`games/`)

- **`adtaboo/server/`** — `AdtabooRoom extends BaseRoom`, game handlers, word providers
- **`adtaboo/client/`** — React SPA with Zustand store, phase-based routing, Tailwind theming

### Apps (`apps/`)

- **`landing/`** — games.jerpi.org hub with game cards linking to subdomains

### Key Patterns

- **Adding a game**: Define types in `shared-types/<game>.ts` → create `<Game>Room extends BaseRoom` → game handlers → client with Zustand store → Dockerfile → docker-compose entry → cloudflared ingress rule
- **Testing**: Unit tests use `test-utils` (TestRoom, MockStore, MockSocket). Integration tests for JsonFileStore use real fs in tmpdir.
- **Storage**: `RoomStore`/`MetricsStore` interfaces allow swapping JsonFileStore for Redis/Postgres later.
- **Theming**: client-core exports a Tailwind preset. Games extend with own colors.

## Deployment

- Docker Compose at repo root with per-game containers
- Cloudflared tunnel routes subdomains to localhost ports
- Adtaboo: port 4040, adtaboo.jerpi.org
- Landing: port 3000, games.jerpi.org

## Code Style

- TypeScript strict mode
- Prettier: single quotes, trailing commas, 120 char width, 2 spaces
- ESLint: unused vars warn (allow `_` prefix), `any` warn
- Components: PascalCase, default exports
- Team IDs: literal `'A' | 'B'`

## Skills

- `/game-dev` — Creating new games or developing existing ones. Covers architecture patterns, new game checklist, and deployment. Start here for any game development work.

## Known TODOs

- **Storage backend abstraction**: Only `JsonFileStore` exists. Implement Redis or Postgres adapters for `RoomStore`/`MetricsStore` interfaces to support multi-instance deployments.
- **Shared game utilities**: Common patterns (team scoring, round advancement, timer management) repeat across games. Extract reusable logic into BaseRoom methods or utility functions in server-core.
- **Landing page auto-discovery**: `apps/landing/src/gameRegistry.ts` is manually maintained. Consider generating from game package metadata or a shared config.
