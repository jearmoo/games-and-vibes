import { create } from 'zustand';
import { WordBuffer, type CaveWord } from './wordService';

export interface Team {
  name: string;
  score: number;
}

export interface RoundEntry {
  teamName: string;
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
  teams: [Team, Team];
  currentTeamIndex: number;
  timerDuration: number;
  timerEnd: number | null;
  currentWord: CaveWord | null;
  cluerName: string;
  roundCorrect: number;
  roundSkips: number;
  roundBonks: number;
  roundHistory: RoundEntry[];
  wordBuffer: WordBuffer;

  setTeamName: (index: number, name: string) => void;
  setTimerDuration: (seconds: number) => void;
  startGame: (startingTeam: number) => Promise<void>;
  setCluerName: (name: string) => void;
  beginRound: () => void;
  markCorrect: (points: number) => void;
  markSkip: () => void;
  markBonk: () => void;
  endRound: () => void;
  nextRound: (teamIndex: number) => void;
  endGame: () => void;
  resetToSetup: () => void;
}

function calcScore(correct: number, skips: number, bonks: number): number {
  return correct - skips - bonks;
}

export const useCompStore = create<CompStore>((set, get) => ({
  active: false,
  phase: 'setup',
  teams: [
    { name: 'Team A', score: 0 },
    { name: 'Team B', score: 0 },
  ],
  currentTeamIndex: 0,
  timerDuration: 90,
  timerEnd: null,
  currentWord: null,
  cluerName: '',
  roundCorrect: 0,
  roundSkips: 0,
  roundBonks: 0,
  roundHistory: [],
  wordBuffer: new WordBuffer(),

  setTeamName: (index, name) =>
    set((s) => {
      const teams = [...s.teams] as [Team, Team];
      teams[index] = { ...teams[index], name };
      return { teams };
    }),

  setTimerDuration: (seconds) => set({ timerDuration: seconds }),

  startGame: async (startingTeam) => {
    const { wordBuffer } = get();
    wordBuffer.reset();
    await wordBuffer.prefetch(20);
    set({
      phase: 'cluer-entry',
      currentTeamIndex: startingTeam,
      teams: [
        { ...get().teams[0], score: 0 },
        { ...get().teams[1], score: 0 },
      ],
      roundHistory: [],
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
    const { roundCorrect, roundSkips, roundBonks, currentTeamIndex, teams, cluerName } = get();
    const score = calcScore(roundCorrect, roundSkips, roundBonks);
    const updatedTeams = [...teams] as [Team, Team];
    updatedTeams[currentTeamIndex] = {
      ...updatedTeams[currentTeamIndex],
      score: updatedTeams[currentTeamIndex].score + score,
    };

    set((s) => ({
      phase: 'round-result',
      timerEnd: null,
      teams: updatedTeams,
      roundHistory: [
        ...s.roundHistory,
        {
          teamName: teams[currentTeamIndex].name,
          cluerName,
          correct: roundCorrect,
          skips: roundSkips,
          bonks: roundBonks,
          score,
        },
      ],
    }));
  },

  nextRound: (teamIndex) =>
    set({
      phase: 'cluer-entry',
      currentTeamIndex: teamIndex,
      cluerName: '',
    }),

  endGame: () => set({ phase: 'game-over', timerEnd: null }),

  resetToSetup: () =>
    set({
      active: false,
      phase: 'setup',
      teams: [
        { name: 'Team A', score: 0 },
        { name: 'Team B', score: 0 },
      ],
      currentTeamIndex: 0,
      timerEnd: null,
      currentWord: null,
      cluerName: '',
      roundCorrect: 0,
      roundSkips: 0,
      roundBonks: 0,
      roundHistory: [],
    }),
}));
