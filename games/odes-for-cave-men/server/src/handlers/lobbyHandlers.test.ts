import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSocketContext, type MockSocketClient, type MockIO } from '@games/test-utils';
import { type RoomManager, type MetricsCollector } from '@games/server-core';
import { CaveRoom } from '../CaveRoom.js';
import { registerCaveLobbyHandlers } from './lobbyHandlers.js';

const socketOpts = {
  roomFactory: (code: string, hostId: string) => new CaveRoom(code, hostId),
  roomFromJSON: (data: any) => CaveRoom.fromJSON(data),
};

function setupRoom(rooms: RoomManager<CaveRoom>, ctx: any): CaveRoom {
  const room = rooms.createRoom('host1');
  room.addPlayer('host1', 'Host', 'mock-socket-id');
  room.addPlayer('p2', 'Player2', 'sock2');
  room.addPlayer('p3', 'Player3', 'sock3');
  room.addPlayer('p4', 'Player4', 'sock4');
  rooms.trackPlayer('host1', room.code);
  rooms.trackPlayer('p2', room.code);
  rooms.trackPlayer('p3', room.code);
  rooms.trackPlayer('p4', room.code);
  ctx.setPlayerId('host1');
  return room;
}

describe('cave lobby handlers', () => {
  let socket: MockSocketClient;
  let io: MockIO;
  let rooms: RoomManager<CaveRoom>;
  let metrics: MetricsCollector;
  let ctx: any;

  beforeEach(() => {
    const mock = createMockSocketContext<CaveRoom>(socketOpts);
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;
    ctx = mock.ctx;
    registerCaveLobbyHandlers(mock.ctx);
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  describe('team:join', () => {
    it('allows any player to join a team', () => {
      const room = setupRoom(rooms, ctx);
      ctx.setPlayerId('p2');

      socket.trigger('team:join', { team: 'A' });

      expect(room.getPlayer('p2')!.team).toBe('A');
      expect(io.getRoomEvent(room.code, 'team:updated')).toHaveLength(1);
    });

    it('allows any player to switch teams', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'A';
      ctx.setPlayerId('p2');

      socket.trigger('team:join', { team: 'B' });

      expect(room.getPlayer('p2')!.team).toBe('B');
    });

    it('allows any player to unassign with null', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'A';
      ctx.setPlayerId('p2');

      socket.trigger('team:join', { team: null });

      expect(room.getPlayer('p2')!.team).toBeNull();
    });

    it('no-ops when joining same team', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'A';
      ctx.setPlayerId('p2');

      socket.trigger('team:join', { team: 'A' });

      expect(io.getRoomEvent(room.code, 'team:updated')).toHaveLength(0);
    });

    it('rejects during active game', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('host1')!.team = 'A';
      room.getPlayer('p2')!.team = 'A';
      room.getPlayer('p3')!.team = 'B';
      room.getPlayer('p4')!.team = 'B';
      room.startGame();
      ctx.setPlayerId('p2');

      socket.trigger('team:join', { team: 'B' });

      expect(room.getPlayer('p2')!.team).toBe('A');
    });
  });

  describe('team:assign', () => {
    it('allows host to assign another player', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team:assign', { team: 'A', targetPlayerId: 'p2' });

      expect(room.getPlayer('p2')!.team).toBe('A');
    });

    it('allows host to unassign with null', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'B';

      socket.trigger('team:assign', { team: null, targetPlayerId: 'p2' });

      expect(room.getPlayer('p2')!.team).toBeNull();
    });

    it('rejects non-host', () => {
      const room = setupRoom(rooms, ctx);
      ctx.setPlayerId('p2');

      socket.trigger('team:assign', { team: 'A', targetPlayerId: 'p3' });

      expect(room.getPlayer('p3')!.team).toBeNull();
    });

    it('rejects during active game', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('host1')!.team = 'A';
      room.getPlayer('p2')!.team = 'A';
      room.getPlayer('p3')!.team = 'B';
      room.getPlayer('p4')!.team = 'B';
      room.startGame();

      socket.trigger('team:assign', { team: 'B', targetPlayerId: 'p2' });

      expect(room.getPlayer('p2')!.team).toBe('A');
    });
  });

  describe('team-names:update', () => {
    it('allows host to update team names', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team-names:update', { teamNames: { A: 'Rocks' } });

      expect(room.teamNames.A).toBe('Rocks');
      expect(io.getRoomEvent(room.code, 'team-names:updated')).toHaveLength(1);
    });

    it('trims and caps at 20 chars', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team-names:update', { teamNames: { B: '  A Super Duper Long Name Here  ' } });

      expect(room.teamNames.B).toBe('A Super Duper Long N');
    });

    it('resets to default on empty string', () => {
      const room = setupRoom(rooms, ctx);
      room.teamNames.B = 'Custom';

      socket.trigger('team-names:update', { teamNames: { B: '' } });

      expect(room.teamNames.B).toBe('Team B');
    });

    it('rejects non-host', () => {
      const room = setupRoom(rooms, ctx);
      ctx.setPlayerId('p2');

      socket.trigger('team-names:update', { teamNames: { A: 'Hacked' } });

      expect(room.teamNames.A).toBe('Team A');
    });

    it('rejects during active game', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('host1')!.team = 'A';
      room.getPlayer('p2')!.team = 'A';
      room.getPlayer('p3')!.team = 'B';
      room.getPlayer('p4')!.team = 'B';
      room.startGame();

      socket.trigger('team-names:update', { teamNames: { A: 'During Game' } });

      expect(room.teamNames.A).toBe('Team A');
    });
  });
});
