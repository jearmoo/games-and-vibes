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

  /** Guard: verify caller is the cluer (or host if cluer disconnected) during a review phase. Returns room + team or null. */
  function getReviewContext(): { room: AdtabooRoom; team: TeamId } | null {
    const playerId = ctx.getPlayerId();
    if (!playerId) return null;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return null;
    if (room.game.phase !== GamePhase.REVIEW_A && room.game.phase !== GamePhase.REVIEW_B) return null;
    const team: TeamId = room.game.phase === GamePhase.REVIEW_A ? 'A' : 'B';
    const cluerId = room.game.challenges[team].clueGiverId;
    if (playerId === cluerId) return { room, team };
    // Fallback: allow host if cluer is disconnected
    const cluer = cluerId ? room.getPlayer(cluerId) : null;
    if (playerId === room.hostId && (!cluer || !cluer.connected)) return { room, team };
    return null;
  }

  function emitReviewUpdate(room: AdtabooRoom, team: TeamId): void {
    io.to(room.code).emit('review:updated', {
      tabooBuzzes: room.game!.challenges[team].tabooBuzzes,
      turnScore: room.game!.turnResults[team],
      scores: room.game!.scores,
    });
  }

  socket.on('review:buzz', ({ tabooWord }: { tabooWord: string }) => {
    const rc = getReviewContext();
    if (!rc) return;
    const count = rc.room.buzzTabooWord(tabooWord);
    if (count === 0) return;
    rc.room.recalcTurnScore(rc.team);
    emitReviewUpdate(rc.room, rc.team);
  });

  socket.on('review:undo-buzz', ({ tabooWord }: { tabooWord: string }) => {
    const rc = getReviewContext();
    if (!rc) return;
    const count = rc.room.undoBuzzTabooWord(tabooWord);
    if (count === null) return;
    rc.room.recalcTurnScore(rc.team);
    emitReviewUpdate(rc.room, rc.team);
  });

  socket.on('review:toggle-card', ({ cardIndex }: { cardIndex: number }) => {
    const rc = getReviewContext();
    if (!rc) return;
    const card = rc.room.game!.challenges[rc.team].cards[cardIndex];
    if (!card) return;
    card.result = card.result === 'correct' ? null : 'correct';
    rc.room.recalcTurnScore(rc.team);
    io.to(rc.room.code).emit('review:card-toggled', {
      cardIndex,
      result: card.result,
      turnScore: rc.room.game!.turnResults[rc.team],
      scores: rc.room.game!.scores,
    });
  });

  socket.on('review:lock-in', () => {
    const rc = getReviewContext();
    if (!rc) return;
    const result = rc.room.lockInReview();
    if (!result) return;

    logger.info('game', 'Review locked in', { room: rc.room.code, team: rc.team, nextPhase: result.nextPhase });

    if (result.nextPhase === GamePhase.CLUING_B) {
      io.to(rc.room.code).emit('turn:transition', {
        phase: GamePhase.CLUING_B,
        turnScore: rc.room.game!.turnResults.A,
        scores: rc.room.game!.scores,
        roundHistory: rc.room.getRoundHistory(),
      });
      prepareCluingPhase(rc.room, 'B', io);
    } else {
      if (result.nextPhase === GamePhase.GAME_OVER) {
        metrics.gameCompleted();
      }
      io.to(rc.room.code).emit('round:ended', {
        phase: result.nextPhase,
        scores: rc.room.game!.scores,
        round: rc.room.game!.round,
        turnResults: rc.room.game!.turnResults,
        roundHistory: rc.room.getRoundHistory(),
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

    // Emit pre-picked clue-givers
    for (const team of ['A', 'B'] as const) {
      const cgId = room.game.challenges[team].clueGiverId;
      if (cgId) io.to(room.code).emit('setup:clue-giver-set', { team, clueGiverId: cgId });
    }

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
