import { Socket } from 'socket.io';
import { SocketContext } from './socketContext.js';
import { BaseRoom } from './BaseRoom.js';
import { logger } from './logger.js';

const RECONNECT_GRACE_MS = 120_000;

export interface ConnectionCallbacks<T extends BaseRoom> {
  /** Called when a player disconnects during an active game. Use for game-specific cleanup. */
  onPlayerDisconnect?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
  /** Called when host needs reassignment. Return new host id or undefined. */
  onHostReassign?: (room: T, oldHostId: string) => string | undefined;
  /** Called before a player leaves, for cleaning up extra socket rooms (e.g., team rooms). */
  onBeforePlayerLeave?: (room: T, playerId: string, socket: Socket) => void;
}

export function registerConnectionHandlers<T extends BaseRoom>(
  ctx: SocketContext<T>,
  callbacks?: ConnectionCallbacks<T>,
) {
  const { io, socket, rooms } = ctx;

  socket.on('room:leave', () => handleLeave(ctx, callbacks));

  socket.on('disconnect', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;

    // Player already reconnected with a different socket — ignore this stale disconnect
    if (player.socketId !== socket.id) {
      socket.leave(room.code);
      return;
    }

    player.connected = false;
    player.disconnectedAt = Date.now();
    io.to(room.code).emit('room:player-disconnected', { playerId });
    logger.info('conn', 'Player disconnected', { room: room.code, player: player.name });

    // Game-specific disconnect handling
    if (room.isGameActive() && callbacks?.onPlayerDisconnect) {
      callbacks.onPlayerDisconnect(room, playerId, io);
    }

    // Host reassignment
    if (room.hostId === playerId) {
      const newHost = Array.from(room.players.values()).find((p) => p.connected && p.id !== playerId);
      if (newHost) {
        room.hostId = newHost.id;
        io.to(room.code).emit('room:host-updated', { hostId: newHost.id });
        logger.info('conn', 'Host auto-reassigned', {
          room: room.code,
          oldHost: player.name,
          newHost: newHost.name,
        });
      }
    }

    // Grace period — remove if still disconnected
    const disconnectSocketId = socket.id;
    setTimeout(() => {
      if (player.connected) return;
      if (player.socketId !== disconnectSocketId) return; // reconnected since this timer was set
      logger.info('conn', 'Player removed after grace period', { room: room.code, player: player.name });
      handleLeave(ctx, callbacks);
    }, RECONNECT_GRACE_MS);
  });
}

function handleLeave<T extends BaseRoom>(ctx: SocketContext<T>, callbacks?: ConnectionCallbacks<T>) {
  const { io, socket, rooms } = ctx;
  const playerId = ctx.getPlayerId();
  if (!playerId) return;
  const room = rooms.getRoomForPlayer(playerId);
  if (!room) return;
  callbacks?.onBeforePlayerLeave?.(room, playerId, socket);
  socket.leave(room.code);
  room.removePlayer(playerId);
  const softRemoved = !!room.getPlayer(playerId);
  if (!softRemoved) {
    rooms.untrackPlayer(playerId);
  }

  const activePlayers = room.getActivePlayers();
  if (activePlayers.length === 0) {
    rooms.deleteRoom(room.code);
    logger.info('room', 'Room deleted (empty)', { room: room.code });
  } else if (!softRemoved) {
    if (room.hostId === playerId) {
      const nextHost = activePlayers.find((p) => p.connected);
      if (nextHost) room.hostId = nextHost.id;
    }
    io.to(room.code).emit('room:player-left', {
      playerId,
      hostId: room.hostId,
      players: room.playerDTOs(),
    });
  }
  ctx.setPlayerId(null);
}
