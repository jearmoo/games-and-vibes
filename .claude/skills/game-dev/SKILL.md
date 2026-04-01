---
name: game-dev
description: Use this skill when creating a new game, adding features to an existing game, or working on game architecture in this party games monorepo. Trigger whenever the user mentions a new game, game feature, game phase, room logic, socket handlers, game client, game server, or any work under games/. Also use when the user asks about the monorepo architecture or how games are structured.
---

# Game Development

This skill guides development in the party games monorepo — creating new games, adding features to existing ones, and maintaining architectural consistency across the platform.

## Understand the Request

Determine which workflow applies:

**New game** — User wants to create a game from scratch.
Read `references/new-game-checklist.md` and follow it sequentially. Use `/feature-dev` to manage the multi-phase implementation.

**Existing game feature** — User wants to add or modify gameplay, UI, or server logic for a game that already exists.
Identify which layer(s) the change touches (see Layer Guide below), then work through them in dependency order.

**Cross-cutting change** — User wants to modify shared packages (`server-core`, `client-core`, `shared-types`, `test-utils`).
These affect all games. Read `references/architecture-patterns.md` for the contracts that must be preserved. Run the full test suite after changes.

## Monorepo Quick Reference

```
shared-types          Pure TS types, no runtime
   |
   +---> <game>-shared    Game-specific types (extends shared-types)
   |        |
   +---> server-core      BaseRoom, RoomManager, createGameServer, handlers
   |        |
   |        +---> <game>-server   GameRoom extends BaseRoom + handlers + entry
   |
   +---> client-core      createSocket, sessionStore, Tailwind preset, shared components
            |
            +---> <game>-client   React SPA + Zustand store + phase routing
```

**Package naming**: `@games/<name>-shared`, `@games/<name>-server`, `@games/<name>-client`
**Directory structure**: `games/<name>/{shared,server,client}`
**Build order matters**: `pnpm -r build` handles it. When working on one package, build its dependencies first.
**Workspace globs** in `pnpm-workspace.yaml` already cover `games/*/` — new games are auto-discovered.

### Port Allocation

| Game    | Server Port | Subdomain           |
|---------|-------------|---------------------|
| adtaboo | 4040        | adtaboo.jerpi.org   |
| landing | 3000        | games.jerpi.org     |
| (next)  | 4041+       | <name>.jerpi.org    |

## Layer Guide

Changes almost always flow through multiple layers. Work in this order:

### 1. Types First

Always start with type definitions. They are the contract between server and client.

- **Base types** (`packages/shared-types/src/index.ts`): `Player`, `PlayerDTO`, `TeamId`, `RoomSettings`, `RoomDTO`. Rarely changed.
- **Game types** (`games/<name>/shared/src/index.ts`): `GamePhase` const + type, `GameState`, game-specific settings extending `RoomSettings`, game DTO extending `RoomDTO`.

Pattern for GamePhase:
```typescript
export const GamePhase = {
  LOBBY: 'LOBBY',
  // ... game-specific phases
  GAME_OVER: 'GAME_OVER',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];
```

### 2. Server Room Class

The room class owns all game state. Handlers never store state — they call room methods.

Extend `BaseRoom` and implement 6 abstract methods:
- `onPlayerRemoved(playerId)` — Clean up role assignments (e.g., clear clue-giver)
- `isGameActive()` — True during gameplay phases, false in lobby/game-over
- `getPhase()` — Return current GamePhase string or null
- `serializeGameState()` — Return game-specific state for JSON persistence
- `resetToLobby()` — Clear all game state, return to lobby
- `clearTimer()` — Cancel any active setTimeout

Also implement:
- `static fromJSON(data)` — Factory that calls `restorePlayers(data)` and restores game state
- `toDTO()` — Override to include game-specific fields, delegate base fields to `super.toDTO()`

Reference: `games/adtaboo/server/src/AdtabooRoom.ts`

### 3. Server Handlers

Organize by game phase. Each handler file exports a `register*Handlers(ctx: SocketContext<GameRoom>)` function.

Every socket handler follows this skeleton:
```typescript
socket.on('event:name', (payload) => {
  const playerId = ctx.getPlayerId();
  if (!playerId) return;
  const room = rooms.getRoomForPlayer(playerId);
  if (!room?.game || room.game.phase !== ExpectedPhase) return;
  // Validate role/permissions
  // Call room method to mutate state
  // Emit to affected players
  // Access metrics via ctx.metrics (e.g., ctx.metrics.record('gamesStarted'))
  room.touch();
});
```

Typical handler files:
- `lobbyHandlers.ts` — Game-specific lobby events (settings, game start, role assignment)
- `gameHandlers.ts` — Core gameplay events
- Additional files per phase as needed (e.g., `setupHandlers.ts`)

### 4. Server Entry Point

Wire everything together with `createGameServer()`:
```typescript
createGameServer<GameRoom>({
  gameName: 'Game Name',
  rooms,              // RoomManager<GameRoom> with factory + fromJSON
  metrics,            // MetricsCollector with JsonFileStore
  registerGameHandlers: (ctx) => {
    // ctx includes io, socket, rooms, metrics, getPlayerId, setPlayerId
    registerMyLobbyHandlers(ctx);
    registerMyGameHandlers(ctx);
  },
  lobbyCallbacks: { buildGameState },     // Return game state for reconnecting players
  connectionCallbacks: { onPlayerDisconnect },  // Game-specific disconnect cleanup
  onRoomRestored: (room, io) => { /* restore timers after server restart */ },
});
```

Reference: `games/adtaboo/server/src/index.ts`

### 5. Client Store (Zustand)

Flat store mirroring server state. One file, no nested stores.

Pattern:
- State fields match server DTO + UI-only state (connected, error)
- Setter actions for each field or group
- Derived hooks exported alongside: `useMyPlayer()`, `useMyRole()`, `useIsHost()`, `useTeamPlayers(team)`

Reference: `games/adtaboo/client/src/store.ts`

### 6. Client Socket Listeners

Separate file (`socketListeners.ts`) imported once at app startup. Each server event maps to a store update.

The `room:rejoined` listener is critical — it must reconstruct the full client state from a server snapshot for any possible phase. This enables seamless reconnection.

Reference: `games/adtaboo/client/src/socketListeners.ts`

### 7. Client UI — Phase Routing

`App.tsx` uses a `ScreenRouter` that switches on `phase`:
```typescript
function ScreenRouter({ phase }: { phase: string }) {
  switch (phase) {
    case 'LOBBY': return <LobbyScreen />;
    // ... one case per phase, sometimes further switching on role
    default: return <HomeScreen />;
  }
}
```

Use `AnimatePresence` from framer-motion for phase transitions. Show `ScoreBoard` above the phase content during gameplay. Show `ReconnectBanner` when disconnected.

Reference: `games/adtaboo/client/src/App.tsx`

## Architecture Invariants

These rules prevent the bugs and inconsistencies that break multiplayer games:

1. **Room is the single source of truth.** All game state lives on the Room class. Handlers are stateless orchestrators. Never store game state in closures, handler scope, or module-level variables.

2. **Serialization round-trip must be lossless.** `toJSON()` calls `serializeGameState()`. `fromJSON()` is a static factory. Test that `fromJSON(room.toJSON())` produces an equivalent room. This is how crash recovery works.

3. **Selective emission.** Different players see different data. Example: during cluing, the clue-giver sees real words while guessers see masked cards. Iterate team players and emit different payloads — never broadcast secrets to the room.

4. **Timer restoration.** If a game has timers, `onRoomRestored` must re-create them from `timerEnd - Date.now()`. Handle the case where the timer expired during server downtime (use a short grace period).

5. **Graceful disconnect handling.** Players disconnect constantly on mobile. The 2-minute grace period in `connectionHandlers` handles reconnection automatically. Games must handle the edge cases: what happens if the active player disconnects mid-turn?

6. **Phase validation in every handler.** Every handler must check that the room is in the expected phase before doing anything. This prevents race conditions from stale client events.

## Skill Recommendations

**Use `/feature-dev`** for significant new features — a new game phase, a new game mechanic, or anything touching 5+ files. Its explore-question-architect-implement-review loop prevents mistakes in multi-package changes.

**Use `/frontend-design`** when building new game screens or components. Each game extends the shared dark glassmorphism aesthetic from `client-core/tailwind-preset.ts` but has its own accent colors and personality. The skill ensures high visual quality.

**Use `/simplify`** after completing a feature. It catches duplicated logic that should move to shared packages, overly complex code, and missed reuse opportunities.

**Don't use skills** for simple bug fixes, single-file changes, type adjustments, or configuration tweaks — just do them directly.

## Testing

Use `@games/test-utils` for all game tests:
- `TestRoom` — Concrete BaseRoom for testing base class behavior
- `MockStore` — In-memory RoomStore/MetricsStore
- `MockSocketClient` / `MockIO` / `createMockSocketContext()` — Socket.IO mocks

What to test:
- Room class: state transitions, edge cases (player disconnect during each phase), serialization round-trip
- Handlers: use `createMockSocketContext()` to simulate socket events and verify emissions
- Run `pnpm -r test` before committing

## Validation Checklist

Before committing any game change:
```bash
pnpm run typecheck    # Catches cross-package type errors
pnpm run lint         # ESLint across all packages
pnpm -r test          # All tests pass
pnpm run format       # Auto-format
```

## Known TODOs

These are architectural improvements to make as the platform grows:

- **Storage backend abstraction**: `RoomStore`/`MetricsStore` interfaces are in place but only `JsonFileStore` exists. Implement Redis or Postgres adapters for multi-instance deployments with shared state.

- **Shared game utilities**: Common patterns like team-based scoring, round advancement, and timer management repeat across games. Extract reusable logic into BaseRoom methods or composable utility functions in server-core.

- **Landing page auto-discovery**: `apps/landing/src/gameRegistry.ts` is manually maintained. Consider generating it from game package metadata or a shared config file.

## Reference Files

Read these when you need deeper detail:

- **`references/new-game-checklist.md`** — Step-by-step guide for creating a brand new game. Follow this sequentially when the user asks to build a new game.
- **`references/architecture-patterns.md`** — Detailed code patterns with file references. Read when you need to understand how a specific pattern works or when extending existing games.
- **`references/deployment-checklist.md`** — Docker, compose, tunnel, CI, and DNS setup for shipping a new game. Read when the game is ready to deploy.
