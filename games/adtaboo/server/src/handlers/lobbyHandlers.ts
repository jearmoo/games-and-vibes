import type { SocketContext, MetricsCollector } from '@games/server-core';
import { logger } from '@games/server-core';
import type { TeamId } from '@games/shared-types';
import { GamePhase } from '@games/adtaboo-shared';
import { AdtabooRoom } from '../AdtabooRoom.js';
import { emitSetupCards } from './setupHandlers.js';

/** Taboo-specific lobby handlers (game:start, taboo-master:set, settings:update) */
export function registerAdtabooLobbyHandlers(ctx: SocketContext<AdtabooRoom>, metrics: MetricsCollector) {
  const { io, socket, rooms } = ctx;

  socket.on('taboo-master:set', ({ team, masterId }: { team: TeamId; masterId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.setTabooMaster(team, masterId)) {
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      const masterName = room.getPlayer(masterId)?.name;
      logger.info('room', 'Taboo master set', { room: room.code, team, master: masterName });
    }
  });

  socket.on(
    'settings:update',
    ({
      rounds,
      timerSeconds,
      wordsPerTurn,
      maxTabooWords,
    }: {
      rounds?: number;
      timerSeconds?: number;
      wordsPerTurn?: number;
      maxTabooWords?: number;
    }) => {
      const playerId = ctx.getPlayerId();
      if (!playerId) return;
      const room = rooms.getRoomForPlayer(playerId);
      if (!room || room.hostId !== playerId) return;
      if (rounds !== undefined) room.settings.rounds = Math.max(1, Math.min(5, rounds));
      if (timerSeconds !== undefined) room.settings.timerSeconds = Math.max(10, Math.min(600, timerSeconds));
      if (wordsPerTurn !== undefined) room.settings.wordsPerTurn = Math.max(1, Math.min(10, wordsPerTurn));
      if (maxTabooWords !== undefined) room.settings.maxTabooWords = Math.max(5, Math.min(30, maxTabooWords));
      io.to(room.code).emit('settings:updated', { settings: room.settings });
      logger.debug('room', 'Settings updated', { room: room.code, settings: room.settings });
    },
  );

  socket.on('game:start', async () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    const check = room.canStart();
    if (!check.ok) {
      socket.emit('room:error', { message: check.reason });
      return;
    }

    room.startGame();
    metrics.gameStarted();
    logger.info('game', 'Game started', {
      room: room.code,
      players: room.playerDTOs().map((p) => p.name),
      settings: room.settings,
    });

    io.to(room.code).emit('setup:started', {
      phase: GamePhase.PARALLEL_SETUP,
      round: room.game!.round,
      scores: room.game!.scores,
      challengeCards: [],
      tabooMasters: room.tabooMasters,
    });

    try {
      await room.fetchInitialWords();
    } catch (e) {
      logger.error('game', 'Failed to fetch initial words', { room: room.code, error: String(e) });
    }
    if (!room.game) return;

    emitSetupCards(room, io);
    io.to(room.code).emit('setup:status', room.getSetupStatus());
  });
}
