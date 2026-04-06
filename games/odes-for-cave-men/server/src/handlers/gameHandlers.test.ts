import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSocketContext, type MockSocketClient, type MockIO } from '@games/test-utils';
import { type RoomManager, type MetricsCollector } from '@games/server-core';
import { CaveRoom } from '../CaveRoom.js';
import { registerGameHandlers } from './gameHandlers.js';
import { GamePhase } from '@games/odes-for-cave-men-shared';

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
  room.getPlayer('host1')!.team = 'A';
  room.getPlayer('p2')!.team = 'A';
  room.getPlayer('p3')!.team = 'B';
  room.getPlayer('p4')!.team = 'B';
  rooms.trackPlayer('host1', room.code);
  rooms.trackPlayer('p2', room.code);
  rooms.trackPlayer('p3', room.code);
  rooms.trackPlayer('p4', room.code);
  ctx.setPlayerId('host1');
  return room;
}

describe('cave game handlers', () => {
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
    registerGameHandlers(mock.ctx);
  });

  afterEach(() => {
    rooms.destroy();
    metrics.destroy();
  });

  describe('turn:pick-cluer', () => {
    it('changes cluer during READY phase', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame(); // phase = READY, playingTeam = A, cluerId = auto-picked
      const originalCluer = room.game!.cluerId;

      // Pick a different cluer on team A
      const newCluer = originalCluer === 'host1' ? 'p2' : 'host1';
      socket.trigger('turn:pick-cluer', { cluerId: newCluer });

      expect(room.game!.cluerId).toBe(newCluer);
      const event = io.getRoomEvent(room.code, 'turn:cluer-changed');
      expect(event).toHaveLength(1);
      expect(event[0][0].cluerId).toBe(newCluer);
    });

    it('rejects player not on playing team', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame(); // playing team A

      socket.trigger('turn:pick-cluer', { cluerId: 'p3' }); // p3 is on team B
      expect(room.game!.cluerId).not.toBe('p3');
    });

    it('rejects when not in READY phase', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame();
      room.startTurn(); // phase = PLAYING

      const cluerBefore = room.game!.cluerId;
      socket.trigger('turn:pick-cluer', { cluerId: 'p2' });
      expect(room.game!.cluerId).toBe(cluerBefore);
    });
  });

  describe('game:end', () => {
    it('host ends game during ROUND_RESULT', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      room.startTurn();
      room.endTurn();
      room.lockInReview(); // -> ROUND_RESULT

      socket.trigger('game:end');
      expect(room.game!.phase).toBe(GamePhase.GAME_OVER);
      const event = io.getRoomEvent(room.code, 'round:ended');
      expect(event).toHaveLength(1);
      expect(event[0][0].phase).toBe(GamePhase.GAME_OVER);
    });

    it('non-host cannot end game', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      room.startTurn();
      room.endTurn();
      room.lockInReview();

      ctx.setPlayerId('p2'); // not host
      socket.trigger('game:end');
      expect(room.game!.phase).toBe(GamePhase.ROUND_RESULT);
    });

    it('rejects when not in ROUND_RESULT phase', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame(); // phase = READY

      socket.trigger('game:end');
      expect(room.game!.phase).toBe(GamePhase.READY);
    });
  });

  describe('clue:end-turn', () => {
    it('cluer can end turn early during PLAYING', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame();
      room.startTurn();
      room.beginTimer(() => {});
      const cluerId = room.game!.cluerId!;
      ctx.setPlayerId(cluerId);

      socket.trigger('clue:end-turn');
      expect(room.game!.phase).toBe(GamePhase.REVIEW);
    });

    it('non-cluer cannot end turn', () => {
      const room = setupRoom(rooms, ctx);
      room.startGame();
      room.startTurn();
      room.beginTimer(() => {});
      // ctx is still host1, who may or may not be cluer
      const nonCluer = room.game!.cluerId === 'host1' ? 'p2' : 'host1';
      ctx.setPlayerId(nonCluer);

      socket.trigger('clue:end-turn');
      expect(room.game!.phase).toBe(GamePhase.PLAYING);
    });
  });
});
