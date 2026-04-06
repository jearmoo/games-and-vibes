import { create } from 'zustand';
import { WordBuffer, type CaveWord } from './wordService';

export interface RoundEntry {
  cluerName: string;
  correct: number;
  skips: number;
  bonks: number;
  score: number;
}

export type CompPhase = 'setup' | 'cluer-entry' | 'playing' | 'round-result' | 'game-over';

export interface CompStore {
  active: boolean;
  phase: CompPhase;
  timerDuration: number;
  timerEnd: number | null;
  currentWord: CaveWord | null;
  cluerName: string;
  roundCorrect: number;
  roundSkips: number;
  roundBonks: number;
  roundHistory: RoundEntry[];
  /** Cumulative scores per player name */
  players: Record<string, number>;
  wordBuffer: WordBuffer;

  setTimerDuration: (seconds: number) => void;
  startGame: () => Promise<void>;
  setCluerName: (name: string) => void;
  beginRound: () => void;
  markCorrect: (points: number) => void;
  markSkip: () => void;
  markBonk: () => void;
  endRound: () => void;
  nextRound: () => void;
  endGame: () => void;
  resetToSetup: () => void;
}

function calcScore(correct: number, skips: number, bonks: number): number {
  return correct - skips - bonks;
}

export const useCompStore = create<CompStore>((set, get) => ({
  active: false,
  phase: 'setup',
  timerDuration: 90,
  timerEnd: null,
  currentWord: null,
  cluerName: '',
  roundCorrect: 0,
  roundSkips: 0,
  roundBonks: 0,
  roundHistory: [],
  players: {},
  wordBuffer: new WordBuffer(),

  setTimerDuration: (seconds) => set({ timerDuration: seconds }),

  startGame: async () => {
    const { wordBuffer } = get();
    wordBuffer.reset();
    await wordBuffer.prefetch(20);
    set({
      phase: 'cluer-entry',
      roundHistory: [],
      players: {},
      cluerName: '',
    });
  },

  setCluerName: (name) => set({ cluerName: name }),

  beginRound: () => {
    const { wordBuffer, timerDuration } = get();
    set({
      phase: 'playing',
      timerEnd: Date.now() + timerDuration * 1000,
      currentWord: wordBuffer.consume(),
      roundCorrect: 0,
      roundSkips: 0,
      roundBonks: 0,
    });
  },

  markCorrect: (points) => {
    const { wordBuffer } = get();
    set((s) => ({
      roundCorrect: s.roundCorrect + points,
      currentWord: wordBuffer.consume(),
    }));
  },

  markSkip: () => {
    const { wordBuffer } = get();
    set((s) => ({
      roundSkips: s.roundSkips + 1,
      currentWord: wordBuffer.consume(),
    }));
  },

  markBonk: () => {
    const { wordBuffer } = get();
    set((s) => ({
      roundBonks: s.roundBonks + 1,
      currentWord: wordBuffer.consume(),
    }));
  },

  endRound: () => {
    const { roundCorrect, roundSkips, roundBonks, cluerName, players } = get();
    const score = calcScore(roundCorrect, roundSkips, roundBonks);
    const updatedPlayers = { ...players };
    updatedPlayers[cluerName] = (updatedPlayers[cluerName] ?? 0) + score;

    set((s) => ({
      phase: 'round-result',
      timerEnd: null,
      players: updatedPlayers,
      roundHistory: [
        ...s.roundHistory,
        { cluerName, correct: roundCorrect, skips: roundSkips, bonks: roundBonks, score },
      ],
    }));
  },

  nextRound: () => set({ phase: 'cluer-entry', cluerName: '' }),

  endGame: () => set({ phase: 'game-over', timerEnd: null }),

  resetToSetup: () =>
    set({
      active: false,
      phase: 'setup',
      timerEnd: null,
      currentWord: null,
      cluerName: '',
      roundCorrect: 0,
      roundSkips: 0,
      roundBonks: 0,
      roundHistory: [],
      players: {},
    }),
}));

/** Get players sorted by score descending */
export function useLeaderboard(): Array<{ name: string; score: number }> {
  const players = useCompStore((s) => s.players);
  return Object.entries(players)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}
