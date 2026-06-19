import { socket, autoReconnecting, clearAutoReconnecting } from './socket';
import { useGameStore, initialState, SESSION_KEY } from './store';
import { YipYapEvent, YipYapPhase } from '@games/yip-yap-shared';
import type {
  YipYapRejoinGame,
  YipYapRoomDTO,
  RoundEndedPayload,
  RoundStartedPayload,
  RoundUpdatedPayload,
} from '@games/yip-yap-shared';
import { clientLogger } from '@games/client-core';

function saveSession() {
  const { roomCode, playerId, playerName } = useGameStore.getState();
  if (roomCode && playerId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerName }));
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Connection
socket.on('connect', () => {
  useGameStore.setState({ connected: true });
});
socket.on('disconnect', () => {
  useGameStore.setState({ connected: false });
});

// Session takeover
socket.on('session:taken-over', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: 'Your name was claimed by another device. You were signed out.',
  });
  window.history.replaceState(null, '', '/');
});

// Kicked by host
socket.on('room:kicked', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: 'The host removed you from the keep.',
  });
  window.history.replaceState(null, '', '/');
});

// Room lifecycle (BaseRoom standard events)
socket.on(
  'room:created',
  ({ roomCode, playerId, room }: { roomCode: string; playerId: string; room: YipYapRoomDTO }) => {
    useGameStore.setState({ roomCode, playerId, room });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
  },
);

socket.on(
  'room:joined',
  ({ roomCode, playerId, room }: { roomCode: string; playerId: string; room: YipYapRoomDTO }) => {
    useGameStore.setState({ roomCode, playerId, room });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
  },
);

socket.on(
  'room:rejoined',
  ({
    roomCode,
    playerId,
    room,
    game,
  }: {
    roomCode: string;
    playerId: string;
    room: YipYapRoomDTO;
    game: YipYapRejoinGame | null;
  }) => {
    clearAutoReconnecting();
    const me = room.players.find((p) => p.id === playerId);
    const currentName = useGameStore.getState().playerName;
    useGameStore.setState({
      roomCode,
      playerId,
      room,
      playerName: me?.name || currentName,
      publicRound: game?.public ?? null,
      privateRound: game?.private ?? null,
      reveal: game?.reveal ?? null,
    });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
  },
);

socket.on(
  'room:mid-game-joined',
  ({
    roomCode,
    playerId,
    room,
    game,
  }: {
    roomCode: string;
    playerId: string;
    room: YipYapRoomDTO;
    game: YipYapRejoinGame | null;
  }) => {
    useGameStore.setState({
      roomCode,
      playerId,
      room,
      publicRound: game?.public ?? null,
      privateRound: game?.private ?? null,
      reveal: game?.reveal ?? null,
    });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
  },
);

// Player roster updates — patch the embedded room DTO
socket.on('room:player-joined', ({ player }: { player: import('@games/yip-yap-shared').YipYapPlayerDTO }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, players: [...s.room.players, player] } } : {}));
});
socket.on(
  'room:player-left',
  ({ hostId, players }: { hostId: string; players: import('@games/yip-yap-shared').YipYapPlayerDTO[] }) => {
    useGameStore.setState((s) => (s.room ? { room: { ...s.room, hostId, players } } : {}));
  },
);
socket.on('room:player-disconnected', ({ playerId: pid }: { playerId: string }) => {
  useGameStore.setState((s) => {
    if (!s.room) return {};
    return { room: { ...s.room, players: s.room.players.map((p) => (p.id === pid ? { ...p, connected: false } : p)) } };
  });
});
socket.on('room:player-reconnected', ({ playerId: pid }: { playerId: string }) => {
  useGameStore.setState((s) => {
    if (!s.room) return {};
    return { room: { ...s.room, players: s.room.players.map((p) => (p.id === pid ? { ...p, connected: true } : p)) } };
  });
});
socket.on('room:host-updated', ({ hostId }: { hostId: string }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, hostId } } : {}));
});

// Lobby — team / settings updates re-emit player roster + settings
socket.on('team:updated', ({ players }: { players: import('@games/yip-yap-shared').YipYapPlayerDTO[] }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, players } } : {}));
});
socket.on('settings:updated', ({ settings }: { settings: import('@games/yip-yap-shared').YipYapSettings }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, settings } } : {}));
});

socket.on('room:error', ({ message }: { message: string }) => {
  if (autoReconnecting.current) {
    clearAutoReconnecting();
    if (message === 'Room not found') {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
  }
  clientLogger.error('room', 'Room error', { message });
  useGameStore.getState().setError(message);
});

// YipYap game events
socket.on(YipYapEvent.RoundStarted, ({ public: pub, private: priv }: RoundStartedPayload) => {
  useGameStore.setState((s) => ({
    publicRound: pub,
    privateRound: priv,
    reveal: null,
    room: s.room ? { ...s.room, phase: YipYapPhase.ROUND, round: pub, reveal: null } : s.room,
  }));
});

socket.on(YipYapEvent.RoundUpdated, ({ public: pub }: RoundUpdatedPayload) => {
  useGameStore.setState((s) => ({
    publicRound: pub,
    room: s.room ? { ...s.room, round: pub } : s.room,
  }));
});

socket.on(YipYapEvent.RoundEnded, ({ reveal }: RoundEndedPayload) => {
  useGameStore.setState((s) => ({
    reveal,
    room: s.room ? { ...s.room, phase: YipYapPhase.GAME_OVER, reveal } : s.room,
  }));
});

socket.on(YipYapEvent.NewRound, () => {
  useGameStore.setState((s) => ({
    publicRound: null,
    privateRound: null,
    reveal: null,
    room: s.room ? { ...s.room, phase: YipYapPhase.LOBBY, round: null, reveal: null } : s.room,
  }));
});
