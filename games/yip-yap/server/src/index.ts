import type express from 'express';
import { createGameServer, RoomManager, MetricsCollector, JsonFileStore, logger } from '@games/server-core';
import { YipYapPhase, type YipYapRejoinGame } from '@games/yip-yap-shared';
import { YipYapRoom } from './YipYapRoom.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<YipYapRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new YipYapRoom(code, hostId),
  roomFromJSON: (data) => YipYapRoom.fromJSON(data),
});

function buildGameState(room: YipYapRoom, playerId: string): YipYapRejoinGame | null {
  if (room.phase === YipYapPhase.LOBBY) return null;
  if (room.phase === YipYapPhase.ROUND) {
    return {
      phase: room.phase,
      public: room.getPublicRoundState(),
      private: room.getPrivateRoundStateFor({ playerId }),
    };
  }
  return {
    phase: room.phase,
    reveal: room.getFullReveal(),
  };
}

function redirectOldDomain(app: express.Express) {
  app.use((req, res, next) => {
    const host = req.headers.host;
    if (host === 'castlefall.jerpi.org') {
      return res.redirect(301, `https://yipyap.jerpi.org${req.url}`);
    }
    next();
  });
}

createGameServer<YipYapRoom>({
  port: parseInt(process.env.PORT || '4070', 10),
  gameName: 'YipYap',
  rooms,
  metrics,

  registerGameHandlers,

  customRoutes: redirectOldDomain,

  lobbyCallbacks: {
    buildGameState,
    onMidGameJoin: (room, playerId) => {
      logger.info('game', 'Mid-game player joined as spectator until next round', {
        room: room.code,
        player: room.getPlayer(playerId)?.name,
      });
    },
  },
});
