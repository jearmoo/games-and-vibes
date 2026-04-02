# Test Utilities API Reference

**Package**: `@games/test-utils` (`packages/test-utils/src/`)

All exports for unit testing game server logic. Import from `@games/test-utils`.

## TestRoom

**File**: `packages/test-utils/src/TestRoom.ts`

Minimal concrete `BaseRoom` for testing the abstract base class and shared handlers. Not used for game-specific tests — games create their own room instances.

```typescript
import { TestRoom } from '@games/test-utils';

const room = new TestRoom('TEST', 'host1');
room.addPlayer('host1', 'Alice', 'sock1');
```

### Constructor

```typescript
new TestRoom(code: string, hostId: string)
```

### Public Toggles

These control the abstract method return values for testing:

| Property | Type | Default | Controls |
|---|---|---|---|
| `gameActive` | `boolean` | `false` | `isGameActive()` return value |
| `phase` | `string \| null` | `null` | `getPhase()` return value |
| `removedPlayerIds` | `string[]` | `[]` | Tracks calls to `onPlayerRemoved()` |
| `timerCleared` | `boolean` | `false` | Set to `true` when `clearTimer()` is called |

### Static Factory

```typescript
TestRoom.fromJSON(data: any): TestRoom
```

Restores a TestRoom from serialized JSON. Calls `restorePlayers(data)` internally.

## MockStore

**File**: `packages/test-utils/src/MockStore.ts`

In-memory implementation of both `RoomStore` and `MetricsStore` interfaces. No disk I/O.

```typescript
import { MockStore } from '@games/test-utils';

const store = new MockStore();
```

### Properties (read after test to verify calls)

| Property | Type | Description |
|---|---|---|
| `savedData` | `any` | Last data passed to `save()` |
| `metricsData` | `any` | Last data passed to `flush()` / `flushSync()` |
| `saveCalls` | `number` | How many times `save()` was called |
| `flushCalls` | `number` | How many times `flush()` was called |
| `restoreCalls` | `number` | How many times `restore()` was called |

### Setup Hooks (set before calling restore/load)

| Property | Type | Description |
|---|---|---|
| `restoreData` | `any` | Data returned by `restore()` |
| `loadData` | `any` | Data returned by `load()` |

### Usage

```typescript
const store = new MockStore();

// Pre-load data for restore tests
store.restoreData = [room1.toJSON(), room2.toJSON()];
const restored = store.restore();
expect(restored).toHaveLength(2);

// Verify save was called
rooms.save();
expect(store.saveCalls).toBe(1);
expect(store.savedData).toBeDefined();
```

## MockSocketClient

**File**: `packages/test-utils/src/MockSocket.ts`

Simulates a single client socket. Extends `EventEmitter`. Tracks all outbound emissions.

```typescript
// Usually accessed via createMockSocketContext
const { socket } = createMockSocketContext(opts);
```

### Key Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Auto-generated socket ID |
| `emitted` | `EmittedEvent[]` | Array of `{ event, args }` for all emissions |

### Methods

#### `trigger(event: string, ...args: any[])`

Simulate a client sending an event to the server. This fires the listeners registered via `socket.on()` in your handlers.

```typescript
socket.trigger('game:start', { rounds: 3 });
```

#### `getEmitted(event: string): any[][]`

Returns all arg arrays emitted for a given event. Useful for counting emissions.

```typescript
socket.trigger('room:create', { playerName: 'Alice' });
const emissions = socket.getEmitted('room:created');
expect(emissions).toHaveLength(1);
expect(emissions[0][0]).toHaveProperty('roomCode');
```

#### `getLastEmitted(event: string): any[] | undefined`

Returns the args of the most recent emission for an event, or `undefined` if none.

```typescript
const args = socket.getLastEmitted('room:created');
expect(args![0].roomCode).toBeTruthy();
```

#### `join(room: string)` / `leave(room: string)`

Track socket room membership. These are called by server-core's connection handlers.

#### `to(room: string)`

Returns a fake broadcast interface for targeted emissions (used internally by handler code that does `socket.to(room).emit(...)`).

## MockIO

**File**: `packages/test-utils/src/MockSocket.ts`

Mock Socket.IO server namespace. Tracks all broadcasts by room.

```typescript
// Usually accessed via createMockSocketContext
const { io } = createMockSocketContext(opts);
```

### Key Properties

| Property | Type | Description |
|---|---|---|
| `broadcasts` | `Map<string, EmittedEvent[]>` | All events broadcast to each room |

### Methods

#### `to(room: string).emit(event: string, ...args: any[])`

Records a broadcast. This is what your handler code calls when doing `io.to(roomCode).emit(...)`.

#### `getBroadcasts(room: string): EmittedEvent[]`

Returns all events broadcast to a room.

```typescript
const all = io.getBroadcasts('ABCD');
expect(all).toHaveLength(2);
```

#### `getRoomEvent(room: string, event: string): any[][]`

Filter broadcasts to a room by event name. Returns array of arg arrays.

```typescript
const updates = io.getRoomEvent('ABCD', 'room:updated');
expect(updates).toHaveLength(1);
expect(updates[0][0].players).toHaveLength(2);
```

## createMockSocketContext

**File**: `packages/test-utils/src/MockSocket.ts`

Factory function that wires up a complete test environment. This is the primary entry point for handler tests.

### Signature

```typescript
function createMockSocketContext<T extends BaseRoom = BaseRoom>(
  opts?: MockSocketContextOptions<T>
): {
  ctx: SocketContext<T>;
  socket: MockSocketClient;
  io: MockIO;
  rooms: RoomManager<T>;
  store: MockStore;
  metrics: MetricsCollector;
}
```

### Options

```typescript
interface MockSocketContextOptions<T extends BaseRoom = BaseRoom> {
  roomFactory?: (code: string, hostId: string) => T;
  roomFromJSON?: (data: any) => T;
}
```

If omitted, defaults to `TestRoom` factory.

### Return Value

| Field | Type | Description |
|---|---|---|
| `ctx` | `SocketContext<T>` | Full context passed to handler registration functions |
| `socket` | `MockSocketClient` | The simulated client socket |
| `io` | `MockIO` | The simulated Socket.IO server |
| `rooms` | `RoomManager<T>` | Room manager with MockStore backing |
| `store` | `MockStore` | The underlying store (for assertions) |
| `metrics` | `MetricsCollector` | Metrics collector (call `destroy()` in afterEach) |

The `ctx` object includes `getPlayerId()` / `setPlayerId()` wired to a local closure — set the player ID before triggering events that require authentication.

### Complete Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSocketContext } from '@games/test-utils';
import { GameRoom } from './GameRoom.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';

const socketOpts = {
  roomFactory: (code: string, hostId: string) => new GameRoom(code, hostId),
  roomFromJSON: (data: any) => GameRoom.fromJSON(data),
};

describe('game handlers', () => {
  let ctx: any, socket: any, io: any, rooms: any, metrics: any;

  beforeEach(() => {
    const mock = createMockSocketContext<GameRoom>(socketOpts);
    ctx = mock.ctx;
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;
    registerGameHandlers(ctx);
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  it('starts game when host triggers game:start', () => {
    // Setup: create room with enough players
    const room = rooms.createRoom('host1');
    room.addPlayer('host1', 'Alice', socket.id);
    room.addPlayer('p2', 'Bob', 'sock2');
    room.getPlayer('host1')!.team = 'A';
    room.getPlayer('p2')!.team = 'B';
    rooms.trackPlayer('host1', room.code);
    ctx.setPlayerId('host1');

    // Act
    socket.trigger('game:start', {});

    // Assert: room broadcast
    const started = io.getRoomEvent(room.code, 'game:started');
    expect(started).toHaveLength(1);
    expect(room.isGameActive()).toBe(true);
  });

  it('rejects game:start from non-host', () => {
    const room = rooms.createRoom('host1');
    room.addPlayer('host1', 'Alice', 'sock1');
    room.addPlayer('p2', 'Bob', socket.id);
    rooms.trackPlayer('p2', room.code);
    ctx.setPlayerId('p2');

    socket.trigger('game:start', {});

    // Assert: no broadcast, game not started
    expect(io.getRoomEvent(room.code, 'game:started')).toHaveLength(0);
    expect(room.isGameActive()).toBe(false);
  });
});
```

## EmittedEvent Type

```typescript
interface EmittedEvent {
  event: string;
  args: any[];
}
```

Used in `MockSocketClient.emitted` and `MockIO.broadcasts`.
