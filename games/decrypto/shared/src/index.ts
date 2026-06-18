import type { BasePlayer, BasePlayerDTO, RoomDTO, RoomSettings } from '@games/server-core';

export type TeamId = 'red' | 'blue';

export type GameWinner = TeamId | 'tie';

export type CodeDigit = 1 | 2 | 3 | 4;

export type Code = [CodeDigit, CodeDigit, CodeDigit];

export type GuessKind = 'decrypt' | 'intercept';

export type TiebreakerVocabularyMode = 'english' | 'word-bank';

export type ClueContent = { kind: 'text'; text: string } | { kind: 'drawing'; dataUrl: string };

export interface GuessShare {
  round: number;
  playerId: string;
  playerName: string;
  playerTeam: TeamId;
  targetTeam: TeamId;
  kind: GuessKind;
  code: Code;
  updatedAt: number;
}

export const DECRYPTO_CODE_LENGTH = 3;

export const CODE_DIGITS: CodeDigit[] = [1, 2, 3, 4];

export const CLUE_TIMER_SECONDS = 30;

export const MAX_DRAWING_DATA_URL_LENGTH = 160_000;

export const DecryptoPhase = {
  LOBBY: 'lobby',
  WORDS: 'words',
  CLUE: 'clue',
  GUESS: 'guess',
  REVEAL: 'reveal',
  TIEBREAKER: 'tiebreaker',
  GAME_OVER: 'gameOver',
} as const;

export type DecryptoPhase = (typeof DecryptoPhase)[keyof typeof DecryptoPhase];

export interface DecryptoPlayer extends BasePlayer {
  team?: TeamId;
}

export interface DecryptoPlayerDTO extends BasePlayerDTO {
  team?: TeamId;
  isEncryptor?: boolean;
}

export interface DecryptoSettings extends RoomSettings {
  maxIntercepts: number;
  maxMiscommunications: number;
  tiebreakerVocabularyMode: TiebreakerVocabularyMode;
}

export interface TeamScore {
  intercepts: number;
  miscommunications: number;
}

export type ScoreBoard = Record<TeamId, TeamScore>;

export interface PublicTeamTurnState {
  round: number;
  team: TeamId;
  encryptorId: string;
  clueLocked: boolean;
  clueLockedAt?: number;
  clues: ClueContent[];
  guesses: {
    decryptSubmitted: boolean;
    interceptSubmitted: boolean;
    interceptRequired: boolean;
  };
  revealed: boolean;
}

export interface ClueTimerState {
  startedAt: number;
  durationSeconds: number;
  expiresAt: number;
}

export interface PublicTurnState {
  round: number;
  activeGuessTeam?: TeamId;
  clueTimer?: ClueTimerState;
  teams: Record<TeamId, PublicTeamTurnState>;
}

export interface PrivateTeamState {
  team?: TeamId;
  keywords?: string[];
  wordsLocked?: boolean;
  isEncryptor: boolean;
  code?: Code;
  guessShares?: GuessShare[];
}

export interface ClueRecord {
  round: number;
  team: TeamId;
  encryptorId: string;
  encryptorName: string;
  code: Code;
  clues: ClueContent[];
  decryptGuess?: Code;
  interceptGuess?: Code;
  decryptCorrect: boolean;
  interceptCorrect: boolean;
}

export type StandardGameEndReason = 'interceptions' | 'miscommunications';

export type GameEndReason = StandardGameEndReason | 'tiebreaker-exact' | 'tiebreaker-similarity' | 'tie';

export interface RevealState extends ClueRecord {
  gameOver: boolean;
  winner?: TeamId;
  reason?: StandardGameEndReason;
}

export interface PublicClinchedOutcome {
  winner: TeamId;
  reason: StandardGameEndReason;
  pendingTeam: TeamId;
}

export interface TiebreakerSubmission {
  team: TeamId;
  guesses: string[];
  submittedById: string;
  submittedByName: string;
  submittedAt: number;
}

export interface PublicTiebreakerSubmission {
  submitted: boolean;
  submittedByName?: string;
  submittedAt?: number;
}

export interface TiebreakerTeamResult {
  team: TeamId;
  targetTeam: TeamId;
  guesses: string[];
  exactMatches: number;
  similarityScore: number;
  slotScores: number[];
}

export interface TiebreakerResult {
  winner: GameWinner;
  reason: 'exact' | 'similarity' | 'tie';
  similarityThreshold: number;
  results: Record<TeamId, TiebreakerTeamResult>;
}

export interface PublicTiebreakerRepeatState {
  available: boolean;
  used: boolean;
  requests: Record<TeamId, boolean>;
}

export interface PublicTiebreakerState {
  submissions: Record<TeamId, PublicTiebreakerSubmission>;
  vocabularyMode: TiebreakerVocabularyMode;
  vocabulary?: string[];
  result?: TiebreakerResult;
  history?: TiebreakerResult[];
  repeat?: PublicTiebreakerRepeatState;
}

export interface FinalGameState {
  keywords: Partial<Record<TeamId, string[]>>;
  releasedWords: Record<TeamId, boolean>;
  scores: ScoreBoard;
  clueHistory: ClueRecord[];
  winner?: GameWinner;
  reason?: GameEndReason;
  tiebreaker?: TiebreakerResult;
}

export interface DecryptoRoomDTO extends RoomDTO {
  players: DecryptoPlayerDTO[];
  settings: DecryptoSettings;
  phase: DecryptoPhase | null;
  scores: ScoreBoard;
  wordLocks: Record<TeamId, boolean>;
  turn: PublicTurnState | null;
  reveal: RevealState | null;
  reveals: RevealState[];
  clinchedOutcome: PublicClinchedOutcome | null;
  tiebreaker: PublicTiebreakerState | null;
  clueHistory: ClueRecord[];
  finalState: FinalGameState | null;
}

export const DecryptoEvent = {
  JoinTeam: 'decrypto:joinTeam',
  RegenerateKeyword: 'decrypto:regenerateKeyword',
  SetWordLock: 'decrypto:setWordLock',
  StartGame: 'decrypto:startGame',
  SaveClues: 'decrypto:saveClues',
  SubmitClues: 'decrypto:submitClues',
  UnlockClues: 'decrypto:unlockClues',
  PostGuessShare: 'decrypto:postGuessShare',
  SubmitGuess: 'decrypto:submitGuess',
  SetTiebreakerVocabularyMode: 'decrypto:setTiebreakerVocabularyMode',
  SubmitTiebreaker: 'decrypto:submitTiebreaker',
  RequestTiebreakerRepeat: 'decrypto:requestTiebreakerRepeat',
  TakeWin: 'decrypto:takeWin',
  ReleaseWords: 'decrypto:releaseWords',
  Continue: 'decrypto:continue',
  ResetGame: 'decrypto:resetGame',
  RequestPrivateState: 'decrypto:requestPrivateState',
  StateUpdated: 'decrypto:stateUpdated',
  PrivateStateUpdated: 'decrypto:privateStateUpdated',
} as const;

export type DecryptoEvent = (typeof DecryptoEvent)[keyof typeof DecryptoEvent];

export interface JoinTeamPayload {
  team: TeamId;
}

export interface RegenerateKeywordPayload {
  team: TeamId;
  index: number;
}

export interface SetWordLockPayload {
  team: TeamId;
  locked: boolean;
}

export type StartGamePayload = Record<string, never>;

export interface SubmitCluesPayload {
  clues: ClueContent[];
}

export interface SubmitGuessPayload {
  team: TeamId;
  kind: GuessKind;
  code: Code;
}

export type PostGuessSharePayload = SubmitGuessPayload;

export interface SubmitTiebreakerPayload {
  guesses: string[];
}

export interface SetTiebreakerVocabularyModePayload {
  mode: TiebreakerVocabularyMode;
}

export interface ReleaseWordsPayload {
  team: TeamId;
}

export interface DecryptoRejoinGame {
  phase: DecryptoPhase;
  private: PrivateTeamState;
  turn?: PublicTurnState | null;
  reveal?: RevealState | null;
  reveals?: RevealState[];
  clinchedOutcome?: PublicClinchedOutcome | null;
  tiebreaker?: PublicTiebreakerState | null;
}

export interface DecryptoClientToServerEvents {
  [DecryptoEvent.JoinTeam]: (payload: JoinTeamPayload) => void;
  [DecryptoEvent.RegenerateKeyword]: (payload: RegenerateKeywordPayload) => void;
  [DecryptoEvent.SetWordLock]: (payload: SetWordLockPayload) => void;
  [DecryptoEvent.StartGame]: (payload: StartGamePayload) => void;
  [DecryptoEvent.SaveClues]: (payload: SubmitCluesPayload) => void;
  [DecryptoEvent.SubmitClues]: (payload: SubmitCluesPayload) => void;
  [DecryptoEvent.UnlockClues]: () => void;
  [DecryptoEvent.PostGuessShare]: (payload: PostGuessSharePayload) => void;
  [DecryptoEvent.SubmitGuess]: (payload: SubmitGuessPayload) => void;
  [DecryptoEvent.SetTiebreakerVocabularyMode]: (payload: SetTiebreakerVocabularyModePayload) => void;
  [DecryptoEvent.SubmitTiebreaker]: (payload: SubmitTiebreakerPayload) => void;
  [DecryptoEvent.RequestTiebreakerRepeat]: () => void;
  [DecryptoEvent.TakeWin]: () => void;
  [DecryptoEvent.ReleaseWords]: (payload: ReleaseWordsPayload) => void;
  [DecryptoEvent.Continue]: () => void;
  [DecryptoEvent.ResetGame]: () => void;
  [DecryptoEvent.RequestPrivateState]: () => void;
}

export interface DecryptoServerToClientEvents {
  [DecryptoEvent.StateUpdated]: (payload: { room: DecryptoRoomDTO }) => void;
  [DecryptoEvent.PrivateStateUpdated]: (payload: { private: PrivateTeamState }) => void;
}
