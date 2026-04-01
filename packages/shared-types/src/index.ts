/** Generic player in a room (server-side, includes socketId) */
export interface Player {
  id: string;
  name: string;
  team: 'A' | 'B' | null;
  socketId: string;
  connected: boolean;
  disconnectedAt?: number;
  removed?: boolean;
}

/** Client-facing player (no socketId) */
export interface PlayerDTO {
  id: string;
  name: string;
  team: 'A' | 'B' | null;
  connected: boolean;
}

export type TeamId = 'A' | 'B';

export interface RoomSettings {
  rounds: number;
  timerSeconds: number;
  [key: string]: unknown;
}

export interface RoomDTO {
  code: string;
  hostId: string;
  players: PlayerDTO[];
  settings: RoomSettings;
  phase: string | null;
}
