import { BaseRoom } from '@games/server-core';
import {
  type TeamId,
  type AdtabooPlayer,
  type AdtabooPlayerDTO,
  GamePhase,
  type GameState,
  type ChallengeSetup,
  type TurnScoreData,
  type TeamRoundData,
  type RoundArchiveEntry,
  type AdtabooSettings,
  type AdtabooRoomDTO,
} from '@games/adtaboo-shared';
import { fetchWords } from './words/index.js';

function emptyChallenge(): ChallengeSetup {
  return {
    cards: [],
    tabooWords: [],
    tabooSuggestions: [],
    tabooBuzzes: {},
    ready: false,
    clueGiverId: null,
  };
}

export class AdtabooRoom extends BaseRoom<AdtabooPlayer> {
  declare settings: AdtabooSettings;
  game: GameState | null = null;
  tabooMasters: { A: string | null; B: string | null } = { A: null, B: null };
  roundHistory: RoundArchiveEntry[] = [];

  private timer: ReturnType<typeof setTimeout> | null = null;
  private onTimerExpired: (() => void) | null = null;
  private _refreshingWord: boolean = false;

  constructor(code: string, hostId: string) {
    super(code, hostId, { rounds: 3, timerSeconds: 60, wordsPerTurn: 5, maxTabooWords: 20 });
  }

  // --- Player management (team-aware) ---

  override addPlayer(id: string, name: string, socketId: string): AdtabooPlayer {
    const player: AdtabooPlayer = { id, name, team: null, socketId, connected: true };
    this.players.set(id, player);
    this.touch();
    return player;
  }

  getTeamPlayers(team: TeamId): AdtabooPlayer[] {
    return Array.from(this.players.values()).filter((p) => p.team === team && p.connected);
  }

  getOpposingTeam(team: TeamId): TeamId {
    return team === 'A' ? 'B' : 'A';
  }

  override playerDTOs(): AdtabooPlayerDTO[] {
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

  protected onPlayerRemoved(playerId: string): void {
    if (this.tabooMasters.A === playerId) this.tabooMasters.A = null;
    if (this.tabooMasters.B === playerId) this.tabooMasters.B = null;
  }

  isGameActive(): boolean {
    return !!(this.game && this.game.phase !== GamePhase.LOBBY && this.game.phase !== GamePhase.GAME_OVER);
  }

  getPhase(): string | null {
    return this.game?.phase ?? null;
  }

  serializeGameState(): object {
    return {
      tabooMasters: this.tabooMasters,
      game: this.game,
      roundHistory: this.roundHistory,
    };
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
    this.roundHistory = [];
    this.touch();
  }

  // --- Taboo-specific DTO ---

  override toDTO(): AdtabooRoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      phase: this.game?.phase ?? null,
      tabooMasters: { ...this.tabooMasters },
    };
  }

  // --- Taboo Master Management ---

  setTabooMaster(team: TeamId, playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.team !== team) return false;
    this.tabooMasters[team] = playerId;
    if (this.game) this.game.tabooMasters[team] = playerId;
    this.touch();
    return true;
  }

  ensureTabooMaster(team: TeamId): string | null {
    const currentId = this.tabooMasters[team];
    if (currentId) {
      const current = this.getPlayer(currentId);
      if (current && current.connected && current.team === team) return currentId;
    }
    const teamPlayers = this.getTeamPlayers(team);
    if (teamPlayers.length > 0) {
      this.tabooMasters[team] = teamPlayers[0].id;
      if (this.game) this.game.tabooMasters[team] = teamPlayers[0].id;
      return teamPlayers[0].id;
    }
    return null;
  }

  // --- Game Start ---

  canStart(): { ok: boolean; reason?: string } {
    const teamA = this.getTeamPlayers('A');
    const teamB = this.getTeamPlayers('B');
    if (teamA.length < 2) return { ok: false, reason: 'Team A needs at least 2 players' };
    if (teamB.length < 2) return { ok: false, reason: 'Team B needs at least 2 players' };
    if (!this.tabooMasters.A) return { ok: false, reason: 'Team A needs a taboo master' };
    if (!this.tabooMasters.B) return { ok: false, reason: 'Team B needs a taboo master' };
    return { ok: true };
  }

  startGame(): void {
    this.game = {
      phase: GamePhase.PARALLEL_SETUP,
      round: 1,
      scores: { A: 0, B: 0 },
      challenges: { A: emptyChallenge(), B: emptyChallenge() },
      timerEnd: null,
      tabooMasters: { ...this.tabooMasters },
      turnResults: { A: null, B: null },
    };
    this.touch();
  }

  async fetchInitialWords(): Promise<void> {
    if (!this.game) return;
    const [wordsForA, wordsForB] = await Promise.all([
      fetchWords(this.settings.wordsPerTurn),
      fetchWords(this.settings.wordsPerTurn),
    ]);
    if (!this.game) return;
    this.game.challenges.A.cards = wordsForA.map((w) => ({ word: w, result: null }));
    this.game.challenges.B.cards = wordsForB.map((w) => ({ word: w, result: null }));
    this.touch();
  }

  // --- Parallel Setup ---

  setClueGiver(team: TeamId, playerId: string): boolean {
    if (!this.game || this.game.phase !== GamePhase.PARALLEL_SETUP) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.team !== team) return false;
    this.game.challenges[team].clueGiverId = playerId;
    this.touch();
    return true;
  }

  suggestTabooWord(forTeam: TeamId, word: string): string[] {
    if (!this.game) return [];
    const challenge = this.game.challenges[forTeam];
    const normalized = word.trim().toLowerCase();
    if (!normalized || normalized.length > 50 || challenge.tabooSuggestions.includes(normalized))
      return challenge.tabooSuggestions;
    if (challenge.tabooSuggestions.length >= this.settings.maxTabooWords) return challenge.tabooSuggestions;
    challenge.tabooSuggestions.push(normalized);
    this.touch();
    return challenge.tabooSuggestions;
  }

  removeTabooWord(forTeam: TeamId, word: string): string[] {
    if (!this.game) return [];
    const challenge = this.game.challenges[forTeam];
    const normalized = word.trim().toLowerCase();
    challenge.tabooSuggestions = challenge.tabooSuggestions.filter((w) => w !== normalized);
    this.touch();
    return challenge.tabooSuggestions;
  }

  async refreshWord(forTeam: TeamId, cardIndex: number): Promise<string | null> {
    if (!this.game || this.game.phase !== GamePhase.PARALLEL_SETUP) return null;
    const challenge = this.game.challenges[forTeam];
    if (cardIndex < 0 || cardIndex >= challenge.cards.length) return null;
    if (this._refreshingWord) return null;

    this._refreshingWord = true;
    try {
      const words = await fetchWords(1);
      if (words.length === 0 || !this.game) return null;
      challenge.cards[cardIndex] = { word: words[0], result: null };
      this.touch();
      return words[0];
    } finally {
      this._refreshingWord = false;
    }
  }

  confirmChallenge(forTeam: TeamId): boolean {
    if (!this.game || this.game.phase !== GamePhase.PARALLEL_SETUP) return false;
    const challenge = this.game.challenges[forTeam];
    if (challenge.tabooSuggestions.length < 1) return false;
    challenge.tabooWords = [...challenge.tabooSuggestions];
    challenge.ready = true;
    this.touch();
    return true;
  }

  unconfirmChallenge(forTeam: TeamId): boolean {
    if (!this.game || this.game.phase !== GamePhase.PARALLEL_SETUP) return false;
    if (this.bothChallengesReady()) return false;
    this.game.challenges[forTeam].ready = false;
    this.touch();
    return true;
  }

  bothChallengesReady(): boolean {
    if (!this.game) return false;
    return this.game.challenges.A.ready && this.game.challenges.B.ready;
  }

  getSetupStatus() {
    if (!this.game)
      return {
        A: { ready: false, tabooCount: 0, hasClueGiver: false },
        B: { ready: false, tabooCount: 0, hasClueGiver: false },
      };
    return {
      A: {
        ready: this.game.challenges.A.ready,
        tabooCount: this.game.challenges.A.tabooSuggestions.length,
        hasClueGiver: !!this.game.challenges.A.clueGiverId,
      },
      B: {
        ready: this.game.challenges.B.ready,
        tabooCount: this.game.challenges.B.tabooSuggestions.length,
        hasClueGiver: !!this.game.challenges.B.clueGiverId,
      },
    };
  }

  // --- Cluing ---

  getCluingTeam(): TeamId | null {
    if (!this.game) return null;
    if (this.game.phase === GamePhase.CLUING_A) return 'A';
    if (this.game.phase === GamePhase.CLUING_B) return 'B';
    return null;
  }

  getActiveChallenge(): ChallengeSetup | null {
    const team = this.getCluingTeam();
    if (!team || !this.game) return null;
    return this.game.challenges[team];
  }

  prepareCluingPhase(team: TeamId): void {
    if (!this.game) return;
    this.game.phase = team === 'A' ? GamePhase.CLUING_A : GamePhase.CLUING_B;
    this.game.timerEnd = null;
    this.touch();
  }

  beginCluingTimer(onExpired: () => void): number {
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

  resolveCard(cardIndex: number): boolean {
    const challenge = this.getActiveChallenge();
    if (!challenge || !this.game || cardIndex < 0 || cardIndex >= challenge.cards.length) return false;
    const card = challenge.cards[cardIndex];
    if (card.result !== null) return false;
    card.result = 'correct';
    const team = this.getCluingTeam()!;
    this.game.scores[team] += 3;
    this.touch();
    return true;
  }

  undoCard(cardIndex: number): boolean {
    const challenge = this.getActiveChallenge();
    if (!challenge || !this.game || cardIndex < 0 || cardIndex >= challenge.cards.length) return false;
    const card = challenge.cards[cardIndex];
    if (card.result !== 'correct') return false;
    card.result = null;
    const team = this.getCluingTeam()!;
    this.game.scores[team] -= 3;
    this.touch();
    return true;
  }

  allCardsResolved(): boolean {
    const challenge = this.getActiveChallenge();
    if (!challenge) return false;
    return challenge.cards.every((c) => c.result !== null);
  }

  buzzTabooWord(word: string): number {
    const challenge = this.getActiveChallenge();
    if (!challenge || !this.game) return 0;
    if (!challenge.tabooWords.includes(word)) return 0;
    const current = challenge.tabooBuzzes[word] || 0;
    challenge.tabooBuzzes[word] = current + 1;
    const team = this.getCluingTeam()!;
    this.game.scores[team] -= 1;
    this.touch();
    return current + 1;
  }

  undoBuzzTabooWord(word: string): number {
    const challenge = this.getActiveChallenge();
    if (!challenge || !this.game) return 0;
    const current = challenge.tabooBuzzes[word] || 0;
    if (current <= 0) return 0;
    challenge.tabooBuzzes[word] = current - 1;
    const team = this.getCluingTeam()!;
    this.game.scores[team] += 1;
    this.touch();
    return current - 1;
  }

  turnScore(team: TeamId): TurnScoreData {
    if (!this.game) return { correct: 0, missed: 0, buzzes: 0, points: 0 };
    const challenge = this.game.challenges[team];
    const correct = challenge.cards.filter((c) => c.result === 'correct').length;
    const missed = challenge.cards.filter((c) => c.result === null).length;
    const buzzes = Object.values(challenge.tabooBuzzes).reduce((sum, c) => sum + c, 0);
    return { correct, missed, buzzes, points: correct * 3 - buzzes };
  }

  endCluing(): { nextPhase: GamePhase; turnScore: TurnScoreData } {
    if (!this.game) return { nextPhase: GamePhase.LOBBY, turnScore: { correct: 0, missed: 0, buzzes: 0, points: 0 } };
    this.clearTimer();
    const team = this.getCluingTeam()!;
    const score = this.turnScore(team);
    this.game.turnResults[team] = score;
    this.game.timerEnd = null;

    if (this.game.phase === GamePhase.CLUING_A) {
      this.game.phase = GamePhase.CLUING_B;
      return { nextPhase: GamePhase.CLUING_B, turnScore: score };
    } else {
      this.archiveCurrentRound();
      if (this.game.round >= this.settings.rounds) {
        this.game.phase = GamePhase.GAME_OVER;
        return { nextPhase: GamePhase.GAME_OVER, turnScore: score };
      }
      this.game.phase = GamePhase.ROUND_RESULT;
      return { nextPhase: GamePhase.ROUND_RESULT, turnScore: score };
    }
  }

  advanceToNextRound(): void {
    if (!this.game || this.game.phase !== GamePhase.ROUND_RESULT) return;
    this.game.round += 1;
    this.game.challenges = { A: emptyChallenge(), B: emptyChallenge() };
    this.game.turnResults = { A: null, B: null };
    this.game.timerEnd = null;
    this.game.phase = GamePhase.PARALLEL_SETUP;
    this.touch();
  }

  private archiveCurrentRound(): void {
    if (!this.game) return;
    const archiveTeam = (team: TeamId): TeamRoundData => {
      const challenge = this.game!.challenges[team];
      const opposingTeam = this.getOpposingTeam(team);
      const clueGiver = challenge.clueGiverId ? this.getPlayer(challenge.clueGiverId) : null;
      const opposingTM = this.tabooMasters[opposingTeam] ? this.getPlayer(this.tabooMasters[opposingTeam]!) : null;
      return {
        cards: challenge.cards.map((c) => ({ ...c })),
        tabooWords: [...challenge.tabooWords],
        tabooBuzzes: { ...challenge.tabooBuzzes },
        turnScore: this.game!.turnResults[team] ?? { correct: 0, missed: 0, buzzes: 0, points: 0 },
        clueGiverName: clueGiver?.name ?? 'Unknown',
        tabooMasterName: opposingTM?.name ?? 'Unknown',
      };
    };
    this.roundHistory.push({
      round: this.game.round,
      teams: { A: archiveTeam('A'), B: archiveTeam('B') },
    });
  }

  getRoundHistory(): RoundArchiveEntry[] {
    return this.roundHistory;
  }

  // --- Serialization ---

  static fromJSON(data: any): AdtabooRoom {
    const room = new AdtabooRoom(data.code, data.hostId);
    room.lastActivity = data.lastActivity ?? Date.now();
    room.settings = { ...room.settings, ...data.settings };
    room.tabooMasters = data.tabooMasters ?? { A: null, B: null };
    room.roundHistory = data.roundHistory ?? [];
    room.game = data.game ?? null;
    room.restorePlayers(data);
    return room;
  }
}
