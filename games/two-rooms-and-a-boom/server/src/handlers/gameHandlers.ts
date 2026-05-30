import type { SocketContext } from '@games/server-core';
import {
  DECK_ITEM_MAP,
  TwoRoomsEvent,
  TwoRoomsPhase,
  type UpdateRolesPayload,
} from '@games/two-rooms-and-a-boom-shared';
import { TwoRoomsRoom } from '../TwoRoomsRoom.js';

/** Keep only known, non-locked deck-item ids. Requirements are resolved in the room. */
function sanitizeSelection(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const item = DECK_ITEM_MAP.get(value);
    if (item && item.kind !== 'locked') seen.add(value);
  }
  return [...seen];
}

export function registerGameHandlers(ctx: SocketContext<TwoRoomsRoom>): void {
  const { io, socket, rooms, metrics } = ctx;

  socket.on(TwoRoomsEvent.UpdateRoles, (payload: UpdateRolesPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.hostId !== playerId) return;
    if (room.getPhase() !== TwoRoomsPhase.LOBBY) return;

    room.setSelection(sanitizeSelection(payload?.selectedItemIds));
    io.to(room.code).emit(TwoRoomsEvent.RolesUpdated, { selectedItemIds: room.settings.selectedItemIds });
    room.touch();
  });

  socket.on(TwoRoomsEvent.StartGame, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.hostId !== playerId) return;
    if (room.getPhase() !== TwoRoomsPhase.LOBBY) return;

    const players = room.dealablePlayers();
    if (players.length < 1) {
      socket.emit('room:error', { message: 'Need at least one connected player to deal.' });
      return;
    }
    const built = room.currentDeck();
    if (!built.valid) {
      socket.emit('room:error', {
        message: `Too many cards selected: ${built.fixedCount} for ${players.length} players. Remove ${built.overBy}.`,
      });
      return;
    }

    room.startGame();
    metrics.gameStarted();

    const assignedCount = room.assignedCount();
    const composition = room.composition();
    for (const player of players) {
      const target = io.sockets.sockets.get(player.socketId);
      if (!target) continue;
      target.emit(TwoRoomsEvent.GameStarted, {
        phase: TwoRoomsPhase.REVEAL,
        role: room.getRoleFor(player.id),
        assignedCount,
        composition,
      });
    }
    room.touch();
  });

  socket.on(TwoRoomsEvent.ReturnToLobby, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.hostId !== playerId) return;
    if (room.getPhase() !== TwoRoomsPhase.REVEAL) return;

    room.resetToLobby();
    io.to(room.code).emit(TwoRoomsEvent.BackToLobby);
    room.touch();
  });
}
