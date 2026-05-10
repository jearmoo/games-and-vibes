import { describe, it, expect } from 'vitest';
import { CastlefallRoom } from './CastlefallRoom.js';
import { CastlefallPhase, type TeamId } from '@games/castlefall-shared';

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
});
