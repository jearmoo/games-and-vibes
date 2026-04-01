import { EventEmitter } from 'events';
import type { SocketContext } from '@games/server-core';
import { RoomManager } from '@games/server-core';
import { BaseRoom } from '@games/server-core';
import { MockStore } from './MockStore.js';

/** Tracks emitted events for assertions */
export interface EmittedEvent {
  event: string;
  args: unknown[];
}

/** Mock socket that records emitted events and supports .on() for handler registration */
export class MockSocketClient extends EventEmitter {
  id = 'mock-socket-id';
  emitted: EmittedEvent[] = [];
  joinedRooms: Set<string> = new Set();

  override emit(event: string, ...args: unknown[]): boolean {
    if (event === 'newListener' || event === 'removeListener') {
      return super.emit(event, ...args);
    }
    this.emitted.push({ event, args });
    return true;
  }

  join(room: string): void {
    this.joinedRooms.add(room);
  }

  leave(room: string): void {
    this.joinedRooms.delete(room);
  }

  to(room: string): { emit: (event: string, ...args: unknown[]) => void } {
    return {
      emit: (event: string, ...args: unknown[]) => {
        this.emitted.push({ event: `to:${room}:${event}`, args });
      },
    };
  }

  /** Simulate receiving an event from the client */
  trigger(event: string, ...args: unknown[]): void {
    const listeners = this.listeners(event);
    for (const fn of listeners) {
      (fn as (...a: unknown[]) => void)(...args);
    }
  }

  /** Get all emissions of a specific event */
  getEmitted(event: string): unknown[][] {
    return this.emitted.filter((e) => e.event === event).map((e) => e.args);
  }

  /** Get the last emission of a specific event */
  getLastEmitted(event: string): unknown[] | undefined {
    const all = this.getEmitted(event);
    return all[all.length - 1];
  }
}

/** Mock io.to(room).emit() — tracks broadcasts by room */
export class MockIO {
  broadcasts: Map<string, EmittedEvent[]> = new Map();
  engine = { clientsCount: 0 };

  to(room: string): { emit: (event: string, ...args: unknown[]) => void } {
    return {
      emit: (event: string, ...args: unknown[]) => {
        if (!this.broadcasts.has(room)) this.broadcasts.set(room, []);
        this.broadcasts.get(room)!.push({ event, args });
      },
    };
  }

  /** Get all broadcasts to a specific room */
  getBroadcasts(room: string): EmittedEvent[] {
    return this.broadcasts.get(room) ?? [];
  }

  /** Get broadcasts of a specific event to a room */
  getRoomEvent(room: string, event: string): unknown[][] {
    return this.getBroadcasts(room)
      .filter((e) => e.event === event)
      .map((e) => e.args);
  }
}

export interface MockSocketContextOptions<T extends BaseRoom> {
  roomFactory: (code: string, hostId: string) => T;
  roomFromJSON: (data: any) => T;
}

/** Create a full SocketContext<T> with mocks for testing handlers */
export function createMockSocketContext<T extends BaseRoom>(
  opts: MockSocketContextOptions<T>,
): {
  ctx: SocketContext<T>;
  socket: MockSocketClient;
  io: MockIO;
  rooms: RoomManager<T>;
  store: MockStore;
} {
  const store = new MockStore();
  const rooms = new RoomManager<T>({
    store,
    roomFactory: opts.roomFactory,
    roomFromJSON: opts.roomFromJSON,
  });

  const socket = new MockSocketClient();
  const io = new MockIO();

  let playerId: string | null = null;

  const ctx: SocketContext<T> = {
    io: io as any,
    socket: socket as any,
    rooms,
    getPlayerId: () => playerId,
    setPlayerId: (id) => {
      playerId = id;
    },
  };

  return { ctx, socket, io, rooms, store };
}
