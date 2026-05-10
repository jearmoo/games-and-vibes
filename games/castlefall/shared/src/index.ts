import type { BasePlayer, BasePlayerDTO, RoomDTO, RoomSettings } from '@games/server-core';

export type TeamId = 1 | 2;

export type WinningTeam = 1 | 2 | 'draw';

export const CastlefallPhase = {
  LOBBY: 'lobby',
  ROUND: 'round',
  GAME_OVER: 'gameOver',
} as const;

export type CastlefallPhase = (typeof CastlefallPhase)[keyof typeof CastlefallPhase];

export interface CastlefallPlayer extends BasePlayer {
  team?: TeamId;
}

export interface CastlefallPlayerDTO extends BasePlayerDTO {
  team?: TeamId;
}

export interface CastlefallSettings extends RoomSettings {
  timerSeconds: number;
}

export interface PublicRoundState {
  phase: CastlefallPhase;
  words: string[];
  timerSeconds: number;
  roundStartedAt?: number;
}

export interface PrivateRoundState {
  team: TeamId;
  secretWord: string;
}

export interface FullReveal {
  winningTeam: WinningTeam;
  team1Word: string;
  team2Word: string;
  players: { id: string; name: string; team: TeamId }[];
}

export interface CastlefallRoomDTO extends RoomDTO {
  players: CastlefallPlayerDTO[];
  settings: CastlefallSettings;
  phase: CastlefallPhase | null;
  round: PublicRoundState | null;
  reveal: FullReveal | null;
}

export const CastlefallEvent = {
  StartRound: 'castlefall:startRound',
  EndRound: 'castlefall:endRound',
  StartNewRound: 'castlefall:startNewRound',
  RoundStarted: 'castlefall:roundStarted',
  RoundEnded: 'castlefall:roundEnded',
  NewRound: 'castlefall:newRound',
} as const;

export type CastlefallEvent = (typeof CastlefallEvent)[keyof typeof CastlefallEvent];

export interface StartRoundPayload {
  timerSeconds: number;
}

export interface EndRoundPayload {
  winningTeam: WinningTeam;
}

export interface RoundStartedPayload {
  public: PublicRoundState;
  private: PrivateRoundState;
}

export interface RoundEndedPayload {
  reveal: FullReveal;
}

export interface CastlefallRejoinGame {
  phase: CastlefallPhase;
  public?: PublicRoundState | null;
  private?: PrivateRoundState | null;
  reveal?: FullReveal | null;
}

export interface CastlefallClientToServerEvents {
  [CastlefallEvent.StartRound]: (payload: StartRoundPayload) => void;
  [CastlefallEvent.EndRound]: (payload: EndRoundPayload) => void;
  [CastlefallEvent.StartNewRound]: () => void;
}

export interface CastlefallServerToClientEvents {
  [CastlefallEvent.RoundStarted]: (payload: RoundStartedPayload) => void;
  [CastlefallEvent.RoundEnded]: (payload: RoundEndedPayload) => void;
  [CastlefallEvent.NewRound]: () => void;
}
