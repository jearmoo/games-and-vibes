import { create } from 'zustand';
import { clearSession as clearStoredSession } from '@games/client-core';
import { DecryptoEvent, DecryptoPhase } from '@games/decrypto-shared';
import type {
  ClueContent,
  Code,
  DecryptoPlayerDTO,
  DecryptoRoomDTO,
  GuessKind,
  PrivateTeamState,
  TeamId,
  TiebreakerVocabularyMode,
} from '@games/decrypto-shared';
import { socket } from './socket';
import { SESSION_KEY } from './constants';

export { DecryptoPhase, SESSION_KEY };
export type { ClueContent, Code, DecryptoPlayerDTO, DecryptoRoomDTO, GuessKind, PrivateTeamState, TeamId };

export interface GameStore {
  connected: boolean;
  playerId: string | null;
  playerName: string;

  roomCode: string | null;
  room: DecryptoRoomDTO | null;
  privateState: PrivateTeamState | null;

  error: string | null;
  kickReason: string | null;

  setPlayerName: (name: string) => void;
  setError: (msg: string | null) => void;
  reset: () => void;

  createRoom: (args: { playerName: string; roomCode?: string }) => void;
  joinRoom: (args: { roomCode: string; playerName: string }) => void;
  leaveRoom: () => void;
  kickPlayer: (targetId: string) => void;
  transferHost: (targetId: string) => void;
  joinTeam: (team: TeamId) => void;
  regenerateKeyword: (args: { team: TeamId; index: number }) => void;
  setWordLock: (args: { team: TeamId; locked: boolean }) => void;
  startGame: () => void;
  saveClues: (clues: ClueContent[]) => void;
  submitClues: (clues: ClueContent[]) => void;
  unlockClues: () => void;
  requestEncryptorSwap: (args: { team: TeamId; replacementId: string }) => void;
  approveEncryptorSwap: () => void;
  rejectEncryptorSwap: () => void;
  postGuessShare: (args: { team: TeamId; kind: GuessKind; code: Code }) => void;
  submitGuess: (args: { team: TeamId; kind: GuessKind; code: Code }) => void;
  setOfflineAwareness: (enabled: boolean) => void;
  setTiebreakerVocabularyMode: (mode: TiebreakerVocabularyMode) => void;
  submitTiebreaker: (guesses: string[]) => void;
  unlockTiebreaker: () => void;
  requestTiebreakerRepeat: () => void;
  takeWin: () => void;
  releaseWords: (args: { team: TeamId }) => void;
  continueGame: () => void;
  resetGame: () => void;
}

export const initialState = {
  connected: false,
  playerId: null as string | null,
  playerName: '',
  roomCode: null as string | null,
  room: null as DecryptoRoomDTO | null,
  privateState: null as PrivateTeamState | null,
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

  createRoom: ({ playerName, roomCode }) => {
    socket.emit('room:create', { playerName, roomCode });
  },
  joinRoom: ({ roomCode, playerName }) => {
    socket.emit('room:join', { roomCode, playerName });
  },
  leaveRoom: () => {
    socket.emit('room:leave');
    clearStoredSession(SESSION_KEY);
    set({ ...initialState, connected: get().connected, playerName: get().playerName });
    window.history.replaceState(null, '', '/');
  },
  kickPlayer: (targetId) => {
    socket.emit('player:kick', { targetId });
  },
  transferHost: (targetId) => {
    socket.emit('host:transfer', { targetId });
    set((state) => {
      if (!state.room || state.room.hostId !== state.playerId) return {};
      if (!state.room.players.some((player) => player.id === targetId)) return {};
      return { room: { ...state.room, hostId: targetId } };
    });
  },
  joinTeam: (team) => {
    socket.emit(DecryptoEvent.JoinTeam, { team });
  },
  regenerateKeyword: ({ team, index }) => {
    socket.emit(DecryptoEvent.RegenerateKeyword, { team, index });
  },
  setWordLock: ({ team, locked }) => {
    socket.emit(DecryptoEvent.SetWordLock, { team, locked });
  },
  startGame: () => {
    socket.emit(DecryptoEvent.StartGame, {});
  },
  saveClues: (clues) => {
    socket.emit(DecryptoEvent.SaveClues, { clues });
  },
  submitClues: (clues) => {
    socket.emit(DecryptoEvent.SubmitClues, { clues });
  },
  unlockClues: () => {
    socket.emit(DecryptoEvent.UnlockClues);
  },
  requestEncryptorSwap: ({ team, replacementId }) => {
    socket.emit(DecryptoEvent.RequestEncryptorSwap, { team, replacementId });
  },
  approveEncryptorSwap: () => {
    socket.emit(DecryptoEvent.ApproveEncryptorSwap);
  },
  rejectEncryptorSwap: () => {
    socket.emit(DecryptoEvent.RejectEncryptorSwap);
  },
  postGuessShare: ({ team, kind, code }) => {
    socket.emit(DecryptoEvent.PostGuessShare, { team, kind, code });
  },
  submitGuess: ({ team, kind, code }) => {
    socket.emit(DecryptoEvent.SubmitGuess, { team, kind, code });
  },
  setOfflineAwareness: (enabled) => {
    socket.emit(DecryptoEvent.SetOfflineAwareness, { enabled });
  },
  setTiebreakerVocabularyMode: (mode) => {
    socket.emit(DecryptoEvent.SetTiebreakerVocabularyMode, { mode });
  },
  submitTiebreaker: (guesses) => {
    socket.emit(DecryptoEvent.SubmitTiebreaker, { guesses });
  },
  unlockTiebreaker: () => {
    socket.emit(DecryptoEvent.UnlockTiebreaker);
  },
  requestTiebreakerRepeat: () => {
    socket.emit(DecryptoEvent.RequestTiebreakerRepeat);
  },
  takeWin: () => {
    socket.emit(DecryptoEvent.TakeWin);
  },
  releaseWords: ({ team }) => {
    socket.emit(DecryptoEvent.ReleaseWords, { team });
  },
  continueGame: () => {
    socket.emit(DecryptoEvent.Continue);
  },
  resetGame: () => {
    socket.emit(DecryptoEvent.ResetGame);
  },
}));

export function usePhase(): DecryptoPhase | null {
  return useGameStore((s) => s.room?.phase ?? null);
}

export function useMyPlayer(): DecryptoPlayerDTO | undefined {
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

export function useTeamPlayers(team: TeamId): DecryptoPlayerDTO[] {
  return useGameStore((s) => s.room?.players ?? []).filter((p) => p.team === team);
}

export function getRoomCodeFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\//, '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(path)) return path;
  return null;
}
