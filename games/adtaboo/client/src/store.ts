import { create } from 'zustand';
export { SESSION_KEY } from './constants';

export type GamePhase = 'LOBBY' | 'PARALLEL_SETUP' | 'CLUING_A' | 'CLUING_B' | 'ROUND_RESULT' | 'GAME_OVER';
export type TeamId = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  team: TeamId | null;
  connected: boolean;
}

export interface WordCard {
  word: string;
  result: 'correct' | null;
}

export interface AdtabooBuzzes {
  [word: string]: number;
}

export interface TurnScore {
  correct: number;
  missed: number;
  buzzes: number;
  points: number;
}

export interface SetupStatus {
  A: { ready: boolean; tabooCount: number; hasClueGiver: boolean };
  B: { ready: boolean; tabooCount: number; hasClueGiver: boolean };
}

export interface TeamRoundData {
  cards: WordCard[];
  tabooWords: string[];
  tabooBuzzes: AdtabooBuzzes;
  turnScore: TurnScore;
  clueGiverName: string;
  tabooMasterName: string;
}

export interface RoundArchiveEntry {
  round: number;
  teams: { A: TeamRoundData; B: TeamRoundData };
}

export interface GameStore {
  connected: boolean;
  playerId: string | null;
  playerName: string;

  roomCode: string | null;
  players: Player[];
  hostId: string | null;
  settings: { rounds: number; timerSeconds: number; wordsPerTurn: number; maxTabooWords: number };
  tabooMasters: { A: string | null; B: string | null };

  phase: GamePhase | null;
  round: number;
  scores: { A: number; B: number };

  challengeCards: WordCard[];
  tabooSuggestions: string[];
  ownClueGiverId: string | null;
  setupStatus: SetupStatus;

  cluingTeam: TeamId | null;
  activeCluingClueGiverId: string | null;
  cards: WordCard[];
  tabooWords: string[];
  tabooBuzzes: AdtabooBuzzes;
  timerEnd: number | null;

  turnResults: { A: TurnScore | null; B: TurnScore | null };
  roundHistory: RoundArchiveEntry[];

  error: string | null;

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
  settings: { rounds: 3, timerSeconds: 60, wordsPerTurn: 5, maxTabooWords: 20 },
  tabooMasters: { A: null, B: null },
  phase: null,
  round: 1,
  scores: { A: 0, B: 0 },
  challengeCards: [],
  tabooSuggestions: [],
  ownClueGiverId: null,
  setupStatus: {
    A: { ready: false, tabooCount: 0, hasClueGiver: false },
    B: { ready: false, tabooCount: 0, hasClueGiver: false },
  },
  cluingTeam: null,
  activeCluingClueGiverId: null,
  cards: [],
  tabooWords: [],
  tabooBuzzes: {},
  timerEnd: null,
  turnResults: { A: null, B: null },
  roundHistory: [],
  error: null,
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

export function useMyRole(): 'clue-giver' | 'taboo-master' | 'taboo-watcher' | 'guesser' | null {
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  const phase = useGameStore((s) => s.phase);
  const cluingTeam = useGameStore((s) => s.cluingTeam);
  const tabooMasters = useGameStore((s) => s.tabooMasters);
  const activeCGId = useGameStore((s) => s.activeCluingClueGiverId);

  const me = players.find((p) => p.id === playerId);
  if (!me?.team) return null;

  if (phase === 'PARALLEL_SETUP') {
    return me.id === tabooMasters[me.team] ? 'taboo-master' : 'taboo-watcher';
  }

  if (!cluingTeam) return null;

  if (me.team === cluingTeam) {
    return me.id === activeCGId ? 'clue-giver' : 'guesser';
  } else {
    return me.id === tabooMasters[me.team] ? 'taboo-master' : 'taboo-watcher';
  }
}

export function useLiveScore() {
  const cards = useGameStore((s) => s.cards);
  const tabooBuzzes = useGameStore((s) => s.tabooBuzzes);

  const buzzedWords = Object.entries(tabooBuzzes).filter(([_, c]) => c > 0);
  const totalBuzzes = buzzedWords.reduce((sum, [_, c]) => sum + c, 0);
  const correctCount = cards.filter((c) => c.result === 'correct').length;
  const remaining = cards.filter((c) => c.result === null).length;
  const liveScore = correctCount * 3 - totalBuzzes;

  return { correctCount, totalBuzzes, buzzedWords, liveScore, remaining };
}

export function useIsHost(): boolean {
  return useGameStore((s) => s.playerId) === useGameStore((s) => s.hostId);
}

export function useTeamPlayers(team: TeamId): Player[] {
  return useGameStore((s) => s.players).filter((p) => p.team === team);
}

export function getRoomCodeFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(path)) return path;
  return null;
}
