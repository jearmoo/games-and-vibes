/** Minimal server-side player. Games extend for game-specific fields (e.g., team). */
export interface BasePlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
  disconnectedAt?: number;
  removed?: boolean;
}

/** Minimal client-facing player. Games extend for game-specific fields. */
export interface BasePlayerDTO {
  id: string;
  name: string;
  connected: boolean;
}

/** Base room settings — games define their own fields. */
export type RoomSettings = Record<string, unknown>;

/** Base room DTO sent to clients. */
export interface RoomDTO {
  code: string;
  hostId: string;
  players: BasePlayerDTO[];
  settings: RoomSettings;
  phase: string | null;
}
