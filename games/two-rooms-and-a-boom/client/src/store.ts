import { create } from 'zustand';
import {
  TwoRoomsEvent,
  TwoRoomsPhase,
  type DeckCount,
  type PrivateRole,
  type TwoRoomsPlayerDTO,
  type TwoRoomsRoomDTO,
} from '@games/two-rooms-and-a-boom-shared';
import { socket } from './socket';

interface GameStore {
  // Connection
  connected: boolean;
  playerId: string | null;
  playerName: string;

  // Room
  roomCode: string | null;
  room: TwoRoomsRoomDTO | null;

  // Reveal
  myRole: PrivateRole | null;
  composition: DeckCount[];

  // UI
  error: string | null;
  kickReason: string | null;

  // Setters
  setConnected: (connected: boolean) => void;
  setPlayerName: (name: string) => void;
  setError: (message: string | null) => void;
  setKickReason: (message: string | null) => void;
  reset: () => void;

  // Actions
  createRoom: (args: { playerName: string }) => void;
  joinRoom: (args: { roomCode: string; playerName: string }) => void;
  leaveRoom: () => void;
  updateSelection: (selectedItemIds: string[]) => void;
  startGame: () => void;
  returnToLobby: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: socket.connected,
  playerId: null,
  playerName: '',
  roomCode: null,
  room: null,
  myRole: null,
  composition: [],
  error: null,
  kickReason: null,

  setConnected: (connected) => set({ connected }),
  setPlayerName: (playerName) => set({ playerName }),
  setError: (error) => set({ error }),
  setKickReason: (kickReason) => set({ kickReason }),

  reset: () =>
    set({
      playerId: null,
      roomCode: null,
      room: null,
      myRole: null,
      composition: [],
      error: null,
    }),

  createRoom: ({ playerName }) => {
    set({ playerName });
    socket.emit('room:create', { playerName });
  },

  joinRoom: ({ roomCode, playerName }) => {
    set({ playerName });
    socket.emit('room:join', { roomCode: roomCode.toUpperCase(), playerName });
  },

  leaveRoom: () => {
    socket.emit('room:leave');
    get().reset();
  },

  updateSelection: (selectedItemIds) => {
    // Optimistic local update so the host's UI is snappy; the server echoes RolesUpdated.
    set((s) => (s.room ? { room: { ...s.room, settings: { ...s.room.settings, selectedItemIds } } } : {}));
    socket.emit(TwoRoomsEvent.UpdateRoles, { selectedItemIds });
  },

  startGame: () => {
    socket.emit(TwoRoomsEvent.StartGame);
  },

  returnToLobby: () => {
    socket.emit(TwoRoomsEvent.ReturnToLobby);
  },
}));

// --- Derived hooks ---

export function usePhase(): TwoRoomsPhase | null {
  return useGameStore((s) => (s.room?.phase as TwoRoomsPhase | null) ?? null);
}

export function useMyPlayer(): TwoRoomsPlayerDTO | undefined {
  return useGameStore((s) => s.room?.players.find((p) => p.id === s.playerId));
}

export function useIsHost(): boolean {
  return useGameStore((s) => !!s.playerId && s.room?.hostId === s.playerId);
}

export function useSelection(): string[] {
  return useGameStore((s) => s.room?.settings.selectedItemIds ?? []);
}

export function getRoomCodeFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/([A-Za-z0-9]{4})$/);
  return match ? match[1].toUpperCase() : null;
}

export { TwoRoomsPhase };
