import { createGameServer, RoomManager, MetricsCollector, JsonFileStore } from '@games/server-core';
import { CastlefallPhase, type CastlefallRejoinGame } from '@games/castlefall-shared';
import { CastlefallRoom } from './CastlefallRoom.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<CastlefallRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new CastlefallRoom(code, hostId),
  roomFromJSON: (data) => CastlefallRoom.fromJSON(data),
});

function buildGameState(room: CastlefallRoom, playerId: string): CastlefallRejoinGame | null {
  if (room.phase === CastlefallPhase.LOBBY) return null;
  if (room.phase === CastlefallPhase.ROUND) {
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

createGameServer<CastlefallRoom>({
  port: parseInt(process.env.PORT || '4070', 10),
  gameName: 'Castlefall',
  rooms,
  metrics,

  registerGameHandlers,

  lobbyCallbacks: {
    buildGameState,
  },
});
