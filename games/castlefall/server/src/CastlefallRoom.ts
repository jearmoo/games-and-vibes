import { BaseRoom, logger } from '@games/server-core';
import {
  CastlefallPhase,
  type CastlefallPlayer,
  type CastlefallPlayerDTO,
  type CastlefallRoomDTO,
  type CastlefallSettings,
  type FullReveal,
  type PrivateRoundState,
  type PublicRoundState,
  type RespondingState,
  type RoundOutcome,
  type TeamId,
  type WinningTeam,
} from '@games/castlefall-shared';
import { pickTeamWords, pickWords } from './wordbank.js';

interface PersistedCastlefallRoom {
  code: string;
  hostId: string;
  lastActivity?: number;
  settings?: Partial<CastlefallSettings>;
  players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean; points?: number }>;
  phase?: string;
  words?: string[];
  teamWords?: { 1: string; 2: string };
  respondingState?: RespondingState;
  outcome?: RoundOutcome;
  winningTeam?: WinningTeam;
  clappingPlayerId?: string;
  losingPlayerId?: string;
  roundsPlayed?: number;
}

const WORDS_PER_ROUND = 18;
const DEFAULT_TIMER_SECONDS = 60;

export class CastlefallRoom extends BaseRoom<CastlefallPlayer> {
  declare settings: CastlefallSettings;
  phase: CastlefallPhase = CastlefallPhase.LOBBY;
  words: string[] = [];
  teamWords: { 1: string; 2: string } = { 1: '', 2: '' };
  respondingState?: RespondingState;
  outcome?: RoundOutcome;
  winningTeam?: WinningTeam;
  clappingPlayerId?: string;
  losingPlayerId?: string;
  roundsPlayed: number = 0;

  constructor(code: string, hostId: string) {
    super(code, hostId, { timerSeconds: DEFAULT_TIMER_SECONDS });
  }

  override addPlayer(id: string, name: string, socketId: string): CastlefallPlayer {
    const player: CastlefallPlayer = { id, name, socketId, connected: true, points: 0 };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  override playerDTOs(): CastlefallPlayerDTO[] {
    const includeTeam = this.phase === CastlefallPhase.GAME_OVER;
    const includeInRound = this.phase === CastlefallPhase.ROUND || this.phase === CastlefallPhase.GAME_OVER;
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      points: p.points,
      ...(includeTeam && p.team ? { team: p.team } : {}),
      ...(includeInRound ? { inRound: !!p.team } : {}),
    }));
  }

  override toDTO(): CastlefallRoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      phase: this.phase,
      round: this.getPublicRoundState(),
      reveal: this.phase === CastlefallPhase.GAME_OVER ? this.getFullReveal() : null,
      roundsPlayed: this.roundsPlayed,
    };
  }

  override toJSON(): object {
    return {
      code: this.code,
      hostId: this.hostId,
      lastActivity: this.lastActivity,
      settings: this.settings,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        connected: p.connected,
        disconnectedAt: p.disconnectedAt,
        removed: p.removed,
        points: p.points,
      })),
      ...this.serializeGameState(),
    };
  }

  override restorePlayers(data: {
    players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean; points?: number }>;
  }) {
    for (const p of data.players ?? []) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        team: p.team,
        socketId: '',
        connected: false,
        disconnectedAt: Date.now(),
        removed: p.removed ?? false,
        points: typeof p.points === 'number' && Number.isFinite(p.points) ? p.points : 0,
      });
    }
  }

  protected onPlayerRemoved(_playerId: string): void {
    // No special cleanup needed
  }

  isGameActive(): boolean {
    return this.phase === CastlefallPhase.ROUND;
  }

  getPhase(): string {
    return this.phase;
  }

  serializeGameState(): object {
    return {
      phase: this.phase,
      words: this.words,
      teamWords: this.teamWords,
      respondingState: this.respondingState,
      outcome: this.outcome,
      winningTeam: this.winningTeam,
      clappingPlayerId: this.clappingPlayerId,
      losingPlayerId: this.losingPlayerId,
      roundsPlayed: this.roundsPlayed,
    };
  }

  private clearRoundState(): void {
    this.words = [];
    this.teamWords = { 1: '', 2: '' };
    this.respondingState = undefined;
    this.outcome = undefined;
    this.winningTeam = undefined;
    this.clappingPlayerId = undefined;
    this.losingPlayerId = undefined;
    for (const p of this.players.values()) {
      p.team = undefined;
    }
  }

  resetToLobby(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.phase = CastlefallPhase.LOBBY;
    this.clearRoundState();
    this.touch();
  }

  startRound(): void {
    this.words = pickWords({ count: WORDS_PER_ROUND });
    this.teamWords = pickTeamWords({ words: this.words });
    this.assignTeams();
    this.respondingState = undefined;
    this.outcome = undefined;
    this.winningTeam = undefined;
    this.clappingPlayerId = undefined;
    this.losingPlayerId = undefined;
    this.phase = CastlefallPhase.ROUND;
    this.roundsPlayed += 1;
    this.touch();
  }

  /** Wrong-clap path: clapper takes -1, opposing team each +1, round ends. */
  endRound({ losingPlayerId }: { losingPlayerId: string }): void {
    const loser = this.players.get(losingPlayerId);
    if (!loser?.team) {
      logger.warn('game', 'endRound: loser has no team, ignoring', { player: losingPlayerId });
      return;
    }
    const winningTeam: TeamId = loser.team === 1 ? 2 : 1;
    this.outcome = 'wrong-clap';
    this.winningTeam = winningTeam;
    this.clappingPlayerId = loser.id;
    this.losingPlayerId = loser.id;
    this.respondingState = undefined;
    loser.points -= 1;
    for (const p of this.players.values()) {
      if (p.team === winningTeam) p.points += 1;
    }
    this.phase = CastlefallPhase.GAME_OVER;
    this.touch();
  }

  /** Correct-clap path: start the response window for the opposing team. */
  correctClap({ clappingPlayerId }: { clappingPlayerId: string }): void {
    if (this.phase !== CastlefallPhase.ROUND) {
      logger.warn('game', 'correctClap rejected: wrong phase', { phase: this.phase });
      return;
    }
    if (this.respondingState) {
      logger.warn('game', 'correctClap rejected: already responding', { room: this.code });
      return;
    }
    const clapper = this.players.get(clappingPlayerId);
    if (!clapper?.team) {
      logger.warn('game', 'correctClap: clapper has no team, ignoring', { player: clappingPlayerId });
      return;
    }
    this.respondingState = {
      clapperId: clapper.id,
      clapperTeam: clapper.team,
      startedAt: Date.now(),
      timerSeconds: this.settings.timerSeconds,
    };
    this.touch();
  }

  /** Resolve the opposing team's response attempt. Ends the round. */
  resolveGuess({ guessedCorrectly }: { guessedCorrectly: boolean }): void {
    const responding = this.respondingState;
    if (!responding) {
      logger.warn('game', 'resolveGuess rejected: not in responding state', { room: this.code });
      return;
    }
    const clapperTeam = responding.clapperTeam;
    const opposingTeam: TeamId = clapperTeam === 1 ? 2 : 1;
    if (guessedCorrectly) {
      this.outcome = 'guess-correct';
      this.winningTeam = opposingTeam;
      for (const p of this.players.values()) {
        if (p.team === opposingTeam) p.points += 1;
      }
    } else {
      this.outcome = 'guess-wrong';
      this.winningTeam = clapperTeam;
      for (const p of this.players.values()) {
        if (p.team === clapperTeam) p.points += 1;
      }
    }
    this.clappingPlayerId = responding.clapperId;
    this.respondingState = undefined;
    this.phase = CastlefallPhase.GAME_OVER;
    this.touch();
  }

  startNewRound(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.phase = CastlefallPhase.LOBBY;
    this.clearRoundState();
    this.touch();
  }

  private assignTeams(): void {
    const active = this.getActivePlayers();
    for (const p of active) p.team = undefined;

    if (active.length === 0) return;
    if (active.length === 1) {
      active[0].team = 1;
      return;
    }

    const shuffled = [...active];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    if (active.length >= 4) {
      const half = Math.ceil(shuffled.length / 2);
      shuffled.slice(0, half).forEach((p) => (p.team = 1));
      shuffled.slice(half).forEach((p) => (p.team = 2));
      return;
    }

    // 2 or 3 players: random per player, but guarantee at least one on each team
    for (const p of shuffled) {
      p.team = Math.random() < 0.5 ? 1 : 2;
    }
    const team1 = shuffled.filter((p) => p.team === 1);
    const team2 = shuffled.filter((p) => p.team === 2);
    if (team1.length === 0) shuffled[0].team = 1;
    else if (team2.length === 0) shuffled[0].team = 2;
  }

  getPublicRoundState(): PublicRoundState | null {
    if (this.phase !== CastlefallPhase.ROUND) return null;
    return {
      phase: this.phase,
      words: [...this.words],
      ...(this.respondingState ? { responding: { ...this.respondingState } } : {}),
    };
  }

  getPrivateRoundStateFor({ playerId }: { playerId: string }): PrivateRoundState | null {
    if (this.phase !== CastlefallPhase.ROUND) return null;
    const player = this.players.get(playerId);
    if (!player?.team) return null;
    return {
      team: player.team,
      secretWord: this.teamWords[player.team],
    };
  }

  getFullReveal(): FullReveal {
    return {
      outcome: this.outcome ?? 'wrong-clap',
      winningTeam: this.winningTeam ?? 'draw',
      clappingPlayerId: this.clappingPlayerId ?? '',
      ...(this.losingPlayerId ? { losingPlayerId: this.losingPlayerId } : {}),
      team1Word: this.teamWords[1],
      team2Word: this.teamWords[2],
      players: Array.from(this.players.values())
        .filter((p): p is CastlefallPlayer & { team: TeamId } => !!p.team)
        .map((p) => ({ id: p.id, name: p.name, team: p.team, points: p.points })),
    };
  }

  getTeamPlayers(team: TeamId): CastlefallPlayer[] {
    return Array.from(this.players.values()).filter((p) => p.team === team && !p.removed);
  }

  static fromJSON(data: unknown): CastlefallRoom {
    const d = data as PersistedCastlefallRoom;
    const room = new CastlefallRoom(d.code, d.hostId);
    room.lastActivity = d.lastActivity ?? Date.now();
    room.settings = { ...room.settings, ...d.settings };
    const validPhases = Object.values(CastlefallPhase) as string[];
    if (d.phase !== undefined && validPhases.includes(d.phase)) {
      room.phase = d.phase as CastlefallPhase;
    } else {
      if (d.phase !== undefined) {
        logger.warn('game', 'fromJSON: invalid phase, falling back to LOBBY', { phase: d.phase });
      }
      room.phase = CastlefallPhase.LOBBY;
    }
    room.words = d.words ?? [];
    room.teamWords = d.teamWords ?? { 1: '', 2: '' };
    room.respondingState = d.respondingState;
    room.outcome = d.outcome;
    room.winningTeam = d.winningTeam;
    room.clappingPlayerId = d.clappingPlayerId;
    room.losingPlayerId = d.losingPlayerId;
    room.roundsPlayed = d.roundsPlayed ?? 0;
    room.restorePlayers({ players: d.players });
    return room;
  }
}
