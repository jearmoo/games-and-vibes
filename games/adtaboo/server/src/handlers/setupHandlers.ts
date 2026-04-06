import { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import type { TeamId } from '@games/adtaboo-shared';
import { GamePhase } from '@games/adtaboo-shared';
import { AdtabooRoom } from '../AdtabooRoom.js';

export function registerSetupHandlers(ctx: SocketContext<AdtabooRoom>) {
  const { io, socket, rooms } = ctx;

  function getChallengeTarget(): TeamId | null {
    const playerId = ctx.getPlayerId();
    if (!playerId) return null;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return null;
    const player = room.getPlayer(playerId);
    if (!player?.team) return null;
    return room.getOpposingTeam(player.team);
  }

  function emitSetupStatus() {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return;
    io.to(room.code).emit('setup:status', room.getSetupStatus());
  }

  socket.on('setup:pick-clue-giver', ({ clueGiverId }: { clueGiverId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const player = room.getPlayer(playerId);
    if (!player?.team) return;
    if (playerId !== room.tabooMasters[player.team]) return;

    if (room.setClueGiver(player.team, clueGiverId)) {
      const cgName = room.getPlayer(clueGiverId)?.name;
      logger.info('setup', 'Clue-giver picked', { room: room.code, team: player.team, clueGiver: cgName });
      for (const p of room.getTeamPlayers(player.team)) {
        io.to(p.socketId).emit('setup:clue-giver-set', { team: player.team, clueGiverId });
      }
      emitSetupStatus();
    }
  });

  socket.on('setup:suggest', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;

    const suggestions = room.suggestTabooWord(forTeam, word);
    const player = room.getPlayer(playerId);
    if (!player?.team) return;
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:taboo-updated', { forTeam, words: suggestions });
    }
    emitSetupStatus();
  });

  socket.on('setup:remove', ({ word }: { word: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    const suggestions = room.removeTabooWord(forTeam, word);
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:taboo-updated', { forTeam, words: suggestions });
    }
    emitSetupStatus();
  });

  socket.on('setup:refresh-word', async ({ cardIndex }: { cardIndex: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    const newWord = await room.refreshWord(forTeam, cardIndex);
    if (!newWord || !room.game) return;

    logger.info('setup', 'Word refreshed', { room: room.code, forTeam, index: cardIndex, newWord });
    for (const p of room.getTeamPlayers(player.team)) {
      io.to(p.socketId).emit('setup:cards-updated', {
        forTeam,
        cards: room.game.challenges[forTeam].cards.map((c) => ({ word: c.word, result: c.result })),
      });
    }
  });

  socket.on('setup:confirm', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    const clueGiverId = room.game.challenges[player.team].clueGiverId;
    if (!clueGiverId) {
      socket.emit('room:error', { message: "Pick your team's clue-giver first" });
      return;
    }
    const clueGiver = room.getPlayer(clueGiverId);
    if (!clueGiver?.connected) {
      socket.emit('room:error', { message: 'Your clue-giver has disconnected — pick a new one' });
      return;
    }

    if (!room.confirmChallenge(forTeam)) {
      socket.emit('room:error', { message: 'Need at least 1 taboo word' });
      return;
    }

    logger.info('setup', 'Challenge locked in', { room: room.code, by: player.team, forTeam });
    emitSetupStatus();

    if (room.bothChallengesReady()) {
      logger.info('game', 'Both teams ready, preparing CLUING_A', { room: room.code });
      prepareCluingPhase(room, 'A', io);
    }
  });

  socket.on('setup:unconfirm', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game || room.game.phase !== GamePhase.PARALLEL_SETUP) return;
    const forTeam = getChallengeTarget();
    if (!forTeam) return;
    const player = room.getPlayer(playerId);
    if (!player?.team || playerId !== room.tabooMasters[player.team]) return;

    if (room.unconfirmChallenge(forTeam)) {
      logger.info('setup', 'Challenge unlocked', { room: room.code, by: player.team, forTeam });
      emitSetupStatus();
    }
  });
}

export function prepareCluingPhase(room: AdtabooRoom, team: TeamId, io: Server) {
  if (!room.game) return;
  const opposingTeam = room.getOpposingTeam(team);
  const challenge = room.game.challenges[team];

  room.prepareCluingPhase(team);

  const basePayload = {
    clueGiverId: challenge.clueGiverId,
    timerEnd: null,
    phase: room.game.phase,
    team,
  };
  const cards = challenge.cards.map((c) => ({ word: c.word, result: c.result }));

  // Cluing team members see cards but not taboo words
  for (const p of room.getTeamPlayers(team)) {
    io.to(p.socketId).emit('clue:start', {
      ...basePayload,
      cards,
      tabooWords: [],
      tabooBuzzes: {},
    });
  }

  // Opposing team sees cards + taboo words (for buzzing)
  for (const p of room.getTeamPlayers(opposingTeam)) {
    io.to(p.socketId).emit('clue:start', {
      ...basePayload,
      cards,
      tabooWords: challenge.tabooWords,
      tabooBuzzes: challenge.tabooBuzzes,
    });
  }
}

export function emitSetupCards(room: AdtabooRoom, io: Server) {
  if (!room.game) return;
  for (const team of ['A', 'B'] as TeamId[]) {
    const opposing = room.getOpposingTeam(team);
    for (const p of room.getTeamPlayers(team)) {
      io.to(p.socketId).emit('setup:cards-updated', {
        forTeam: opposing,
        cards: room.game.challenges[opposing].cards.map((c) => ({ word: c.word, result: c.result })),
      });
    }
  }
}
