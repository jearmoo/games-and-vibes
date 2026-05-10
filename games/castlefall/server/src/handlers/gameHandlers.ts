import type { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import {
  CastlefallEvent,
  CastlefallPhase,
  type EndRoundPayload,
  type StartRoundPayload,
  type WinningTeam,
} from '@games/castlefall-shared';
import type { CastlefallRoom } from '../CastlefallRoom.js';

function emitRoundStarted(room: CastlefallRoom, io: Server) {
  const publicState = room.getPublicRoundState();
  if (!publicState) return;
  for (const player of room.players.values()) {
    if (!player.team || !player.socketId) continue;
    const privateState = room.getPrivateRoundStateFor({ playerId: player.id });
    if (!privateState) continue;
    io.to(player.socketId).emit(CastlefallEvent.RoundStarted, {
      public: publicState,
      private: privateState,
    });
  }
}

export function registerGameHandlers(ctx: SocketContext<CastlefallRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on(CastlefallEvent.StartRound, (payload: StartRoundPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId) {
      logger.warn('game', 'Non-host attempted to start round', { room: room.code, player: playerId });
      return;
    }
    if (room.phase !== CastlefallPhase.LOBBY && room.phase !== CastlefallPhase.GAME_OVER) {
      logger.warn('game', 'startRound rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }

    const connectedActive = room.getActivePlayers().filter((p) => p.connected).length;
    if (connectedActive < 2) {
      logger.warn('game', 'startRound rejected: need at least 2 connected players', {
        room: room.code,
        connectedActive,
      });
      socket.emit('room:error', { message: 'Need at least 2 connected players to start.' });
      return;
    }

    const timerSeconds = Math.max(0, Math.floor(Number(payload?.timerSeconds) || 0));
    room.startRound({ timerSeconds });
    metrics.gameStarted();

    emitRoundStarted(room, io);

    logger.info('game', 'Round started', {
      room: room.code,
      players: room.getActivePlayers().length,
      timerSeconds,
    });
  });

  socket.on(CastlefallEvent.EndRound, (payload: EndRoundPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId) {
      logger.warn('game', 'Non-host attempted to end round', { room: room.code, player: playerId });
      return;
    }
    if (room.phase !== CastlefallPhase.ROUND) {
      logger.warn('game', 'endRound rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }

    const winningTeam = validateWinningTeam(payload?.winningTeam);
    if (winningTeam === null) {
      logger.warn('game', 'endRound rejected: invalid winningTeam', {
        room: room.code,
        value: payload?.winningTeam,
      });
      return;
    }

    room.endRound({ winningTeam });
    metrics.gameCompleted();

    const reveal = room.getFullReveal();
    io.to(room.code).emit(CastlefallEvent.RoundEnded, { reveal });

    logger.info('game', 'Round ended', { room: room.code, winningTeam });
  });

  socket.on('settings:update', (payload: { timerSeconds?: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId) {
      logger.warn('game', 'Non-host attempted to update settings', { room: room.code, player: playerId });
      return;
    }
    if (room.phase !== CastlefallPhase.LOBBY && room.phase !== CastlefallPhase.GAME_OVER) {
      logger.warn('game', 'settings:update rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }

    if (payload?.timerSeconds !== undefined) {
      const value = Math.floor(Number(payload.timerSeconds));
      if (Number.isFinite(value) && value >= 0) {
        room.settings.timerSeconds = Math.min(3600, value);
      }
    }
    room.touch();
    io.to(room.code).emit('settings:updated', { settings: room.settings });
  });

  socket.on(CastlefallEvent.StartNewRound, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId) {
      logger.warn('game', 'Non-host attempted to start new round', { room: room.code, player: playerId });
      return;
    }
    if (room.phase !== CastlefallPhase.GAME_OVER) {
      logger.warn('game', 'startNewRound rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }

    room.startNewRound();
    io.to(room.code).emit(CastlefallEvent.NewRound);

    logger.info('game', 'New round prepared', { room: room.code });
  });
}

function validateWinningTeam(value: unknown): WinningTeam | null {
  if (value === 1 || value === 2 || value === 'draw') return value;
  return null;
}
