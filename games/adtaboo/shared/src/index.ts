import type { BasePlayer, BasePlayerDTO, RoomSettings } from '@games/server-core';

export type TeamId = 'A' | 'B';

export interface AdtabooPlayer extends BasePlayer {
  team: TeamId | null;
}

export interface AdtabooPlayerDTO extends BasePlayerDTO {
  team: TeamId | null;
}

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

export interface AdtabooSettings extends RoomSettings {
  rounds: number;
  timerSeconds: number;
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
  players: AdtabooPlayerDTO[];
  settings: AdtabooSettings;
  phase: GamePhase | null;
  tabooMasters: { A: string | null; B: string | null };
  teamNames: { A: string; B: string };
}
