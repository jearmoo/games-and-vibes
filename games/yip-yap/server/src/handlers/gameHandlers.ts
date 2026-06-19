import type { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import {
  YipYapEvent,
  YipYapPhase,
  type CorrectClapPayload,
  type EndRoundPayload,
  type ResolveGuessPayload,
} from '@games/yip-yap-shared';
import type { YipYapRoom } from '../YipYapRoom.js';

function emitRoundStarted(room: YipYapRoom, io: Server) {
  const publicState = room.getPublicRoundState();
  if (!publicState) return;
  for (const player of room.players.values()) {
    if (!player.team || !player.socketId) continue;
    const privateState = room.getPrivateRoundStateFor({ playerId: player.id });
    if (!privateState) continue;
    io.to(player.socketId).emit(YipYapEvent.RoundStarted, {
      public: publicState,
      private: privateState,
    });
  }
}

function emitRoundUpdated(room: YipYapRoom, io: Server) {
  const publicState = room.getPublicRoundState();
  if (!publicState) return;
  io.to(room.code).emit(YipYapEvent.RoundUpdated, { public: publicState });
}

export function registerGameHandlers(ctx: SocketContext<YipYapRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on(YipYapEvent.StartRound, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId && room.roundsPlayed === 0) {
      logger.warn('game', 'Non-host attempted to start first round', { room: room.code, player: playerId });
      return;
    }
    if (room.phase !== YipYapPhase.LOBBY && room.phase !== YipYapPhase.GAME_OVER) {
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

    room.startRound();
    metrics.gameStarted();

    emitRoundStarted(room, io);

    logger.info('game', 'Round started', {
      room: room.code,
      players: room.getActivePlayers().length,
    });
  });

  socket.on(YipYapEvent.EndRound, (payload: EndRoundPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.phase !== YipYapPhase.ROUND) {
      logger.warn('game', 'endRound rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }
    const losingPlayerId = payload?.losingPlayerId;
    if (typeof losingPlayerId !== 'string') {
      logger.warn('game', 'endRound rejected: missing losingPlayerId', { room: room.code });
      return;
    }
    const loser = room.getPlayer(losingPlayerId);
    if (!loser || !loser.team) {
      logger.warn('game', 'endRound rejected: invalid losingPlayerId', {
        room: room.code,
        value: losingPlayerId,
      });
      return;
    }

    room.endRound({ losingPlayerId });
    metrics.gameCompleted();
    const reveal = room.getFullReveal();
    io.to(room.code).emit(YipYapEvent.RoundEnded, { reveal });
    logger.info('game', 'Round ended via wrong clap', {
      room: room.code,
      losingPlayerId,
      winningTeam: room.winningTeam,
    });
  });

  socket.on(YipYapEvent.CorrectClap, (payload: CorrectClapPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.phase !== YipYapPhase.ROUND) {
      logger.warn('game', 'correctClap rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }
    if (room.respondingState) {
      logger.warn('game', 'correctClap rejected: already responding', { room: room.code });
      return;
    }
    const clappingPlayerId = payload?.clappingPlayerId;
    if (typeof clappingPlayerId !== 'string') {
      logger.warn('game', 'correctClap rejected: missing clappingPlayerId', { room: room.code });
      return;
    }
    const clapper = room.getPlayer(clappingPlayerId);
    if (!clapper || !clapper.team) {
      logger.warn('game', 'correctClap rejected: invalid clappingPlayerId', {
        room: room.code,
        value: clappingPlayerId,
      });
      return;
    }

    room.correctClap({ clappingPlayerId });
    emitRoundUpdated(room, io);
    logger.info('game', 'Correct clap → response window opened', {
      room: room.code,
      clappingPlayerId,
      timerSeconds: room.settings.timerSeconds,
    });
  });

  socket.on(YipYapEvent.ResolveGuess, (payload: ResolveGuessPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.phase !== YipYapPhase.ROUND) {
      logger.warn('game', 'resolveGuess rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }
    if (!room.respondingState) {
      logger.warn('game', 'resolveGuess rejected: not in responding state', { room: room.code });
      return;
    }
    if (typeof payload?.guessedCorrectly !== 'boolean') {
      logger.warn('game', 'resolveGuess rejected: missing guessedCorrectly', { room: room.code });
      return;
    }

    room.resolveGuess({ guessedCorrectly: payload.guessedCorrectly });
    metrics.gameCompleted();
    const reveal = room.getFullReveal();
    io.to(room.code).emit(YipYapEvent.RoundEnded, { reveal });
    logger.info('game', 'Round ended via guess resolution', {
      room: room.code,
      guessedCorrectly: payload.guessedCorrectly,
      winningTeam: room.winningTeam,
    });
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
    if (room.phase !== YipYapPhase.LOBBY && room.phase !== YipYapPhase.GAME_OVER) {
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

  socket.on(YipYapEvent.StartNewRound, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.phase !== YipYapPhase.GAME_OVER) {
      logger.warn('game', 'startNewRound rejected: wrong phase', { room: room.code, phase: room.phase });
      return;
    }

    room.startNewRound();
    io.to(room.code).emit(YipYapEvent.NewRound);

    logger.info('game', 'New round prepared', { room: room.code });
  });
}
