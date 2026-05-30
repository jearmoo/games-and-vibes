import type { BasePlayer, BasePlayerDTO, RoomDTO, RoomSettings } from '@games/server-core';

export * from './roles.js';

export const TwoRoomsPhase = {
  LOBBY: 'lobby',
  REVEAL: 'reveal',
} as const;

export type TwoRoomsPhase = (typeof TwoRoomsPhase)[keyof typeof TwoRoomsPhase];

export interface TwoRoomsPlayer extends BasePlayer {}

export interface TwoRoomsPlayerDTO extends BasePlayerDTO {
  /** True during REVEAL if this player was dealt a card. Never reveals *which* card. */
  hasRole: boolean;
}

export interface TwoRoomsSettings extends RoomSettings {
  /** Selected deck-item ids (packs + singles). President/Bomber are always implied. */
  selectedItemIds: string[];
}

/** One card and how many copies are in the dealt deck. */
export interface DeckCount {
  roleId: string;
  count: number;
}

/** Server-side game state, persisted via serializeGameState. */
export interface TwoRoomsGameState {
  phase: TwoRoomsPhase;
  /** playerId -> roleId dealt to them. */
  assignments: Record<string, string>;
  /** The full deck that was dealt (card id + copies), for the in-game role list. */
  composition: DeckCount[];
}

/** A single player's private card, only ever sent to that player. */
export interface PrivateRole {
  roleId: string;
}

export interface TwoRoomsRoomDTO extends RoomDTO {
  players: TwoRoomsPlayerDTO[];
  settings: TwoRoomsSettings;
  phase: TwoRoomsPhase | null;
  /** Number of players holding a card during REVEAL. */
  assignedCount: number;
  /** During REVEAL, the cards in play (everyone may see this). Empty in lobby. */
  composition: DeckCount[];
}

export const TwoRoomsEvent = {
  /** Host updates the selected deck items. */
  UpdateRoles: 'tworooms:updateRoles',
  /** Broadcast: selection changed. */
  RolesUpdated: 'tworooms:rolesUpdated',
  /** Host deals the deck to the players. */
  StartGame: 'tworooms:startGame',
  /** Per-socket: your private card + the new phase + the deck composition. */
  GameStarted: 'tworooms:gameStarted',
  /** Host returns everyone to the lobby. */
  ReturnToLobby: 'tworooms:returnToLobby',
  /** Broadcast: back to the lobby, clear cards. */
  BackToLobby: 'tworooms:backToLobby',
} as const;

export type TwoRoomsEvent = (typeof TwoRoomsEvent)[keyof typeof TwoRoomsEvent];

export interface UpdateRolesPayload {
  selectedItemIds: string[];
}

export interface RolesUpdatedPayload {
  selectedItemIds: string[];
}

export interface GameStartedPayload {
  phase: TwoRoomsPhase;
  /** Null if this connection was not dealt a card (e.g. joined after the deal). */
  role: PrivateRole | null;
  assignedCount: number;
  composition: DeckCount[];
}

/** Snapshot returned to a reconnecting player via the lobby `game` field. */
export interface TwoRoomsRejoinGame {
  phase: TwoRoomsPhase;
  role: PrivateRole | null;
  assignedCount: number;
  composition: DeckCount[];
}
