import { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger, MetricsCollector } from '@games/server-core';
import type { TeamId } from '@games/adtaboo-shared';
import { GamePhase } from '@games/adtaboo-shared';
import { AdtabooRoom } from '../AdtabooRoom.js';
import { prepareCluingPhase, emitSetupCards } from './setupHandlers.js';

export function handleTurnEnd(room: AdtabooRoom, team: TeamId, io: Server, metrics: MetricsCollector) {
  const result = room.endCluing();
  if (!room.game) return;
  logger.info('game', 'Cluing ended', { room: room.code, team, turnScore: result.turnScore });

  if (result.nextPhase === GamePhase.CLUING_B) {
    io.to(room.code).emit('turn:transition', {
      phase: GamePhase.CLUING_B,
      turnScore: result.turnScore,
      scores: room.game.scores,
    });
    prepareCluingPhase(room, 'B', io);
  } else {
    if (result.nextPhase === GamePhase.GAME_OVER) {
      metrics.gameCompleted();
    }
    io.to(room.code).emit('round:ended', {
      phase: result.nextPhase,
      scores: room.game.scores,
      round: room.game.round,
      turnResults: room.game.turnResults,
      roundHistory: room.getRoundHistory(),
    });
  }
}

export function registerGameHandlers(ctx: SocketContext<AdtabooRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on('clue:begin', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const cluingTeam = room.getCluingTeam();
    if (!cluingTeam) return;
    const challenge = room.getActiveChallenge();
    if (!challenge || playerId !== challenge.clueGiverId) return;
    if (room.game.timerEnd !== null) return;

    const timerEnd = room.beginCluingTimer(() => handleTurnEnd(room, cluingTeam, io, metrics));
    logger.info('game', 'Clue-giver began cluing', { room: room.code, team: cluingTeam });
    io.to(room.code).emit('clue:timer-started', { timerEnd });
  });

  socket.on('clue:got-it', ({ cardIndex }: { cardIndex: number }) => {
    if (typeof cardIndex !== 'number' || !Number.isInteger(cardIndex) || cardIndex < 0) return;
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const cluingTeam = room.getCluingTeam();
    if (!cluingTeam) return;
    const challenge = room.getActiveChallenge();
    if (!challenge || playerId !== challenge.clueGiverId) return;

    if (!room.resolveCard(cardIndex)) return;
    const card = challenge.cards[cardIndex];
    logger.info('game', 'Card resolved', { room: room.code, team: cluingTeam, word: card.word });

    io.to(room.code).emit('clue:card-resolved', {
      cardIndex,
      word: card.word,
      result: 'correct',
      scores: room.game.scores,
    });

    if (room.allCardsResolved()) {
      handleTurnEnd(room, cluingTeam, io, metrics);
    }
  });

  socket.on('clue:undo', ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const challenge = room.getActiveChallenge();
    if (!challenge || playerId !== challenge.clueGiverId) return;
    if (!room.undoCard(cardIndex)) return;
    logger.info('game', 'Card undone', { room: room.code, word: challenge.cards[cardIndex].word });
    io.to(room.code).emit('clue:card-undone', { cardIndex, scores: room.game.scores });
  });

  socket.on('clue:end-turn', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const cluingTeam = room.getCluingTeam();
    if (!cluingTeam) return;
    const challenge = room.getActiveChallenge();
    if (!challenge || playerId !== challenge.clueGiverId) return;
    if (room.game.timerEnd === null) return;
    logger.info('game', 'Clue-giver ended turn early', { room: room.code, team: cluingTeam });
    handleTurnEnd(room, cluingTeam, io, metrics);
  });

  socket.on('taboo:buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const cluingTeam = room.getCluingTeam();
    if (!cluingTeam) return;
    const opposingTeam = room.getOpposingTeam(cluingTeam);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const count = room.buzzTabooWord(tabooWord);
    if (count === 0) return;
    logger.info('game', 'Taboo buzz', { room: room.code, tabooWord, count });
    io.to(room.code).emit('taboo:buzzed', {
      tabooWord,
      count,
      scores: room.game.scores,
      tabooBuzzes: room.game.challenges[cluingTeam].tabooBuzzes,
    });
  });

  socket.on('taboo:undo-buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    const cluingTeam = room.getCluingTeam();
    if (!cluingTeam) return;
    const opposingTeam = room.getOpposingTeam(cluingTeam);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const count = room.undoBuzzTabooWord(tabooWord);
    if (count === null) return;
    logger.info('game', 'Taboo undo-buzz', { room: room.code, tabooWord, count });
    io.to(room.code).emit('taboo:unbuzzed', {
      tabooWord,
      count,
      scores: room.game.scores,
      tabooBuzzes: room.game.challenges[cluingTeam].tabooBuzzes,
    });
  });

  socket.on('round:next', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.ROUND_RESULT) return;
    if (room.hostId !== playerId) return;

    room.ensureTabooMaster('A');
    room.ensureTabooMaster('B');
    room.advanceToNextRound();

    logger.info('game', 'Next round', { room: room.code, round: room.game.round });

    io.to(room.code).emit('setup:started', {
      phase: GamePhase.PARALLEL_SETUP,
      round: room.game.round,
      scores: room.game.scores,
      challengeCards: [],
      tabooMasters: room.tabooMasters,
    });

    room
      .fetchInitialWords()
      .then(() => {
        if (!room.game) return;
        emitSetupCards(room, io);
        io.to(room.code).emit('setup:status', room.getSetupStatus());
      })
      .catch((e) => {
        logger.error('game', 'Failed to fetch words for next round', { room: room.code, error: String(e) });
      });
  });

  socket.on('game:play-again', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (room.hostId !== playerId) return;
    logger.info('game', 'Play again', { room: room.code });
    room.resetToLobby();
    io.to(room.code).emit('game:reset', { room: room.toDTO() });
  });
}
