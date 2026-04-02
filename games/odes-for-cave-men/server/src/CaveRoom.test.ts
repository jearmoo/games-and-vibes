import { describe, it, expect, beforeEach } from 'vitest';
import { CaveRoom } from './CaveRoom';
import { GamePhase } from '@games/odes-for-cave-men-shared';

function createTestRoom(): CaveRoom {
  const room = new CaveRoom('TEST', 'host1');
  room.addPlayer('host1', 'Host', 'sock1');
  room.addPlayer('p2', 'Player2', 'sock2');
  room.addPlayer('p3', 'Player3', 'sock3');
  room.addPlayer('p4', 'Player4', 'sock4');

  room.getPlayer('host1')!.team = 'A';
  room.getPlayer('p2')!.team = 'A';
  room.getPlayer('p3')!.team = 'B';
  room.getPlayer('p4')!.team = 'B';

  return room;
}

describe('CaveRoom', () => {
  let room: CaveRoom;

  beforeEach(() => {
    room = createTestRoom();
  });

  describe('player management', () => {
    it('adds players with null team', () => {
      const p = room.addPlayer('p5', 'Player5', 'sock5');
      expect(p.team).toBeNull();
    });

    it('gets team players (connected, non-removed)', () => {
      expect(room.getTeamPlayers('A')).toHaveLength(2);
      room.getPlayer('p2')!.connected = false;
      expect(room.getTeamPlayers('A')).toHaveLength(1);
    });
  });

  describe('team names', () => {
    it('defaults to Team A and Team B', () => {
      expect(room.teamNames).toEqual({ A: 'Team A', B: 'Team B' });
    });

    it('includes teamNames in toDTO', () => {
      room.teamNames.A = 'Rockers';
      const dto = room.toDTO();
      expect(dto.teamNames).toEqual({ A: 'Rockers', B: 'Team B' });
    });

    it('includes teamNames in toJSON', () => {
      room.teamNames.B = 'Grunters';
      const json = room.toJSON() as any;
      expect(json.teamNames).toEqual({ A: 'Team A', B: 'Grunters' });
    });
  });

  describe('canStart', () => {
    it('succeeds with 2+ per team', () => {
      expect(room.canStart()).toEqual({ ok: true });
    });

    it('fails with < 2 on team A', () => {
      // Remove p2 so team A has only 1 player
      room.removePlayer('p2');
      const result = room.canStart();
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Team A');
    });

    it('fails with < 2 on team B', () => {
      // Remove p4 so team B has only 1 player
      room.removePlayer('p4');
      const result = room.canStart();
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Team B');
    });
  });

  describe('game lifecycle', () => {
    it('starts game in READY phase', () => {
      room.startGame();
      expect(room.game?.phase).toBe(GamePhase.READY);
      expect(room.game?.round).toBe(1);
      expect(room.game?.playingTeam).toBe('A');
    });

    it('isGameActive is true during play', () => {
      room.startGame();
      expect(room.isGameActive()).toBe(true);
    });

    it('isGameActive is false in GAME_OVER', () => {
      room.startGame();
      room.game!.phase = GamePhase.GAME_OVER;
      expect(room.isGameActive()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('round-trips through toJSON/fromJSON', () => {
      room.teamNames = { A: 'Fire', B: 'Water' };
      room.startGame();
      const json = room.toJSON();
      const restored = CaveRoom.fromJSON(json);

      expect(restored.code).toBe('TEST');
      expect(restored.hostId).toBe('host1');
      expect(restored.players.size).toBe(4);
      expect(restored.game?.phase).toBe(GamePhase.READY);
      expect(restored.teamNames).toEqual({ A: 'Fire', B: 'Water' });
    });

    it('restores players as disconnected', () => {
      const json = room.toJSON();
      const restored = CaveRoom.fromJSON(json);

      for (const [, player] of restored.players) {
        expect(player.connected).toBe(false);
        expect(player.socketId).toBe('');
      }
    });

    it('restores team assignments', () => {
      const json = room.toJSON();
      const restored = CaveRoom.fromJSON(json);

      expect(restored.getPlayer('host1')!.team).toBe('A');
      expect(restored.getPlayer('p3')!.team).toBe('B');
    });

    it('defaults teamNames when missing from JSON', () => {
      const json = room.toJSON() as any;
      delete json.teamNames;
      const restored = CaveRoom.fromJSON(json);
      expect(restored.teamNames).toEqual({ A: 'Team A', B: 'Team B' });
    });
  });

  describe('resetToLobby', () => {
    it('clears game state', () => {
      room.startGame();
      room.resetToLobby();
      expect(room.game).toBeNull();
    });

    it('purges soft-removed players', () => {
      room.startGame();
      room.removePlayer('p4');
      expect(room.getPlayer('p4')?.removed).toBe(true);
      room.game!.phase = GamePhase.GAME_OVER;
      room.resetToLobby();
      expect(room.getPlayer('p4')).toBeUndefined();
      expect(room.players.size).toBe(3);
    });
  });
});
