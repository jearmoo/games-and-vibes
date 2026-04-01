# Architecture Patterns

Detailed code patterns established in the adtaboo reference implementation. Read this when extending existing games or understanding how a specific pattern works.

## BaseRoom Contract

**File**: `packages/server-core/src/BaseRoom.ts`

BaseRoom provides player management, teams, host tracking, settings, and serialization. Games extend it with game-specific state and logic.

### Provided Methods (don't override unless extending with `super`)

| Method | Purpose |
|--------|---------|
| `addPlayer(id, name, socketId)` | Register player, return Player object |
| `removePlayer(id)` | Soft-remove during active game, hard-delete in lobby |
| `getActivePlayers()` | Players not marked `removed` |
| `getPlayer(id)` / `getPlayerByName(name)` | Lookups |
| `getTeamPlayers(team)` | Connected players on a team |
| `getOpposingTeam(team)` | Returns `'A'` or `'B'` |
| `playerDTOs()` / `toDTO()` | Client-safe serialization (strips `socketId`) |
| `toJSON()` / `restorePlayers(data)` | Persistence (calls `serializeGameState()`) |
| `touch()` | Update `lastActivity` for stale room cleanup |

### Abstract Methods (must implement)

```typescript
// Clean up role assignments when player leaves (e.g., clear clue-giver, reassign roles)
protected abstract onPlayerRemoved(playerId: string): void;

// True during gameplay phases — controls soft-remove vs hard-delete behavior
abstract isGameActive(): boolean;

// Current phase string for toDTO() — null when in lobby with no active game
abstract getPhase(): string | null;

// Return game-specific state for JSON crash recovery
// This gets spread into toJSON(): { ...baseFields, ...serializeGameState() }
abstract serializeGameState(): object;

// Reset everything and return to lobby phase
abstract resetToLobby(): void;

// Cancel active timers — called during cleanup and lobby reset
abstract clearTimer(): void;
```

### Extension Pattern

```typescript
// Override toDTO to include game-specific fields
toDTO(): MyGameRoomDTO {
  return {
    ...super.toDTO(),
    myField: this.myField,
  };
}

// Static factory for crash recovery — NOT an abstract method, but required
static fromJSON(data: any): MyGameRoom {
  const room = new MyGameRoom(data.code, data.hostId);
  room.restorePlayers(data);  // Rebuilds player Map from serialized array
  room.settings = data.settings;
  room.lastActivity = data.lastActivity;
  room.game = data.game;
  return room;
}
```

## RoomManager Generic Pattern

**File**: `packages/server-core/src/RoomManager.ts`

`RoomManager<T extends BaseRoom>` manages room lifecycle. It's generic — it doesn't know about your game's specific room type.

```typescript
interface RoomManagerOptions<T extends BaseRoom> {
  store?: RoomStore;           // Persistence (JsonFileStore or future Redis)
  roomFactory: (code: string, hostId: string) => T;  // Creates new rooms
  roomFromJSON: (data: any) => T;                     // Deserializes rooms
  snapshotPath?: string;       // Path for automatic snapshots
}
```

**Key behaviors**:
- `createRoom(hostId)` generates a random 4-character room code
- `trackPlayer(playerId, roomCode)` / `untrackPlayer(playerId)` maintain a player→room index
- Automatic cleanup: rooms with no activity for 30 minutes are destroyed
- Automatic snapshots: room state saved to disk every 60 seconds
- `restore(onRoomRestored?)` loads rooms from disk on startup

## createGameServer() Wiring

**File**: `packages/server-core/src/createServer.ts`

The factory sets up Express + Socket.IO + health/metrics endpoints + graceful shutdown. Games provide callbacks:

### Server Endpoints

`createGameServer()` automatically registers these endpoints — no per-game setup required.

**`GET /api/health`** — Unauthenticated. Returns:
```json
{ "status": "ok", "game": "Adversarial Taboo", "uptime": 3600, "rooms": 5, "players": 12 }
```

**`GET /api/metrics`** — Requires `Authorization: Bearer $METRICS_TOKEN`. Optional `?days=N` query param to limit history. Returns aggregated stats plus live counts:
```json
{ "connections": 8, "activePlayers": 12, "activeRooms": 5, "...": "game-specific metrics" }
```

### registerGameHandlers

Called for every new socket connection. Register all game-specific event listeners here.

```typescript
registerGameHandlers: (ctx: SocketContext<T>) => {
  // Typically calls multiple handler registration functions
  registerMyLobbyHandlers(ctx, metrics);
  registerMySetupHandlers(ctx);
  registerMyGameHandlers(ctx, metrics);
},
```

### lobbyCallbacks

```typescript
lobbyCallbacks: {
  // Called when a player reconnects — return current game state or null
  buildGameState: (room: T) => object | null;

  // Optional: called after player successfully reconnects
  onPlayerReconnect?: (room: T, playerId: string, io: Server) => void;
}
```

`buildGameState` is critical for reconnection. It must return enough state for the client to reconstruct its view at any phase. Return `null` if no game is active.

### connectionCallbacks

```typescript
connectionCallbacks: {
  // Called when a player's socket disconnects (before the 2-min grace period)
  onPlayerDisconnect?: (room: T, playerId: string, io: Server) => void;

  // Optional: custom host reassignment logic
  onHostReassign?: (room: T, oldHostId: string) => string | undefined;
}
```

Use `onPlayerDisconnect` for game-specific cleanup: auto-end turn if active player disconnects, clear role assignments, notify other players of state changes.

### onRoomRestored

Called once per room during server startup after rooms are loaded from disk.

```typescript
onRoomRestored: (room: T, io: Server) => {
  // Restore timers from saved state
  if (room.game?.timerEnd) {
    const remaining = room.game.timerEnd - Date.now();
    if (remaining > 0) {
      room.restoreTimer(remaining, () => handleTurnEnd(room, io));
    } else {
      // Timer expired during downtime — short grace period for reconnecting clients
      room.restoreTimer(3000, () => handleTurnEnd(room, io));
    }
  }
}
```

## SocketContext

**File**: `packages/server-core/src/socketContext.ts`

Every handler receives this typed context — never raw sockets:

```typescript
interface SocketContext<T extends BaseRoom = BaseRoom> {
  io: Server;                              // Socket.IO server (for broadcasting)
  socket: Socket;                          // The connected client's socket
  rooms: RoomManager<T>;                   // Room manager (typed to your game)
  metrics: MetricsCollector;               // Metrics collector (record events, no manual wiring)
  getPlayerId: () => string | null;        // Get the authenticated player ID
  setPlayerId: (id: string | null) => void; // Set during join/create
}
```

Metrics are available on the context — handlers access them via `ctx.metrics` instead of receiving them as a separate parameter.

## Handler Pattern

**Reference**: `games/adtaboo/server/src/handlers/setupHandlers.ts`

### Standard Handler Shape

```typescript
export function registerMyHandlers(ctx: SocketContext<MyGameRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on('action:name', (payload: { field: string }) => {
    // 1. Auth check
    const playerId = ctx.getPlayerId();
    if (!playerId) return;

    // 2. Get room
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;

    // 3. Phase check
    if (room.game.phase !== GamePhase.EXPECTED_PHASE) return;

    // 4. Role/permission check
    const player = room.getPlayer(playerId);
    if (!player?.team) return;
    if (playerId !== room.someRoleId) return;  // e.g., only clue-giver can do this

    // 5. Call room method (state mutation)
    room.doSomething(payload.field);

    // 6. Emit to affected players
    io.to(room.code).emit('action:result', { /* data */ });

    // 7. Touch (if room method doesn't already)
    room.touch();
  });
}
```

### Selective Emission

When different players should see different data:

```typescript
// Emit to each team separately with filtered data
for (const p of room.getTeamPlayers('A')) {
  io.to(p.socketId).emit('game:state', {
    cards: room.game.challenges.A.cards,  // Team A sees their own cards
    opponentCards: room.game.challenges.B.cards.map(maskCard),  // Masked opponent cards
  });
}
for (const p of room.getTeamPlayers('B')) {
  io.to(p.socketId).emit('game:state', {
    cards: room.game.challenges.B.cards,
    opponentCards: room.game.challenges.A.cards.map(maskCard),
  });
}
```

### Socket Event Naming Convention

Events follow `namespace:action` pattern:
- `room:*` — Room lifecycle (create, join, rejoin, leave)
- `team:*` — Team management
- `settings:*` — Game settings
- `game:*` — Game lifecycle (start, reset, play-again)
- `<phase>:*` — Phase-specific actions (e.g., `setup:suggest`, `clue:got-it`, `taboo:buzz`)
- `turn:*` / `round:*` — Transition events

## Client Store Pattern

**Reference**: `games/adtaboo/client/src/store.ts`

### Store Structure

Flat Zustand store — no nesting, no separate slices:

```typescript
interface GameStore {
  // Connection
  connected: boolean;
  error: string | null;

  // Room
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
  hostId: string | null;
  players: PlayerDTO[];
  settings: MyGameSettings;

  // Game state (mirrors server)
  phase: GamePhase | null;
  scores: { A: number; B: number };
  // ... game-specific fields

  // Actions (setters)
  setConnected: (v: boolean) => void;
  setPhase: (v: GamePhase | null) => void;
  reset: () => void;
  // ...
}

export const useGameStore = create<GameStore>((set) => ({
  // ... initial values and setters
}));
```

### Derived Hooks

Export hooks that compute values from the store:

```typescript
export function useMyPlayer() {
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  return players.find((p) => p.id === playerId) ?? null;
}

export function useIsHost() {
  const playerId = useGameStore((s) => s.playerId);
  const hostId = useGameStore((s) => s.hostId);
  return playerId !== null && playerId === hostId;
}

export function useMyRole(): 'some-role' | 'other-role' | null {
  // Compute role from phase + playerId + game state
}
```

## Socket Listener Pattern

**Reference**: `games/adtaboo/client/src/socketListeners.ts`

This is a side-effect file — it imports `socket` and `useGameStore`, then mounts listeners. Imported once in `main.tsx`.

```typescript
import { socket } from './socket';
import { useGameStore } from './store';
import { saveSession, clearSession } from '@games/client-core';

const { getState: get } = useGameStore;

socket.on('room:created', (data) => {
  get().setRoomCode(data.roomCode);
  get().setPlayerId(data.playerId);
  saveSession('my_session', { roomCode: data.roomCode, playerId: data.playerId, playerName: data.playerName });
});

// room:rejoined is the most complex — must handle ALL phases
socket.on('room:rejoined', (data) => {
  const store = get();
  store.setRoomCode(data.room.code);
  store.setPlayers(data.room.players);
  store.setPhase(data.room.phase);
  if (data.gameState) {
    // Restore all game-specific state based on current phase
    store.setScores(data.gameState.scores);
    // ...
  }
});
```

### Critical: `room:rejoined` Completeness

The `room:rejoined` listener must reconstruct the FULL client state for any phase. If a player refreshes during the cluing phase, the listener must restore scores, cards, timer, buzzes — everything. Missing a field causes a broken UI on reconnect.

## Phase Routing Pattern

**Reference**: `games/adtaboo/client/src/App.tsx`

```typescript
function ScreenRouter({ phase }: { phase: string }) {
  const role = useMyRole();

  switch (phase) {
    case 'LOBBY':
      return <LobbyScreen />;
    case 'SOME_PHASE':
      // Further switch on role when different roles see different screens
      if (role === 'active-player') return <ActivePlayerScreen />;
      return <SpectatorScreen />;
    case 'GAME_OVER':
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
  }
}
```

Wrap with `AnimatePresence` for smooth phase transitions:
```typescript
<AnimatePresence mode="wait">
  <motion.div key={phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <ScreenRouter phase={phase} />
  </motion.div>
</AnimatePresence>
```

## Tailwind Theming

**Base preset**: `packages/client-core/src/tailwind-preset.ts`

Provides the dark glassmorphism design system: surface colors, accent yellow, display font (Righteous), body font (DM Sans), animations.

Games extend in their `tailwind.config.js`:
```javascript
import basePreset from '@games/client-core/tailwind-preset';

export default {
  presets: [basePreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/client-core/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'team-a': '#3b82f6',      // Game-specific team colors
        'team-b': '#ef4444',
        'team-a-glow': '#60a5fa',
        'team-b-glow': '#f87171',
      },
    },
  },
};
```

## Storage and Persistence

**Interfaces**: `packages/server-core/src/store.ts`

```typescript
interface RoomStore {
  save(data: object[]): void;      // Save all rooms
  restore(): object[] | null;       // Load rooms on startup
  clear(): void;                    // Clear persisted data
}

interface MetricsStore {
  flush(data: object): Promise<void>;  // Async persist
  load(): object | null;               // Load on startup
  flushSync(data: object): void;       // Sync persist (for shutdown)
}
```

`JsonFileStore` implements both interfaces with atomic writes (write to `.tmp`, then rename). This prevents corruption on crash. Future implementations (Redis, Postgres) should implement these same interfaces.

## Structured Logging

### Server Logger

**File**: `packages/server-core/src/logger.ts`

```typescript
logger.info('category', 'Human-readable message', { key: 'value' });
// Output: {"ts":"...","level":"info","cat":"category","msg":"...","data":{...}}
```

Use consistent categories: `room`, `game`, `conn`, `setup`, `server`, `metrics`.

### Client Logger

**File**: `packages/client-core/src/clientLogger.ts`

Same API as the server logger but designed for browser environments:

```typescript
import { clientLogger } from '@games/client-core';
clientLogger.info('room', 'Player joined', { name: 'Alice' });
// Output: [room] Player joined { name: 'Alice' }
```

Level gating: defaults to `debug` in dev (localhost), `warn` in production. Override via `localStorage.setItem('LOG_LEVEL', 'debug')`.

Use `clientLogger` instead of `console.log/error` in game clients for consistent, filterable output.

## Test Utilities

**Directory**: `packages/test-utils/src/`

### createMockSocketContext

The primary tool for handler testing:

```typescript
import { createMockSocketContext, MockSocketClient, MockIO } from '@games/test-utils';

const { ctx, socket, io, rooms, store, metrics } = createMockSocketContext<MyGameRoom>({
  roomFactory: (code, hostId) => new MyGameRoom(code, hostId),
  roomFromJSON: (data) => MyGameRoom.fromJSON(data),
});

// Create a room and player
const room = rooms.createRoom('host-id');
room.addPlayer('host-id', 'Alice', socket.id);
ctx.setPlayerId('host-id');

// Register handlers
registerMyHandlers(ctx);

// Simulate a client event
socket.trigger('action:name', { field: 'value' });

// Assert emissions
expect(io.getRoomEvent(room.code, 'action:result')).toHaveLength(1);
expect(socket.getLastEmitted('action:result')).toBeDefined();
```

### MockStore

In-memory `RoomStore` + `MetricsStore` for testing persistence without the filesystem:

```typescript
const store = new MockStore();
// Set data to return from restore()
store.restoreData = [room.toJSON()];
// Check that save was called
expect(store.saveCalls).toBe(1);
```
