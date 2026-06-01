import { createGameServer, JsonFileStore, MetricsCollector, RoomManager } from '@games/server-core';
import { TwoRoomsPhase, type TwoRoomsRejoinGame } from '@games/two-rooms-and-a-boom-shared';
import { TwoRoomsRoom } from './TwoRoomsRoom.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';
const PORT = parseInt(process.env.PORT || '4080', 10);

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<TwoRoomsRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new TwoRoomsRoom(code, hostId),
  roomFromJSON: (data) => TwoRoomsRoom.fromJSON(data),
});

/** State a reconnecting player needs to rebuild their screen. */
function buildGameState(room: TwoRoomsRoom, playerId: string): TwoRoomsRejoinGame | null {
  if (room.getPhase() !== TwoRoomsPhase.REVEAL) return null;
  return {
    phase: TwoRoomsPhase.REVEAL,
    role: room.getRoleFor(playerId),
    assignedCount: room.assignedCount(),
    composition: room.composition(),
  };
}

createGameServer<TwoRoomsRoom>({
  port: PORT,
  gameName: 'Two Rooms and a Boom',
  rooms,
  metrics,
  registerGameHandlers,
  lobbyCallbacks: {
    buildGameState,
    // Allow late joiners to spectate the reveal (they hold no card).
    onMidGameJoin: () => {},
  },
});
