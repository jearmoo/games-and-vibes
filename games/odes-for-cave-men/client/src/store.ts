import { create } from 'zustand';
import { GamePhase } from '@games/odes-for-cave-men-shared';
import type { WordCard, TeamId, CaveRoundArchiveEntry } from '@games/odes-for-cave-men-shared';
export { SESSION_KEY } from './constants';
export { GamePhase };
export type { WordCard };

export interface ReviewCard extends WordCard {
  originalPoints: number;
}

export interface Player {
  id: string;
  name: string;
  team: TeamId | null;
  connected: boolean;
}

export interface GameStore {
  connected: boolean;
  playerId: string | null;
  playerName: string;

  roomCode: string | null;
  players: Player[];
  hostId: string | null;
  settings: { rounds: number | null; timerSeconds: number };
  teamNames: { A: string; B: string };

  phase: GamePhase | null;
  round: number;
  scores: { A: number; B: number };

  // Round structure
  playingTeam: TeamId | null;

  // Turn state
  role: 'cluer' | 'guesser' | 'opponent' | null;
  cluerId: string | null;
  cluerName: string | null;
  currentWord: { word1: string; word3: string } | null;
  timerEnd: number | null;
  wordsResolved: number;
  bonkFlash: boolean;

  // Review state
  reviewCards: ReviewCard[];
  roundHistory: CaveRoundArchiveEntry[];

  error: string | null;
  kickReason: string | null;

  setPlayerName: (name: string) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const initialState = {
  connected: false,
  playerId: null,
  playerName: '',
  roomCode: null,
  players: [],
  hostId: null,
  settings: { rounds: null, timerSeconds: 90 },
  teamNames: { A: 'Team A', B: 'Team B' },
  phase: null,
  round: 1,
  scores: { A: 0, B: 0 },
  playingTeam: null,
  role: null,
  cluerId: null,
  cluerName: null,
  currentWord: null,
  timerEnd: null,
  wordsResolved: 0,
  bonkFlash: false,
  reviewCards: [],
  roundHistory: [],
  error: null,
  kickReason: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setPlayerName: (name) => set({ playerName: name }),
  setError: (msg) => {
    set({ error: msg });
    if (msg) setTimeout(() => set({ error: null }), 4000);
  },
  reset: () => set(initialState),
}));

export function useMyPlayer(): Player | undefined {
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  return players.find((p) => p.id === playerId);
}

export function useMyRole(): 'cluer' | 'guesser' | 'opponent' | null {
  return useGameStore((s) => s.role);
}

export function useIsHost(): boolean {
  return useGameStore((s) => s.playerId) === useGameStore((s) => s.hostId);
}

export function useTeamPlayers(team: TeamId): Player[] {
  return useGameStore((s) => s.players).filter((p) => p.team === team);
}

export function useTeamName(team: TeamId): string {
  return useGameStore((s) => s.teamNames[team]);
}

export function getRoomCodeFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(path)) return path;
  return null;
}
