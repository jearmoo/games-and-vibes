import { createGameServer, RoomManager, MetricsCollector, JsonFileStore, logger } from '@games/server-core';
import { AdtabooRoom } from './AdtabooRoom.js';
import { registerSetupHandlers } from './handlers/setupHandlers.js';
import { registerGameHandlers, handleTurnEnd } from './handlers/gameHandlers.js';
import { registerAdtabooLobbyHandlers } from './handlers/lobbyHandlers.js';
import { buildGameState } from './buildGameState.js';
import { GamePhase } from '@games/adtaboo-shared';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<AdtabooRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new AdtabooRoom(code, hostId),
  roomFromJSON: (data) => AdtabooRoom.fromJSON(data),
});

createGameServer<AdtabooRoom>({
  gameName: 'Adversarial Taboo',
  rooms,
  metrics,

  registerGameHandlers: (ctx) => {
    registerAdtabooLobbyHandlers(ctx);
    registerSetupHandlers(ctx);
    registerGameHandlers(ctx);
  },

  lobbyCallbacks: {
    buildGameState,
    onPlayerSocketJoin: (room, playerId, socket) => {
      const player = room.getPlayer(playerId);
      if (player?.team) socket.join(`${room.code}:team${player.team}`);
    },
    onPlayerReconnect: (room, playerId, io) => {
      const player = room.getPlayer(playerId);
      if (!player?.team || !room.game) return;
      const newTM = room.ensureTabooMaster(player.team);
      if (newTM) {
        io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
      }
    },
    onMidGameJoin: (room, playerId) => {
      logger.info('game', 'Mid-game player awaiting team selection', {
        room: room.code,
        player: room.getPlayer(playerId)?.name,
      });
    },
    onPlayerKicked: (room, kickedId, io) => {
      if (!room.game) return;
      const phase = room.game.phase;

      // Reassign taboo master if the kicked player was TM
      for (const team of ['A', 'B'] as const) {
        if (room.tabooMasters[team] === kickedId) {
          room.ensureTabooMaster(team);
          io.to(room.code).emit('taboo-master:updated', { tabooMasters: room.tabooMasters });
        }
      }

      // Clear clue-giver if kicked during setup
      if (phase === GamePhase.PARALLEL_SETUP) {
        for (const team of ['A', 'B'] as const) {
          const challenge = room.game.challenges[team];
          if (challenge.clueGiverId === kickedId) {
            challenge.clueGiverId = null;
            io.to(room.code).emit('setup:status', room.getSetupStatus());
            io.to(room.code).emit('setup:clue-giver-set', { team, clueGiverId: null });
          }
        }
      }
    },
  },

  connectionCallbacks: {
    onBeforePlayerLeave: (room, playerId, socket) => {
      const player = room.getPlayer(playerId);
      if (player?.team) socket.leave(`${room.code}:team${player.team}`);
    },
    onPlayerDisconnect: (room, playerId, io) => {
      const player = room.getPlayer(playerId);
      if (!player?.team || !room.game) return;

      const phase = room.game.phase;

      // Log clue-giver disconnect during cluing (timer continues, they can rejoin)
      if (phase === GamePhase.CLUING_A || phase === GamePhase.CLUING_B) {
        const cluingTeam = room.getCluingTeam();
        if (cluingTeam) {
          const challenge = room.game.challenges[cluingTeam];
          if (challenge.clueGiverId === playerId) {
            logger.info('conn', 'Clue giver disconnected during cluing, timer continues', {
              room: room.code,
              team: cluingTeam,
              player: player.name,
              timerEnd: room.game.timerEnd,
            });
          }
        }
      }
    },
  },

  onRoomRestored: (room, io) => {
    const cluingTeam = room.getCluingTeam();
    if (cluingTeam && room.game?.timerEnd) {
      const remaining = room.game.timerEnd - Date.now();
      const cb = () => handleTurnEnd(room, cluingTeam, io, metrics);
      if (remaining > 0) {
        room.restoreTimer(remaining, cb);
      } else {
        // Timer expired during restart — delay to allow clients to reconnect first
        room.restoreTimer(3000, cb);
      }
    }
  },
});
