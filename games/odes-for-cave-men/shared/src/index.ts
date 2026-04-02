import type { BasePlayer, BasePlayerDTO, RoomSettings } from '@games/server-core';

export type TeamId = 'A' | 'B';

export interface CavePlayer extends BasePlayer {
  team: TeamId | null;
}

export interface CavePlayerDTO extends BasePlayerDTO {
  team: TeamId | null;
}

export const GamePhase = {
  LOBBY: 'LOBBY',
  READY: 'READY',
  PLAYING: 'PLAYING',
  REVIEW: 'REVIEW',
  ROUND_RESULT: 'ROUND_RESULT',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface WordCard {
  word1: string;
  word3: string;
  points: number;
  result: 'correct' | 'skipped' | 'bonked' | null;
}

export interface CaveSettings extends RoomSettings {
  rounds: number;
  timerSeconds: number;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  scores: { A: number; B: number };
  playingTeam: TeamId;
  turnIndex: number;
  turnsPerRound: number;
  cluedA: string[];
  cluedB: string[];
  cluerId: string | null;
  currentWordIndex: number;
  words: WordCard[];
  timerEnd: number | null;
}

export interface CaveRoomDTO {
  code: string;
  hostId: string;
  players: CavePlayerDTO[];
  settings: CaveSettings;
  phase: GamePhase | null;
  scores: { A: number; B: number };
}
