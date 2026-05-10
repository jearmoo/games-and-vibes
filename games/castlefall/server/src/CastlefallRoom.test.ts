import { describe, it, expect } from 'vitest';
import { CastlefallRoom } from './CastlefallRoom.js';
import { CastlefallPhase, type CastlefallRejoinGame, type TeamId } from '@games/castlefall-shared';

// Mirror of buildGameState in src/index.ts — kept in sync manually.
// TODO: extract buildGameState from index.ts so tests can import it directly.
function buildGameState({ room, playerId }: { room: CastlefallRoom; playerId: string }): CastlefallRejoinGame | null {
  if (room.phase === CastlefallPhase.LOBBY) return null;
  if (room.phase === CastlefallPhase.ROUND) {
    return {
      phase: room.phase,
      public: room.getPublicRoundState(),
      private: room.getPrivateRoundStateFor({ playerId }),
    };
  }
  return {
    phase: room.phase,
    reveal: room.getFullReveal(),
  };
}

function makeRoom({ playerCount }: { playerCount: number }): CastlefallRoom {
  const room = new CastlefallRoom('TEST', 'p1');
  for (let i = 1; i <= playerCount; i++) {
    room.addPlayer(`p${i}`, `Player${i}`, `sock${i}`);
  }
  return room;
}

describe('CastlefallRoom', () => {
  describe('startRound', () => {
    it('picks 18 distinct words from the wordbank', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      expect(room.words).toHaveLength(18);
      expect(new Set(room.words).size).toBe(18);
    });

    it('assigns every player a team', () => {
      const room = makeRoom({ playerCount: 6 });
      room.startRound({ timerSeconds: 0 });
      for (const p of room.players.values()) {
        expect(p.team === 1 || p.team === 2).toBe(true);
      }
    });

    it('team words are always distinct', () => {
      for (let i = 0; i < 50; i++) {
        const playerCount = 2 + (i % 5); // 2..6
        const room = makeRoom({ playerCount });
        room.startRound({ timerSeconds: 0 });
        expect(room.teamWords[1]).not.toBe(room.teamWords[2]);
        expect(room.teamWords[1]).toBeTruthy();
        expect(room.teamWords[2]).toBeTruthy();
      }
    });

    it('balances teams within 1 for 4+ players', () => {
      for (const playerCount of [4, 5, 6]) {
        for (let i = 0; i < 20; i++) {
          const room = makeRoom({ playerCount });
          room.startRound({ timerSeconds: 0 });
          const team1 = Array.from(room.players.values()).filter((p) => p.team === 1).length;
          const team2 = Array.from(room.players.values()).filter((p) => p.team === 2).length;
          expect(team1 + team2).toBe(playerCount);
          expect(Math.abs(team1 - team2)).toBeLessThanOrEqual(1);
        }
      }
    });

    it('guarantees ≥1 player per team for 2-3 players', () => {
      for (const playerCount of [2, 3]) {
        for (let i = 0; i < 50; i++) {
          const room = makeRoom({ playerCount });
          room.startRound({ timerSeconds: 0 });
          const team1 = Array.from(room.players.values()).filter((p) => p.team === 1).length;
          const team2 = Array.from(room.players.values()).filter((p) => p.team === 2).length;
          expect(team1).toBeGreaterThanOrEqual(1);
          expect(team2).toBeGreaterThanOrEqual(1);
          expect(team1 + team2).toBe(playerCount);
        }
      }
    });
  });

  describe('getPrivateRoundStateFor', () => {
    it("returns calling player's team and that team's word", () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      for (const p of room.players.values()) {
        const priv = room.getPrivateRoundStateFor({ playerId: p.id });
        expect(priv).not.toBeNull();
        expect(priv!.team).toBe(p.team);
        expect(priv!.secretWord).toBe(room.teamWords[p.team!]);
      }
    });

    it("never returns the OTHER team's word", () => {
      const room = makeRoom({ playerCount: 6 });
      room.startRound({ timerSeconds: 0 });
      for (const p of room.players.values()) {
        const priv = room.getPrivateRoundStateFor({ playerId: p.id })!;
        const otherTeam: TeamId = priv.team === 1 ? 2 : 1;
        expect(priv.secretWord).toBe(room.teamWords[priv.team]);
        expect(priv.secretWord).not.toBe(room.teamWords[otherTeam]);
      }
    });

    it('returns null when phase is not ROUND', () => {
      const room = makeRoom({ playerCount: 4 });
      expect(room.getPrivateRoundStateFor({ playerId: 'p1' })).toBeNull();
    });
  });

  describe('toDTO', () => {
    it('strips team from all player DTOs during ROUND', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        expect(playerDto.team).toBeUndefined();
      }
      expect(dto.phase).toBe(CastlefallPhase.ROUND);
      expect(dto.round).not.toBeNull();
      expect(dto.round!.words).toHaveLength(18);
    });

    it('includes team for every player DTO during GAME_OVER', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 1 });
      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        const player = room.getPlayer(playerDto.id)!;
        expect(playerDto.team).toBe(player.team);
      }
      expect(dto.reveal).not.toBeNull();
    });
  });

  describe('endRound', () => {
    it('transitions phase to gameOver and stores winningTeam', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 1 });
      expect(room.phase).toBe(CastlefallPhase.GAME_OVER);
      expect(room.winningTeam).toBe(1);
    });

    it('supports draw winningTeam', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 'draw' });
      expect(room.phase).toBe(CastlefallPhase.GAME_OVER);
      expect(room.winningTeam).toBe('draw');
    });
  });

  describe('getFullReveal', () => {
    it('returns both team words and all player teams after endRound', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const expectedTeam1Word = room.teamWords[1];
      const expectedTeam2Word = room.teamWords[2];
      const teamByPlayer = new Map<string, TeamId>();
      for (const p of room.players.values()) teamByPlayer.set(p.id, p.team!);

      room.endRound({ winningTeam: 2 });
      const reveal = room.getFullReveal();

      expect(reveal.team1Word).toBe(expectedTeam1Word);
      expect(reveal.team2Word).toBe(expectedTeam2Word);
      expect(reveal.winningTeam).toBe(2);
      expect(reveal.players).toHaveLength(4);
      for (const entry of reveal.players) {
        expect(entry.team).toBe(teamByPlayer.get(entry.id));
      }
    });
  });

  describe('startNewRound', () => {
    it('resets phase to lobby and clears round state', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 60 });
      room.endRound({ winningTeam: 1 });
      room.startNewRound();
      expect(room.phase).toBe(CastlefallPhase.LOBBY);
      expect(room.teamWords).toEqual({ 1: '', 2: '' });
      expect(room.winningTeam).toBeUndefined();
      expect(room.words).toEqual([]);
      expect(room.timerSeconds).toBe(0);
      expect(room.roundStartedAt).toBeUndefined();
      for (const p of room.players.values()) {
        expect(p.team).toBeUndefined();
      }
    });

    it('drops removed (kicked) players from the roster', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.removePlayer('p2');
      expect(room.players.has('p2')).toBe(true);
      expect(room.getPlayer('p2')!.removed).toBe(true);
      room.endRound({ winningTeam: 1 });
      room.startNewRound();
      expect(room.players.has('p2')).toBe(false);
      expect(room.players.size).toBe(3);
    });
  });

  describe('fromJSON validation', () => {
    it('falls back to LOBBY when persisted phase is not a valid enum value', () => {
      const room = makeRoom({ playerCount: 2 });
      const json = room.toJSON() as Record<string, unknown>;
      json.phase = 'bogus-phase';
      expect(() => CastlefallRoom.fromJSON(json)).not.toThrow();
      const restored = CastlefallRoom.fromJSON(json);
      expect(restored.phase).toBe(CastlefallPhase.LOBBY);
    });
  });

  describe('serialization', () => {
    it('round-trips full state through toJSON/fromJSON', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 90 });
      const teamAssignments = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) teamAssignments.set(p.id, p.team);
      const expectedTeamWords = { ...room.teamWords };
      const expectedRoundStartedAt = room.roundStartedAt;

      const json = room.toJSON();
      const restored = CastlefallRoom.fromJSON(json);

      expect(restored.phase).toBe(CastlefallPhase.ROUND);
      expect(restored.teamWords).toEqual(expectedTeamWords);
      expect(restored.roundStartedAt).toBe(expectedRoundStartedAt);
      expect(restored.timerSeconds).toBe(90);
      expect(restored.winningTeam).toBeUndefined();
      for (const [id, team] of teamAssignments) {
        expect(restored.getPlayer(id)!.team).toBe(team);
      }
    });

    it('round-trips winningTeam after endRound', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 1 });
      const restored = CastlefallRoom.fromJSON(room.toJSON());
      expect(restored.phase).toBe(CastlefallPhase.GAME_OVER);
      expect(restored.winningTeam).toBe(1);
    });
  });

  describe('rejoin payload (server-restart)', () => {
    it('toJSON+fromJSON preserves every player team field', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const expectedTeams = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team);

      const restored = CastlefallRoom.fromJSON(room.toJSON());

      for (const [id, team] of expectedTeams) {
        expect(restored.getPlayer(id)!.team).toBe(team);
      }
    });

    it('getPrivateRoundStateFor after restore returns each player their own team word, never the opposing word', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const expectedTeamWords = { ...room.teamWords };
      const expectedTeams = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team);

      const restored = CastlefallRoom.fromJSON(room.toJSON());

      for (const [id, team] of expectedTeams) {
        const priv = restored.getPrivateRoundStateFor({ playerId: id });
        expect(priv).not.toBeNull();
        expect(priv!.team).toBe(team);
        expect(priv!.secretWord).toBe(expectedTeamWords[team!]);
        const otherTeam: TeamId = priv!.team === 1 ? 2 : 1;
        expect(priv!.secretWord).not.toBe(expectedTeamWords[otherTeam]);
      }
    });

    it('disconnected player can rejoin and still learn their team and secret word', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const target = room.getPlayer('p2')!;
      const expectedTeam = target.team!;
      const expectedWord = room.teamWords[expectedTeam];

      target.connected = false;
      target.disconnectedAt = Date.now();

      const priv = room.getPrivateRoundStateFor({ playerId: 'p2' });
      expect(priv).not.toBeNull();
      expect(priv!.team).toBe(expectedTeam);
      expect(priv!.secretWord).toBe(expectedWord);
    });
  });

  describe('points', () => {
    it('endRound awards +1 to every player on winning team', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      // force deterministic team assignment
      room.getPlayer('p1')!.team = 1;
      room.getPlayer('p2')!.team = 1;
      room.getPlayer('p3')!.team = 2;
      room.getPlayer('p4')!.team = 2;

      room.endRound({ winningTeam: 1 });

      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(0);
      expect(room.getPlayer('p4')!.points).toBe(0);
    });

    it('endRound with draw awards no points', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 'draw' });
      for (const p of room.players.values()) {
        expect(p.points).toBe(0);
      }
    });

    it('points persist across startNewRound', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.getPlayer('p1')!.team = 1;
      room.getPlayer('p2')!.team = 1;
      room.getPlayer('p3')!.team = 2;
      room.getPlayer('p4')!.team = 2;
      room.endRound({ winningTeam: 1 });
      room.startNewRound();

      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(0);
      expect(room.getPlayer('p4')!.points).toBe(0);

      // a second round with new winners should accumulate, not reset
      room.startRound({ timerSeconds: 0 });
      room.getPlayer('p1')!.team = 1;
      room.getPlayer('p2')!.team = 2;
      room.getPlayer('p3')!.team = 2;
      room.getPlayer('p4')!.team = 2;
      room.endRound({ winningTeam: 2 });

      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(2);
      expect(room.getPlayer('p3')!.points).toBe(1);
      expect(room.getPlayer('p4')!.points).toBe(1);
    });

    it('points round-trip through toJSON/fromJSON', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.getPlayer('p1')!.team = 1;
      room.getPlayer('p2')!.team = 1;
      room.getPlayer('p3')!.team = 2;
      room.getPlayer('p4')!.team = 2;
      room.endRound({ winningTeam: 1 });

      const restored = CastlefallRoom.fromJSON(room.toJSON());

      expect(restored.getPlayer('p1')!.points).toBe(1);
      expect(restored.getPlayer('p2')!.points).toBe(1);
      expect(restored.getPlayer('p3')!.points).toBe(0);
      expect(restored.getPlayer('p4')!.points).toBe(0);
    });
  });

  describe('buildGameState', () => {
    it('returns null in LOBBY phase', () => {
      const room = makeRoom({ playerCount: 4 });
      expect(buildGameState({ room, playerId: 'p1' })).toBeNull();
    });

    it('ROUND payload uses keys public and private (regression guard against publicRound/privateRound)', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 60 });
      const payload = buildGameState({ room, playerId: 'p1' });
      expect(payload).not.toBeNull();
      expect(payload!.phase).toBe(CastlefallPhase.ROUND);
      expect(Object.prototype.hasOwnProperty.call(payload, 'public')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'private')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'publicRound')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(payload, 'privateRound')).toBe(false);
      expect(payload!.public).toBeTruthy();
      expect(payload!.public!.words).toHaveLength(18);
      expect(payload!.public!.timerSeconds).toBe(60);
      expect(payload!.public!.roundStartedAt).toBeDefined();
      expect(payload!.private).toBeTruthy();
    });

    it('ROUND payload private gives each player their own team and word', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      for (const p of room.players.values()) {
        const payload = buildGameState({ room, playerId: p.id });
        expect(payload!.private!.team).toBe(p.team);
        expect(payload!.private!.secretWord).toBe(room.teamWords[p.team!]);
        const otherTeam: TeamId = p.team === 1 ? 2 : 1;
        expect(payload!.private!.secretWord).not.toBe(room.teamWords[otherTeam]);
      }
    });

    it('ROUND payload survives toJSON/fromJSON with team and word intact', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 30 });
      const expectedTeams = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team);
      const expectedTeamWords = { ...room.teamWords };

      const restored = CastlefallRoom.fromJSON(room.toJSON());

      for (const [id, team] of expectedTeams) {
        const payload = buildGameState({ room: restored, playerId: id });
        expect(payload).not.toBeNull();
        expect(payload!.phase).toBe(CastlefallPhase.ROUND);
        expect(payload!.public!.words).toHaveLength(18);
        expect(payload!.public!.timerSeconds).toBe(30);
        expect(payload!.private!.team).toBe(team);
        expect(payload!.private!.secretWord).toBe(expectedTeamWords[team!]);
      }
    });

    it('GAME_OVER payload uses key reveal (regression guard)', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      room.endRound({ winningTeam: 1 });
      const payload = buildGameState({ room, playerId: 'p1' });
      expect(payload).not.toBeNull();
      expect(payload!.phase).toBe(CastlefallPhase.GAME_OVER);
      expect(Object.prototype.hasOwnProperty.call(payload, 'reveal')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'public')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(payload, 'private')).toBe(false);
    });

    it('GAME_OVER reveal contains team1Word, team2Word, winningTeam, and players[]', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound({ timerSeconds: 0 });
      const expectedTeam1Word = room.teamWords[1];
      const expectedTeam2Word = room.teamWords[2];
      const expectedTeams = new Map<string, TeamId>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team!);

      room.endRound({ winningTeam: 2 });
      const payload = buildGameState({ room, playerId: 'p1' });

      expect(payload!.reveal).toBeTruthy();
      expect(payload!.reveal!.team1Word).toBe(expectedTeam1Word);
      expect(payload!.reveal!.team2Word).toBe(expectedTeam2Word);
      expect(payload!.reveal!.winningTeam).toBe(2);
      expect(payload!.reveal!.players).toHaveLength(4);
      for (const entry of payload!.reveal!.players) {
        expect(entry.team).toBe(expectedTeams.get(entry.id));
      }
    });
  });
});
