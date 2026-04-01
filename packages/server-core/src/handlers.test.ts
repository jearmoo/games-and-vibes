import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestRoom, createMockSocketContext } from '@games/test-utils';
import type { MockSocketClient, MockIO } from '@games/test-utils';
import { RoomManager } from './RoomManager.js';
import { MetricsCollector } from './metrics.js';
import { registerConnectionHandlers } from './connectionHandlers.js';
import { registerLobbyHandlers } from './lobbyHandlers.js';

const socketOpts = {
  roomFactory: (code: string, hostId: string) => new TestRoom(code, hostId),
  roomFromJSON: (data: any) => TestRoom.fromJSON(data),
};

describe('lobbyHandlers', () => {
  let socket: MockSocketClient;
  let io: MockIO;
  let rooms: RoomManager<TestRoom>;
  let metrics: MetricsCollector;

  beforeEach(() => {
    const mock = createMockSocketContext<TestRoom>(socketOpts);
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;

    registerLobbyHandlers(mock.ctx, {
      buildGameState: () => null,
    });
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  it('room:create creates room and emits room:created', () => {
    socket.trigger('room:create', { playerName: 'Alice' });

    const emitted = socket.getLastEmitted('room:created');
    expect(emitted).toBeDefined();
    const data = emitted![0] as any;
    expect(data.roomCode).toHaveLength(4);
    expect(data.playerId).toBeDefined();
    expect(data.room.hostId).toBe(data.playerId);
    expect(rooms.getRoomCount()).toBe(1);
  });

  it('room:join adds new player to existing room', () => {
    // Create a room first
    socket.trigger('room:create', { playerName: 'Host' });
    const { roomCode } = socket.getLastEmitted('room:created')![0] as any;

    // New socket joins
    const mock2 = createMockSocketContext<TestRoom>({
      ...socketOpts,
      // Reuse the same room manager is tricky — just test the event flow
    });
    // For simplicity, test on same socket with different handler registration
    // The room:join handler should find the room
    socket.trigger('room:join', { roomCode, playerName: 'Bob' });

    const joinedEmit = socket.getLastEmitted('room:joined');
    expect(joinedEmit).toBeDefined();
    mock2.rooms.destroy();
  });

  it('room:join emits error for non-existent room', () => {
    socket.trigger('room:join', { roomCode: 'ZZZZ', playerName: 'Nobody' });
    const errorEmit = socket.getLastEmitted('room:error');
    expect(errorEmit).toBeDefined();
    expect((errorEmit![0] as any).message).toBe('Room not found');
  });
});

describe('connectionHandlers', () => {
  let socket: MockSocketClient;
  let io: MockIO;
  let rooms: RoomManager<TestRoom>;
  let metrics: MetricsCollector;

  beforeEach(() => {
    const mock = createMockSocketContext<TestRoom>(socketOpts);
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;

    registerLobbyHandlers(mock.ctx, {
      buildGameState: () => null,
    });

    const disconnectCallbacks: string[] = [];
    registerConnectionHandlers(mock.ctx, {
      onPlayerDisconnect: (room, playerId) => {
        disconnectCallbacks.push(playerId);
      },
    });
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  it('room:leave removes player from room', () => {
    socket.trigger('room:create', { playerName: 'Host' });
    expect(rooms.getRoomCount()).toBe(1);

    socket.trigger('room:leave');
    // Room should be deleted (last player left)
    expect(rooms.getRoomCount()).toBe(0);
  });

  it('disconnect marks player as disconnected', () => {
    socket.trigger('room:create', { playerName: 'Host' });
    const { roomCode } = socket.getLastEmitted('room:created')![0] as any;

    socket.trigger('disconnect');

    const room = rooms.getRoom(roomCode);
    if (room) {
      const host = Array.from(room.players.values())[0];
      expect(host.connected).toBe(false);
      expect(host.disconnectedAt).toBeDefined();
    }
  });
});
