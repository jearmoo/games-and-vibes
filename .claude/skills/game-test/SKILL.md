---
name: game-test
description: Use this skill when writing, running, or debugging tests in this party games monorepo. Trigger when the user mentions tests, test coverage, vitest, playwright, e2e, test-utils, mocks, or asks how to verify game behavior. Also use when creating a new game's test suite or investigating test failures.
---

# Game Testing

This skill guides writing and running tests across the party games monorepo — unit tests for server/client logic (Vitest) and end-to-end tests for full multiplayer game flows (Playwright).

## Understand the Request

Determine which workflow applies:

**Writing unit tests** — User wants to test a room class, handler, or client utility.
Identify which layer the change touches and follow the corresponding pattern in Unit Testing by Layer.

**Writing e2e tests** — User wants to test a full game flow, disconnection scenario, or multi-player interaction.
Follow the E2E Testing section. These require `data-testid` attributes on UI elements.

**Running or debugging tests** — User wants to run the suite or investigate a failure.
See Running Tests, then diagnose from the error output.

## When to Use Which Test Type

| What you're testing | Test type | Why |
|---|---|---|
| Room class state transitions | Unit | Fast, deterministic, no I/O |
| Handler socket event/emission logic | Unit | MockSocketContext isolates socket layer |
| Serialization round-trip (`fromJSON(toJSON())`) | Unit | Pure data transform |
| Client utility functions (scoring, word service) | Unit | Pure functions, no mocks needed |
| Persistence (JsonFileStore) | Unit (integration) | Uses real fs in tmpdir |
| Full game flow (lobby to game-over) | E2E | Tests real client-server interaction |
| Disconnect/reconnect scenarios | E2E | Requires real WebSocket lifecycle |
| UI state correctness across phases | E2E | Validates real rendering |

Rule of thumb: if it can be tested with a function call and an assertion, use a unit test. If it requires multiple browser sessions interacting, use e2e.

## Running Tests

```bash
# All unit tests (excludes e2e packages)
pnpm -r --filter='!*-e2e' test

# Single package
cd games/adtaboo/server && npx vitest run

# Single file
cd games/adtaboo/server && npx vitest run src/AdtabooRoom.test.ts

# Watch mode (re-runs on save)
cd games/adtaboo/server && npx vitest

# E2E tests (build first, then run)
pnpm -r build && cd games/adtaboo/e2e && npx playwright test

# Single e2e spec
cd games/adtaboo/e2e && npx playwright test tests/happy-path.spec.ts

# E2E with debug UI
cd games/adtaboo/e2e && npx playwright test --ui

# E2E headed (see the browsers)
cd games/adtaboo/e2e && npx playwright test --headed
```

No shared vitest config — each package uses `vitest run` defaults with auto-discovery of `*.test.ts` files colocated with source.

## Unit Testing by Layer

### Room Class Tests

What to test: state transitions for every phase, player management edge cases (disconnect during each phase), `canStart()` validation, scoring, and serialization round-trip.

**Setup pattern** — create a factory that builds a room in a known state:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom.js';

function createTestRoom() {
  const room = new GameRoom('TEST', 'host1');
  room.addPlayer('host1', 'Alice', 'sock1');
  room.addPlayer('p2', 'Bob', 'sock2');
  room.getPlayer('host1')!.team = 'A';
  room.getPlayer('p2')!.team = 'B';
  return room;
}

describe('GameRoom', () => {
  let room: GameRoom;
  beforeEach(() => { room = createTestRoom(); });

  // Group by behavior area
  describe('player management', () => { /* ... */ });
  describe('game flow', () => { /* ... */ });
  describe('scoring', () => { /* ... */ });
  describe('serialization', () => { /* ... */ });
});
```

**Key tests to always include:**

- Serialization round-trip: `GameRoom.fromJSON(room.toJSON())` produces equivalent room (players, game state, scores)
- Restored players are disconnected: after `fromJSON`, all `player.connected === false` and `player.socketId === ''`
- Soft-remove during active game preserves player; hard-delete during lobby/game-over removes from map
- `resetToLobby()` purges soft-removed players and clears all game state
- Each phase transition method changes `game.phase` correctly
- `canStart()` returns false with clear reasons for each failure case (not enough players, missing teams, missing roles)

Reference: `games/adtaboo/server/src/AdtabooRoom.test.ts`

### Handler Tests

What to test: socket event handling, emission to correct targets (room broadcast vs direct emit), reconnection flow, error/guard cases.

**Setup pattern:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSocketContext } from '@games/test-utils';
import { GameRoom } from './GameRoom.js';
import { registerMyHandlers } from './handlers.js';

const socketOpts = {
  roomFactory: (code: string, hostId: string) => new GameRoom(code, hostId),
  roomFromJSON: (data: any) => GameRoom.fromJSON(data),
};

describe('game handlers', () => {
  let socket: any, io: any, rooms: any, metrics: any;

  beforeEach(() => {
    const mock = createMockSocketContext<GameRoom>(socketOpts);
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;
    registerMyHandlers(mock.ctx);
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  it('handles game:start', () => {
    const room = rooms.createRoom('host1');
    room.addPlayer('host1', 'Alice', socket.id);
    mock.ctx.setPlayerId('host1');

    socket.trigger('game:start', {});

    expect(io.getRoomEvent(room.code, 'game:started')).toHaveLength(1);
  });
});
```

**Assertion methods:**

- `socket.getLastEmitted('event')` — direct emission back to the triggering socket (returns `[...args]` or `undefined`)
- `socket.getEmitted('event')` — all emissions of an event (array of arg arrays, for counting)
- `io.getRoomEvent(roomCode, 'event')` — broadcasts to a room (array of arg arrays)
- `io.getBroadcasts(roomCode)` — all events broadcast to a room

**Always test these guards:**

- Room not found (player not in any room)
- Wrong phase (handler should silently return)
- Wrong role (e.g., non-host tries to start game)
- Happy path with correct state

Reference: `packages/server-core/src/handlers.test.ts`

### Persistence Tests

Uses real filesystem in a tmpdir. Clean up files in `afterEach`.

```typescript
import { afterEach, describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { JsonFileStore } from './JsonFileStore.js';

function tmpPath(): string {
  return path.join(os.tmpdir(), `test-store-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('JsonFileStore', () => {
  const paths: string[] = [];
  afterEach(() => {
    for (const p of paths) {
      try { fs.unlinkSync(p); } catch {}
      try { fs.unlinkSync(p + '.tmp'); } catch {}
    }
  });

  // Test: save/restore round-trip, atomic write, .tmp fallback on corruption, null on missing file
});
```

Reference: `packages/server-core/src/store.test.ts`

### Client Utility Tests

Pure function tests — no mocks needed. Import the function, call it, assert the result.

```typescript
import { describe, it, expect } from 'vitest';
import { calcRoundScore } from './scoring.js';

describe('calcRoundScore', () => {
  it('scores correct answers minus pass penalty', () => {
    expect(calcRoundScore(3, 0)).toBe(3);
    expect(calcRoundScore(3, 2)).toBe(2); // first pass free, every 2 extra cost 1
  });
});
```

References: `games/charades/client/src/scoring.test.ts`, `packages/client-core/src/sessionStore.test.ts`

## E2E Testing

### Architecture

Three-layer setup:

1. **`packages/e2e-core/`** — Shared infrastructure:
   - `fixture.ts` — Custom Playwright fixture providing `players: Player[]` (N isolated browser contexts with separate localStorage)
   - `setup.ts` — `createGameSetup()` factory that finds free ports, spawns game server + Vite dev server, waits for readiness, sets `BASE_URL`, and returns a teardown function
   - `ports.ts` — Port discovery and readiness utilities

2. **`games/<name>/e2e/`** — Per-game config, fixtures, helpers, and test specs

3. **Tests** use isolated browser contexts (one per player) to simulate separate devices

### Setting Up E2E for a New Game

Directory structure:

```
games/<name>/e2e/
  package.json              # @games/e2e-core, @playwright/test
  tsconfig.json
  playwright.config.ts      # defineConfig with tests/, globalSetup
  global-setup.ts           # createGameSetup({ serverDir, clientDir, serverPortEnvVar })
  fixtures/
    game.ts                 # re-export { test, expect, Player } from e2e-core
  helpers/
    lobby.ts                # goHome, createRoom, joinRoom, joinTeam, startGame
    setup.ts                # game-specific setup phase helpers
    gameplay.ts             # game-specific gameplay helpers
  tests/
    happy-path.spec.ts      # full game flow
    reconnect.spec.ts       # disconnect/reconnect during each phase
    ...
```

**`global-setup.ts`** — minimal, uses the shared factory:

```typescript
import path from 'path';
import { createGameSetup } from '@games/e2e-core';

const ROOT = path.resolve(import.meta.dirname, '../../..');

export default createGameSetup({
  serverDir: path.join(ROOT, 'games/<name>/server'),
  clientDir: path.join(ROOT, 'games/<name>/client'),
  serverPortEnvVar: '<NAME>_SERVER_PORT',
});
```

**`playwright.config.ts`** — standard values:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,                         // multiplayer tests are sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  timeout: 120_000,
});
```

### Writing E2E Tests

**Test pattern:**

```typescript
import { test, expect, type Player } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam, startGame } from '../helpers/lobby';

test.describe('Feature Name', () => {
  test('scenario description', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    // Lobby setup
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinTeam(alice.page, 'A');
    await joinTeam(bob.page, 'B');

    // Game flow
    await startGame(alice.page);

    // Assertions
    for (const p of [alice, bob]) {
      await expect(p.page.getByText('Round 1')).toBeVisible({ timeout: 10_000 });
    }
  });
});
```

**Selectors:** Always use `page.getByTestId()` for interactive elements. Use `page.getByText()` or `page.getByRole()` for content assertions. Never use CSS selectors.

**Disconnect simulation:** Close the page, wait, reopen in the same context (preserves localStorage session):

```typescript
await player.page.close();
await alice.page.waitForTimeout(3000);  // wait for server to detect disconnect
player.page = await player.context.newPage();
await player.page.goto('/');
// Player should auto-reconnect via saved session
```

### E2E Helper Guidelines

Each helper file covers one phase/area. Helpers should:
- Accept a `Page` as first argument
- Use `expect(...).toBeVisible({ timeout })` for waits instead of arbitrary sleeps
- Use short `waitForTimeout(300)` only after click actions that trigger async server round-trips
- Return meaningful values (e.g., `createRoom` returns the room code)
- Use `getByTestId` for all interactions

Reference: `games/adtaboo/e2e/helpers/lobby.ts`

## Common Patterns and Anti-Patterns

**Do:**
- Test every phase transition in the room class
- Test serialization round-trip for every game
- Test handler error cases (wrong phase, wrong role, missing room)
- Use `afterEach` to call `rooms.destroy()` and `metrics.destroy()` in handler tests
- Use `getByTestId` selectors in e2e tests
- Add `data-testid` attributes when building new UI components
- Group tests by behavior area with nested `describe` blocks

**Don't:**
- Don't test React components directly (no component test infra — use e2e for UI verification)
- Don't test Socket.IO transport mechanics (tested by the library itself)
- Don't use `vi.useFakeTimers()` for game timers — test the state machine (`endCluing()` behavior) rather than timer scheduling
- Don't share `RoomManager` instances between test cases — each test gets a fresh `createMockSocketContext`
- Don't use CSS selectors in e2e tests
- Don't add `sleep` calls longer than 500ms in e2e helpers — use explicit `expect().toBeVisible({ timeout })` waits
- Don't mock the database in persistence tests — use real fs in tmpdir

## Testing Checklist for New Games

**Unit tests (server):**
- [ ] Room class: state transitions for each phase
- [ ] Room class: player disconnect during each active phase
- [ ] Room class: `canStart()` validation (success + each failure case)
- [ ] Room class: scoring logic
- [ ] Room class: serialization round-trip (`fromJSON(room.toJSON())`)
- [ ] Room class: restored players are disconnected with empty socketId
- [ ] Room class: soft-remove during active game, hard-delete in lobby
- [ ] Room class: `resetToLobby()` clears state and purges soft-removed players
- [ ] Handlers: create room, join room, rejoin by name, rejoin by sessionId
- [ ] Handlers: each game-specific socket event (happy path + error cases)
- [ ] Handlers: phase guard rejects events in wrong phase

**Unit tests (client):**
- [ ] Any pure utility functions (scoring math, word services, etc.)
- [ ] Session storage logic (if custom beyond client-core)

**E2E tests:**
- [ ] Happy path: full game from lobby to game-over
- [ ] Reconnect: player disconnects and reconnects during active phase
- [ ] Host disconnect: host leaves, new host assigned
- [ ] Play again: game-over to new game
- [ ] Timer expiry: turn ends when timer runs out (if applicable)

**Before committing:**
- [ ] `pnpm run typecheck`
- [ ] `pnpm run lint`
- [ ] `pnpm -r --filter='!*-e2e' test`
- [ ] `pnpm run format`

## Skill Recommendations

**Use `/game-dev`** when building the game itself — this skill is for testing it.

**Use `/simplify`** after writing tests to catch redundant setup or missed helper extraction.

## Reference Files

- **`references/test-utilities.md`** — Full API reference for `@games/test-utils` (TestRoom, MockStore, MockSocketClient, MockIO, createMockSocketContext)
