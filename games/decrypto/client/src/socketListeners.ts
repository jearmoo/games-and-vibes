import { clientLogger, clearSession as clearStoredSession, saveSession as persistSession } from '@games/client-core';
import { DecryptoEvent } from '@games/decrypto-shared';
import type { DecryptoPlayerDTO, DecryptoRejoinGame, DecryptoRoomDTO, PrivateTeamState } from '@games/decrypto-shared';
import { autoReconnecting, clearAutoReconnecting, reconnectExpired, socket } from './socket';
import { initialState, SESSION_KEY, useGameStore } from './store';
import { RECONNECT_SESSION_TTL_MS, SESSION_REFRESH_INTERVAL_MS } from './constants';

function saveSession() {
  const { roomCode, playerId, playerName } = useGameStore.getState();
  if (roomCode && playerId) {
    persistSession(SESSION_KEY, {
      roomCode,
      playerId,
      playerName,
      expiresAt: Date.now() + RECONNECT_SESSION_TTL_MS,
    });
  }
}

function clearSession() {
  clearStoredSession(SESSION_KEY);
}

function requestPrivateState() {
  socket.emit(DecryptoEvent.RequestPrivateState);
}

window.setInterval(() => {
  const { connected, roomCode, playerId } = useGameStore.getState();
  if (connected && roomCode && playerId) saveSession();
}, SESSION_REFRESH_INTERVAL_MS);

socket.on('connect', () => {
  useGameStore.setState({ connected: true });
  if (reconnectExpired.current) {
    reconnectExpired.current = false;
    useGameStore.setState({ ...initialState, connected: true });
    useGameStore.getState().setError('Your saved room expired. Please rejoin.');
    window.history.replaceState(null, '', '/');
  }
});

socket.on('disconnect', () => {
  useGameStore.setState({ connected: false });
});

socket.on('session:taken-over', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: 'Your name was claimed by another device. You were signed out.',
  });
  window.history.replaceState(null, '', '/');
});

socket.on('room:kicked', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: 'The host removed you from the room.',
  });
  window.history.replaceState(null, '', '/');
});

socket.on(
  'room:created',
  ({ roomCode, playerId, room }: { roomCode: string; playerId: string; room: DecryptoRoomDTO }) => {
    useGameStore.setState({ roomCode, playerId, room });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
    requestPrivateState();
  },
);

socket.on(
  'room:joined',
  ({ roomCode, playerId, room }: { roomCode: string; playerId: string; room: DecryptoRoomDTO }) => {
    useGameStore.setState({ roomCode, playerId, room });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
    requestPrivateState();
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
    room: DecryptoRoomDTO;
    game: DecryptoRejoinGame | null;
  }) => {
    clearAutoReconnecting();
    const me = room.players.find((p) => p.id === playerId);
    const currentName = useGameStore.getState().playerName;
    useGameStore.setState({
      roomCode,
      playerId,
      room,
      playerName: me?.name || currentName,
      privateState: game?.private ?? null,
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
    room: DecryptoRoomDTO;
    game: DecryptoRejoinGame | null;
  }) => {
    useGameStore.setState({
      roomCode,
      playerId,
      room,
      privateState: game?.private ?? null,
    });
    saveSession();
    window.history.replaceState(null, '', `/${roomCode}`);
  },
);

socket.on('room:player-joined', ({ player }: { player: DecryptoPlayerDTO }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, players: [...s.room.players, player] } } : {}));
});

socket.on('room:player-left', ({ hostId, players }: { hostId: string; players: DecryptoPlayerDTO[] }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, hostId, players } } : {}));
});

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

socket.on(DecryptoEvent.StateUpdated, ({ room }: { room: DecryptoRoomDTO }) => {
  useGameStore.setState({ room });
  saveSession();
});

socket.on(DecryptoEvent.PrivateStateUpdated, ({ private: privateState }: { private: PrivateTeamState }) => {
  useGameStore.setState({ privateState });
  saveSession();
});

socket.on('room:error', ({ message }: { message: string }) => {
  if (autoReconnecting.current) {
    clearAutoReconnecting();
    if (message === 'Room not found') {
      clearSession();
      return;
    }
  }
  clientLogger.error('room', 'Room error', { message });
  useGameStore.getState().setError(message);
});
