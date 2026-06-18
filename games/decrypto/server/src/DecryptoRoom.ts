import { BaseRoom, logger } from '@games/server-core';
import {
  CLUE_TIMER_SECONDS,
  CODE_DIGITS,
  DecryptoPhase,
  MAX_DRAWING_DATA_URL_LENGTH,
  type ClueContent,
  type ClueRecord,
  type Code,
  type CodeDigit,
  type DecryptoPlayer,
  type DecryptoPlayerDTO,
  type DecryptoRoomDTO,
  type DecryptoSettings,
  type FinalGameState,
  type GameEndReason,
  type GameWinner,
  type GuessShare,
  type GuessKind,
  type PrivateTeamState,
  type PublicClinchedOutcome,
  type PublicTiebreakerState,
  type PublicTeamTurnState,
  type PublicTurnState,
  type RevealState,
  type ScoreBoard,
  type StandardGameEndReason,
  type TeamId,
  type TiebreakerVocabularyMode,
  type TiebreakerResult,
  type TiebreakerSubmission,
} from '@games/decrypto-shared';
import {
  getTiebreakerVocabulary,
  isKnownTiebreakerGuess,
  normalizeSemanticAnswer,
  semanticSimilarity,
} from './semanticSimilarity.js';
import { getKeywordVocabulary, isKnownKeywordGuess, pickKeywordSets, pickReplacementKeyword } from './wordbank.js';

interface TeamTurn {
  round: number;
  team: TeamId;
  encryptorId: string;
  code: Code;
  clues: ClueContent[];
  clueLocked: boolean;
  clueLockedAt?: number;
  decryptGuess?: Code;
  interceptGuess?: Code;
  revealed: boolean;
}

interface PersistedDecryptoRoom {
  code: string;
  hostId: string;
  lastActivity?: number;
  settings?: Partial<DecryptoSettings>;
  players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean }>;
  phase?: string;
  scores?: ScoreBoard;
  keywords?: Record<TeamId, string[]>;
  wordLocks?: Record<TeamId, boolean>;
  round?: number;
  encryptorCursor?: Record<TeamId, number>;
  encryptorQueue?: Record<TeamId, string[]>;
  roundTurns?: Record<TeamId, TeamTurn>;
  activeGuessTeam?: TeamId;
  guessQueue?: TeamId[];
  clueTimerStartedAt?: number;
  reveal?: RevealState;
  reveals?: RevealState[];
  clinchedOutcome?: PublicClinchedOutcome;
  tiebreakerSubmissions?: Partial<Record<TeamId, TiebreakerSubmission>>;
  tiebreakerResult?: TiebreakerResult;
  tiebreakerHistory?: TiebreakerResult[];
  tiebreakerRepeatRequests?: Record<TeamId, boolean>;
  tiebreakerRepeatUsed?: boolean;
  gameWinner?: GameWinner;
  gameEndReason?: GameEndReason;
  clueHistory?: ClueRecord[];
  guessShares?: GuessShare[];
  releasedWords?: Record<TeamId, boolean>;
}

type ActionResult = { ok: true } | { ok: false; message: string };
type TerminalOutcome = { team: TeamId; reason: StandardGameEndReason };
type SanitizedTiebreakerGuesses = { ok: true; guesses: string[] } | { ok: false; message: string };

const TEAMS: TeamId[] = ['red', 'blue'];
const TIEBREAKER_GUESS_COUNT = 4;
const TIEBREAKER_SIMILARITY_THRESHOLD = 0.08;
const SINGLE_WORD_TIEBREAKER_GUESS = /^[A-Za-z]{3,18}$/;

const DEFAULT_SETTINGS: DecryptoSettings = {
  maxIntercepts: 2,
  maxMiscommunications: 2,
  tiebreakerVocabularyMode: 'english',
};

const EMPTY_SCORES: ScoreBoard = {
  red: { intercepts: 0, miscommunications: 0 },
  blue: { intercepts: 0, miscommunications: 0 },
};

function cloneScores(scores: ScoreBoard): ScoreBoard {
  return {
    red: { ...scores.red },
    blue: { ...scores.blue },
  };
}

function cloneWordLocks(wordLocks: Record<TeamId, boolean>): Record<TeamId, boolean> {
  return { red: wordLocks.red, blue: wordLocks.blue };
}

function cloneReleaseState(releasedWords: Record<TeamId, boolean>): Record<TeamId, boolean> {
  return { red: releasedWords.red, blue: releasedWords.blue };
}

function cloneTeamBooleans(values: Record<TeamId, boolean>): Record<TeamId, boolean> {
  return { red: values.red, blue: values.blue };
}

function otherTeam(team: TeamId): TeamId {
  return team === 'red' ? 'blue' : 'red';
}

function createTextClue(text: string): ClueContent {
  return { kind: 'text', text };
}

function createEmptyClues(): ClueContent[] {
  return [createTextClue(''), createTextClue(''), createTextClue('')];
}

function cloneClue(clue: ClueContent | unknown): ClueContent {
  if (typeof clue === 'string') return createTextClue(clue);
  if (!clue || typeof clue !== 'object') return createTextClue('');
  const maybeClue = clue as Partial<ClueContent>;
  if (maybeClue.kind === 'drawing') return { kind: 'drawing', dataUrl: maybeClue.dataUrl ?? '' };
  if (maybeClue.kind === 'text') return { kind: 'text', text: maybeClue.text ?? '' };
  return createTextClue('');
}

function cloneKnownClue(clue: ClueContent): ClueContent {
  return clue.kind === 'drawing' ? { kind: 'drawing', dataUrl: clue.dataUrl } : { kind: 'text', text: clue.text };
}

function sanitizeTextClue(value: unknown, { allowEmpty }: { allowEmpty: boolean }): ClueContent | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!trimmed && !allowEmpty) return null;
  return createTextClue(trimmed);
}

function sanitizeDrawingClue(value: unknown, { allowEmpty }: { allowEmpty: boolean }): ClueContent | null {
  if (!value || typeof value !== 'object') return null;
  const maybeClue = value as Partial<ClueContent>;
  if (maybeClue.kind !== 'drawing') return null;
  if (typeof maybeClue.dataUrl !== 'string') return null;
  const dataUrl = maybeClue.dataUrl.trim();
  if (!dataUrl && allowEmpty) return { kind: 'drawing', dataUrl: '' };
  if (!dataUrl && !allowEmpty) return null;
  if (!dataUrl.startsWith('data:image/png;base64,')) return null;
  if (dataUrl.length > MAX_DRAWING_DATA_URL_LENGTH) return null;
  return { kind: 'drawing', dataUrl };
}

function normalizeClue(value: unknown, options: { allowEmpty: boolean }): ClueContent | null {
  if (typeof value === 'string') return sanitizeTextClue(value, options);
  if (!value || typeof value !== 'object') return null;
  const maybeClue = value as Partial<ClueContent>;
  if (maybeClue.kind === 'text') return sanitizeTextClue(maybeClue.text, options);
  if (maybeClue.kind === 'drawing') return sanitizeDrawingClue(maybeClue, options);
  return null;
}

function normalizeClues(values: unknown[], { allowEmpty }: { allowEmpty: boolean }): ClueContent[] | null {
  if (!Array.isArray(values) || values.length !== 3) return null;
  const clues = values.map((value) => normalizeClue(value, { allowEmpty }));
  if (clues.some((clue) => clue === null)) return null;
  return clues as ClueContent[];
}

function hasClueContent(clue: ClueContent | undefined): boolean {
  if (!clue) return false;
  return clue.kind === 'drawing' ? !!clue.dataUrl : !!clue.text.trim();
}

function fillClues(clues: ClueContent[]): ClueContent[] {
  return [0, 1, 2].map((index) => {
    const clue = clues[index];
    return hasClueContent(clue) ? cloneKnownClue(clue) : createTextClue('No clue');
  });
}

function isValidCode(value: unknown): value is Code {
  if (!Array.isArray(value) || value.length !== 3) return false;
  const unique = new Set(value);
  return unique.size === 3 && value.every((digit) => CODE_DIGITS.includes(digit));
}

function codesEqual(a: Code | undefined, b: Code): boolean {
  return !!a && a.length === b.length && a.every((digit, index) => digit === b[index]);
}

function cloneCode(code: Code): Code {
  return [...code] as Code;
}

function cloneGuessShare(share: GuessShare): GuessShare {
  return {
    ...share,
    code: cloneCode(share.code),
  };
}

function cloneTiebreakerSubmission(submission: TiebreakerSubmission): TiebreakerSubmission {
  return {
    ...submission,
    guesses: [...submission.guesses],
  };
}

function cloneTiebreakerResult(result: TiebreakerResult): TiebreakerResult {
  return {
    ...result,
    results: {
      red: {
        ...result.results.red,
        guesses: [...result.results.red.guesses],
        slotScores: [...result.results.red.slotScores],
      },
      blue: {
        ...result.results.blue,
        guesses: [...result.results.blue.guesses],
        slotScores: [...result.results.blue.slotScores],
      },
    },
  };
}

function cloneTurn(turn: TeamTurn): TeamTurn {
  return {
    ...turn,
    code: cloneCode(turn.code),
    clues: turn.clues.map(cloneClue),
    ...(turn.decryptGuess ? { decryptGuess: cloneCode(turn.decryptGuess) } : {}),
    ...(turn.interceptGuess ? { interceptGuess: cloneCode(turn.interceptGuess) } : {}),
  };
}

function cloneRecord(record: ClueRecord): ClueRecord {
  return {
    ...record,
    code: cloneCode(record.code),
    clues: record.clues.map(cloneClue),
    ...(record.decryptGuess ? { decryptGuess: cloneCode(record.decryptGuess) } : {}),
    ...(record.interceptGuess ? { interceptGuess: cloneCode(record.interceptGuess) } : {}),
  };
}

function cloneReveal(reveal: RevealState): RevealState {
  return {
    ...cloneRecord(reveal),
    gameOver: reveal.gameOver,
    ...(reveal.winner ? { winner: reveal.winner } : {}),
    ...(reveal.reason ? { reason: reveal.reason } : {}),
  };
}

function isKnownTiebreakerGuessForMode(value: string, mode: TiebreakerVocabularyMode): boolean {
  return mode === 'word-bank' ? isKnownKeywordGuess(value) : isKnownTiebreakerGuess(value);
}

function tiebreakerUnknownWordMessage(mode: TiebreakerVocabularyMode): string {
  return mode === 'word-bank' ? 'Word not in the Decrypto word bank.' : 'Word not recognized. Try a more common word.';
}

function sanitizeTiebreakerGuesses(value: unknown, mode: TiebreakerVocabularyMode): SanitizedTiebreakerGuesses {
  if (!Array.isArray(value) || value.length !== TIEBREAKER_GUESS_COUNT) {
    return { ok: false, message: 'Submit one recognized single-word guess for each opposing keyword.' };
  }

  const guesses: string[] = [];
  for (const guess of value) {
    const normalized = typeof guess === 'string' ? guess.trim().toLowerCase() : '';
    if (!SINGLE_WORD_TIEBREAKER_GUESS.test(normalized)) {
      return { ok: false, message: 'Submit one recognized single-word guess for each opposing keyword.' };
    }
    if (!isKnownTiebreakerGuessForMode(normalized, mode)) {
      return { ok: false, message: tiebreakerUnknownWordMessage(mode) };
    }
    guesses.push(normalized);
  }
  return { ok: true, guesses };
}

export class DecryptoRoom extends BaseRoom<DecryptoPlayer> {
  declare settings: DecryptoSettings;
  phase: DecryptoPhase = DecryptoPhase.LOBBY;
  scores: ScoreBoard = cloneScores(EMPTY_SCORES);
  keywords: Record<TeamId, string[]> = pickKeywordSets();
  wordLocks: Record<TeamId, boolean> = { red: false, blue: false };
  round = 0;
  encryptorQueue: Record<TeamId, string[]> = { red: [], blue: [] };
  roundTurns?: Record<TeamId, TeamTurn>;
  activeGuessTeam?: TeamId;
  guessQueue: TeamId[] = [];
  clueTimerStartedAt?: number;
  reveal?: RevealState;
  reveals: RevealState[] = [];
  clinchedOutcome?: PublicClinchedOutcome;
  tiebreakerSubmissions: Partial<Record<TeamId, TiebreakerSubmission>> = {};
  tiebreakerResult?: TiebreakerResult;
  tiebreakerHistory: TiebreakerResult[] = [];
  tiebreakerRepeatRequests: Record<TeamId, boolean> = { red: false, blue: false };
  tiebreakerRepeatUsed = false;
  gameWinner?: GameWinner;
  gameEndReason?: GameEndReason;
  clueHistory: ClueRecord[] = [];
  guessShares: GuessShare[] = [];
  releasedWords: Record<TeamId, boolean> = { red: false, blue: false };
  private clueTimer?: ReturnType<typeof setTimeout>;

  constructor(code: string, hostId: string) {
    super(code, hostId, { ...DEFAULT_SETTINGS });
  }

  override addPlayer(id: string, name: string, socketId: string): DecryptoPlayer {
    const player: DecryptoPlayer = { id, name, socketId, connected: true };
    if (this.phase === DecryptoPhase.LOBBY) {
      const redCount = this.getTeamPlayers('red').length;
      const blueCount = this.getTeamPlayers('blue').length;
      player.team = redCount <= blueCount ? 'red' : 'blue';
    }
    this.players.set(id, player);
    this.touch();
    return player;
  }

  override playerDTOs(): DecryptoPlayerDTO[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      team: p.team,
      isEncryptor: TEAMS.some((team) => this.roundTurns?.[team]?.encryptorId === p.id),
    }));
  }

  override toDTO(): DecryptoRoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      phase: this.phase,
      scores: cloneScores(this.scores),
      wordLocks: cloneWordLocks(this.wordLocks),
      turn: this.getPublicTurnState(),
      reveal: this.reveal ? cloneReveal(this.reveal) : null,
      reveals: this.reveals.map(cloneReveal),
      clinchedOutcome: this.getPublicClinchedOutcome(),
      tiebreaker: this.getPublicTiebreakerState(),
      clueHistory: this.clueHistory.map(cloneRecord),
      finalState: this.getFinalGameState(),
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

  override restorePlayers(data: { players?: Array<{ id: string; name: string; team?: TeamId; removed?: boolean }> }) {
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

  protected onPlayerRemoved(playerId: string): void {
    if (!this.roundTurns) return;
    for (const team of TEAMS) {
      const turn = this.roundTurns[team];
      if (turn.encryptorId !== playerId) continue;
      const replacement = this.getTeamPlayers(team).find((p) => p.id !== playerId && p.connected);
      if (replacement) turn.encryptorId = replacement.id;
    }
  }

  isGameActive(): boolean {
    return (
      this.phase === DecryptoPhase.WORDS ||
      this.phase === DecryptoPhase.CLUE ||
      this.phase === DecryptoPhase.GUESS ||
      this.phase === DecryptoPhase.REVEAL ||
      this.phase === DecryptoPhase.TIEBREAKER
    );
  }

  getPhase(): string {
    return this.phase;
  }

  serializeGameState(): object {
    return {
      phase: this.phase,
      scores: this.scores,
      keywords: this.keywords,
      wordLocks: this.wordLocks,
      round: this.round,
      encryptorQueue: this.encryptorQueue,
      roundTurns: this.roundTurns,
      activeGuessTeam: this.activeGuessTeam,
      guessQueue: this.guessQueue,
      clueTimerStartedAt: this.clueTimerStartedAt,
      reveal: this.reveal,
      reveals: this.reveals,
      clinchedOutcome: this.clinchedOutcome,
      tiebreakerSubmissions: this.tiebreakerSubmissions,
      tiebreakerResult: this.tiebreakerResult,
      tiebreakerHistory: this.tiebreakerHistory,
      tiebreakerRepeatRequests: this.tiebreakerRepeatRequests,
      tiebreakerRepeatUsed: this.tiebreakerRepeatUsed,
      gameWinner: this.gameWinner,
      gameEndReason: this.gameEndReason,
      clueHistory: this.clueHistory,
      guessShares: this.guessShares,
      releasedWords: this.releasedWords,
    };
  }

  override clearTimer(): void {
    if (this.clueTimer) {
      clearTimeout(this.clueTimer);
      this.clueTimer = undefined;
    }
  }

  scheduleClueTimer(onExpire: () => void): void {
    this.clearTimer();
    if (this.phase !== DecryptoPhase.CLUE || !this.clueTimerStartedAt) return;
    const remainingMs = Math.max(0, this.clueTimerStartedAt + CLUE_TIMER_SECONDS * 1000 - Date.now());
    this.clueTimer = setTimeout(() => {
      this.clueTimer = undefined;
      if (this.phase !== DecryptoPhase.CLUE || !this.clueTimerStartedAt) return;
      this.finishCluePhase();
      onExpire();
    }, remainingMs);
  }

  resetToLobby(): void {
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
    this.phase = DecryptoPhase.LOBBY;
    this.scores = cloneScores(EMPTY_SCORES);
    this.keywords = pickKeywordSets();
    this.wordLocks = { red: false, blue: false };
    this.round = 0;
    this.encryptorQueue = { red: [], blue: [] };
    this.roundTurns = undefined;
    this.activeGuessTeam = undefined;
    this.guessQueue = [];
    this.clueTimerStartedAt = undefined;
    this.clearTimer();
    this.reveal = undefined;
    this.reveals = [];
    this.clinchedOutcome = undefined;
    this.tiebreakerSubmissions = {};
    this.tiebreakerResult = undefined;
    this.tiebreakerHistory = [];
    this.tiebreakerRepeatRequests = { red: false, blue: false };
    this.tiebreakerRepeatUsed = false;
    this.gameWinner = undefined;
    this.gameEndReason = undefined;
    this.clueHistory = [];
    this.guessShares = [];
    this.releasedWords = { red: false, blue: false };
    this.touch();
  }

  assignTeam(playerId: string, team: TeamId): ActionResult {
    if (this.phase !== DecryptoPhase.LOBBY) {
      return { ok: false, message: 'Teams can only be changed in the lobby.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.removed) return { ok: false, message: 'Player not found.' };
    player.team = team;
    this.touch();
    return { ok: true };
  }

  regenerateKeyword(playerId: string, team: TeamId, index: number): ActionResult {
    if (this.phase !== DecryptoPhase.WORDS) {
      return { ok: false, message: 'Words can only be regenerated during word setup.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.team !== team) {
      return { ok: false, message: 'Only members of that team can regenerate its words.' };
    }
    if (!Number.isInteger(index) || index < 0 || index > 3) {
      return { ok: false, message: 'Choose a valid word slot.' };
    }
    if (this.wordLocks[team]) {
      return { ok: false, message: 'Unlock your team words before regenerating.' };
    }
    const existing = [...this.keywords.red, ...this.keywords.blue];
    this.keywords[team][index] = pickReplacementKeyword(existing);
    this.touch();
    return { ok: true };
  }

  setWordLock(playerId: string, team: TeamId, locked: boolean): ActionResult {
    if (this.phase !== DecryptoPhase.WORDS) {
      return { ok: false, message: 'Team words can only be locked during word setup.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.team !== team) {
      return { ok: false, message: 'Only members of that team can lock its words.' };
    }
    if (locked && this.keywords[team].length !== 4) {
      return { ok: false, message: 'Your team needs four words before locking.' };
    }
    this.wordLocks[team] = locked;
    if (this.wordLocks.red && this.wordLocks.blue) {
      this.round = 1;
      this.startRound();
    }
    this.touch();
    return { ok: true };
  }

  canStart(): boolean {
    return (
      this.getTeamPlayers('red').filter((p) => p.connected).length >= 2 &&
      this.getTeamPlayers('blue').filter((p) => p.connected).length >= 2
    );
  }

  startGame(): ActionResult {
    if (this.phase !== DecryptoPhase.LOBBY) {
      return { ok: false, message: 'The game has already started.' };
    }
    if (!this.canStart()) {
      return { ok: false, message: 'Need 2 players on each team.' };
    }

    this.scores = cloneScores(EMPTY_SCORES);
    this.wordLocks = { red: false, blue: false };
    this.round = 0;
    this.encryptorQueue = { red: [], blue: [] };
    this.clueHistory = [];
    this.guessShares = [];
    this.releasedWords = { red: false, blue: false };
    this.reveal = undefined;
    this.reveals = [];
    this.clinchedOutcome = undefined;
    this.tiebreakerSubmissions = {};
    this.tiebreakerResult = undefined;
    this.tiebreakerHistory = [];
    this.tiebreakerRepeatRequests = { red: false, blue: false };
    this.tiebreakerRepeatUsed = false;
    this.gameWinner = undefined;
    this.gameEndReason = undefined;
    this.roundTurns = undefined;
    this.activeGuessTeam = undefined;
    this.guessQueue = [];
    this.clueTimerStartedAt = undefined;
    this.clearTimer();
    this.phase = DecryptoPhase.WORDS;
    this.touch();
    return { ok: true };
  }

  saveClues(playerId: string, rawClues: unknown[]): ActionResult {
    if (this.phase !== DecryptoPhase.CLUE || !this.roundTurns) {
      return { ok: false, message: 'It is not time for clues.' };
    }
    const turn = this.getEncryptorTurn(playerId);
    if (!turn) {
      return { ok: false, message: 'Only an encryptor can edit clues.' };
    }
    if (turn.clueLocked) {
      return { ok: false, message: 'Unlock your clues before editing.' };
    }
    const clues = normalizeClues(rawClues, { allowEmpty: true });
    if (!clues) {
      return { ok: false, message: 'Submit exactly 3 clues.' };
    }
    turn.clues = clues;
    this.touch();
    return { ok: true };
  }

  lockClues(playerId: string, rawClues: unknown[]): ActionResult {
    if (this.phase !== DecryptoPhase.CLUE || !this.roundTurns) {
      return { ok: false, message: 'It is not time for clues.' };
    }
    const turn = this.getEncryptorTurn(playerId);
    if (!turn) {
      return { ok: false, message: 'Only an encryptor can lock clues.' };
    }
    const clues = normalizeClues(rawClues, { allowEmpty: false });
    if (!clues) {
      return { ok: false, message: 'Each clue must include text before locking.' };
    }
    turn.clues = clues;
    turn.clueLocked = true;
    turn.clueLockedAt = Date.now();
    if (!this.clueTimerStartedAt) this.clueTimerStartedAt = turn.clueLockedAt;
    if (TEAMS.every((team) => this.roundTurns?.[team].clueLocked)) {
      this.finishCluePhase();
    }
    this.touch();
    return { ok: true };
  }

  unlockClues(playerId: string): ActionResult {
    if (this.phase !== DecryptoPhase.CLUE || !this.roundTurns) {
      return { ok: false, message: 'It is not time for clues.' };
    }
    const turn = this.getEncryptorTurn(playerId);
    if (!turn) {
      return { ok: false, message: 'Only an encryptor can unlock clues.' };
    }
    turn.clueLocked = false;
    turn.clueLockedAt = undefined;
    if (!TEAMS.some((team) => this.roundTurns?.[team].clueLocked)) {
      this.clueTimerStartedAt = undefined;
      this.clearTimer();
    }
    this.touch();
    return { ok: true };
  }

  postGuessShare(playerId: string, team: TeamId, kind: GuessKind, code: unknown): ActionResult {
    if (this.phase !== DecryptoPhase.GUESS || !this.roundTurns) {
      return { ok: false, message: 'It is not time for guesses.' };
    }
    const turn = this.roundTurns[team];
    if (!turn) return { ok: false, message: 'Choose a valid team transmission.' };
    if (this.activeGuessTeam && team !== this.activeGuessTeam) {
      return { ok: false, message: `${this.activeGuessTeam} is resolving first.` };
    }
    if (!isValidCode(code)) {
      return { ok: false, message: 'Codes must use 3 different digits from 1 to 4.' };
    }
    const player = this.players.get(playerId);
    if (!player?.team) return { ok: false, message: 'Join a team before guessing.' };

    if (kind === 'decrypt') {
      if (player.team !== team) {
        return { ok: false, message: 'Only the transmitting team can decrypt this code.' };
      }
      if (player.id === turn.encryptorId) {
        return { ok: false, message: 'The encryptor cannot post a team guess.' };
      }
      if (turn.decryptGuess) {
        return { ok: false, message: 'Your team has already submitted a guess.' };
      }
    } else {
      if (!this.isInterceptRequired(team)) {
        return { ok: false, message: 'There is no interception attempt in round 1.' };
      }
      if (player.team !== otherTeam(team)) {
        return { ok: false, message: 'Only the opposing team can intercept.' };
      }
      if (turn.interceptGuess) {
        return { ok: false, message: 'Your team has already submitted an intercept.' };
      }
    }

    const share: GuessShare = {
      round: this.round,
      playerId,
      playerName: player.name,
      playerTeam: player.team,
      targetTeam: team,
      kind,
      code: cloneCode(code),
      updatedAt: Date.now(),
    };
    const existingIndex = this.guessShares.findIndex(
      (existing) =>
        existing.round === share.round &&
        existing.playerId === share.playerId &&
        existing.targetTeam === share.targetTeam &&
        existing.kind === share.kind,
    );
    if (existingIndex >= 0) this.guessShares[existingIndex] = share;
    else this.guessShares.push(share);
    this.touch();
    return { ok: true };
  }

  submitGuess(playerId: string, team: TeamId, kind: GuessKind, code: unknown): ActionResult {
    if (this.phase !== DecryptoPhase.GUESS || !this.roundTurns) {
      return { ok: false, message: 'It is not time for guesses.' };
    }
    const turn = this.roundTurns[team];
    if (!turn) return { ok: false, message: 'Choose a valid team transmission.' };
    if (this.activeGuessTeam && team !== this.activeGuessTeam) {
      return { ok: false, message: `${this.activeGuessTeam} is resolving first.` };
    }
    if (!isValidCode(code)) {
      return { ok: false, message: 'Codes must use 3 different digits from 1 to 4.' };
    }
    const player = this.players.get(playerId);
    if (!player?.team) return { ok: false, message: 'Join a team before guessing.' };

    if (kind === 'decrypt') {
      if (player.team !== team) {
        return { ok: false, message: 'Only the transmitting team can decrypt this code.' };
      }
      if (player.id === turn.encryptorId) {
        return { ok: false, message: 'The encryptor cannot submit the team guess.' };
      }
      if (turn.decryptGuess) {
        return { ok: false, message: 'Your team has already submitted a guess.' };
      }
      turn.decryptGuess = cloneCode(code);
    } else {
      if (!this.isInterceptRequired(team)) {
        return { ok: false, message: 'There is no interception attempt in round 1.' };
      }
      if (player.team !== otherTeam(team)) {
        return { ok: false, message: 'Only the opposing team can intercept.' };
      }
      if (turn.interceptGuess) {
        return { ok: false, message: 'Your team has already submitted an intercept.' };
      }
      turn.interceptGuess = cloneCode(code);
    }

    this.resolveReadyGuesses();
    this.touch();
    return { ok: true };
  }

  continueFromReveal(playerId?: string): ActionResult {
    if (this.phase !== DecryptoPhase.REVEAL) {
      return { ok: false, message: 'There is no revealed turn to continue from.' };
    }
    if (this.clinchedOutcome && playerId) {
      const player = this.players.get(playerId);
      if (player?.team !== this.clinchedOutcome.winner) {
        return { ok: false, message: 'Only the clinching team can choose to play the extra turn.' };
      }
    }

    const nextTeam = this.guessQueue.shift();
    if (nextTeam) {
      this.activeGuessTeam = nextTeam;
      this.phase = DecryptoPhase.GUESS;
      this.reveal = undefined;
      this.reveals = [];
      this.clinchedOutcome = undefined;
      this.guessShares = [];
      this.touch();
      return { ok: true };
    }

    this.round += 1;
    this.clinchedOutcome = undefined;
    this.startRound();
    this.touch();
    return { ok: true };
  }

  takeClinchedWin(playerId: string): ActionResult {
    if (this.phase !== DecryptoPhase.REVEAL || !this.clinchedOutcome) {
      return { ok: false, message: 'There is no clinched win to take.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.team !== this.clinchedOutcome.winner) {
      return { ok: false, message: 'Only the clinching team can take the win.' };
    }
    this.finishGame(this.clinchedOutcome.winner, this.clinchedOutcome.reason);
    this.clinchedOutcome = undefined;
    this.touch();
    return { ok: true };
  }

  finishCluePhase(): void {
    if (this.phase !== DecryptoPhase.CLUE || !this.roundTurns) return;
    for (const team of TEAMS) {
      const turn = this.roundTurns[team];
      turn.clues = fillClues(turn.clues);
      turn.clueLocked = true;
      turn.clueLockedAt ??= Date.now();
    }
    this.clueTimerStartedAt = undefined;
    this.clearTimer();
    this.reveal = undefined;
    this.reveals = [];
    this.clinchedOutcome = undefined;
    this.phase = DecryptoPhase.GUESS;
    this.guessShares = [];
    if (this.round === 1) {
      this.activeGuessTeam = undefined;
      this.guessQueue = [];
    } else {
      this.activeGuessTeam = 'red';
      this.guessQueue = ['blue'];
    }
    this.touch();
  }

  getPublicTurnState(): PublicTurnState | null {
    if (!this.roundTurns || this.phase === DecryptoPhase.LOBBY) return null;
    const showClues = this.phase !== DecryptoPhase.CLUE;
    return {
      round: this.round,
      ...(this.activeGuessTeam ? { activeGuessTeam: this.activeGuessTeam } : {}),
      ...(this.clueTimerStartedAt && this.phase === DecryptoPhase.CLUE
        ? {
            clueTimer: {
              startedAt: this.clueTimerStartedAt,
              durationSeconds: CLUE_TIMER_SECONDS,
              expiresAt: this.clueTimerStartedAt + CLUE_TIMER_SECONDS * 1000,
            },
          }
        : {}),
      teams: {
        red: this.getPublicTeamTurnState('red', showClues),
        blue: this.getPublicTeamTurnState('blue', showClues),
      },
    };
  }

  getPrivateStateFor(playerId: string): PrivateTeamState {
    const player = this.players.get(playerId);
    const team = player?.team;
    const turn = team ? this.roundTurns?.[team] : undefined;
    const isEncryptor = !!turn && turn.encryptorId === playerId && this.phase === DecryptoPhase.CLUE;
    const showTeamWords = !!team && this.phase !== DecryptoPhase.LOBBY;
    return {
      team,
      ...(showTeamWords && team ? { keywords: [...this.keywords[team]], wordsLocked: this.wordLocks[team] } : {}),
      isEncryptor,
      ...(isEncryptor && turn ? { code: cloneCode(turn.code) } : {}),
      guessShares: this.getGuessSharesFor(playerId),
    };
  }

  getTeamPlayers(team: TeamId): DecryptoPlayer[] {
    return Array.from(this.players.values()).filter((p) => p.team === team && !p.removed);
  }

  submitTiebreaker(playerId: string, rawGuesses: unknown): ActionResult {
    if (this.phase !== DecryptoPhase.TIEBREAKER) {
      return { ok: false, message: 'There is no tiebreaker to submit.' };
    }
    const player = this.players.get(playerId);
    if (!player?.team) return { ok: false, message: 'Join a team before submitting tiebreaker guesses.' };
    if (this.tiebreakerSubmissions[player.team]) {
      return { ok: false, message: 'Your team already submitted its tiebreaker guesses.' };
    }
    const guessResult = sanitizeTiebreakerGuesses(rawGuesses, this.settings.tiebreakerVocabularyMode);
    if (!guessResult.ok) {
      return { ok: false, message: guessResult.message };
    }

    this.tiebreakerSubmissions[player.team] = {
      team: player.team,
      guesses: guessResult.guesses,
      submittedById: playerId,
      submittedByName: player.name,
      submittedAt: Date.now(),
    };

    if (TEAMS.every((team) => this.tiebreakerSubmissions[team])) {
      this.resolveTiebreaker();
    }

    this.touch();
    return { ok: true };
  }

  setTiebreakerVocabularyMode(playerId: string, mode: unknown): ActionResult {
    if (playerId !== this.hostId) {
      return { ok: false, message: 'Only the host can change the tiebreaker word pool.' };
    }
    if (this.phase !== DecryptoPhase.TIEBREAKER) {
      return { ok: false, message: 'The tiebreaker word pool can only be changed during the tiebreaker.' };
    }
    if (mode !== 'english' && mode !== 'word-bank') {
      return { ok: false, message: 'Choose a valid tiebreaker word pool.' };
    }
    if (TEAMS.some((team) => this.tiebreakerSubmissions[team])) {
      return { ok: false, message: 'Change the tiebreaker word pool before either team submits.' };
    }
    if (this.settings.tiebreakerVocabularyMode !== mode) {
      this.settings.tiebreakerVocabularyMode = mode;
      this.touch();
    }
    return { ok: true };
  }

  requestTiebreakerRepeat(playerId: string): ActionResult {
    if (!this.canRepeatTiebreaker()) {
      return { ok: false, message: 'The tiebreaker cannot be repeated.' };
    }
    const player = this.players.get(playerId);
    if (!player?.team) return { ok: false, message: 'Join a team before requesting another tiebreaker.' };

    this.tiebreakerRepeatRequests[player.team] = true;
    if (TEAMS.every((team) => this.tiebreakerRepeatRequests[team])) {
      if (this.tiebreakerResult) this.tiebreakerHistory.push(cloneTiebreakerResult(this.tiebreakerResult));
      this.tiebreakerRepeatUsed = true;
      this.startTiebreaker();
    }
    this.touch();
    return { ok: true };
  }

  releaseWords(playerId: string, team: TeamId): ActionResult {
    if (this.phase !== DecryptoPhase.GAME_OVER) {
      return { ok: false, message: 'Words can only be released after the game ends.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.team !== team) {
      return { ok: false, message: 'Only members of that team can release its words.' };
    }
    if (!this.releasedWords[team]) {
      this.releasedWords[team] = true;
      this.touch();
    }
    return { ok: true };
  }

  getFinalGameState(): FinalGameState | null {
    if (this.phase !== DecryptoPhase.GAME_OVER) return null;
    const keywords: Partial<Record<TeamId, string[]>> = {};
    for (const team of TEAMS) {
      if (this.releasedWords[team]) keywords[team] = [...this.keywords[team]];
    }
    return {
      keywords,
      releasedWords: cloneReleaseState(this.releasedWords),
      scores: cloneScores(this.scores),
      clueHistory: this.clueHistory.map(cloneRecord),
      ...(this.gameWinner ? { winner: this.gameWinner } : {}),
      ...(this.gameEndReason ? { reason: this.gameEndReason } : {}),
      ...(this.tiebreakerResult ? { tiebreaker: cloneTiebreakerResult(this.tiebreakerResult) } : {}),
    };
  }

  getPublicTiebreakerState(): PublicTiebreakerState | null {
    if (this.phase !== DecryptoPhase.TIEBREAKER && !this.tiebreakerResult) return null;
    return {
      submissions: {
        red: this.tiebreakerSubmissions.red
          ? {
              submitted: true,
              submittedByName: this.tiebreakerSubmissions.red.submittedByName,
              submittedAt: this.tiebreakerSubmissions.red.submittedAt,
            }
          : { submitted: false },
        blue: this.tiebreakerSubmissions.blue
          ? {
              submitted: true,
              submittedByName: this.tiebreakerSubmissions.blue.submittedByName,
              submittedAt: this.tiebreakerSubmissions.blue.submittedAt,
            }
          : { submitted: false },
      },
      vocabularyMode: this.settings.tiebreakerVocabularyMode,
      ...(this.phase === DecryptoPhase.TIEBREAKER ? { vocabulary: [...this.getTiebreakerVocabulary()] } : {}),
      ...(this.tiebreakerResult ? { result: cloneTiebreakerResult(this.tiebreakerResult) } : {}),
      ...(this.tiebreakerHistory.length > 0 ? { history: this.tiebreakerHistory.map(cloneTiebreakerResult) } : {}),
      ...(this.tiebreakerResult
        ? {
            repeat: {
              available: this.canRepeatTiebreaker(),
              used: this.tiebreakerRepeatUsed,
              requests: cloneTeamBooleans(this.tiebreakerRepeatRequests),
            },
          }
        : {}),
    };
  }

  getPublicClinchedOutcome(): PublicClinchedOutcome | null {
    return this.clinchedOutcome ? { ...this.clinchedOutcome } : null;
  }

  private startRound(): void {
    this.roundTurns = {
      red: this.createTurn('red'),
      blue: this.createTurn('blue'),
    };
    this.activeGuessTeam = undefined;
    this.guessQueue = [];
    this.guessShares = [];
    this.clueTimerStartedAt = undefined;
    this.clearTimer();
    this.reveal = undefined;
    this.reveals = [];
    this.clinchedOutcome = undefined;
    this.phase = DecryptoPhase.CLUE;
  }

  private createTurn(team: TeamId): TeamTurn {
    const encryptor = this.pickEncryptor(team);
    return {
      round: this.round,
      team,
      encryptorId: encryptor.id,
      code: this.pickCode(),
      clues: createEmptyClues(),
      clueLocked: false,
      revealed: false,
    };
  }

  private pickEncryptor(team: TeamId): DecryptoPlayer {
    const players = this.getTeamPlayers(team).filter((p) => p.connected);
    const candidates = players.length > 0 ? players : this.getTeamPlayers(team);
    if (candidates.length === 0) {
      logger.warn('game', 'No players available for encryptor; falling back to host', { room: this.code, team });
      const host = this.players.get(this.hostId);
      if (host) return host;
      throw new Error(`No encryptor candidates for ${team}`);
    }
    const candidateIds = new Set(candidates.map((player) => player.id));
    let queue = this.encryptorQueue[team].filter((playerId) => candidateIds.has(playerId));
    if (queue.length === 0) queue = candidates.map((player) => player.id);

    const selectedId = queue.shift();
    this.encryptorQueue[team] = queue;
    const selected = selectedId ? this.players.get(selectedId) : undefined;
    if (selected && !selected.removed) return selected;
    return candidates[0];
  }

  private pickCode(): Code {
    const digits = [...CODE_DIGITS];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits.slice(0, 3) as [CodeDigit, CodeDigit, CodeDigit];
  }

  private getEncryptorTurn(playerId: string): TeamTurn | null {
    if (!this.roundTurns) return null;
    for (const team of TEAMS) {
      const turn = this.roundTurns[team];
      if (turn.encryptorId === playerId) return turn;
    }
    return null;
  }

  private getPublicTeamTurnState(team: TeamId, showClues: boolean): PublicTeamTurnState {
    const turn = this.roundTurns?.[team];
    if (!turn) {
      return {
        round: this.round,
        team,
        encryptorId: '',
        clueLocked: false,
        clues: [],
        guesses: {
          decryptSubmitted: false,
          interceptSubmitted: false,
          interceptRequired: this.round > 1,
        },
        revealed: false,
      };
    }
    return {
      round: turn.round,
      team,
      encryptorId: turn.encryptorId,
      clueLocked: turn.clueLocked,
      ...(turn.clueLockedAt ? { clueLockedAt: turn.clueLockedAt } : {}),
      clues: showClues ? [...turn.clues] : [],
      guesses: {
        decryptSubmitted: !!turn.decryptGuess,
        interceptSubmitted: !!turn.interceptGuess,
        interceptRequired: this.isInterceptRequired(team),
      },
      revealed: turn.revealed,
    };
  }

  private isInterceptRequired(team: TeamId): boolean {
    return !!this.roundTurns?.[team] && this.round > 1;
  }

  private getGuessSharesFor(playerId: string): GuessShare[] {
    const player = this.players.get(playerId);
    if (this.phase !== DecryptoPhase.GUESS || !player?.team) return [];
    return this.guessShares
      .filter((share) => share.round === this.round && share.playerTeam === player.team)
      .map(cloneGuessShare);
  }

  private isTurnReadyToReveal(team: TeamId): boolean {
    const turn = this.roundTurns?.[team];
    if (!turn?.decryptGuess) return false;
    return !this.isInterceptRequired(team) || !!turn.interceptGuess;
  }

  private resolveReadyGuesses(): void {
    if (!this.roundTurns) return;
    if (this.round === 1) {
      if (TEAMS.every((team) => this.isTurnReadyToReveal(team))) {
        for (const team of TEAMS) this.revealTurn(team);
        this.finalizeTerminalOutcomeIfReady();
        if (this.phase === DecryptoPhase.GUESS) this.phase = DecryptoPhase.REVEAL;
      }
      return;
    }

    const activeTeam = this.activeGuessTeam;
    if (!activeTeam || !this.isTurnReadyToReveal(activeTeam)) return;
    this.revealTurn(activeTeam);
    this.finalizeTerminalOutcomeIfReady();
    if (this.phase === DecryptoPhase.GUESS) this.phase = DecryptoPhase.REVEAL;
  }

  private revealTurn(team: TeamId): void {
    const turn = this.roundTurns?.[team];
    if (!turn?.decryptGuess || turn.revealed) return;
    const opponent = otherTeam(team);
    const decryptCorrect = codesEqual(turn.decryptGuess, turn.code);
    const interceptCorrect = codesEqual(turn.interceptGuess, turn.code);

    if (interceptCorrect) this.scores[opponent].intercepts += 1;
    if (!decryptCorrect) this.scores[team].miscommunications += 1;

    const encryptor = this.players.get(turn.encryptorId);
    const record: ClueRecord = {
      round: turn.round,
      team,
      encryptorId: turn.encryptorId,
      encryptorName: encryptor?.name ?? 'Unknown',
      code: cloneCode(turn.code),
      clues: [...turn.clues],
      decryptGuess: cloneCode(turn.decryptGuess),
      ...(turn.interceptGuess ? { interceptGuess: cloneCode(turn.interceptGuess) } : {}),
      decryptCorrect,
      interceptCorrect,
    };
    turn.revealed = true;
    this.clueHistory.push(record);
    const reveal: RevealState = {
      ...cloneRecord(record),
      gameOver: false,
    };
    this.reveal = reveal;
    this.reveals.push(reveal);
  }

  private getTerminalOutcomes(): TerminalOutcome[] {
    const outcomes: TerminalOutcome[] = [];
    if (this.scores.red.intercepts >= this.settings.maxIntercepts) {
      outcomes.push({ team: 'red', reason: 'interceptions' });
    } else if (this.scores.blue.miscommunications >= this.settings.maxMiscommunications) {
      outcomes.push({ team: 'red', reason: 'miscommunications' });
    }

    if (this.scores.blue.intercepts >= this.settings.maxIntercepts) {
      outcomes.push({ team: 'blue', reason: 'interceptions' });
    } else if (this.scores.red.miscommunications >= this.settings.maxMiscommunications) {
      outcomes.push({ team: 'blue', reason: 'miscommunications' });
    }

    return outcomes;
  }

  private hasUnrevealedTurnThisRound(): boolean {
    return TEAMS.some((team) => {
      const turn = this.roundTurns?.[team];
      return !!turn && !turn.revealed;
    });
  }

  private getUnrevealedTurnTeam(): TeamId | undefined {
    return TEAMS.find((team) => {
      const turn = this.roundTurns?.[team];
      return !!turn && !turn.revealed;
    });
  }

  private finalizeTerminalOutcomeIfReady(): void {
    const outcomes = this.getTerminalOutcomes();
    if (outcomes.length === 0) return;
    const unrevealedTeam = this.getUnrevealedTurnTeam();
    if (unrevealedTeam) {
      if (
        outcomes.length === 1 &&
        !this.canUnrevealedTurnCreateOutcomeFor(otherTeam(outcomes[0].team), unrevealedTeam)
      ) {
        this.clinchedOutcome = {
          winner: outcomes[0].team,
          reason: outcomes[0].reason,
          pendingTeam: unrevealedTeam,
        };
      }
      return;
    }
    const scoreTiebreakOutcome = this.getScoreTiebreakOutcome(outcomes);
    if (!scoreTiebreakOutcome) {
      this.startTiebreaker();
      return;
    }
    this.finishGame(scoreTiebreakOutcome.team, scoreTiebreakOutcome.reason);
  }

  private canUnrevealedTurnCreateOutcomeFor(team: TeamId, unrevealedTeam: TeamId): boolean {
    const simulated = cloneScores(this.scores);
    const opponent = otherTeam(unrevealedTeam);
    simulated[opponent].intercepts += 1;
    simulated[unrevealedTeam].miscommunications += 1;
    return (
      simulated[team].intercepts >= this.settings.maxIntercepts ||
      simulated[otherTeam(team)].miscommunications >= this.settings.maxMiscommunications
    );
  }

  private getScoreTiebreakOutcome(outcomes: TerminalOutcome[]): TerminalOutcome | null {
    if (outcomes.length === 1) return outcomes[0];
    if (this.scores.red.intercepts !== this.scores.blue.intercepts) {
      const winner = this.scores.red.intercepts > this.scores.blue.intercepts ? 'red' : 'blue';
      return outcomes.find((outcome) => outcome.team === winner) ?? { team: winner, reason: 'interceptions' };
    }
    if (this.scores.red.miscommunications !== this.scores.blue.miscommunications) {
      const winner = this.scores.red.miscommunications < this.scores.blue.miscommunications ? 'red' : 'blue';
      return outcomes.find((outcome) => outcome.team === winner) ?? { team: winner, reason: 'miscommunications' };
    }
    return null;
  }

  private finishGame(winner: GameWinner, reason: GameEndReason): void {
    this.gameWinner = winner;
    this.gameEndReason = reason;
    this.clinchedOutcome = undefined;
    if (winner !== 'tie' && (reason === 'interceptions' || reason === 'miscommunications') && this.reveal) {
      this.reveal.gameOver = true;
      this.reveal.winner = winner;
      this.reveal.reason = reason;
    }
    this.activeGuessTeam = undefined;
    this.guessQueue = [];
    this.guessShares = [];
    this.phase = DecryptoPhase.GAME_OVER;
  }

  private startTiebreaker(): void {
    this.phase = DecryptoPhase.TIEBREAKER;
    this.activeGuessTeam = undefined;
    this.guessQueue = [];
    this.guessShares = [];
    this.tiebreakerSubmissions = {};
    this.tiebreakerResult = undefined;
    this.tiebreakerRepeatRequests = { red: false, blue: false };
    this.gameWinner = undefined;
    this.gameEndReason = undefined;
  }

  private getTiebreakerVocabulary(): readonly string[] {
    return this.settings.tiebreakerVocabularyMode === 'word-bank' ? getKeywordVocabulary() : getTiebreakerVocabulary();
  }

  private canRepeatTiebreaker(): boolean {
    return (
      this.phase === DecryptoPhase.GAME_OVER &&
      this.gameWinner === 'tie' &&
      this.gameEndReason === 'tie' &&
      this.tiebreakerResult?.reason === 'tie' &&
      !this.tiebreakerRepeatUsed
    );
  }

  private scoreTiebreakerTeam(team: TeamId): TiebreakerResult['results'][TeamId] {
    const submission = this.tiebreakerSubmissions[team];
    if (!submission) throw new Error(`Missing tiebreaker submission for ${team}`);
    const targetTeam = otherTeam(team);
    const targetWords = this.keywords[targetTeam];
    let exactMatches = 0;
    const slotScores = submission.guesses.map((guess, index) => {
      const targetWord = targetWords[index] ?? '';
      const exact = normalizeSemanticAnswer(guess) === normalizeSemanticAnswer(targetWord);
      if (exact) exactMatches += 1;
      return exact ? 1 : semanticSimilarity(guess, targetWord);
    });
    const similarityScore = slotScores.reduce((sum, score) => sum + score, 0) / TIEBREAKER_GUESS_COUNT;
    return {
      team,
      targetTeam,
      guesses: [...submission.guesses],
      exactMatches,
      similarityScore,
      slotScores,
    };
  }

  private resolveTiebreaker(): void {
    const red = this.scoreTiebreakerTeam('red');
    const blue = this.scoreTiebreakerTeam('blue');
    let winner: GameWinner = 'tie';
    let reason: TiebreakerResult['reason'] = 'tie';

    if (red.exactMatches !== blue.exactMatches) {
      winner = red.exactMatches > blue.exactMatches ? 'red' : 'blue';
      reason = 'exact';
    } else {
      const similarityDifference = red.similarityScore - blue.similarityScore;
      if (Math.abs(similarityDifference) > TIEBREAKER_SIMILARITY_THRESHOLD) {
        winner = similarityDifference > 0 ? 'red' : 'blue';
        reason = 'similarity';
      }
    }

    this.tiebreakerResult = {
      winner,
      reason,
      similarityThreshold: TIEBREAKER_SIMILARITY_THRESHOLD,
      results: { red, blue },
    };
    this.finishGame(
      winner,
      reason === 'exact' ? 'tiebreaker-exact' : reason === 'similarity' ? 'tiebreaker-similarity' : 'tie',
    );
  }

  static fromJSON(data: unknown): DecryptoRoom {
    const d = data as PersistedDecryptoRoom;
    const room = new DecryptoRoom(d.code, d.hostId);
    room.lastActivity = d.lastActivity ?? Date.now();
    room.settings = { ...room.settings, ...d.settings };
    const validPhases = Object.values(DecryptoPhase) as string[];
    if (d.phase !== undefined && validPhases.includes(d.phase)) {
      room.phase = d.phase as DecryptoPhase;
    }
    room.scores = d.scores ?? cloneScores(EMPTY_SCORES);
    room.keywords = d.keywords ?? pickKeywordSets();
    room.wordLocks = d.wordLocks ?? { red: false, blue: false };
    room.round = d.round ?? 0;
    room.encryptorQueue = {
      red: d.encryptorQueue?.red ?? [],
      blue: d.encryptorQueue?.blue ?? [],
    };
    room.roundTurns = d.roundTurns
      ? {
          red: cloneTurn(d.roundTurns.red),
          blue: cloneTurn(d.roundTurns.blue),
        }
      : undefined;
    if (room.phase !== DecryptoPhase.LOBBY && !room.roundTurns) room.phase = DecryptoPhase.LOBBY;
    room.activeGuessTeam = d.activeGuessTeam;
    room.guessQueue = d.guessQueue ?? [];
    room.clueTimerStartedAt = d.clueTimerStartedAt;
    room.reveal = d.reveal ? cloneReveal(d.reveal) : undefined;
    room.reveals = (d.reveals ?? (d.reveal ? [d.reveal] : [])).map(cloneReveal);
    if (
      (d.clinchedOutcome?.winner === 'red' || d.clinchedOutcome?.winner === 'blue') &&
      (d.clinchedOutcome.pendingTeam === 'red' || d.clinchedOutcome.pendingTeam === 'blue') &&
      (d.clinchedOutcome.reason === 'interceptions' || d.clinchedOutcome.reason === 'miscommunications')
    ) {
      room.clinchedOutcome = { ...d.clinchedOutcome };
    }
    room.tiebreakerSubmissions = {};
    for (const team of TEAMS) {
      const submission = d.tiebreakerSubmissions?.[team];
      if (submission) room.tiebreakerSubmissions[team] = cloneTiebreakerSubmission(submission);
    }
    room.tiebreakerResult = d.tiebreakerResult ? cloneTiebreakerResult(d.tiebreakerResult) : undefined;
    room.tiebreakerHistory = (d.tiebreakerHistory ?? []).map(cloneTiebreakerResult);
    room.tiebreakerRepeatRequests = {
      red: d.tiebreakerRepeatRequests?.red ?? false,
      blue: d.tiebreakerRepeatRequests?.blue ?? false,
    };
    room.tiebreakerRepeatUsed = d.tiebreakerRepeatUsed ?? false;
    if (d.gameWinner === 'red' || d.gameWinner === 'blue' || d.gameWinner === 'tie') {
      room.gameWinner = d.gameWinner;
    }
    room.gameEndReason = d.gameEndReason;
    if (!room.gameWinner && room.reveal?.winner) room.gameWinner = room.reveal.winner;
    if (!room.gameEndReason && room.reveal?.reason) room.gameEndReason = room.reveal.reason;
    room.clueHistory = (d.clueHistory ?? []).map(cloneRecord);
    room.guessShares = (d.guessShares ?? []).map(cloneGuessShare);
    room.releasedWords = {
      red: d.releasedWords?.red ?? false,
      blue: d.releasedWords?.blue ?? false,
    };
    room.restorePlayers({ players: d.players });
    return room;
  }
}
