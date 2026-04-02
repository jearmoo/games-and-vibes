import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSocketContext, type MockSocketClient, type MockIO } from '@games/test-utils';
import { type RoomManager, type MetricsCollector } from '@games/server-core';
import { AdtabooRoom } from '../AdtabooRoom.js';
import { registerAdtabooLobbyHandlers } from './lobbyHandlers.js';

const socketOpts = {
  roomFactory: (code: string, hostId: string) => new AdtabooRoom(code, hostId),
  roomFromJSON: (data: any) => AdtabooRoom.fromJSON(data),
};

function setupRoom(rooms: RoomManager<AdtabooRoom>, ctx: any): AdtabooRoom {
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

describe('adtaboo lobby handlers', () => {
  let socket: MockSocketClient;
  let io: MockIO;
  let rooms: RoomManager<AdtabooRoom>;
  let metrics: MetricsCollector;
  let ctx: any;

  beforeEach(() => {
    const mock = createMockSocketContext<AdtabooRoom>(socketOpts);
    socket = mock.socket;
    io = mock.io;
    rooms = mock.rooms;
    metrics = mock.metrics;
    ctx = mock.ctx;
    registerAdtabooLobbyHandlers(mock.ctx);
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

    it('rejects when player not in room', () => {
      setupRoom(rooms, ctx);
      ctx.setPlayerId('unknown');

      socket.trigger('team:join', { team: 'A' });

      // No broadcast means it was rejected
      expect(io.broadcasts.size).toBe(0);
    });
  });

  describe('team:assign', () => {
    it('allows host to assign another player', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team:assign', { team: 'A', targetPlayerId: 'p2' });

      expect(room.getPlayer('p2')!.team).toBe('A');
      expect(io.getRoomEvent(room.code, 'team:updated')).toHaveLength(1);
    });

    it('allows host to unassign another player with null', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'A';

      socket.trigger('team:assign', { team: null, targetPlayerId: 'p2' });

      expect(room.getPlayer('p2')!.team).toBeNull();
    });

    it('rejects non-host', () => {
      const room = setupRoom(rooms, ctx);
      ctx.setPlayerId('p2');

      socket.trigger('team:assign', { team: 'A', targetPlayerId: 'p3' });

      expect(room.getPlayer('p3')!.team).toBeNull();
    });

    it('no-ops when assigning to same team', () => {
      const room = setupRoom(rooms, ctx);
      room.getPlayer('p2')!.team = 'B';

      socket.trigger('team:assign', { team: 'B', targetPlayerId: 'p2' });

      expect(io.getRoomEvent(room.code, 'team:updated')).toHaveLength(0);
    });
  });

  describe('team-names:update', () => {
    it('allows host to update team names', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team-names:update', { teamNames: { A: 'Alphas' } });

      expect(room.teamNames.A).toBe('Alphas');
      expect(io.getRoomEvent(room.code, 'team-names:updated')).toHaveLength(1);
    });

    it('trims and caps at 20 chars', () => {
      const room = setupRoom(rooms, ctx);

      socket.trigger('team-names:update', { teamNames: { B: '  A Very Long Team Name That Exceeds  ' } });

      expect(room.teamNames.B).toBe('A Very Long Team Nam');
    });

    it('resets to default on empty string', () => {
      const room = setupRoom(rooms, ctx);
      room.teamNames.A = 'Custom';

      socket.trigger('team-names:update', { teamNames: { A: '   ' } });

      expect(room.teamNames.A).toBe('Team A');
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
      room.setTabooMaster('A', 'host1');
      room.setTabooMaster('B', 'p3');
      room.startGame();

      socket.trigger('team-names:update', { teamNames: { A: 'During Game' } });

      expect(room.teamNames.A).toBe('Team A');
    });
  });
});
