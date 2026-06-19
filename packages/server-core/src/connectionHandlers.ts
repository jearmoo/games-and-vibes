import { Socket } from 'socket.io';
import { SocketContext } from './socketContext.js';
import { BaseRoom } from './BaseRoom.js';
import { logger } from './logger.js';

export interface ConnectionCallbacks<T extends BaseRoom> {
  /** Called when a player disconnects during an active game. Use for game-specific cleanup. */
  onPlayerDisconnect?: (room: T, playerId: string, io: SocketContext<T>['io']) => void;
  /** Called when host needs reassignment. Return undefined to keep the current host. */
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

    if (room.hostId === playerId) {
      const newHostId =
        callbacks?.onHostReassign?.(room, playerId) ??
        (callbacks?.onHostReassign
          ? undefined
          : room.getActivePlayers().find((activePlayer) => activePlayer.connected && activePlayer.id !== playerId)?.id);
      const newHost = newHostId ? room.getPlayer(newHostId) : undefined;
      if (newHost && !newHost.removed && newHost.id !== playerId) {
        room.hostId = newHost.id;
        io.to(room.code).emit('room:host-updated', { hostId: newHost.id });
        logger.info('conn', 'Host reassigned after disconnect', {
          room: room.code,
          oldHost: player.name,
          newHost: newHost.name,
        });
      }
    }

    room.touch();
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
  } else {
    if (room.hostId === playerId) {
      const nextHost = activePlayers.find((p) => p.connected) ?? activePlayers[0];
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
