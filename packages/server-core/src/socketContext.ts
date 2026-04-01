import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { BaseRoom } from './BaseRoom.js';
import { MetricsCollector } from './metrics.js';

export interface SocketContext<T extends BaseRoom = BaseRoom> {
  io: Server;
  socket: Socket;
  rooms: RoomManager<T>;
  metrics: MetricsCollector;
  getPlayerId: () => string | null;
  setPlayerId: (id: string | null) => void;
}
