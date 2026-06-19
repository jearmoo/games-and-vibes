import type { BasePlayer, BasePlayerDTO, RoomDTO, RoomSettings } from '@games/server-core';

export type TeamId = 1 | 2;

export type WinningTeam = 1 | 2 | 'draw';

/** How a round ended. */
export type RoundOutcome =
  | 'wrong-clap' // clapper was wrong → clapper -1, opposing team +1
  | 'guess-correct' // opposing team correctly guessed back → opposing team +1
  | 'guess-wrong'; // opposing team failed → clapper's team +1

export const YipYapPhase = {
  LOBBY: 'lobby',
  ROUND: 'round',
  GAME_OVER: 'gameOver',
} as const;

export type YipYapPhase = (typeof YipYapPhase)[keyof typeof YipYapPhase];

export interface YipYapPlayer extends BasePlayer {
  team?: TeamId;
  points: number;
}

export interface YipYapPlayerDTO extends BasePlayerDTO {
  team?: TeamId;
  points: number;
  /** True during ROUND/GAME_OVER if this player was dealt into the current round. */
  inRound?: boolean;
}

export interface YipYapSettings extends RoomSettings {
  /** Response-timer duration (seconds) that starts after a correct clap. 0 = no timer. */
  timerSeconds: number;
}

/** Set on PublicRoundState while the opposing team is responding to a correct clap. */
export interface RespondingState {
  clapperId: string;
  clapperTeam: TeamId;
  startedAt: number;
  timerSeconds: number;
}

export interface PublicRoundState {
  phase: YipYapPhase;
  words: string[];
  responding?: RespondingState;
}

export interface PrivateRoundState {
  team: TeamId;
  secretWord: string;
}

export interface FullReveal {
  outcome: RoundOutcome;
  winningTeam: WinningTeam;
  /** The player who clapped (set for all outcomes). */
  clappingPlayerId: string;
  /** Set on `wrong-clap` — the player who scored -1. */
  losingPlayerId?: string;
  team1Word: string;
  team2Word: string;
  players: { id: string; name: string; team: TeamId; points: number }[];
}

export interface YipYapRoomDTO extends RoomDTO {
  players: YipYapPlayerDTO[];
  settings: YipYapSettings;
  phase: YipYapPhase | null;
  round: PublicRoundState | null;
  reveal: FullReveal | null;
  roundsPlayed: number;
}

export const YipYapEvent = {
  StartRound: 'yip-yap:startRound',
  /** Mark the clapper as wrong → ends the round with a -1 penalty. */
  EndRound: 'yip-yap:endRound',
  /** Mark the clapper as correct → starts the response timer for the opposing team. */
  CorrectClap: 'yip-yap:correctClap',
  /** Resolve the opposing team's guess attempt during/after the response window. */
  ResolveGuess: 'yip-yap:resolveGuess',
  StartNewRound: 'yip-yap:startNewRound',
  RoundStarted: 'yip-yap:roundStarted',
  /** Broadcast when the public round state changes mid-round (e.g. response timer started). */
  RoundUpdated: 'yip-yap:roundUpdated',
  RoundEnded: 'yip-yap:roundEnded',
  NewRound: 'yip-yap:newRound',
} as const;

export type YipYapEvent = (typeof YipYapEvent)[keyof typeof YipYapEvent];

export type StartRoundPayload = Record<string, never>;

/** End the round because the clapper guessed wrong. Clapper scores -1, opposing team +1 each. */
export interface EndRoundPayload {
  losingPlayerId: string;
}

/** Start the response window after a correct clap. */
export interface CorrectClapPayload {
  clappingPlayerId: string;
}

/** Resolve the opposing team's response attempt. */
export interface ResolveGuessPayload {
  guessedCorrectly: boolean;
}

export interface RoundStartedPayload {
  public: PublicRoundState;
  private: PrivateRoundState;
}

export interface RoundUpdatedPayload {
  public: PublicRoundState;
}

export interface RoundEndedPayload {
  reveal: FullReveal;
}

export interface YipYapRejoinGame {
  phase: YipYapPhase;
  public?: PublicRoundState | null;
  private?: PrivateRoundState | null;
  reveal?: FullReveal | null;
}

export interface YipYapClientToServerEvents {
  [YipYapEvent.StartRound]: (payload: StartRoundPayload) => void;
  [YipYapEvent.EndRound]: (payload: EndRoundPayload) => void;
  [YipYapEvent.CorrectClap]: (payload: CorrectClapPayload) => void;
  [YipYapEvent.ResolveGuess]: (payload: ResolveGuessPayload) => void;
  [YipYapEvent.StartNewRound]: () => void;
}

export interface YipYapServerToClientEvents {
  [YipYapEvent.RoundStarted]: (payload: RoundStartedPayload) => void;
  [YipYapEvent.RoundUpdated]: (payload: RoundUpdatedPayload) => void;
  [YipYapEvent.RoundEnded]: (payload: RoundEndedPayload) => void;
  [YipYapEvent.NewRound]: () => void;
}
