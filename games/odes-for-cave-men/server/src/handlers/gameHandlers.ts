import type { Server } from 'socket.io';
import type { SocketContext, MetricsCollector } from '@games/server-core';
import { logger } from '@games/server-core';
import type { CaveRoom } from '../CaveRoom.js';
import { GamePhase } from '@games/odes-for-cave-men-shared';

function sendWordToCluerAndOpponents(room: CaveRoom, io: Server) {
  if (!room.game) return;
  const currentWord = room.getCurrentWord();
  const wordPayload = currentWord ? { word1: currentWord.word1, word3: currentWord.word3 } : null;

  const cluer = room.game.cluerId ? room.getPlayer(room.game.cluerId) : null;
  if (cluer) {
    io.to(cluer.socketId).emit('word:next', { word: wordPayload });
  }
  const opposingTeam = room.game.playingTeam === 'A' ? 'B' : 'A';
  for (const p of room.getTeamPlayers(opposingTeam)) {
    io.to(p.socketId).emit('word:next', { word: wordPayload });
  }
}

export function handleTurnEnd(room: CaveRoom, io: Server, _metrics: MetricsCollector) {
  if (!room.game || room.game.phase !== GamePhase.PLAYING) return;

  room.endTurn();
  const resolvedCards = room.getResolvedCards();
  logger.info('game', 'Turn ended, entering review', {
    room: room.code,
    team: room.game.playingTeam,
    cards: resolvedCards.length,
  });

  io.to(room.code).emit('turn:review', {
    phase: GamePhase.REVIEW,
    cards: resolvedCards,
    scores: room.game.scores,
    cluerId: room.game.cluerId,
    playingTeam: room.game.playingTeam,
  });
}

export function registerGameHandlers(ctx: SocketContext<CaveRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  // Change cluer selection during READY phase
  socket.on('turn:pick-cluer', ({ cluerId: newCluerId }: { cluerId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.READY) return;

    // Verify the new cluer is on the playing team
    const newCluer = room.getPlayer(newCluerId);
    if (!newCluer || newCluer.team !== room.game.playingTeam) return;

    room.game.cluerId = newCluerId;
    room.touch();

    io.to(room.code).emit('turn:cluer-changed', {
      cluerId: newCluerId,
      cluerName: newCluer.name,
    });
  });

  // Cluer starts their turn (from the READY screen)
  socket.on('turn:start', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.READY) return;
    if (playerId !== room.game.cluerId) return;

    room.startTurn();
    const timerEnd = room.beginTimer(() => handleTurnEnd(room, io, metrics));

    const currentWord = room.getCurrentWord();
    const wordPayload = currentWord ? { word1: currentWord.word1, word3: currentWord.word3 } : null;
    const { playingTeam, cluerId } = room.game;
    const opposingTeam = playingTeam === 'A' ? 'B' : 'A';

    // Cluer gets word
    const cluer = room.getPlayer(cluerId!);
    if (cluer) {
      io.to(cluer.socketId).emit('turn:started', {
        role: 'cluer',
        word: wordPayload,
        timerEnd,
        cluerId,
        playingTeam,
      });
    }

    // Guessers (same team, not cluer) get no word
    for (const p of room.getTeamPlayers(playingTeam)) {
      if (p.id !== cluerId) {
        io.to(p.socketId).emit('turn:started', {
          role: 'guesser',
          word: null,
          timerEnd,
          cluerId,
          playingTeam,
        });
      }
    }

    // Opposing team gets word
    for (const p of room.getTeamPlayers(opposingTeam)) {
      io.to(p.socketId).emit('turn:started', {
        role: 'opponent',
        word: wordPayload,
        timerEnd,
        cluerId,
        playingTeam,
      });
    }

    logger.info('game', 'Turn started', { room: room.code, team: playingTeam, cluer: cluer?.name });
  });

  // Word resolved — only cluer can do this
  socket.on('word:resolve', ({ result, points }: { result: 'correct' | 'skipped' | 'bonked'; points: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (playerId !== room.game.cluerId) return;
    if (room.game.phase !== GamePhase.PLAYING) return;

    // Skipped and bonked are always -1
    const resolvedPoints = result === 'correct' ? points : -1;
    const resolved = room.resolveCurrentWord({ result, points: resolvedPoints });
    if (!resolved) return;

    const nextWord = room.getCurrentWord();

    // Send result to everyone
    io.to(room.code).emit('word:resolved', {
      result,
      points: resolved.points,
      word1: resolved.word1,
      word3: resolved.word3,
      scores: room.game.scores,
    });

    // Send next word to cluer and opponents
    if (nextWord) {
      sendWordToCluerAndOpponents(room, io);
    } else {
      handleTurnEnd(room, io, metrics);
    }
  });

  // Cluer ends turn early (gives up)
  socket.on('clue:end-turn', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.PLAYING) return;
    if (playerId !== room.game.cluerId) return;
    if (room.game.timerEnd === null) return;
    logger.info('game', 'Cluer ended turn early', { room: room.code, player: room.getPlayer(playerId)?.name });
    handleTurnEnd(room, io, metrics);
  });

  // Bonk alert — any opponent can send this (visual only)
  socket.on('bonk:alert', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (room.game.phase !== GamePhase.PLAYING) return;

    // Verify sender is on the opposing team
    const player = room.getPlayer(playerId);
    if (!player?.team || player.team === room.game.playingTeam) return;

    // Flash the cluer's screen
    const cluer = room.game.cluerId ? room.getPlayer(room.game.cluerId) : null;
    if (cluer) {
      io.to(cluer.socketId).emit('bonk:flash');
    }
    logger.info('game', 'Bonk alert sent', { room: room.code, from: player.name });
  });

  // Review: adjust card points — only cluer
  socket.on('review:adjust', ({ index, points }: { index: number; points: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (playerId !== room.game.cluerId) return;
    if (room.game.phase !== GamePhase.REVIEW) return;
    if (![-1, 0, 1, 3].includes(points)) return;

    room.adjustCardPoints({ index, newPoints: points });

    // Broadcast the card update to everyone
    io.to(room.code).emit('review:updated', {
      index,
      points,
      scores: room.game.scores,
    });
  });

  // Review: lock in — only cluer
  socket.on('review:lock-in', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (playerId !== room.game.cluerId) return;
    if (room.game.phase !== GamePhase.REVIEW) return;

    const { nextPhase, nextCluerId } = room.lockInReview();
    logger.info('game', 'Review locked in', { room: room.code, nextPhase, nextCluerId });

    const roundHistory = room.getRoundHistory();

    if (nextPhase === GamePhase.READY) {
      const nextCluer = nextCluerId ? room.getPlayer(nextCluerId) : null;
      io.to(room.code).emit('turn:ready', {
        phase: GamePhase.READY,
        cluerId: nextCluerId,
        cluerName: nextCluer?.name ?? null,
        playingTeam: room.game.playingTeam,
        scores: room.game.scores,
        round: room.game.round,
        roundHistory,
      });
    } else if (nextPhase === GamePhase.ROUND_RESULT) {
      io.to(room.code).emit('round:ended', {
        phase: GamePhase.ROUND_RESULT,
        scores: room.game.scores,
        round: room.game.round,
        roundHistory,
      });
    } else if (nextPhase === GamePhase.GAME_OVER) {
      metrics.gameCompleted();
      io.to(room.code).emit('round:ended', {
        phase: GamePhase.GAME_OVER,
        scores: room.game.scores,
        round: room.game.round,
        roundHistory,
      });
    }
  });

  // Next round — host only
  socket.on('game:next-round', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.ROUND_RESULT) return;
    if (playerId !== room.hostId) return;

    room.advanceToNextRound();
    logger.info('game', 'Advanced to next round', { room: room.code, round: room.game.round });

    const nextCluer = room.game.cluerId ? room.getPlayer(room.game.cluerId) : null;
    io.to(room.code).emit('turn:ready', {
      phase: GamePhase.READY,
      cluerId: room.game.cluerId,
      cluerName: nextCluer?.name ?? null,
      playingTeam: room.game.playingTeam,
      scores: room.game.scores,
      round: room.game.round,
      roundHistory: room.getRoundHistory(),
    });
  });

  // End game — host only (for unlimited rounds)
  socket.on('game:end', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    if (playerId !== room.hostId) return;
    if (room.game.phase !== GamePhase.ROUND_RESULT) return;

    room.endGame();
    metrics.gameCompleted();
    logger.info('game', 'Game ended by host', { room: room.code });

    io.to(room.code).emit('round:ended', {
      phase: GamePhase.GAME_OVER,
      scores: room.game.scores,
      round: room.game.round,
    });
  });
}
