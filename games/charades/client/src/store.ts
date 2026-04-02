import { create } from 'zustand';
import { WordBuffer, fetchCasualWords } from './wordService';

export type GameMode = 'casual' | 'competitive';
export type CompPhase = 'setup' | 'playing' | 'round-result' | 'game-over';

export interface Team {
  name: string;
  score: number;
}

export interface RoundEntry {
  teamName: string;
  correct: number;
  passes: number;
  score: number;
}

export function calcRoundScore(correct: number, passes: number): number {
  return correct - Math.floor(passes / 2);
}

const wordBuffer = new WordBuffer();
const casualUsedWords = new Set<string>();

export interface CharadesStore {
  // Mode
  mode: GameMode | null;

  // Casual
  casualDifficulty: number;
  casualWordCount: number;
  casualWords: string[];
  casualLoading: boolean;

  // Competitive
  teams: [Team, Team];
  timerDuration: number;
  phase: CompPhase | null;
  currentTeamIndex: number;
  currentWord: string | null;
  timerEnd: number | null;
  roundCorrect: number;
  roundPasses: number;
  roundHistory: RoundEntry[];
  swipeFeedback: 'correct' | 'pass' | null;

  // Actions
  setMode: (mode: GameMode) => void;
  setCasualDifficulty: (d: number) => void;
  setCasualWordCount: (n: number) => void;
  generateCasualWords: () => Promise<void>;
  setTeamName: (index: number, name: string) => void;
  setTimerDuration: (seconds: number) => void;
  startGame: (startingTeamIndex: number) => Promise<void>;
  startRound: (teamIndex: number) => Promise<void>;
  markCorrect: () => Promise<void>;
  markPass: () => Promise<void>;
  endRound: () => void;
  endGame: () => void;
  resetToSetup: () => void;
  resetAll: () => void;
  clearSwipeFeedback: () => void;
}

export const useCharadesStore = create<CharadesStore>((set, get) => ({
  mode: null,

  casualDifficulty: 2,
  casualWordCount: 3,
  casualWords: [],
  casualLoading: false,

  teams: [
    { name: 'Team 1', score: 0 },
    { name: 'Team 2', score: 0 },
  ],
  timerDuration: 60,
  phase: null,
  currentTeamIndex: 0,
  currentWord: null,
  timerEnd: null,
  roundCorrect: 0,
  roundPasses: 0,
  roundHistory: [],
  swipeFeedback: null,

  setMode: (mode) => {
    if (mode === 'competitive') {
      set({ mode, phase: 'setup' });
      wordBuffer.reset();
      wordBuffer.prefetch();
    } else {
      casualUsedWords.clear();
      set({ mode, phase: null });
    }
  },

  setCasualDifficulty: (d) => set({ casualDifficulty: d }),
  setCasualWordCount: (n) => set({ casualWordCount: n }),

  generateCasualWords: async () => {
    set({ casualLoading: true });
    try {
      const { casualWordCount, casualDifficulty } = get();
      const words = await fetchCasualWords(casualWordCount, casualDifficulty, casualUsedWords);
      set({ casualWords: words, casualLoading: false });
    } catch {
      set({ casualLoading: false });
    }
  },

  setTeamName: (index, name) => {
    const teams = [...get().teams] as [Team, Team];
    teams[index] = { ...teams[index], name };
    set({ teams });
  },

  setTimerDuration: (seconds) => set({ timerDuration: seconds }),

  startGame: async (startingTeamIndex) => {
    if (!wordBuffer.hasNext()) {
      await wordBuffer.consume(); // Force fetch if needed
      await wordBuffer.prefetch();
    }
    const word = await wordBuffer.consume();
    set({
      phase: 'playing',
      currentTeamIndex: startingTeamIndex,
      currentWord: word,
      timerEnd: Date.now() + get().timerDuration * 1000,
      roundCorrect: 0,
      roundPasses: 0,
    });
  },

  startRound: async (teamIndex) => {
    if (!wordBuffer.hasNext()) {
      await wordBuffer.prefetch();
    }
    const word = await wordBuffer.consume();
    set({
      phase: 'playing',
      currentTeamIndex: teamIndex,
      currentWord: word,
      timerEnd: Date.now() + get().timerDuration * 1000,
      roundCorrect: 0,
      roundPasses: 0,
    });
  },

  markCorrect: async () => {
    const { roundCorrect } = get();
    set({ roundCorrect: roundCorrect + 1, swipeFeedback: 'correct' });
    const word = await wordBuffer.consume();
    set({ currentWord: word });
  },

  markPass: async () => {
    const { roundPasses } = get();
    set({ roundPasses: roundPasses + 1, swipeFeedback: 'pass' });
    const word = await wordBuffer.consume();
    set({ currentWord: word });
  },

  endRound: () => {
    const { roundCorrect, roundPasses, teams, currentTeamIndex, roundHistory } = get();
    const score = calcRoundScore(roundCorrect, roundPasses);
    const updatedTeams = [...teams] as [Team, Team];
    updatedTeams[currentTeamIndex] = {
      ...updatedTeams[currentTeamIndex],
      score: updatedTeams[currentTeamIndex].score + score,
    };
    set({
      phase: 'round-result',
      teams: updatedTeams,
      timerEnd: null,
      roundHistory: [
        ...roundHistory,
        {
          teamName: teams[currentTeamIndex].name,
          correct: roundCorrect,
          passes: roundPasses,
          score,
        },
      ],
    });
    wordBuffer.prefetch();
  },

  endGame: () => {
    const { roundCorrect, roundPasses, teams, currentTeamIndex, roundHistory, phase } = get();
    if (phase === 'playing') {
      const score = calcRoundScore(roundCorrect, roundPasses);
      const updatedTeams = [...teams] as [Team, Team];
      updatedTeams[currentTeamIndex] = {
        ...updatedTeams[currentTeamIndex],
        score: updatedTeams[currentTeamIndex].score + score,
      };
      set({
        phase: 'game-over',
        teams: updatedTeams,
        timerEnd: null,
        roundHistory: [
          ...roundHistory,
          {
            teamName: teams[currentTeamIndex].name,
            correct: roundCorrect,
            passes: roundPasses,
            score,
          },
        ],
      });
    } else {
      set({ phase: 'game-over', timerEnd: null });
    }
  },

  resetToSetup: () => {
    wordBuffer.reset();
    wordBuffer.prefetch();
    set({
      phase: 'setup',
      teams: [
        { name: get().teams[0].name, score: 0 },
        { name: get().teams[1].name, score: 0 },
      ],
      currentTeamIndex: 0,
      currentWord: null,
      timerEnd: null,
      roundCorrect: 0,
      roundPasses: 0,
      roundHistory: [],
      swipeFeedback: null,
    });
  },

  resetAll: () => {
    wordBuffer.reset();
    casualUsedWords.clear();
    set({
      mode: null,
      casualDifficulty: 2,
      casualWordCount: 3,
      casualWords: [],
      casualLoading: false,
      teams: [
        { name: 'Team 1', score: 0 },
        { name: 'Team 2', score: 0 },
      ],
      timerDuration: 60,
      phase: null,
      currentTeamIndex: 0,
      currentWord: null,
      timerEnd: null,
      roundCorrect: 0,
      roundPasses: 0,
      roundHistory: [],
      swipeFeedback: null,
    });
  },

  clearSwipeFeedback: () => set({ swipeFeedback: null }),
}));
