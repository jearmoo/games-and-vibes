# New Game Checklist

Follow these steps in order when creating a new game. Each step references the adtaboo implementation as a template.

## 1. Choose a Name and Port

- Pick a short, lowercase name (e.g., `charades`, `hivemind`, `decrypto`)
- Package names: `@games/<name>-shared`, `@games/<name>-server`, `@games/<name>-client`
- Pick the next available port (adtaboo=4040, so 4041+)
- Subdomain: `<name>.jerpi.org`

## 2. Create Shared Types Package

**Directory**: `games/<name>/shared/`
**Template**: `games/adtaboo/shared/`

Create these files:

### `package.json`
```json
{
  "name": "@games/<name>-shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@games/server-core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.7.0"
  }
}
```

### `tsconfig.json`
Copy from `games/adtaboo/shared/tsconfig.json` — extends `../../../tsconfig.base.json`.

### `src/index.ts`
Define all game-specific types, extending base types from `@games/server-core`:

1. **Game player** — extend `BasePlayer` with game-specific fields:
   ```typescript
   import type { BasePlayer, BasePlayerDTO, RoomSettings } from '@games/server-core';

   export interface GamePlayer extends BasePlayer {
     team: 'A' | 'B' | null;  // or whatever your game needs
   }

   export interface GamePlayerDTO extends BasePlayerDTO {
     team: 'A' | 'B' | null;
   }
   ```

2. **GamePhase** — const object + type union. Always include LOBBY and GAME_OVER:
   ```typescript
   export const GamePhase = {
     LOBBY: 'LOBBY',
     // ... your phases
     GAME_OVER: 'GAME_OVER',
   } as const;
   export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];
   ```

3. **Game settings** — extend `RoomSettings` from `@games/server-core`:
   ```typescript
   export interface MyGameSettings extends RoomSettings {
     rounds: number;
     timerSeconds: number;
     // game-specific settings with defaults
   }
   ```

4. **Game state** — the full server-side game state:
   ```typescript
   export interface GameState {
     phase: GamePhase;
     round: number;
     // ... game-specific state
   }
   ```

5. **Room DTO** — what clients receive:
   ```typescript
   export interface MyGameRoomDTO {
     code: string;
     hostId: string;
     players: GamePlayerDTO[];
     settings: MyGameSettings;
     phase: GamePhase | null;
     // ... game-specific public fields
   }
   ```

## 3. Create Server Package

**Directory**: `games/<name>/server/`
**Template**: `games/adtaboo/server/`

### `package.json`
Key dependencies:
```json
{
  "dependencies": {
    "@games/server-core": "workspace:*",
    "@games/<name>-shared": "workspace:*",
    "express": "^4.21.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@games/test-utils": "workspace:*",
    "vitest": "^2.1.0",
    "typescript": "~5.7.0",
    "tsx": "^4.0.0"
  }
}
```

Scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist/index.js), `test` (vitest run).

### `tsconfig.json`
Copy from `games/adtaboo/server/tsconfig.json` — extends base, excludes `**/*.test.ts` from build.

### `src/<Name>Room.ts`

Extend `BaseRoom<GamePlayer>`. This is where ALL game state lives.

```typescript
import { BaseRoom } from '@games/server-core';
import type { GamePlayer, GamePlayerDTO, MyGameSettings, GameState } from '@games/<name>-shared';

export class MyGameRoom extends BaseRoom<GamePlayer> {
  declare settings: MyGameSettings;
  game: GameState | null = null;

  constructor(code: string, hostId: string) {
    super(code, hostId, {
      // ... default settings
    });
  }

  // --- Player management (override to add game-specific fields) ---

  override addPlayer(id: string, name: string, socketId: string): GamePlayer {
    const player: GamePlayer = { id, name, team: null, socketId, connected: true };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  override playerDTOs(): GamePlayerDTO[] {
    return Array.from(this.players.values()).map(p => ({
      id: p.id, name: p.name, team: p.team, connected: p.connected,
    }));
  }

  // --- Abstract method implementations ---

  protected onPlayerRemoved(playerId: string): void {
    // Clear any role assignments for this player
  }

  isGameActive(): boolean {
    // Return true during gameplay phases, false in LOBBY/GAME_OVER
    return this.game !== null &&
      this.game.phase !== 'LOBBY' &&
      this.game.phase !== 'GAME_OVER';
  }

  getPhase(): string | null {
    return this.game?.phase ?? null;
  }

  serializeGameState(): object {
    return {
      game: this.game,
      // ... any other game-specific state not in BaseRoom
    };
  }

  resetToLobby(): void {
    this.clearTimer();
    this.game = null;
    // ... reset any other game state
  }

  // --- Optional overrides ---

  override clearTimer(): void {
    // clearTimeout(this.timer); this.timer = null;
  }

  // --- Serialization ---

  override toDTO() {
    return {
      ...super.toDTO(),
      // ... game-specific public fields
    };
  }

  static fromJSON(data: any): MyGameRoom {
    const room = new MyGameRoom(data.code, data.hostId);
    room.restorePlayers(data);
    room.settings = data.settings;
    room.lastActivity = data.lastActivity;
    room.game = data.game;
    // ... restore other state
    return room;
  }

  // --- Game methods ---
  // Add methods for game logic. Handlers call these methods.
}
```

### `src/handlers/`

Create handler files organized by game phase:

**`lobbyHandlers.ts`** — Game-specific lobby events:
- `team:join` — Assign player to team (if your game uses teams)
- `settings:update` — Validate and update game settings
- `game:start` — Validate readiness (enough players, teams balanced, roles assigned), initialize GameState, transition to first gameplay phase

**`gameHandlers.ts`** — Core gameplay events:
- One event per player action
- Always validate: playerId exists, room exists, correct phase, correct role
- Call room methods, then emit results
- Access metrics via `ctx.metrics` (it's on `SocketContext`, not passed separately)

**Additional handler files** as needed for distinct phases.

### `src/index.ts`

Wire everything together. Follow the pattern in `games/adtaboo/server/src/index.ts`:

```typescript
const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<MyGameRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new MyGameRoom(code, hostId),
  roomFromJSON: (data) => MyGameRoom.fromJSON(data),
});

createGameServer<MyGameRoom>({
  gameName: 'My Game',
  rooms,
  metrics,
  registerGameHandlers: (ctx) => {
    // ctx includes io, socket, rooms, metrics, getPlayerId, setPlayerId
    registerMyLobbyHandlers(ctx);
    registerMyGameHandlers(ctx);
  },
  lobbyCallbacks: {
    buildGameState: (room) => {
      if (!room.game) return null;
      return { /* game state snapshot for reconnecting players */ };
    },
    // If your game uses team socket rooms:
    onPlayerSocketJoin: (room, playerId, socket) => {
      const player = room.getPlayer(playerId);
      if (player?.team) socket.join(`${room.code}:team${player.team}`);
    },
  },
  connectionCallbacks: {
    onPlayerDisconnect: (room, playerId, io) => {
      // Handle active player disconnecting mid-game
    },
    // If your game uses team socket rooms:
    onBeforePlayerLeave: (room, playerId, socket) => {
      const player = room.getPlayer(playerId);
      if (player?.team) socket.leave(`${room.code}:team${player.team}`);
    },
  },
  onRoomRestored: (room, io) => {
    // Restore timers if game was in a timed phase
  },
});
```

### `src/<Name>Room.test.ts`

Test at minimum:
- Game state transitions (each phase → next phase)
- Player disconnect during each phase
- Serialization round-trip: `MyGameRoom.fromJSON(room.toJSON())`
- Edge cases specific to the game

Use `createMockSocketContext()` from `@games/test-utils` for handler tests.

## 4. Create Client Package

**Directory**: `games/<name>/client/`
**Template**: `games/adtaboo/client/`

### Config Files

Copy these from `games/adtaboo/client/`, adjusting names and ports:
- `package.json` — Change name to `@games/<name>-client`, update dependencies
- `tsconfig.json` — Same structure
- `vite.config.ts` — Change port and proxy target to match server port
- `postcss.config.js` — Same (tailwindcss + autoprefixer)
- `tailwind.config.js` — Extend `@games/client-core/tailwind-preset`, add game-specific colors
- `index.html` — Update title and set up Google Analytics (see below)

### Google Analytics (`index.html`)

Copy the gtag `<script>` block from `games/adtaboo/client/index.html` into your `index.html` `<head>`. The key parts:

- **`%VITE_GA_ID%`** — Vite substitutes this at build time from the `VITE_GA_ID` env var (set via `GA_MEASUREMENT_ID` Docker build arg)
- **`game_name`** — Set this to your game's identifier in the `gtag('config', ...)` call so games are distinguishable in Google Analytics:
  ```js
  gtag('config', id, { 'game_name': '<name>' });
  ```

The script is a no-op when the ID is missing, so local dev works without it.

### `src/store.ts`

Flat Zustand store. Include:
- Connection state: `connected`, `error`
- Room state: `roomCode`, `playerId`, `playerName`, `hostId`, `players`, `settings`
- Game state: `phase`, `scores`, and game-specific fields
- Setter actions for each group
- Derived hooks: `useMyPlayer()`, `useIsHost()`, `useMyRole()`, etc.

### `src/socket.ts`

```typescript
import { createSocket } from '@games/client-core';
const { socket, autoReconnecting } = createSocket({ sessionKey: '<name>_session' });
export { socket, autoReconnecting };
```

Use `clientLogger` from `@games/client-core` instead of `console.log/error` for structured, level-gated logging in the client.

### `src/socketListeners.ts`

Import socket and store. Mount one listener per server event. Critical listeners:
- `room:created` / `room:joined` — Save session, set initial state
- `room:rejoined` — Full state reconstruction (handle EVERY phase)
- `room:player-*` — Player join/leave/disconnect/reconnect
- Game-specific events — Update store fields

### `src/App.tsx`

Phase-based `ScreenRouter` with `AnimatePresence`. Follow the adtaboo pattern.

### `src/components/`

One component per screen/phase. Use the Tailwind preset classes:
- `glass-card` for card surfaces
- `btn-primary` for primary actions
- `font-display` for headings
- Team colors via `text-team-a` / `text-team-b`
- Animations: `animate-slide-up`, `animate-fade-in`, `animate-score-pop`

### `src/constants.ts`

```typescript
export const SESSION_KEY = '<name>_session';
```

## 5. Add Root Scripts

In the root `package.json`, add:
```json
{
  "scripts": {
    "dev:<name>": "concurrently \"pnpm --filter @games/<name>-server dev\" \"pnpm --filter @games/<name>-client dev\""
  }
}
```

## 6. Update Landing Page

Add an entry to `apps/landing/src/gameRegistry.ts`:
```typescript
{
  id: '<name>',
  name: 'Display Name',
  tagline: 'Short description',
  url: 'https://<name>.jerpi.org',
  playerCount: 'X-Y players',
  accentColor: '#hexcolor',
  accentGlow: 'rgba(r, g, b, 0.4)',
  available: true,  // or false if not yet deployed
},
```

## 7. Deploy

Follow `references/deployment-checklist.md` for Dockerfile, docker-compose, tunnel, and CI setup.

## 8. Verify

```bash
pnpm install
pnpm -r build
pnpm run typecheck
pnpm -r test
pnpm run dev:<name>    # Test locally
```
