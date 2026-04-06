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

  describe('endTurn', () => {
    it('sets phase to REVIEW and marks cluer as having clued', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      expect(room.game!.phase).toBe(GamePhase.REVIEW);
      expect(room.game!.cluedA).toContain(room.game!.cluerId);
    });

    it('includes timeout word for unresolved current word', () => {
      room.startGame();
      room.startTurn();
      // Don't resolve anything — endTurn should capture current word as timeout
      const wordBefore = room.getCurrentWord();
      expect(wordBefore).not.toBeNull();
      room.endTurn();
      const resolved = room.getResolvedCards();
      expect(resolved).toHaveLength(1);
      expect(resolved[0].result).toBe('timeout');
      expect(resolved[0].points).toBe(0);
    });
  });

  describe('lockInReview', () => {
    it('transitions from Team A to Team B READY', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      const { nextPhase, nextCluerId } = room.lockInReview();
      expect(nextPhase).toBe(GamePhase.READY);
      expect(room.game!.playingTeam).toBe('B');
      expect(nextCluerId).not.toBeNull();
    });

    it('transitions Team B to ROUND_RESULT with unlimited rounds', () => {
      room.startGame();
      // Team A turn
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      // Team B turn
      room.startTurn();
      room.endTurn();
      const { nextPhase } = room.lockInReview();
      expect(nextPhase).toBe(GamePhase.ROUND_RESULT);
    });

    it('transitions Team B to GAME_OVER when at round limit', () => {
      room.settings.rounds = 1;
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      room.startTurn();
      room.endTurn();
      const { nextPhase } = room.lockInReview();
      expect(nextPhase).toBe(GamePhase.GAME_OVER);
    });
  });

  describe('endGame', () => {
    it('sets phase to GAME_OVER', () => {
      room.startGame();
      room.endGame();
      expect(room.game!.phase).toBe(GamePhase.GAME_OVER);
    });
  });

  describe('advanceToNextRound', () => {
    it('increments round and resets state', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      room.startTurn();
      room.endTurn();
      room.lockInReview();

      room.advanceToNextRound();
      expect(room.game!.round).toBe(2);
      expect(room.game!.phase).toBe(GamePhase.READY);
      expect(room.game!.playingTeam).toBe('A');
      expect(room.game!.cluedA).toHaveLength(0);
      expect(room.game!.cluedB).toHaveLength(0);
    });
  });

  describe('round history', () => {
    it('archives Team A data after their review', () => {
      room.startGame();
      room.startTurn();
      room.resolveCurrentWord({ result: 'correct', points: 1 });
      room.endTurn();
      room.lockInReview();

      expect(room.getRoundHistory()).toHaveLength(1);
      const entry = room.getRoundHistory()[0];
      expect(entry.round).toBe(1);
      expect(entry.teams.A).not.toBeNull();
      expect(entry.teams.A!.words.length).toBeGreaterThan(0);
      expect(entry.teams.B).toBeNull();
    });

    it('completes entry with Team B data', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      room.startTurn();
      room.endTurn();
      room.lockInReview();

      const history = room.getRoundHistory();
      expect(history).toHaveLength(1);
      expect(history[0].teams.A).not.toBeNull();
      expect(history[0].teams.B).not.toBeNull();
    });

    it('resets on resetToLobby', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();
      expect(room.getRoundHistory()).toHaveLength(1);

      room.resetToLobby();
      expect(room.getRoundHistory()).toHaveLength(0);
    });

    it('serializes and restores round history', () => {
      room.startGame();
      room.startTurn();
      room.endTurn();
      room.lockInReview();

      const json = room.toJSON();
      const restored = CaveRoom.fromJSON(json);
      expect(restored.getRoundHistory()).toHaveLength(1);
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
