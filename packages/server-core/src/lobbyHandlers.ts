import type { TeamId } from '@games/shared-types';
import { SocketContext } from './socketContext.js';
import { BaseRoom } from './BaseRoom.js';
import { logger } from './logger.js';
import { randomUUID } from 'crypto';

export interface LobbyCallbacks<T extends BaseRoom> {
  /** Build full game state for reconnecting player. Return null if no game in progress. */
  buildGameState: (room: T) => object | null;
  /** Called after a player reconnects to an active game (optional). */
  onPlayerReconnect?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
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

      const existingByName = room.getPlayerByName(playerName);
      const existingBySession = sessionId ? room.getPlayer(sessionId) : undefined;
      const existing = existingByName || existingBySession;

      if (existing) {
        const wasDisconnected = !existing.connected;
        existing.connected = true;
        existing.socketId = socket.id;
        existing.disconnectedAt = undefined;
        existing.removed = false;
        ctx.setPlayerId(existing.id);
        rooms.trackPlayer(existing.id, room.code);
        socket.join(room.code);
        if (existing.team) socket.join(`${room.code}:team${existing.team}`);

        socket.emit('room:rejoined', {
          roomCode: room.code,
          playerId: existing.id,
          room: room.toDTO(),
          game: callbacks.buildGameState(room),
        });
        if (wasDisconnected) {
          io.to(room.code).emit('room:player-reconnected', { playerId: existing.id });
          callbacks.onPlayerReconnect?.(room, existing.id, io);
        }
        logger.info('room', wasDisconnected ? 'Player reconnected' : 'Player re-attached', {
          room: room.code,
          player: playerName,
        });
        return;
      }

      if (room.isGameActive()) {
        logger.warn('room', 'Join rejected: game in progress', { room: room.code, player: playerName });
        socket.emit('room:error', { message: 'Game in progress. Use the same name to reconnect.' });
        return;
      }

      const playerId = randomUUID();
      ctx.setPlayerId(playerId);
      room.addPlayer(playerId, playerName, socket.id);
      rooms.trackPlayer(playerId, room.code);
      socket.join(room.code);
      socket.emit('room:joined', { roomCode: room.code, playerId, room: room.toDTO() });
      socket.to(room.code).emit('room:player-joined', {
        player: { id: playerId, name: playerName, team: null, connected: true },
      });
      metrics.playerJoined();
      logger.info('room', 'Player joined', { room: room.code, player: playerName });
    },
  );

  socket.on('team:join', ({ team }: { team: TeamId }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;
    if (player.team) socket.leave(`${room.code}:team${player.team}`);
    player.team = team;
    socket.join(`${room.code}:team${team}`);
    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
    logger.info('room', 'Player joined team', { room: room.code, player: player.name, team });
  });
}
