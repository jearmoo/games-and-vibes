import { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger, MetricsCollector } from '@games/server-core';
import type { TeamId } from '@games/adtaboo-shared';
import { GamePhase } from '@games/adtaboo-shared';
import { AdtabooRoom } from '../AdtabooRoom.js';
import { prepareCluingPhase, emitSetupCards } from './setupHandlers.js';

export function handleTurnEnd(room: AdtabooRoom, team: TeamId, io: Server, _metrics: MetricsCollector) {
  const result = room.endCluing();
  if (!result || !room.game) return;
  logger.info('game', 'Cluing ended, entering review', { room: room.code, team, turnScore: result.turnScore });

  // Always transition to review phase (REVIEW_A or REVIEW_B)
  io.to(room.code).emit('turn:review', {
    phase: result.nextPhase,
    team,
    turnScore: result.turnScore,
    scores: room.game.scores,
    cards: room.game.challenges[team].cards,
    tabooWords: room.game.challenges[team].tabooWords,
    tabooBuzzes: room.game.challenges[team].tabooBuzzes,
  });
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

  // Review: TM can buzz taboo during review
  socket.on('review:buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.REVIEW_A && room.game.phase !== GamePhase.REVIEW_B) return;

    const team = room.game.phase === GamePhase.REVIEW_A ? 'A' : 'B';
    const opposingTeam = room.getOpposingTeam(team);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const count = room.buzzTabooWord(tabooWord);
    if (count === 0) return;
    room.recalcTurnScore(team);

    io.to(room.code).emit('review:updated', {
      tabooBuzzes: room.game.challenges[team].tabooBuzzes,
      turnScore: room.game.turnResults[team],
      scores: room.game.scores,
    });
  });

  // Review: TM can undo buzz during review
  socket.on('review:undo-buzz', ({ tabooWord }: { tabooWord: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.REVIEW_A && room.game.phase !== GamePhase.REVIEW_B) return;

    const team = room.game.phase === GamePhase.REVIEW_A ? 'A' : 'B';
    const opposingTeam = room.getOpposingTeam(team);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const count = room.undoBuzzTabooWord(tabooWord);
    if (count === null) return;
    room.recalcTurnScore(team);

    io.to(room.code).emit('review:updated', {
      tabooBuzzes: room.game.challenges[team].tabooBuzzes,
      turnScore: room.game.turnResults[team],
      scores: room.game.scores,
    });
  });

  // Review: TM can toggle card result during review
  socket.on('review:toggle-card', ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.REVIEW_A && room.game.phase !== GamePhase.REVIEW_B) return;

    const team = room.game.phase === GamePhase.REVIEW_A ? 'A' : 'B';
    const opposingTeam = room.getOpposingTeam(team);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const card = room.game.challenges[team].cards[cardIndex];
    if (!card) return;

    // Toggle between correct and null
    card.result = card.result === 'correct' ? null : 'correct';
    room.recalcTurnScore(team);

    io.to(room.code).emit('review:card-toggled', {
      cardIndex,
      result: card.result,
      turnScore: room.game.turnResults[team],
      scores: room.game.scores,
    });
  });

  // Review: lock in — opposing team's TM advances to next phase
  socket.on('review:lock-in', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.REVIEW_A && room.game.phase !== GamePhase.REVIEW_B) return;

    const team = room.game.phase === GamePhase.REVIEW_A ? 'A' : 'B';
    const opposingTeam = room.getOpposingTeam(team);
    if (playerId !== room.tabooMasters[opposingTeam]) return;

    const result = room.lockInReview();
    if (!result) return;

    logger.info('game', 'Review locked in', { room: room.code, team, nextPhase: result.nextPhase });

    if (result.nextPhase === GamePhase.CLUING_B) {
      io.to(room.code).emit('turn:transition', {
        phase: GamePhase.CLUING_B,
        turnScore: room.game.turnResults.A,
        scores: room.game.scores,
        roundHistory: room.getRoundHistory(),
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

  socket.on('game:end', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.ROUND_RESULT) return;
    if (room.hostId !== playerId) return;

    room.game.phase = GamePhase.GAME_OVER;
    room.touch();
    metrics.gameCompleted();
    logger.info('game', 'Host ended game', { room: room.code, round: room.game.round });

    io.to(room.code).emit('round:ended', {
      phase: GamePhase.GAME_OVER,
      scores: room.game.scores,
      round: room.game.round,
      turnResults: room.game.turnResults,
      roundHistory: room.getRoundHistory(),
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
