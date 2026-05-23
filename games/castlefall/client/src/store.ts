import { create } from 'zustand';
import { CastlefallEvent, CastlefallPhase } from '@games/castlefall-shared';
import type {
  CastlefallPlayerDTO,
  CastlefallRoomDTO,
  CastlefallSettings,
  FullReveal,
  PrivateRoundState,
  PublicRoundState,
  TeamId,
} from '@games/castlefall-shared';
import { socket } from './socket';
import { SESSION_KEY } from './constants';

export { CastlefallPhase, SESSION_KEY };
export type { CastlefallPlayerDTO, CastlefallRoomDTO, PublicRoundState, PrivateRoundState, FullReveal, TeamId };

export interface GameStore {
  connected: boolean;
  playerId: string | null;
  playerName: string;

  roomCode: string | null;
  room: CastlefallRoomDTO | null;
  publicRound: PublicRoundState | null;
  privateRound: PrivateRoundState | null;
  reveal: FullReveal | null;

  error: string | null;
  kickReason: string | null;

  setPlayerName: (name: string) => void;
  setError: (msg: string | null) => void;
  reset: () => void;

  createRoom: (args: { playerName: string }) => void;
  joinRoom: (args: { roomCode: string; playerName: string }) => void;
  leaveRoom: () => void;
  startRound: () => void;
  endRound: (args: { losingPlayerId: string }) => void;
  correctClap: (args: { clappingPlayerId: string }) => void;
  resolveGuess: (args: { guessedCorrectly: boolean }) => void;
  startNewRound: () => void;
}

export const initialState = {
  connected: false,
  playerId: null as string | null,
  playerName: '',
  roomCode: null as string | null,
  room: null as CastlefallRoomDTO | null,
  publicRound: null as PublicRoundState | null,
  privateRound: null as PrivateRoundState | null,
  reveal: null as FullReveal | null,
  error: null as string | null,
  kickReason: null as string | null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  setPlayerName: (name) => set({ playerName: name }),
  setError: (msg) => {
    set({ error: msg });
    if (msg) setTimeout(() => set({ error: null }), 4000);
  },
  reset: () => set(initialState),

  createRoom: ({ playerName }) => {
    socket.emit('room:create', { playerName });
  },
  joinRoom: ({ roomCode, playerName }) => {
    socket.emit('room:join', { roomCode, playerName });
  },
  leaveRoom: () => {
    socket.emit('room:leave');
    localStorage.removeItem(SESSION_KEY);
    set({ ...initialState, connected: get().connected, playerName: get().playerName });
    window.history.replaceState(null, '', '/');
  },
  startRound: () => {
    socket.emit(CastlefallEvent.StartRound, {});
  },
  endRound: ({ losingPlayerId }) => {
    socket.emit(CastlefallEvent.EndRound, { losingPlayerId });
  },
  correctClap: ({ clappingPlayerId }) => {
    socket.emit(CastlefallEvent.CorrectClap, { clappingPlayerId });
  },
  resolveGuess: ({ guessedCorrectly }) => {
    socket.emit(CastlefallEvent.ResolveGuess, { guessedCorrectly });
  },
  startNewRound: () => {
    socket.emit(CastlefallEvent.StartNewRound);
  },
}));

export function usePhase(): CastlefallPhase | null {
  return useGameStore((s) => s.room?.phase ?? null);
}

export function useMyPlayer(): CastlefallPlayerDTO | undefined {
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  if (!playerId || !room) return undefined;
  return room.players.find((p) => p.id === playerId);
}

export function useIsHost(): boolean {
  const playerId = useGameStore((s) => s.playerId);
  const hostId = useGameStore((s) => s.room?.hostId ?? null);
  return playerId !== null && playerId === hostId;
}

export function useSettings(): CastlefallSettings | null {
  return useGameStore((s) => s.room?.settings ?? null);
}

export function useTeamPlayers(team: TeamId): CastlefallPlayerDTO[] {
  return useGameStore((s) => s.room?.players ?? []).filter((p) => p.team === team);
}

export function getRoomCodeFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(path)) return path;
  return null;
}
