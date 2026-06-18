import { describe, it, expect } from 'vitest';
import { YipYapRoom } from './YipYapRoom.js';
import { YipYapPhase, type YipYapRejoinGame, type TeamId } from '@games/yip-yap-shared';

// Mirror of buildGameState in src/index.ts — kept in sync manually.
// TODO: extract buildGameState from index.ts so tests can import it directly.
function buildGameState({ room, playerId }: { room: YipYapRoom; playerId: string }): YipYapRejoinGame | null {
  if (room.phase === YipYapPhase.LOBBY) return null;
  if (room.phase === YipYapPhase.ROUND) {
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

function makeRoom({ playerCount }: { playerCount: number }): YipYapRoom {
  const room = new YipYapRoom('TEST', 'p1');
  for (let i = 1; i <= playerCount; i++) {
    room.addPlayer(`p${i}`, `Player${i}`, `sock${i}`);
  }
  return room;
}

/** Force a known team split: p1+p2 → team 1, p3+p4 → team 2. */
function forceTeams(room: YipYapRoom): void {
  room.getPlayer('p1')!.team = 1;
  room.getPlayer('p2')!.team = 1;
  room.getPlayer('p3')!.team = 2;
  room.getPlayer('p4')!.team = 2;
}

describe('YipYapRoom', () => {
  describe('startRound', () => {
    it('picks 18 distinct words from the wordbank', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      expect(room.words).toHaveLength(18);
      expect(new Set(room.words).size).toBe(18);
    });

    it('assigns every player a team', () => {
      const room = makeRoom({ playerCount: 6 });
      room.startRound();
      for (const p of room.players.values()) {
        expect(p.team === 1 || p.team === 2).toBe(true);
      }
    });

    it('team words are always distinct', () => {
      for (let i = 0; i < 50; i++) {
        const playerCount = 2 + (i % 5); // 2..6
        const room = makeRoom({ playerCount });
        room.startRound();
        expect(room.teamWords[1]).not.toBe(room.teamWords[2]);
        expect(room.teamWords[1]).toBeTruthy();
        expect(room.teamWords[2]).toBeTruthy();
      }
    });

    it('balances teams within 1 for 4+ players', () => {
      for (const playerCount of [4, 5, 6]) {
        for (let i = 0; i < 20; i++) {
          const room = makeRoom({ playerCount });
          room.startRound();
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
          room.startRound();
          const team1 = Array.from(room.players.values()).filter((p) => p.team === 1).length;
          const team2 = Array.from(room.players.values()).filter((p) => p.team === 2).length;
          expect(team1).toBeGreaterThanOrEqual(1);
          expect(team2).toBeGreaterThanOrEqual(1);
          expect(team1 + team2).toBe(playerCount);
        }
      }
    });

    it('starts with no responding state and default settings.timerSeconds=60', () => {
      const room = makeRoom({ playerCount: 4 });
      expect(room.settings.timerSeconds).toBe(60);
      room.startRound();
      expect(room.respondingState).toBeUndefined();
    });
  });

  describe('getPrivateRoundStateFor', () => {
    it("returns calling player's team and that team's word", () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      for (const p of room.players.values()) {
        const priv = room.getPrivateRoundStateFor({ playerId: p.id });
        expect(priv).not.toBeNull();
        expect(priv!.team).toBe(p.team);
        expect(priv!.secretWord).toBe(room.teamWords[p.team!]);
      }
    });

    it("never returns the OTHER team's word", () => {
      const room = makeRoom({ playerCount: 6 });
      room.startRound();
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
      room.startRound();
      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        expect(playerDto.team).toBeUndefined();
      }
      expect(dto.phase).toBe(YipYapPhase.ROUND);
      expect(dto.round).not.toBeNull();
      expect(dto.round!.words).toHaveLength(18);
    });

    it('includes team for every player DTO during GAME_OVER', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p1' });
      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        const player = room.getPlayer(playerDto.id)!;
        expect(playerDto.team).toBe(player.team);
      }
      expect(dto.reveal).not.toBeNull();
    });

    it('flags inRound for dealt players during ROUND; late joiners are inRound:false', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      room.addPlayer('late', 'LatePlayer', 'sockLate');

      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        if (playerDto.id === 'late') {
          expect(playerDto.inRound).toBe(false);
        } else {
          expect(playerDto.inRound).toBe(true);
        }
        expect(playerDto.team).toBeUndefined();
      }
    });

    it('omits inRound during LOBBY', () => {
      const room = makeRoom({ playerCount: 4 });
      const dto = room.toDTO();
      for (const playerDto of dto.players) {
        expect(playerDto.inRound).toBeUndefined();
      }
    });
  });

  describe('endRound (wrong clap)', () => {
    it('clapper scores -1, opposing team each +1, phase → GAME_OVER', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);

      room.endRound({ losingPlayerId: 'p3' });

      expect(room.phase).toBe(YipYapPhase.GAME_OVER);
      expect(room.outcome).toBe('wrong-clap');
      expect(room.winningTeam).toBe(1);
      expect(room.clappingPlayerId).toBe('p3');
      expect(room.losingPlayerId).toBe('p3');
      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(-1);
      expect(room.getPlayer('p4')!.points).toBe(0);
    });

    it('clapper on team 1 makes team 2 the winner', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);

      room.endRound({ losingPlayerId: 'p1' });

      expect(room.outcome).toBe('wrong-clap');
      expect(room.winningTeam).toBe(2);
      expect(room.losingPlayerId).toBe('p1');
      expect(room.getPlayer('p1')!.points).toBe(-1);
      expect(room.getPlayer('p3')!.points).toBe(1);
      expect(room.getPlayer('p4')!.points).toBe(1);
    });

    it('ignored when clapper has no team (mid-game joiner)', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      room.addPlayer('late', 'LatePlayer', 'sockLate');
      expect(room.getPlayer('late')!.team).toBeUndefined();

      room.endRound({ losingPlayerId: 'late' });

      expect(room.phase).toBe(YipYapPhase.ROUND);
      expect(room.outcome).toBeUndefined();
      expect(room.winningTeam).toBeUndefined();
      for (const p of room.players.values()) expect(p.points).toBe(0);
    });
  });

  describe('correctClap → resolveGuess', () => {
    it('correctClap opens responding state with timer from settings', () => {
      const room = makeRoom({ playerCount: 4 });
      room.settings.timerSeconds = 90;
      room.startRound();
      forceTeams(room);

      const before = Date.now();
      room.correctClap({ clappingPlayerId: 'p1' });
      const after = Date.now();

      expect(room.phase).toBe(YipYapPhase.ROUND);
      expect(room.respondingState).toBeDefined();
      expect(room.respondingState!.clapperId).toBe('p1');
      expect(room.respondingState!.clapperTeam).toBe(1);
      expect(room.respondingState!.timerSeconds).toBe(90);
      expect(room.respondingState!.startedAt).toBeGreaterThanOrEqual(before);
      expect(room.respondingState!.startedAt).toBeLessThanOrEqual(after);
    });

    it('public round state surfaces responding to all clients', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });

      const pub = room.getPublicRoundState();
      expect(pub).not.toBeNull();
      expect(pub!.responding).toBeDefined();
      expect(pub!.responding!.clapperTeam).toBe(1);
    });

    it('correctClap is ignored when already responding', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });
      const original = room.respondingState!;
      room.correctClap({ clappingPlayerId: 'p3' });
      expect(room.respondingState).toBe(original);
    });

    it('correctClap ignored when clapper has no team', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      room.addPlayer('late', 'LatePlayer', 'sockLate');
      room.correctClap({ clappingPlayerId: 'late' });
      expect(room.respondingState).toBeUndefined();
    });

    it('resolveGuess(true): opposing team +1, clapper team unchanged, phase → GAME_OVER', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);

      room.correctClap({ clappingPlayerId: 'p1' });
      room.resolveGuess({ guessedCorrectly: true });

      expect(room.phase).toBe(YipYapPhase.GAME_OVER);
      expect(room.outcome).toBe('guess-correct');
      expect(room.winningTeam).toBe(2);
      expect(room.clappingPlayerId).toBe('p1');
      expect(room.losingPlayerId).toBeUndefined();
      expect(room.respondingState).toBeUndefined();
      expect(room.getPlayer('p1')!.points).toBe(0);
      expect(room.getPlayer('p2')!.points).toBe(0);
      expect(room.getPlayer('p3')!.points).toBe(1);
      expect(room.getPlayer('p4')!.points).toBe(1);
    });

    it('resolveGuess(false): clapper team +1, phase → GAME_OVER', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);

      room.correctClap({ clappingPlayerId: 'p1' });
      room.resolveGuess({ guessedCorrectly: false });

      expect(room.phase).toBe(YipYapPhase.GAME_OVER);
      expect(room.outcome).toBe('guess-wrong');
      expect(room.winningTeam).toBe(1);
      expect(room.clappingPlayerId).toBe('p1');
      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(0);
      expect(room.getPlayer('p4')!.points).toBe(0);
    });

    it('resolveGuess is a no-op without a responding state', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.resolveGuess({ guessedCorrectly: true });
      expect(room.phase).toBe(YipYapPhase.ROUND);
      expect(room.outcome).toBeUndefined();
    });
  });

  describe('getFullReveal', () => {
    it('wrong-clap reveal contains clappingPlayerId, losingPlayerId, outcome, winningTeam', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p3' });
      const reveal = room.getFullReveal();

      expect(reveal.outcome).toBe('wrong-clap');
      expect(reveal.winningTeam).toBe(1);
      expect(reveal.clappingPlayerId).toBe('p3');
      expect(reveal.losingPlayerId).toBe('p3');
    });

    it('guess-correct reveal: clappingPlayerId set, losingPlayerId absent', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });
      room.resolveGuess({ guessedCorrectly: true });
      const reveal = room.getFullReveal();

      expect(reveal.outcome).toBe('guess-correct');
      expect(reveal.winningTeam).toBe(2);
      expect(reveal.clappingPlayerId).toBe('p1');
      expect(reveal.losingPlayerId).toBeUndefined();
    });

    it('guess-wrong reveal: clappingPlayerId set, losingPlayerId absent', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p3' });
      room.resolveGuess({ guessedCorrectly: false });
      const reveal = room.getFullReveal();

      expect(reveal.outcome).toBe('guess-wrong');
      expect(reveal.winningTeam).toBe(2);
      expect(reveal.clappingPlayerId).toBe('p3');
      expect(reveal.losingPlayerId).toBeUndefined();
    });
  });

  describe('startNewRound', () => {
    it('resets phase to lobby and clears round state', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p1' });
      room.startNewRound();
      expect(room.phase).toBe(YipYapPhase.LOBBY);
      expect(room.teamWords).toEqual({ 1: '', 2: '' });
      expect(room.outcome).toBeUndefined();
      expect(room.winningTeam).toBeUndefined();
      expect(room.clappingPlayerId).toBeUndefined();
      expect(room.losingPlayerId).toBeUndefined();
      expect(room.respondingState).toBeUndefined();
      expect(room.words).toEqual([]);
      for (const p of room.players.values()) {
        expect(p.team).toBeUndefined();
      }
    });

    it('drops removed (kicked) players from the roster', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.removePlayer('p2');
      expect(room.players.has('p2')).toBe(true);
      expect(room.getPlayer('p2')!.removed).toBe(true);
      room.endRound({ losingPlayerId: 'p3' });
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
      expect(() => YipYapRoom.fromJSON(json)).not.toThrow();
      const restored = YipYapRoom.fromJSON(json);
      expect(restored.phase).toBe(YipYapPhase.LOBBY);
    });
  });

  describe('serialization', () => {
    it('round-trips full state through toJSON/fromJSON', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      const teamAssignments = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) teamAssignments.set(p.id, p.team);
      const expectedTeamWords = { ...room.teamWords };

      const json = room.toJSON();
      const restored = YipYapRoom.fromJSON(json);

      expect(restored.phase).toBe(YipYapPhase.ROUND);
      expect(restored.teamWords).toEqual(expectedTeamWords);
      expect(restored.respondingState).toBeUndefined();
      expect(restored.outcome).toBeUndefined();
      expect(restored.winningTeam).toBeUndefined();
      for (const [id, team] of teamAssignments) {
        expect(restored.getPlayer(id)!.team).toBe(team);
      }
    });

    it('round-trips wrong-clap outcome', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p3' });

      const restored = YipYapRoom.fromJSON(room.toJSON());

      expect(restored.phase).toBe(YipYapPhase.GAME_OVER);
      expect(restored.outcome).toBe('wrong-clap');
      expect(restored.winningTeam).toBe(1);
      expect(restored.clappingPlayerId).toBe('p3');
      expect(restored.losingPlayerId).toBe('p3');
      expect(restored.getPlayer('p3')!.points).toBe(-1);
      const reveal = restored.getFullReveal();
      expect(reveal.outcome).toBe('wrong-clap');
      expect(reveal.losingPlayerId).toBe('p3');
    });

    it('round-trips responding state mid-round', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });
      const startedAt = room.respondingState!.startedAt;

      const restored = YipYapRoom.fromJSON(room.toJSON());

      expect(restored.phase).toBe(YipYapPhase.ROUND);
      expect(restored.respondingState).toBeDefined();
      expect(restored.respondingState!.clapperId).toBe('p1');
      expect(restored.respondingState!.clapperTeam).toBe(1);
      expect(restored.respondingState!.startedAt).toBe(startedAt);
    });

    it('round-trips guess-correct outcome', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });
      room.resolveGuess({ guessedCorrectly: true });

      const restored = YipYapRoom.fromJSON(room.toJSON());

      expect(restored.phase).toBe(YipYapPhase.GAME_OVER);
      expect(restored.outcome).toBe('guess-correct');
      expect(restored.winningTeam).toBe(2);
      expect(restored.clappingPlayerId).toBe('p1');
      expect(restored.respondingState).toBeUndefined();
      expect(restored.getPlayer('p3')!.points).toBe(1);
      expect(restored.getPlayer('p4')!.points).toBe(1);
    });
  });

  describe('rejoin payload (server-restart)', () => {
    it('toJSON+fromJSON preserves every player team field', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      const expectedTeams = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team);

      const restored = YipYapRoom.fromJSON(room.toJSON());

      for (const [id, team] of expectedTeams) {
        expect(restored.getPlayer(id)!.team).toBe(team);
      }
    });

    it('getPrivateRoundStateFor after restore returns each player their own team word, never the opposing word', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      const expectedTeamWords = { ...room.teamWords };
      const expectedTeams = new Map<string, TeamId | undefined>();
      for (const p of room.players.values()) expectedTeams.set(p.id, p.team);

      const restored = YipYapRoom.fromJSON(room.toJSON());

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
      room.startRound();
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

  describe('points across rounds', () => {
    it('points accumulate across multiple rounds', () => {
      const room = makeRoom({ playerCount: 4 });

      // round 1: p3 clapped wrong (on team 2) → team 1 +1, p3 -1
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p3' });
      room.startNewRound();
      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(-1);
      expect(room.getPlayer('p4')!.points).toBe(0);

      // round 2: p1 (team 1) clapped right, opposing team guessed it → team 2 +1
      room.startRound();
      forceTeams(room);
      room.correctClap({ clappingPlayerId: 'p1' });
      room.resolveGuess({ guessedCorrectly: true });

      expect(room.getPlayer('p1')!.points).toBe(1);
      expect(room.getPlayer('p2')!.points).toBe(1);
      expect(room.getPlayer('p3')!.points).toBe(0);
      expect(room.getPlayer('p4')!.points).toBe(1);
    });

    it('points round-trip through toJSON/fromJSON', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p3' });

      const restored = YipYapRoom.fromJSON(room.toJSON());

      expect(restored.getPlayer('p1')!.points).toBe(1);
      expect(restored.getPlayer('p2')!.points).toBe(1);
      expect(restored.getPlayer('p3')!.points).toBe(-1);
      expect(restored.getPlayer('p4')!.points).toBe(0);
    });
  });

  describe('mid-game join', () => {
    it('new player joining during ROUND has no team and getPrivateRoundStateFor returns null', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      room.addPlayer('late', 'LatePlayer', 'sockLate');
      const late = room.getPlayer('late')!;
      expect(late.team).toBeUndefined();
      expect(room.getPrivateRoundStateFor({ playerId: 'late' })).toBeNull();
      const payload = buildGameState({ room, playerId: 'late' });
      expect(payload).not.toBeNull();
      expect(payload!.phase).toBe(YipYapPhase.ROUND);
      expect(payload!.public).toBeTruthy();
      expect(payload!.public!.words).toHaveLength(18);
      expect(payload!.private).toBeNull();
    });

    it('new player joining during ROUND gets assigned a team on next startRound', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.addPlayer('late', 'LatePlayer', 'sockLate');
      expect(room.getPlayer('late')!.team).toBeUndefined();

      room.endRound({ losingPlayerId: 'p1' });
      room.startNewRound();
      room.startRound();

      const late = room.getPlayer('late')!;
      expect(late.team === 1 || late.team === 2).toBe(true);
      const priv = room.getPrivateRoundStateFor({ playerId: 'late' });
      expect(priv).not.toBeNull();
      expect(priv!.team).toBe(late.team);
      expect(priv!.secretWord).toBe(room.teamWords[late.team!]);
    });
  });

  describe('buildGameState', () => {
    it('returns null in LOBBY phase', () => {
      const room = makeRoom({ playerCount: 4 });
      expect(buildGameState({ room, playerId: 'p1' })).toBeNull();
    });

    it('ROUND payload uses keys public and private (regression guard against publicRound/privateRound)', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      const payload = buildGameState({ room, playerId: 'p1' });
      expect(payload).not.toBeNull();
      expect(payload!.phase).toBe(YipYapPhase.ROUND);
      expect(Object.prototype.hasOwnProperty.call(payload, 'public')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'private')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'publicRound')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(payload, 'privateRound')).toBe(false);
      expect(payload!.public).toBeTruthy();
      expect(payload!.public!.words).toHaveLength(18);
      expect(payload!.public!.responding).toBeUndefined();
      expect(payload!.private).toBeTruthy();
    });

    it('GAME_OVER payload uses key reveal (regression guard)', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      room.endRound({ losingPlayerId: 'p1' });
      const payload = buildGameState({ room, playerId: 'p1' });
      expect(payload).not.toBeNull();
      expect(payload!.phase).toBe(YipYapPhase.GAME_OVER);
      expect(Object.prototype.hasOwnProperty.call(payload, 'reveal')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(payload, 'public')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(payload, 'private')).toBe(false);
    });

    it('GAME_OVER reveal contains team1Word, team2Word, outcome, winningTeam, and players[]', () => {
      const room = makeRoom({ playerCount: 4 });
      room.startRound();
      forceTeams(room);
      const expectedTeam1Word = room.teamWords[1];
      const expectedTeam2Word = room.teamWords[2];

      room.endRound({ losingPlayerId: 'p3' });
      const payload = buildGameState({ room, playerId: 'p1' });

      expect(payload!.reveal).toBeTruthy();
      expect(payload!.reveal!.team1Word).toBe(expectedTeam1Word);
      expect(payload!.reveal!.team2Word).toBe(expectedTeam2Word);
      expect(payload!.reveal!.outcome).toBe('wrong-clap');
      expect(payload!.reveal!.winningTeam).toBe(1);
      expect(payload!.reveal!.clappingPlayerId).toBe('p3');
      expect(payload!.reveal!.players).toHaveLength(4);
    });
  });
});
