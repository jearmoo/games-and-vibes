import { createGameServer, JsonFileStore, MetricsCollector, RoomManager, logger } from '@games/server-core';
import { DecryptoPhase, type DecryptoRejoinGame } from '@games/decrypto-shared';
import { DecryptoRoom } from './DecryptoRoom.js';
import { emitGameState, registerGameHandlers, scheduleClueTimer } from './handlers/gameHandlers.js';
import { assertStoredEmbeddingAssetsAvailable } from './keywordEmbeddings.generated.js';

const ROOMS_PATH = process.env.ROOMS_PATH || '/data/rooms.json';
const METRICS_PATH = process.env.METRICS_PATH || '/data/metrics.json';
const embeddingAssets = assertStoredEmbeddingAssetsAvailable();

logger.info('game', 'Verified Decrypto embedding assets', embeddingAssets);

const roomStore = new JsonFileStore(ROOMS_PATH);
const metricsStore = new JsonFileStore(METRICS_PATH);
const metrics = new MetricsCollector(metricsStore);

const rooms = new RoomManager<DecryptoRoom>({
  store: roomStore,
  snapshotPath: ROOMS_PATH,
  roomFactory: (code, hostId) => new DecryptoRoom(code, hostId),
  roomFromJSON: (data) => DecryptoRoom.fromJSON(data),
});

function buildGameState(room: DecryptoRoom, playerId: string): DecryptoRejoinGame | null {
  if (room.phase === DecryptoPhase.LOBBY) return null;
  return {
    phase: room.phase,
    private: room.getPrivateStateFor(playerId),
    turn: room.getPublicTurnState(),
    reveal: room.reveal ?? null,
    reveals: room.reveals,
    clinchedOutcome: room.getPublicClinchedOutcome(),
    tiebreaker: room.getPublicTiebreakerState(),
  };
}

createGameServer<DecryptoRoom>({
  port: parseInt(process.env.PORT || '4090', 10),
  gameName: 'Decrypto',
  rooms,
  metrics,

  registerGameHandlers,

  onRoomRestored: (room, io) => {
    scheduleClueTimer(room, io);
  },

  lobbyCallbacks: {
    buildGameState,
    onMidGameJoin: (room, playerId, io) => {
      logger.info('game', 'Mid-game player joined as Decrypto spectator', {
        room: room.code,
        player: room.getPlayer(playerId)?.name,
      });
      emitGameState(room, io);
    },
    onPlayerKicked: (room, _playerId, io) => {
      emitGameState(room, io);
    },
  },
});
