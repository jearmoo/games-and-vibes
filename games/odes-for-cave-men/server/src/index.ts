import { createGameServer, RoomManager, MetricsCollector, JsonFileStore, logger } from '@games/server-core';
import { CaveRoom } from './CaveRoom.js';
import { registerCaveLobbyHandlers } from './handlers/lobbyHandlers.js';
import { registerGameHandlers, handleTurnEnd } from './handlers/gameHandlers.js';
import { GamePhase } from '@games/odes-for-cave-men-shared';
import { getRandomWords } from './words/index.js';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<CaveRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new CaveRoom(code, hostId),
  roomFromJSON: (data) => CaveRoom.fromJSON(data),
});

function buildGameState(room: CaveRoom) {
  if (!room.game) return null;
  return {
    phase: room.game.phase,
    round: room.game.round,
    scores: room.game.scores,
    playingTeam: room.game.playingTeam,
    cluerId: room.game.cluerId,
    currentWordIndex: room.game.currentWordIndex,
    words: room.game.words,
    timerEnd: room.game.timerEnd,
    roundHistory: room.getRoundHistory(),
  };
}

createGameServer<CaveRoom>({
  gameName: 'Odes for Cave Men',
  rooms,
  metrics,

  registerGameHandlers: (ctx) => {
    registerCaveLobbyHandlers(ctx, buildGameState);
    registerGameHandlers(ctx);
  },

  lobbyCallbacks: {
    buildGameState,
    onPlayerSocketJoin: (room, playerId, socket) => {
      const player = room.getPlayer(playerId);
      if (player?.team) socket.join(`${room.code}:team${player.team}`);
    },
    onPlayerKicked: (room, kickedId, io) => {
      if (!room.game) return;
      if (room.game.cluerId !== kickedId) return;

      const team = room.game.playingTeam;
      const newCluerId = room.pickCluer(team);
      room.game.cluerId = newCluerId;
      const newCluer = newCluerId ? room.getPlayer(newCluerId) : null;

      if (room.game.phase === GamePhase.READY) {
        io.to(room.code).emit('turn:ready', {
          phase: GamePhase.READY,
          cluerId: newCluerId,
          cluerName: newCluer?.name ?? null,
          playingTeam: team,
          scores: room.game.scores,
          round: room.game.round,
          roundHistory: room.getRoundHistory(),
        });
      }
      logger.info('game', 'Cluer kicked, reassigned', { room: room.code, newCluer: newCluer?.name });
    },
    onMidGameJoin: (room, playerId) => {
      logger.info('game', 'Mid-game player awaiting team selection', {
        room: room.code,
        player: room.getPlayer(playerId)?.name,
      });
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

      // Cluer disconnected during play — timer continues, they can rejoin
      if (room.game.phase === GamePhase.PLAYING && room.game.cluerId === playerId) {
        logger.info('conn', 'Cluer disconnected during play, timer continues', {
          room: room.code,
          team: room.game.playingTeam,
          player: player.name,
          timerEnd: room.game.timerEnd,
        });
      }
    },
  },

  customRoutes: (app) => {
    app.get('/api/words', (req, res) => {
      const count = Math.min(Math.max(parseInt(String(req.query.count)) || 5, 1), 20);
      const words = getRandomWords(count, new Set());
      res.json(words.map((w) => ({ word1: w.word1, word3: w.word3 })));
    });
  },

  onRoomRestored: (room, io) => {
    if (room.game?.phase === GamePhase.PLAYING && room.game.timerEnd) {
      const remaining = room.game.timerEnd - Date.now();
      const cb = () => handleTurnEnd(room, io, metrics);
      if (remaining > 0) {
        room.restoreTimer(remaining, cb);
      } else {
        room.restoreTimer(3000, cb);
      }
    }
  },
});
