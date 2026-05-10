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
  type TeamId,
  type WinningTeam,
} from '@games/castlefall-shared';
import { pickTeamWords, pickWords } from './wordbank.js';

interface PersistedCastlefallRoom {
  code: string;
  hostId: string;
  lastActivity?: number;
  settings?: Partial<CastlefallSettings>;
  players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean }>;
  phase?: string;
  words?: string[];
  teamWords?: { 1: string; 2: string };
  timerSeconds?: number;
  roundStartedAt?: number;
  winningTeam?: WinningTeam;
}

const WORDS_PER_ROUND = 18;

export class CastlefallRoom extends BaseRoom<CastlefallPlayer> {
  declare settings: CastlefallSettings;
  phase: CastlefallPhase = CastlefallPhase.LOBBY;
  words: string[] = [];
  teamWords: { 1: string; 2: string } = { 1: '', 2: '' };
  timerSeconds: number = 0;
  roundStartedAt?: number;
  winningTeam?: WinningTeam;

  constructor(code: string, hostId: string) {
    super(code, hostId, { timerSeconds: 0 });
  }

  override addPlayer(id: string, name: string, socketId: string): CastlefallPlayer {
    const player: CastlefallPlayer = { id, name, socketId, connected: true };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  override playerDTOs(): CastlefallPlayerDTO[] {
    const includeTeam = this.phase === CastlefallPhase.GAME_OVER;
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      ...(includeTeam && p.team ? { team: p.team } : {}),
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
      })),
      ...this.serializeGameState(),
    };
  }

  override restorePlayers(data: {
    players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean }>;
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
      timerSeconds: this.timerSeconds,
      roundStartedAt: this.roundStartedAt,
      winningTeam: this.winningTeam,
    };
  }

  resetToLobby(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.phase = CastlefallPhase.LOBBY;
    this.words = [];
    this.teamWords = { 1: '', 2: '' };
    this.timerSeconds = 0;
    this.roundStartedAt = undefined;
    this.winningTeam = undefined;
    for (const p of this.players.values()) {
      p.team = undefined;
    }
    this.touch();
  }

  startRound({ timerSeconds }: { timerSeconds: number }): void {
    this.words = pickWords({ count: WORDS_PER_ROUND });
    this.teamWords = pickTeamWords({ words: this.words });
    this.assignTeams();
    this.timerSeconds = timerSeconds;
    this.roundStartedAt = timerSeconds > 0 ? Date.now() : undefined;
    this.winningTeam = undefined;
    this.phase = CastlefallPhase.ROUND;
    this.touch();
  }

  endRound({ winningTeam }: { winningTeam: WinningTeam }): void {
    this.winningTeam = winningTeam;
    this.phase = CastlefallPhase.GAME_OVER;
    this.roundStartedAt = undefined;
    this.touch();
  }

  startNewRound(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.phase = CastlefallPhase.LOBBY;
    this.words = [];
    this.teamWords = { 1: '', 2: '' };
    this.timerSeconds = 0;
    this.roundStartedAt = undefined;
    this.winningTeam = undefined;
    for (const p of this.players.values()) {
      p.team = undefined;
    }
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
      timerSeconds: this.timerSeconds,
      roundStartedAt: this.roundStartedAt,
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
      winningTeam: this.winningTeam ?? 'draw',
      team1Word: this.teamWords[1],
      team2Word: this.teamWords[2],
      players: Array.from(this.players.values())
        .filter((p): p is CastlefallPlayer & { team: TeamId } => !!p.team)
        .map((p) => ({ id: p.id, name: p.name, team: p.team })),
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
    room.timerSeconds = d.timerSeconds ?? 0;
    room.roundStartedAt = d.roundStartedAt;
    room.winningTeam = d.winningTeam;
    room.restorePlayers({ players: d.players });
    return room;
  }
}
