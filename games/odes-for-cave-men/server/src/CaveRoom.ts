import { BaseRoom } from '@games/server-core';
import {
  type TeamId,
  type CavePlayer,
  type CavePlayerDTO,
  GamePhase,
  type GameState,
  type WordCard,
  type CaveSettings,
  type CaveRoomDTO,
} from '@games/odes-for-cave-men-shared';
import { getRandomWords, TOTAL_WORD_COUNT } from './words/index.js';

export class CaveRoom extends BaseRoom<CavePlayer> {
  declare settings: CaveSettings;
  game: GameState | null = null;
  teamNames: { A: string; B: string } = { A: 'Team A', B: 'Team B' };
  /** Indices of words already used in this room (persists across games) */
  usedWordIndices: Set<number> = new Set();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private onTimerExpired: (() => void) | null = null;

  constructor(code: string, hostId: string) {
    super(code, hostId, { rounds: 4, timerSeconds: 90 });
  }

  // --- Player management ---

  override addPlayer(id: string, name: string, socketId: string): CavePlayer {
    const player: CavePlayer = { id, name, team: null, socketId, connected: true };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  getTeamPlayers(team: TeamId): CavePlayer[] {
    return Array.from(this.players.values()).filter((p) => p.team === team && p.connected && !p.removed);
  }

  override playerDTOs(): CavePlayerDTO[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      connected: p.connected,
    }));
  }

  override toJSON(): object {
    return {
      code: this.code,
      hostId: this.hostId,
      lastActivity: this.lastActivity,
      settings: this.settings,
      teamNames: this.teamNames,
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
    players?: Array<{ id: string; name: string; team: TeamId | null; removed?: boolean }>;
  }) {
    for (const p of data.players ?? []) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        team: p.team ?? null,
        socketId: '',
        connected: false,
        disconnectedAt: Date.now(),
        removed: p.removed ?? false,
      });
    }
  }

  // --- BaseRoom abstract implementations ---

  protected onPlayerRemoved(_playerId: string): void {
    // No special cleanup needed
  }

  isGameActive(): boolean {
    return !!(this.game && this.game.phase !== GamePhase.LOBBY && this.game.phase !== GamePhase.GAME_OVER);
  }

  getPhase(): string | null {
    return this.game?.phase ?? null;
  }

  serializeGameState(): object {
    return { game: this.game, usedWordIndices: [...this.usedWordIndices] };
  }

  override clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.onTimerExpired = null;
  }

  resetToLobby(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.game = null;
    this.clearTimer();
    this.touch();
  }

  // --- DTO ---

  override toDTO(): CaveRoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      teamNames: { ...this.teamNames },
      phase: this.game?.phase ?? null,
      scores: this.game?.scores ?? { A: 0, B: 0 },
    };
  }

  // --- Game lifecycle ---

  canStart(): { ok: boolean; reason?: string } {
    const teamA = this.getTeamPlayers('A');
    const teamB = this.getTeamPlayers('B');
    if (teamA.length < 1) return { ok: false, reason: 'Team A needs at least 1 player' };
    if (teamB.length < 1) return { ok: false, reason: 'Team B needs at least 1 player' };
    return { ok: true };
  }

  pickCluer(team: TeamId): string | null {
    if (!this.game) return null;
    const clued = team === 'A' ? this.game.cluedA : this.game.cluedB;
    const teamPlayers = this.getTeamPlayers(team);
    const uncluded = teamPlayers.filter((p) => !clued.includes(p.id));
    const pool = uncluded.length > 0 ? uncluded : teamPlayers;
    if (pool.length === 0) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return pick.id;
  }

  startGame(): void {
    const teamA = this.getTeamPlayers('A');
    const teamB = this.getTeamPlayers('B');
    const turnsPerRound = Math.max(teamA.length, teamB.length);

    this.game = {
      phase: GamePhase.READY,
      round: 1,
      scores: { A: 0, B: 0 },
      playingTeam: 'A',
      turnIndex: 0,
      turnsPerRound,
      cluedA: [],
      cluedB: [],
      cluerId: null,
      currentWordIndex: 0,
      words: [],
      timerEnd: null,
    };

    this.game.cluerId = this.pickCluer('A');
    this.touch();
  }

  startTurn(): void {
    if (!this.game) return;

    // Reset used pool if we've exhausted all words
    if (this.usedWordIndices.size >= TOTAL_WORD_COUNT) {
      this.usedWordIndices.clear();
    }

    const entries = getRandomWords(20, this.usedWordIndices);
    for (const e of entries) this.usedWordIndices.add(e.index);

    this.game.words = entries.map((e) => ({ word1: e.word1, word3: e.word3, points: 0, result: null }));
    this.game.currentWordIndex = 0;
    this.game.phase = GamePhase.PLAYING;
    this.touch();
  }

  beginTimer(onExpired: () => void): number {
    if (!this.game) return 0;
    const end = Date.now() + this.settings.timerSeconds * 1000;
    this.game.timerEnd = end;
    this.onTimerExpired = onExpired;
    this.timer = setTimeout(() => {
      this.onTimerExpired?.();
    }, this.settings.timerSeconds * 1000);
    this.touch();
    return end;
  }

  restoreTimer(remainingMs: number, onExpired: () => void): void {
    this.onTimerExpired = onExpired;
    this.timer = setTimeout(() => {
      this.onTimerExpired?.();
    }, remainingMs);
  }

  getCurrentWord(): WordCard | null {
    if (!this.game || this.game.currentWordIndex >= this.game.words.length) return null;
    return this.game.words[this.game.currentWordIndex];
  }

  resolveCurrentWord({
    result,
    points,
  }: {
    result: 'correct' | 'skipped' | 'bonked';
    points: number;
  }): WordCard | null {
    if (!this.game) return null;
    const card = this.getCurrentWord();
    if (!card) return null;
    card.result = result;
    card.points = points;
    this.game.scores[this.game.playingTeam] += points;
    this.game.currentWordIndex += 1;
    this.touch();
    return card;
  }

  endTurn(): void {
    if (!this.game) return;
    this.clearTimer();
    this.game.timerEnd = null;
    this.game.phase = GamePhase.REVIEW;
    // Mark cluer as having clued
    const clued = this.game.playingTeam === 'A' ? this.game.cluedA : this.game.cluedB;
    if (this.game.cluerId && !clued.includes(this.game.cluerId)) {
      clued.push(this.game.cluerId);
    }
    this.touch();
  }

  /** Adjust a card's points during review. Returns the score delta applied. */
  adjustCardPoints({ index, newPoints }: { index: number; newPoints: number }): number {
    if (!this.game) return 0;
    const card = this.game.words[index];
    if (!card || card.result === null) return 0;
    const delta = newPoints - card.points;
    card.points = newPoints;
    this.game.scores[this.game.playingTeam] += delta;
    this.touch();
    return delta;
  }

  /** Get resolved cards for the review screen */
  getResolvedCards(): WordCard[] {
    if (!this.game) return [];
    return this.game.words.filter((w) => w.result !== null);
  }

  /** Lock in review and advance to next turn/round/game over */
  lockInReview(): { nextPhase: GamePhase; nextCluerId: string | null } {
    if (!this.game || this.game.phase !== GamePhase.REVIEW) {
      return { nextPhase: GamePhase.LOBBY, nextCluerId: null };
    }

    const { playingTeam, turnIndex, turnsPerRound, round } = this.game;

    if (playingTeam === 'A') {
      // Team A just finished, Team B's turn
      this.game.playingTeam = 'B';
      this.game.cluerId = this.pickCluer('B');
      this.game.phase = GamePhase.READY;
      this.game.words = [];
      this.game.currentWordIndex = 0;
      this.touch();
      return { nextPhase: GamePhase.READY, nextCluerId: this.game.cluerId };
    }

    // Team B just finished
    if (turnIndex < turnsPerRound - 1) {
      // More turns in this round
      this.game.turnIndex = turnIndex + 1;
      this.game.playingTeam = 'A';
      this.game.cluerId = this.pickCluer('A');
      this.game.phase = GamePhase.READY;
      this.game.words = [];
      this.game.currentWordIndex = 0;
      this.touch();
      return { nextPhase: GamePhase.READY, nextCluerId: this.game.cluerId };
    }

    // Round complete
    if (round >= this.settings.rounds) {
      this.game.phase = GamePhase.GAME_OVER;
      this.touch();
      return { nextPhase: GamePhase.GAME_OVER, nextCluerId: null };
    }

    this.game.phase = GamePhase.ROUND_RESULT;
    this.touch();
    return { nextPhase: GamePhase.ROUND_RESULT, nextCluerId: null };
  }

  advanceToNextRound(): void {
    if (!this.game || this.game.phase !== GamePhase.ROUND_RESULT) return;
    this.game.round += 1;
    this.game.turnIndex = 0;
    const teamA = this.getTeamPlayers('A');
    const teamB = this.getTeamPlayers('B');
    this.game.turnsPerRound = Math.max(teamA.length, teamB.length);
    this.game.cluedA = [];
    this.game.cluedB = [];
    this.game.playingTeam = 'A';
    this.game.cluerId = this.pickCluer('A');
    this.game.words = [];
    this.game.currentWordIndex = 0;
    this.game.timerEnd = null;
    this.game.phase = GamePhase.READY;
    this.touch();
  }

  // --- Serialization ---

  static fromJSON(data: any): CaveRoom {
    const room = new CaveRoom(data.code, data.hostId);
    room.lastActivity = data.lastActivity ?? Date.now();
    room.settings = { ...room.settings, ...data.settings };
    room.teamNames = data.teamNames ?? { A: 'Team A', B: 'Team B' };
    room.game = data.game ?? null;
    room.usedWordIndices = new Set(data.usedWordIndices ?? []);
    room.restorePlayers(data);
    return room;
  }
}
