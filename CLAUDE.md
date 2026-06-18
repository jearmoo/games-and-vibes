# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm -r build             # Build all packages (server-core → games → apps)
pnpm -r test              # Run all tests (server-core, client-core, adtaboo-server)
pnpm run lint             # ESLint across all packages
pnpm run typecheck        # tsc --noEmit in all packages
pnpm run format           # Prettier auto-format
pnpm run format:check     # Check formatting

# Game-specific
pnpm run dev:adtaboo      # Run adtaboo server (4040) + client (5173) concurrently
pnpm run dev:charades     # Run charades server (4050) + client (5173) concurrently
pnpm run dev:cave         # Run Odes for Cave Men server (4060) + client (5173) concurrently
pnpm run dev:castlefall   # Run Castlefall server (4070) + client (5173) concurrently
pnpm run dev:tworooms     # Run Two Rooms and a Boom server (4080) + client (5175) concurrently
pnpm run dev:landing      # Run landing page (3000)

# Single test file
cd packages/server-core && npx vitest run src/BaseRoom.test.ts
cd games/adtaboo/server && npx vitest run src/AdtabooRoom.test.ts
```

## Architecture

pnpm monorepo for a multi-game party platform. Three layers: shared packages, game packages, and apps.

### Shared Packages (`packages/`)

- **`server-core/`** — Room infrastructure reused by all games:
  - `BasePlayer`/`BasePlayerDTO`/`RoomSettings`/`RoomDTO` — base types in `types.ts`, games extend for game-specific fields
  - `BaseRoom<P>` (abstract, generic) — player management, host, settings, serialization. Games extend with their own player type.
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
  - `Sheet` — reusable bottom-sheet overlay with backdrop blur; use as the default for any user-triggered overlay UI (pickers, confirmations, info panels). Prefer `Sheet` over inline replacements or centered modals for mobile-first game flows.
- **`test-utils/`** — Shared test infrastructure:
  - `TestRoom` — concrete BaseRoom for testing abstract class
  - `MockStore` — in-memory RoomStore/MetricsStore
  - `MockSocketClient`/`MockIO`/`createMockSocketContext()` — Socket.IO mocks

### Games (`games/`)

- **`adtaboo/`** — Adversarial Taboo: teams give clues while opponents set traps. `AdtabooRoom extends BaseRoom<AdtabooPlayer>`, word providers, phase-based client.
- **`charades/`** — Charades: act it out without words. Stateless word server, team-based play.
- **`odes-for-cave-men/`** — Odes for Cave Men: explain big ideas with only small words. `CaveRoom extends BaseRoom<CavePlayer>`, word JSON files, timed turns.
- **`castlefall/`** — Castlefall: two secret teams, one betrayal away. `CastlefallRoom extends BaseRoom<CastlefallPlayer>`, hidden-team social deduction.
- **`two-rooms-and-a-boom/`** — Two Rooms and a Boom: deal secret roles, hide/reveal your card. `TwoRoomsRoom extends BaseRoom<TwoRoomsPlayer>`, role catalog in `shared/src/roles.ts`, no in-app game logic (display only).

### Apps (`apps/`)

- **`landing/`** — games.jerpi.org hub with game cards linking to subdomains

### Key Patterns

- **Adding a game**: Define game types in `games/<name>/shared/` extending base types from server-core → create `<Game>Room extends BaseRoom<GamePlayer>` → game handlers → client with Zustand store → Dockerfile → docker-compose entry → cloudflared ingress rule
- **Testing**: Unit tests use `test-utils` (TestRoom, MockStore, MockSocket). Integration tests for JsonFileStore use real fs in tmpdir.
- **Storage**: `RoomStore`/`MetricsStore` interfaces allow swapping JsonFileStore for Redis/Postgres later.
- **Theming**: client-core exports a Tailwind preset. Games extend with own colors.
- **Disconnect/Reconnect**: See [`docs/disconnect-reconnect.md`](docs/disconnect-reconnect.md) for principles and phase x role behavior matrix.

## Deployment

- Docker Compose at repo root with per-game containers
- Cloudflared tunnel routes subdomains to localhost ports
- Adtaboo: port 4040, adtaboo.jerpi.org
- Charades: port 4050, charades.jerpi.org
- Odes for Cave Men: port 4060, odes.jerpi.org
- Castlefall: port 4070, castlefall.jerpi.org
- Two Rooms and a Boom: port 4080, tworooms.jerpi.org
- Landing: port 3000, games.jerpi.org

## Code Style

- TypeScript strict mode
- Prettier: single quotes, trailing commas, 120 char width, 2 spaces
- ESLint: unused vars warn (allow `_` prefix), `any` warn
- Components: PascalCase, default exports

## Skills

- `/game-dev` — Creating new games or developing existing ones. Covers architecture patterns, new game checklist, and deployment. Start here for any game development work.
- `/game-test` — Writing and running tests. Covers unit tests (vitest, test-utils), e2e tests (Playwright), testing patterns, and new-game testing checklist.
- `/deploy-new-game` — Deploy a game that's already built but not yet in production. Creates Dockerfile, docker-compose entry, CI step, cloudflared config, and updates all docs.

## Known TODOs

- **Storage backend abstraction**: Only `JsonFileStore` exists. Implement Redis or Postgres adapters for `RoomStore`/`MetricsStore` interfaces to support multi-instance deployments.
- **Landing page auto-discovery**: `apps/landing/src/gameRegistry.ts` is manually maintained. Consider generating from game package metadata or a shared config.
