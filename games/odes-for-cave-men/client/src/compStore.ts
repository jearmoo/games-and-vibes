import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordBuffer, type CaveWord } from './wordService';

export interface CompReviewCard {
  word1: string;
  word3: string;
  result: 'correct' | 'skipped' | 'bonked' | 'timeout';
  originalPoints: number;
  points: number;
}

export interface RoundEntry {
  cluerName: string;
  correct: number;
  skips: number;
  bonks: number;
  score: number;
  cards: CompReviewCard[];
}

export type CompPhase = 'setup' | 'cluer-entry' | 'playing' | 'review' | 'round-result' | 'game-over';

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
  roundCards: CompReviewCard[];
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
  adjustCardPoints: (index: number, points: number) => void;
  lockInReview: () => void;
  nextRound: () => void;
  endGame: () => void;
  resetToSetup: () => void;
}

export const useCompStore = create<CompStore>()(
  persist(
    (set, get) => ({
      active: false,
      phase: 'setup',
      timerDuration: 90,
      timerEnd: null,
      currentWord: null,
      cluerName: '',
      roundCorrect: 0,
      roundSkips: 0,
      roundBonks: 0,
      roundCards: [],
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
          roundCards: [],
        });
      },

      markCorrect: (points) => {
        const { wordBuffer } = get();
        set((s) => {
          const card: CompReviewCard | null = s.currentWord
            ? {
                word1: s.currentWord.word1,
                word3: s.currentWord.word3,
                result: 'correct',
                originalPoints: points,
                points,
              }
            : null;
          return {
            roundCorrect: s.roundCorrect + points,
            currentWord: wordBuffer.consume(),
            roundCards: card ? [...s.roundCards, card] : s.roundCards,
          };
        });
      },

      markSkip: () => {
        const { wordBuffer } = get();
        set((s) => {
          const card: CompReviewCard | null = s.currentWord
            ? {
                word1: s.currentWord.word1,
                word3: s.currentWord.word3,
                result: 'skipped',
                originalPoints: -1,
                points: -1,
              }
            : null;
          return {
            roundSkips: s.roundSkips + 1,
            currentWord: wordBuffer.consume(),
            roundCards: card ? [...s.roundCards, card] : s.roundCards,
          };
        });
      },

      markBonk: () => {
        const { wordBuffer } = get();
        set((s) => {
          const card: CompReviewCard | null = s.currentWord
            ? {
                word1: s.currentWord.word1,
                word3: s.currentWord.word3,
                result: 'bonked',
                originalPoints: -1,
                points: -1,
              }
            : null;
          return {
            roundBonks: s.roundBonks + 1,
            currentWord: wordBuffer.consume(),
            roundCards: card ? [...s.roundCards, card] : s.roundCards,
          };
        });
      },

      endRound: () => {
        set({
          phase: 'review',
          timerEnd: null,
        });
      },

      adjustCardPoints: (index, points) => {
        set((s) => {
          const roundCards = [...s.roundCards];
          if (roundCards[index]) {
            roundCards[index] = { ...roundCards[index], points };
          }
          return { roundCards };
        });
      },

      lockInReview: () => {
        const { roundCards, cluerName, players } = get();
        const score = roundCards.reduce((sum, c) => sum + c.points, 0);
        const correct = roundCards.filter((c) => c.points > 0).reduce((sum, c) => sum + c.points, 0);
        const skips = roundCards.filter((c) => c.result === 'skipped').length;
        const bonks = roundCards.filter((c) => c.result === 'bonked').length;

        const updatedPlayers = { ...players };
        updatedPlayers[cluerName] = (updatedPlayers[cluerName] ?? 0) + score;

        set((s) => ({
          phase: 'round-result',
          players: updatedPlayers,
          roundCorrect: correct,
          roundSkips: skips,
          roundBonks: bonks,
          roundHistory: [...s.roundHistory, { cluerName, correct, skips, bonks, score, cards: roundCards }],
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
          roundCards: [],
          roundHistory: [],
          players: {},
        }),
    }),
    {
      name: 'odes-comp-game',
      partialize: (state) => ({
        active: state.active,
        phase: state.phase,
        timerDuration: state.timerDuration,
        timerEnd: state.timerEnd,
        currentWord: state.currentWord,
        cluerName: state.cluerName,
        roundCorrect: state.roundCorrect,
        roundSkips: state.roundSkips,
        roundBonks: state.roundBonks,
        roundCards: state.roundCards,
        roundHistory: state.roundHistory,
        players: state.players,
      }),
      onRehydrateStorage: () => {
        // After rehydration, check if we were in a playing phase with an expired timer
        return (rehydratedState) => {
          if (!rehydratedState) return;
          if (rehydratedState.phase === 'playing' && rehydratedState.timerEnd) {
            if (Date.now() >= rehydratedState.timerEnd) {
              // Timer expired while page was closed — transition to review
              rehydratedState.phase = 'review';
              rehydratedState.timerEnd = null;
            }
          }
        };
      },
    },
  ),
);

/** Get players sorted by score descending */
export function useLeaderboard(): Array<{ name: string; score: number }> {
  const players = useCompStore((s) => s.players);
  return Object.entries(players)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}
