import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { BaseRoom } from './BaseRoom.js';
import { RoomManager } from './RoomManager.js';
import { SocketContext } from './socketContext.js';
import { MetricsCollector } from './metrics.js';
import {
  registerConnectionHandlers,
  ConnectionCallbacks,
} from './connectionHandlers.js';
import { registerLobbyHandlers, LobbyCallbacks } from './lobbyHandlers.js';
import { logger } from './logger.js';

export interface GameServerOptions<T extends BaseRoom> {
  port?: number;
  gameName: string;
  rooms: RoomManager<T>;
  metrics: MetricsCollector;

  /** Register game-specific socket handlers */
  registerGameHandlers: (ctx: SocketContext<T>) => void;

  /** Callbacks for generic connection handling */
  connectionCallbacks?: ConnectionCallbacks<T>;

  /** Callbacks for generic lobby handling */
  lobbyCallbacks: LobbyCallbacks<T>;

  /** Called after rooms are restored from disk. io is provided for timer restoration. */
  onRoomRestored?: (room: T, io: Server) => void;

  /** Absolute path to static client files for production serving. */
  clientPath?: string;
}

export function createGameServer<T extends BaseRoom>(opts: GameServerOptions<T>): void {
  const {
    port = parseInt(process.env.PORT || '4040', 10),
    gameName,
    rooms,
    metrics,
    registerGameHandlers,
    connectionCallbacks,
    lobbyCallbacks,
    onRoomRestored,
    clientPath: clientPathOpt,
  } = opts;

  const metricsToken = process.env.METRICS_TOKEN;
  const app = express();
  const httpServer = createHttpServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      game: gameName,
      uptime: Math.floor(process.uptime()),
      rooms: rooms.getRoomCount(),
      players: rooms.getPlayerCount(),
    });
  });

  // Metrics endpoint
  app.get('/api/metrics', (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${metricsToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const days = req.query.days ? parseInt(req.query.days as string, 10) : undefined;
    res.json(
      metrics.getStats({
        days: days && !isNaN(days) ? days : undefined,
        connections: io.engine.clientsCount,
        activePlayers: rooms.getPlayerCount(),
        activeRooms: rooms.getRoomCount(),
      }),
    );
  });

  // Static files in production
  if (process.env.NODE_ENV === 'production') {
    const staticPath = clientPathOpt ?? path.join(process.cwd(), 'public');
    app.use(express.static(staticPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  // Socket handlers
  io.on('connection', (socket) => {
    let playerId: string | null = null;
    logger.debug('conn', 'Socket connected', { socketId: socket.id });

    const ctx: SocketContext<T> = {
      io,
      socket,
      rooms,
      getPlayerId: () => playerId,
      setPlayerId: (id) => {
        playerId = id;
      },
    };

    registerLobbyHandlers(ctx, metrics, lobbyCallbacks);
    registerGameHandlers(ctx);
    registerConnectionHandlers(ctx, connectionCallbacks);
  });

  // Restore rooms
  rooms.restore(onRoomRestored ? (room) => onRoomRestored(room, io) : undefined);

  // Graceful shutdown
  function shutdown() {
    logger.info('server', 'Shutting down, saving state...');
    rooms.save();
    metrics.destroy();
    rooms.destroy();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('uncaughtException', (err) => {
    logger.error('server', 'Uncaught exception, saving state before exit', { error: String(err) });
    rooms.save();
    metrics.destroy();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('server', 'Unhandled rejection, saving state before exit', { error: String(reason) });
    rooms.save();
    metrics.destroy();
    process.exit(1);
  });

  io.engine.on('connection_error', (err: any) => {
    logger.error('server', 'Socket.IO connection error', { code: err.code, message: err.message });
  });

  // Start
  httpServer.listen(port, () => {
    logger.info('server', `${gameName} server started on port ${port}`);
  });
}
