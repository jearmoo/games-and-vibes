import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import type { CaveRoom } from '../CaveRoom.js';
import type { TeamId } from '@games/odes-for-cave-men-shared';

export function registerCaveLobbyHandlers(ctx: SocketContext<CaveRoom>) {
  const { io, socket, rooms } = ctx;

  // Host joins a team themselves
  socket.on('team:join', ({ team }: { team: TeamId | null }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    if (room.isGameActive()) return;

    const player = room.getPlayer(playerId);
    if (!player) return;

    const oldTeam = player.team;
    player.team = team;
    room.touch();

    if (oldTeam) socket.leave(`${room.code}:team${oldTeam}`);
    if (team) socket.join(`${room.code}:team${team}`);

    logger.info('room', 'Host changed team', { room: room.code, player: player.name, from: oldTeam, to: team });
    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
  });

  // Host assigns a player to a team
  socket.on('team:assign', ({ team, targetPlayerId }: { team: TeamId | null; targetPlayerId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    if (room.isGameActive()) return;

    const target = room.getPlayer(targetPlayerId);
    if (!target) return;

    const oldTeam = target.team;
    target.team = team;
    room.touch();

    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      if (oldTeam) targetSocket.leave(`${room.code}:team${oldTeam}`);
      if (team) targetSocket.join(`${room.code}:team${team}`);
    }

    logger.info('room', 'Host assigned player to team', { room: room.code, player: target.name, team });
    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
  });

  // Settings update
  socket.on('settings:update', (settings: { rounds?: number; timerSeconds?: number }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || playerId !== room.hostId) return;
    if (room.isGameActive()) return;

    if (settings.rounds !== undefined) {
      room.settings.rounds = Math.max(1, Math.min(10, settings.rounds));
    }
    if (settings.timerSeconds !== undefined) {
      room.settings.timerSeconds = Math.max(30, Math.min(180, settings.timerSeconds));
    }
    room.touch();
    io.to(room.code).emit('settings:updated', { settings: room.settings });
  });

  // Game start
  socket.on('game:start', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || playerId !== room.hostId) return;

    const check = room.canStart();
    if (!check.ok) {
      socket.emit('room:error', { message: check.reason });
      return;
    }

    room.startGame();
    ctx.metrics.gameStarted();
    logger.info('game', 'Game started', { room: room.code, round: 1, cluer: room.game!.cluerId });

    const nextCluer = room.game!.cluerId ? room.getPlayer(room.game!.cluerId) : null;
    io.to(room.code).emit('turn:ready', {
      phase: room.game!.phase,
      cluerId: room.game!.cluerId,
      cluerName: nextCluer?.name ?? null,
      playingTeam: room.game!.playingTeam,
      turnIndex: room.game!.turnIndex,
      turnsPerRound: room.game!.turnsPerRound,
      scores: room.game!.scores,
      round: room.game!.round,
    });
  });

  // Game reset (back to lobby)
  socket.on('game:reset', () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || playerId !== room.hostId) return;

    room.resetToLobby();
    logger.info('game', 'Game reset to lobby', { room: room.code });
    io.to(room.code).emit('game:reset', { room: room.toDTO() });
  });
}
