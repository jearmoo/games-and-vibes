import { Socket } from 'socket.io';
import { SocketContext } from './socketContext.js';
import { BaseRoom } from './BaseRoom.js';
import { logger } from './logger.js';
import { randomUUID } from 'crypto';

export interface LobbyCallbacks<T extends BaseRoom> {
  /** Build full game state for reconnecting player. Return null if no game in progress. */
  buildGameState: (room: T, playerId: string) => object | null;
  /** Called after a player reconnects to an active game (optional). */
  onPlayerReconnect?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
  /** Called when a player joins/rejoins, after socket joins the room. Use for extra socket room assignments (e.g., team rooms). */
  onPlayerSocketJoin?: (room: T, playerId: string, socket: Socket) => void;
  /** Called when a new player joins an active game. If not provided, mid-game joins are rejected. */
  onMidGameJoin?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
}

function validatePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 20);
  return trimmed || null;
}

export function registerLobbyHandlers<T extends BaseRoom>(ctx: SocketContext<T>, callbacks: LobbyCallbacks<T>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on('room:create', ({ playerName }: { playerName: string }) => {
    const validName = validatePlayerName(playerName);
    if (!validName) {
      socket.emit('room:error', { message: 'Player name is required' });
      return;
    }
    const playerId = randomUUID();
    ctx.setPlayerId(playerId);
    const room = rooms.createRoom(playerId);
    room.addPlayer(playerId, validName, socket.id);
    rooms.trackPlayer(playerId, room.code);
    socket.join(room.code);
    socket.emit('room:created', { roomCode: room.code, playerId, room: room.toDTO() });
    metrics.roomCreated();
    metrics.playerJoined();
    logger.info('room', 'Room created', { room: room.code, player: validName });
  });

  socket.on(
    'room:join',
    ({ roomCode, playerName, sessionId }: { roomCode: string; playerName: string; sessionId?: string }) => {
      const validName = validatePlayerName(playerName);
      if (!validName) {
        socket.emit('room:error', { message: 'Player name is required' });
        return;
      }
      const room = rooms.getRoom(roomCode);
      if (!room) {
        logger.warn('room', 'Join failed: room not found', { room: roomCode, player: validName });
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // 1. Reconnection — match by sessionId first, then by name
      const existingBySession = sessionId ? room.getPlayer(sessionId) : undefined;
      const existingByName = room.getPlayerByName(validName);
      const existing = existingBySession || existingByName;

      if (existing) {
        // Force-disconnect old socket to prevent stale actions
        const oldSocketId = existing.socketId;
        if (oldSocketId && oldSocketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(oldSocketId);
          if (oldSocket) {
            oldSocket.emit('session:taken-over');
            oldSocket.disconnect(true);
          }
        }

        const wasDisconnected = !existing.connected;
        existing.connected = true;
        existing.socketId = socket.id;
        existing.disconnectedAt = undefined;
        existing.removed = false;
        ctx.setPlayerId(existing.id);
        rooms.trackPlayer(existing.id, room.code);
        socket.join(room.code);
        callbacks.onPlayerSocketJoin?.(room, existing.id, socket);

        socket.emit('room:rejoined', {
          roomCode: room.code,
          playerId: existing.id,
          room: room.toDTO(),
          game: callbacks.buildGameState(room, existing.id),
        });
        if (wasDisconnected) {
          io.to(room.code).emit('room:player-reconnected', {
            playerId: existing.id,
            players: room.playerDTOs(),
          });
          callbacks.onPlayerReconnect?.(room, existing.id, io);
        }
        logger.info('room', wasDisconnected ? 'Player reconnected' : 'Player re-attached', {
          room: room.code,
          player: validName,
        });
        return;
      }

      // 2. Game-in-progress check
      if (room.isGameActive()) {
        if (!callbacks.onMidGameJoin) {
          logger.warn('room', 'Join rejected: game in progress', { room: room.code, player: validName });
          socket.emit('room:error', { message: 'Game in progress. Use the same name to reconnect.' });
          return;
        }
        const playerId = randomUUID();
        ctx.setPlayerId(playerId);
        room.addPlayer(playerId, validName, socket.id);
        rooms.trackPlayer(playerId, room.code);
        socket.join(room.code);
        callbacks.onPlayerSocketJoin?.(room, playerId, socket);
        const playerDTO = room.playerDTOs().find((p) => p.id === playerId);
        socket.emit('room:mid-game-joined', {
          roomCode: room.code,
          playerId,
          room: room.toDTO(),
          game: callbacks.buildGameState(room, playerId),
        });
        socket.to(room.code).emit('room:player-joined', { player: playerDTO });
        callbacks.onMidGameJoin(room, playerId, io);
        metrics.playerJoined();
        logger.info('room', 'Player joined mid-game', { room: room.code, player: validName });
        return;
      }

      const playerId = randomUUID();
      ctx.setPlayerId(playerId);
      room.addPlayer(playerId, validName, socket.id);
      rooms.trackPlayer(playerId, room.code);
      socket.join(room.code);
      const playerDTO = room.playerDTOs().find((p) => p.id === playerId);
      socket.emit('room:joined', { roomCode: room.code, playerId, room: room.toDTO() });
      socket.to(room.code).emit('room:player-joined', { player: playerDTO });
      metrics.playerJoined();
      logger.info('room', 'Player joined', { room: room.code, player: validName });
    },
  );
}
