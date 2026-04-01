import type { Player, PlayerDTO, RoomSettings as BaseRoomSettings } from '@games/shared-types';

export type { Player, PlayerDTO };

export const GamePhase = {
  LOBBY: 'LOBBY',
  PARALLEL_SETUP: 'PARALLEL_SETUP',
  CLUING_A: 'CLUING_A',
  CLUING_B: 'CLUING_B',
  ROUND_RESULT: 'ROUND_RESULT',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface WordCard {
  word: string;
  result: 'correct' | null;
}

export interface AdtabooBuzzes {
  [tabooWord: string]: number;
}

export interface ChallengeSetup {
  cards: WordCard[];
  tabooWords: string[];
  tabooSuggestions: string[];
  tabooBuzzes: AdtabooBuzzes;
  ready: boolean;
  clueGiverId: string | null;
}

export interface TurnScoreData {
  correct: number;
  missed: number;
  buzzes: number;
  points: number;
}

export interface AdtabooSettings extends BaseRoomSettings {
  wordsPerTurn: number;
  maxTabooWords: number;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  scores: { A: number; B: number };
  challenges: { A: ChallengeSetup; B: ChallengeSetup };
  timerEnd: number | null;
  tabooMasters: { A: string | null; B: string | null };
  turnResults: { A: TurnScoreData | null; B: TurnScoreData | null };
}

export interface TeamRoundData {
  cards: WordCard[];
  tabooWords: string[];
  tabooBuzzes: AdtabooBuzzes;
  turnScore: TurnScoreData;
  clueGiverName: string;
  tabooMasterName: string;
}

export interface RoundArchiveEntry {
  round: number;
  teams: { A: TeamRoundData; B: TeamRoundData };
}

export interface AdtabooRoomDTO {
  code: string;
  hostId: string;
  players: PlayerDTO[];
  settings: AdtabooSettings;
  phase: GamePhase | null;
  tabooMasters: { A: string | null; B: string | null };
}
