import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import type { TeamId } from '@games/adtaboo-shared';
import { GamePhase } from '@games/adtaboo-shared';
import { AdtabooRoom } from '../AdtabooRoom.js';
import { buildGameState } from '../buildGameState.js';
import { emitSetupCards } from './setupHandlers.js';

/** Taboo-specific lobby handlers (game:start, taboo-master:set, settings:update, team:join) */
export function registerAdtabooLobbyHandlers(ctx: SocketContext<AdtabooRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  // Any player joins/switches/leaves a team
  socket.on('team:join', ({ team }: { team: TeamId | null }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;

    const oldTeam = player.team;
    if (oldTeam === team) return;
    if (oldTeam) socket.leave(`${room.code}:team${oldTeam}`);
    player.team = team;
    room.touch();
    if (team) socket.join(`${room.code}:team${team}`);
    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
    logger.info('room', 'Player changed team', { room: room.code, player: player.name, from: oldTeam, to: team });

    // Mid-game joiner picked a team — send them full game state
    if (room.isGameActive() && team) {
      socket.emit('room:mid-game-ready', {
        game: buildGameState(room, playerId),
        room: room.toDTO(),
      });
    }
  });

  // Host assigns/unassigns a player to a team
  socket.on('team:assign', ({ team, targetPlayerId }: { team: TeamId | null; targetPlayerId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;

    const target = room.getPlayer(targetPlayerId);
    if (!target) return;

    const oldTeam = target.team;
    if (oldTeam === team) return;
    target.team = team;
    room.touch();

    // Update socket rooms for the target player
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      if (oldTeam) targetSocket.leave(`${room.code}:team${oldTeam}`);
      if (team) targetSocket.join(`${room.code}:team${team}`);
    }

    io.to(room.code).emit('team:updated', { players: room.playerDTOs() });
    logger.info('room', 'Host assigned player to team', { room: room.code, player: target.name, team });

    // Mid-game joiner picked a team — send them full game state
    if (room.isGameActive() && team) {
      targetSocket?.emit('room:mid-game-ready', {
        game: buildGameState(room, targetPlayerId),
        room: room.toDTO(),
      });
    }
  });

  socket.on('team-names:update', ({ teamNames }: { teamNames: { A?: string; B?: string } }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId || room.isGameActive()) return;
    if (teamNames.A !== undefined) room.teamNames.A = teamNames.A.trim().slice(0, 20) || 'Team A';
    if (teamNames.B !== undefined) room.teamNames.B = teamNames.B.trim().slice(0, 20) || 'Team B';
    io.to(room.code).emit('team-names:updated', { teamNames: room.teamNames });
    logger.debug('room', 'Team names updated', { room: room.code, teamNames: room.teamNames });
  });

  socket.on('taboo-master:set', ({ team, masterId }: { team: TeamId; masterId: string }) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room || room.hostId !== playerId) return;
    if (room.setTabooMaster(team, masterId)) {
      io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      const masterName = room.getPlayer(masterId)?.name;
      logger.info('room', 'Taboo master set', { room: room.code, team, master: masterName });

      // If swapped during cluing, send the new TM the taboo words/buzzes they need
      const cluingTeam = room.getCluingTeam();
      if (cluingTeam) {
        const challenge = room.game!.challenges[cluingTeam];
        const newMaster = room.getPlayer(masterId);
        if (newMaster) {
          io.to(newMaster.socketId).emit('clue:start', {
            clueGiverId: challenge.clueGiverId,
            timerEnd: room.game!.timerEnd,
            phase: room.game!.phase,
            team: cluingTeam,
            cards: challenge.cards.map((c) => ({ word: c.word, result: c.result })),
            tabooWords: challenge.tabooWords,
            tabooBuzzes: challenge.tabooBuzzes,
          });
        }
      }
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
      rounds?: number | null;
      timerSeconds?: number;
      wordsPerTurn?: number;
      maxTabooWords?: number;
    }) => {
      const playerId = ctx.getPlayerId();
      if (!playerId) return;
      const room = rooms.getRoomForPlayer(playerId);
      if (!room || room.hostId !== playerId) return;
      if (rounds !== undefined) room.settings.rounds = rounds === null ? null : Math.max(1, Math.min(5, rounds));
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
