import { io, Socket } from 'socket.io-client';
import { loadSession } from './sessionStore.js';

export interface SocketOptions {
  /** localStorage key for session persistence */
  sessionKey: string;
  /** Server URL override (defaults to window.location.origin in prod, localhost:4040 in dev) */
  url?: string;
}

/**
 * Create a Socket.IO client with auto-reconnect from saved session.
 * Each game calls this once with its own session key.
 */
export function createSocket(opts: SocketOptions): {
  socket: Socket;
  autoReconnecting: { current: boolean };
} {
  const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const url = opts.url ?? (isProd ? window.location.origin : 'http://localhost:4040');

  const socket: Socket = io(url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  const autoReconnecting = { current: false };

  socket.on('connect', () => {
    const session = loadSession(opts.sessionKey);
    if (!session) return;

    // If URL has a room code, only auto-reconnect if it matches the saved session
    const urlPath = window.location.pathname.replace(/^\//, '');
    const urlRoomCode = /^[A-Za-z0-9]{4}$/.test(urlPath) ? urlPath.toUpperCase() : null;
    if (urlRoomCode && urlRoomCode !== session.roomCode) return;

    autoReconnecting.current = true;
    socket.emit('room:join', {
      roomCode: session.roomCode,
      playerName: session.playerName,
      sessionId: session.playerId,
    });
  });

  return { socket, autoReconnecting };
}
