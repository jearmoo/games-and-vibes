import { Socket } from 'socket.io';
import { SocketContext } from './socketContext.js';
import { BaseRoom } from './BaseRoom.js';
import { logger } from './logger.js';
import { randomUUID } from 'crypto';

export interface LobbyCallbacks<T extends BaseRoom> {
  /** Build full game state for reconnecting player. Return null if no game in progress. */
  buildGameState: (room: T) => object | null;
  /** Called after a player reconnects to an active game (optional). */
  onPlayerReconnect?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
  /** Called when a player joins/rejoins, after socket joins the room. Use for extra socket room assignments (e.g., team rooms). */
  onPlayerSocketJoin?: (room: T, playerId: string, socket: Socket) => void;
  /** Called when a new player joins an active game. If not provided, mid-game joins are rejected. */
  onMidGameJoin?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
}

export function registerLobbyHandlers<T extends BaseRoom>(ctx: SocketContext<T>, callbacks: LobbyCallbacks<T>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on('room:create', ({ playerName }: { playerName: string }) => {
    const playerId = randomUUID();
    ctx.setPlayerId(playerId);
    const room = rooms.createRoom(playerId);
    room.addPlayer(playerId, playerName, socket.id);
    rooms.trackPlayer(playerId, room.code);
    socket.join(room.code);
    socket.emit('room:created', { roomCode: room.code, playerId, room: room.toDTO() });
    metrics.roomCreated();
    metrics.playerJoined();
    logger.info('room', 'Room created', { room: room.code, player: playerName });
  });

  socket.on(
    'room:join',
    ({ roomCode, playerName, sessionId }: { roomCode: string; playerName: string; sessionId?: string }) => {
      const room = rooms.getRoom(roomCode);
      if (!room) {
        logger.warn('room', 'Join failed: room not found', { room: roomCode, player: playerName });
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // 1. Reconnection — match by sessionId first, then by name
      const existingBySession = sessionId ? room.getPlayer(sessionId) : undefined;
      const existingByName = room.getPlayerByName(playerName);
      const existing = existingBySession || existingByName;

      if (existing) {
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
          game: callbacks.buildGameState(room),
        });
        if (wasDisconnected) {
          io.to(room.code).emit('room:player-reconnected', { playerId: existing.id });
          // Broadcast updated player list so all clients have correct state
          io.to(room.code).emit('room:player-left', {
            playerId: existing.id,
            hostId: room.hostId,
            players: room.playerDTOs(),
          });
          callbacks.onPlayerReconnect?.(room, existing.id, io);
        }
        logger.info('room', wasDisconnected ? 'Player reconnected' : 'Player re-attached', {
          room: room.code,
          player: playerName,
        });
        return;
      }

      // 2. Game-in-progress check
      if (room.isGameActive()) {
        if (!callbacks.onMidGameJoin) {
          logger.warn('room', 'Join rejected: game in progress', { room: room.code, player: playerName });
          socket.emit('room:error', { message: 'Game in progress. Use the same name to reconnect.' });
          return;
        }
        const playerId = randomUUID();
        ctx.setPlayerId(playerId);
        room.addPlayer(playerId, playerName, socket.id);
        rooms.trackPlayer(playerId, room.code);
        socket.join(room.code);
        callbacks.onPlayerSocketJoin?.(room, playerId, socket);
        const playerDTO = room.playerDTOs().find((p) => p.id === playerId);
        socket.emit('room:mid-game-joined', {
          roomCode: room.code,
          playerId,
          room: room.toDTO(),
          game: callbacks.buildGameState(room),
        });
        socket.to(room.code).emit('room:player-joined', { player: playerDTO });
        callbacks.onMidGameJoin(room, playerId, io);
        metrics.playerJoined();
        logger.info('room', 'Player joined mid-game', { room: room.code, player: playerName });
        return;
      }

      const playerId = randomUUID();
      ctx.setPlayerId(playerId);
      room.addPlayer(playerId, playerName, socket.id);
      rooms.trackPlayer(playerId, room.code);
      socket.join(room.code);
      const playerDTO = room.playerDTOs().find((p) => p.id === playerId);
      socket.emit('room:joined', { roomCode: room.code, playerId, room: room.toDTO() });
      socket.to(room.code).emit('room:player-joined', { player: playerDTO });
      metrics.playerJoined();
      logger.info('room', 'Player joined', { room: room.code, player: playerName });
    },
  );
}
