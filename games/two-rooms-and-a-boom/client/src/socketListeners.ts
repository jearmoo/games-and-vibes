import { clientLogger } from '@games/client-core';
import {
  TwoRoomsEvent,
  type GameStartedPayload,
  type RolesUpdatedPayload,
  type TwoRoomsPlayerDTO,
  type TwoRoomsRejoinGame,
  type TwoRoomsRoomDTO,
} from '@games/two-rooms-and-a-boom-shared';
import { SESSION_KEY } from './constants';
import { socket } from './socket';
import { useGameStore } from './store';

const log = clientLogger;

function saveSession(roomCode: string, playerId: string, playerName: string): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerName }));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

socket.on('connect', () => useGameStore.getState().setConnected(true));
socket.on('disconnect', () => useGameStore.getState().setConnected(false));

socket.on('session:taken-over', () => {
  clearSession();
  useGameStore.getState().reset();
  useGameStore.getState().setKickReason('You opened this room in another tab or device.');
});

socket.on('room:kicked', () => {
  clearSession();
  useGameStore.getState().reset();
  useGameStore.getState().setKickReason('You were removed from the room by the host.');
});

socket.on('room:error', ({ message }: { message: string }) => {
  useGameStore.getState().setError(message);
});

function applyJoin(payload: {
  roomCode: string;
  playerId: string;
  room: TwoRoomsRoomDTO;
  game?: TwoRoomsRejoinGame | null;
}): void {
  const { roomCode, playerId, room, game } = payload;
  const playerName = useGameStore.getState().playerName || room.players.find((p) => p.id === playerId)?.name || '';
  saveSession(roomCode, playerId, playerName);
  useGameStore.setState({
    roomCode,
    playerId,
    room,
    playerName,
    myRole: game?.role ?? null,
    composition: game?.composition ?? room.composition ?? [],
    error: null,
  });
}

socket.on('room:created', applyJoin);
socket.on('room:joined', applyJoin);
socket.on('room:rejoined', applyJoin);
socket.on('room:mid-game-joined', applyJoin);

socket.on('room:player-joined', ({ player }: { player: TwoRoomsPlayerDTO }) => {
  useGameStore.setState((s) =>
    s.room ? { room: { ...s.room, players: [...s.room.players.filter((p) => p.id !== player.id), player] } } : {},
  );
});

socket.on('room:player-left', ({ hostId, players }: { hostId: string; players: TwoRoomsPlayerDTO[] }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, hostId, players } } : {}));
});

socket.on('room:player-disconnected', ({ playerId }: { playerId: string }) => {
  useGameStore.setState((s) =>
    s.room
      ? {
          room: { ...s.room, players: s.room.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)) },
        }
      : {},
  );
});

socket.on('room:player-reconnected', ({ players }: { players: TwoRoomsPlayerDTO[] }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, players } } : {}));
});

socket.on('room:host-updated', ({ hostId }: { hostId: string }) => {
  useGameStore.setState((s) => (s.room ? { room: { ...s.room, hostId } } : {}));
});

socket.on(TwoRoomsEvent.RolesUpdated, ({ selectedItemIds }: RolesUpdatedPayload) => {
  useGameStore.setState((s) =>
    s.room ? { room: { ...s.room, settings: { ...s.room.settings, selectedItemIds } } } : {},
  );
});

socket.on(TwoRoomsEvent.GameStarted, ({ phase, role, assignedCount, composition }: GameStartedPayload) => {
  useGameStore.setState((s) =>
    s.room
      ? { room: { ...s.room, phase, assignedCount, composition }, myRole: role, composition }
      : { myRole: role, composition },
  );
});

socket.on(TwoRoomsEvent.BackToLobby, () => {
  useGameStore.setState((s) =>
    s.room
      ? { room: { ...s.room, phase: 'lobby', assignedCount: 0, composition: [] }, myRole: null, composition: [] }
      : { myRole: null, composition: [] },
  );
});

log.info('socket', 'Two Rooms and a Boom listeners registered');
