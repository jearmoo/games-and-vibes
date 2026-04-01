import { describe, it, expect, beforeEach } from 'vitest';
import { AdtabooRoom } from './AdtabooRoom';
import { GamePhase } from '@games/adtaboo-shared';

function createTestRoom(): AdtabooRoom {
  const room = new AdtabooRoom('TEST', 'host1');
  room.addPlayer('host1', 'Host', 'sock1');
  room.addPlayer('p2', 'Player2', 'sock2');
  room.addPlayer('p3', 'Player3', 'sock3');
  room.addPlayer('p4', 'Player4', 'sock4');

  room.getPlayer('host1')!.team = 'A';
  room.getPlayer('p2')!.team = 'A';
  room.getPlayer('p3')!.team = 'B';
  room.getPlayer('p4')!.team = 'B';

  room.setTabooMaster('A', 'host1');
  room.setTabooMaster('B', 'p3');

  return room;
}

describe('AdtabooRoom', () => {
  let room: AdtabooRoom;

  beforeEach(() => {
    room = createTestRoom();
  });

  describe('player management', () => {
    it('adds and retrieves players', () => {
      expect(room.players.size).toBe(4);
      expect(room.getPlayer('host1')?.name).toBe('Host');
    });

    it('removes players and clears TM', () => {
      room.removePlayer('host1');
      expect(room.players.size).toBe(3);
      expect(room.tabooMasters.A).toBeNull();
    });

    it('finds player by name', () => {
      expect(room.getPlayerByName('Player2')?.id).toBe('p2');
    });

    it('gets team players (connected only)', () => {
      const teamA = room.getTeamPlayers('A');
      expect(teamA).toHaveLength(2);
      room.getPlayer('p2')!.connected = false;
      expect(room.getTeamPlayers('A')).toHaveLength(1);
    });
  });

  describe('taboo master', () => {
    it('sets taboo master', () => {
      expect(room.setTabooMaster('A', 'p2')).toBe(true);
      expect(room.tabooMasters.A).toBe('p2');
    });

    it('rejects wrong team', () => {
      expect(room.setTabooMaster('A', 'p3')).toBe(false);
    });

    it('ensures taboo master on disconnect', () => {
      room.getPlayer('host1')!.connected = false;
      const newTM = room.ensureTabooMaster('A');
      expect(newTM).toBe('p2');
      expect(room.tabooMasters.A).toBe('p2');
    });
  });

  describe('canStart', () => {
    it('succeeds with valid setup', () => {
      expect(room.canStart()).toEqual({ ok: true });
    });

    it('fails without enough players', () => {
      room.getPlayer('p2')!.connected = false;
      const result = room.canStart();
      expect(result.ok).toBe(false);
    });
  });

  describe('game flow', () => {
    beforeEach(() => {
      room.startGame();
    });

    it('starts in PARALLEL_SETUP', () => {
      expect(room.game?.phase).toBe(GamePhase.PARALLEL_SETUP);
      expect(room.game?.round).toBe(1);
    });

    it('sets clue giver', () => {
      expect(room.setClueGiver('A', 'p2')).toBe(true);
      expect(room.game?.challenges.A.clueGiverId).toBe('p2');
    });

    it('rejects clue giver from wrong team', () => {
      expect(room.setClueGiver('A', 'p3')).toBe(false);
    });

    it('suggests and removes taboo words', () => {
      room.suggestTabooWord('A', 'forbidden');
      expect(room.game?.challenges.A.tabooSuggestions).toContain('forbidden');

      room.removeTabooWord('A', 'forbidden');
      expect(room.game?.challenges.A.tabooSuggestions).not.toContain('forbidden');
    });

    it('normalizes taboo words', () => {
      room.suggestTabooWord('A', '  HELLO  ');
      expect(room.game?.challenges.A.tabooSuggestions).toContain('hello');
    });

    it('rejects duplicate taboo words', () => {
      room.suggestTabooWord('A', 'word');
      room.suggestTabooWord('A', 'word');
      expect(room.game?.challenges.A.tabooSuggestions).toHaveLength(1);
    });

    it('confirms and unconfirms challenges', () => {
      room.suggestTabooWord('A', 'forbidden');
      expect(room.confirmChallenge('A')).toBe(true);
      expect(room.game?.challenges.A.ready).toBe(true);

      expect(room.unconfirmChallenge('A')).toBe(true);
      expect(room.game?.challenges.A.ready).toBe(false);
    });

    it('cannot unconfirm when both ready', () => {
      room.suggestTabooWord('A', 'word1');
      room.suggestTabooWord('B', 'word2');
      room.confirmChallenge('A');
      room.confirmChallenge('B');
      expect(room.unconfirmChallenge('A')).toBe(false);
    });
  });

  describe('cluing phase', () => {
    beforeEach(() => {
      room.startGame();
      room.game!.challenges.A.cards = [
        { word: 'cat', result: null },
        { word: 'dog', result: null },
      ];
      room.game!.challenges.A.tabooWords = ['meow'];
      room.game!.challenges.A.tabooBuzzes = {};
      room.setClueGiver('A', 'p2');
      room.prepareCluingPhase('A');
    });

    it('sets CLUING_A phase', () => {
      expect(room.game?.phase).toBe(GamePhase.CLUING_A);
      expect(room.getCluingTeam()).toBe('A');
    });

    it('resolves cards and updates score', () => {
      expect(room.resolveCard(0)).toBe(true);
      expect(room.game?.challenges.A.cards[0].result).toBe('correct');
      expect(room.game?.scores.A).toBe(3);
    });

    it('rejects invalid card index', () => {
      expect(room.resolveCard(-1)).toBe(false);
      expect(room.resolveCard(99)).toBe(false);
    });

    it('undoes card resolution', () => {
      room.resolveCard(0);
      expect(room.undoCard(0)).toBe(true);
      expect(room.game?.challenges.A.cards[0].result).toBeNull();
      expect(room.game?.scores.A).toBe(0);
    });

    it('buzzes taboo words', () => {
      const count = room.buzzTabooWord('meow');
      expect(count).toBe(1);
      expect(room.game?.scores.A).toBe(-1);
    });

    it('undoes taboo buzzes', () => {
      room.buzzTabooWord('meow');
      room.undoBuzzTabooWord('meow');
      expect(room.game?.scores.A).toBe(0);
    });

    it('rejects buzz on non-taboo word', () => {
      expect(room.buzzTabooWord('notataboo')).toBe(0);
    });

    it('detects all cards resolved', () => {
      expect(room.allCardsResolved()).toBe(false);
      room.resolveCard(0);
      room.resolveCard(1);
      expect(room.allCardsResolved()).toBe(true);
    });

    it('ends cluing and transitions', () => {
      room.resolveCard(0);
      const result = room.endCluing();
      expect(result.nextPhase).toBe(GamePhase.CLUING_B);
      expect(result.turnScore.correct).toBe(1);
      expect(result.turnScore.missed).toBe(1);
    });
  });

  describe('round lifecycle', () => {
    it('archives rounds and transitions to ROUND_RESULT', () => {
      room.startGame();
      room.game!.challenges.A.cards = [{ word: 'cat', result: null }];
      room.game!.challenges.A.tabooWords = ['meow'];
      room.game!.challenges.A.tabooBuzzes = {};
      room.game!.challenges.B.cards = [{ word: 'dog', result: null }];
      room.game!.challenges.B.tabooWords = ['bark'];
      room.game!.challenges.B.tabooBuzzes = {};
      room.setClueGiver('A', 'p2');
      room.setClueGiver('B', 'p4');

      room.prepareCluingPhase('A');
      room.resolveCard(0);
      room.endCluing();

      room.resolveCard(0);
      const result = room.endCluing();

      expect(result.nextPhase).toBe(GamePhase.ROUND_RESULT);
      expect(room.roundHistory).toHaveLength(1);
      expect(room.roundHistory[0].round).toBe(1);
    });

    it('advances to next round', () => {
      room.startGame();
      room.game!.challenges.A.cards = [{ word: 'cat', result: null }];
      room.game!.challenges.A.tabooWords = [];
      room.game!.challenges.A.tabooBuzzes = {};
      room.game!.challenges.B.cards = [{ word: 'dog', result: null }];
      room.game!.challenges.B.tabooWords = [];
      room.game!.challenges.B.tabooBuzzes = {};
      room.setClueGiver('A', 'p2');
      room.setClueGiver('B', 'p4');

      room.prepareCluingPhase('A');
      room.endCluing();
      room.endCluing();

      room.advanceToNextRound();
      expect(room.game?.round).toBe(2);
      expect(room.game?.phase).toBe(GamePhase.PARALLEL_SETUP);
    });
  });

  describe('serialization', () => {
    it('round-trips through toJSON/fromJSON', () => {
      room.startGame();
      const json = room.toJSON();
      const restored = AdtabooRoom.fromJSON(json);

      expect(restored.code).toBe('TEST');
      expect(restored.hostId).toBe('host1');
      expect(restored.players.size).toBe(4);
      expect(restored.game?.phase).toBe(GamePhase.PARALLEL_SETUP);
      expect(restored.tabooMasters).toEqual({ A: 'host1', B: 'p3' });
    });

    it('restores players as disconnected', () => {
      const json = room.toJSON();
      const restored = AdtabooRoom.fromJSON(json);

      for (const [, player] of restored.players) {
        expect(player.connected).toBe(false);
        expect(player.socketId).toBe('');
      }
    });
  });

  describe('resetToLobby', () => {
    it('clears game state', () => {
      room.startGame();
      room.resetToLobby();
      expect(room.game).toBeNull();
      expect(room.roundHistory).toHaveLength(0);
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

  describe('soft-remove during active game', () => {
    it('soft-removes player during active game', () => {
      room.startGame();
      room.removePlayer('p4');
      expect(room.players.size).toBe(4);
      expect(room.getPlayer('p4')?.removed).toBe(true);
      expect(room.getPlayer('p4')?.connected).toBe(false);
    });

    it('hard-deletes player when no game is active', () => {
      room.removePlayer('p4');
      expect(room.players.size).toBe(3);
      expect(room.getPlayer('p4')).toBeUndefined();
    });

    it('hard-deletes player in LOBBY phase', () => {
      room.startGame();
      room.game!.phase = GamePhase.LOBBY;
      room.removePlayer('p4');
      expect(room.getPlayer('p4')).toBeUndefined();
    });

    it('hard-deletes player in GAME_OVER phase', () => {
      room.startGame();
      room.game!.phase = GamePhase.GAME_OVER;
      room.removePlayer('p4');
      expect(room.getPlayer('p4')).toBeUndefined();
    });

    it('getPlayerByName finds soft-removed players', () => {
      room.startGame();
      room.removePlayer('p4');
      expect(room.getPlayerByName('Player4')?.removed).toBe(true);
    });

    it('getTeamPlayers excludes soft-removed players', () => {
      room.startGame();
      expect(room.getTeamPlayers('B')).toHaveLength(2);
      room.removePlayer('p4');
      expect(room.getTeamPlayers('B')).toHaveLength(1);
    });

    it('getActivePlayers excludes soft-removed players', () => {
      room.startGame();
      expect(room.getActivePlayers()).toHaveLength(4);
      room.removePlayer('p4');
      expect(room.getActivePlayers()).toHaveLength(3);
    });

    it('clears taboo master on soft-remove', () => {
      room.startGame();
      room.removePlayer('p3');
      expect(room.tabooMasters.B).toBeNull();
    });

    it('serializes and restores removed flag', () => {
      room.startGame();
      room.removePlayer('p4');
      const json = room.toJSON();
      const restored = AdtabooRoom.fromJSON(json);
      expect(restored.getPlayer('p4')?.removed).toBe(true);
      expect(restored.getPlayerByName('Player4')?.removed).toBe(true);
    });
  });
});
