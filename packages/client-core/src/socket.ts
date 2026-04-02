import { io, Socket } from 'socket.io-client';
import { clearSession, loadSession } from './sessionStore.js';

export interface SocketOptions {
  /** localStorage key for session persistence */
  sessionKey: string;
  /** Server URL override (defaults to window.location.origin in prod, localhost:4040 in dev) */
  url?: string;
  /** Max time (ms) a disconnect can last before session is cleared instead of auto-rejoining.
   *  Should be slightly longer than server's grace period. Default: no limit. */
  reconnectTimeoutMs?: number;
}

/**
 * Create a Socket.IO client with auto-reconnect from saved session.
 * Each game calls this once with its own session key.
 */
export function createSocket(opts: SocketOptions): {
  socket: Socket;
  autoReconnecting: { current: boolean };
  /** Set to true when a reconnect was suppressed because the disconnect lasted longer than reconnectTimeoutMs. */
  reconnectExpired: { current: boolean };
} {
  const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const url = opts.url ?? (isProd ? window.location.origin : 'http://localhost:4040');

  const socket: Socket = io(url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  const autoReconnecting = { current: false };
  const reconnectExpired = { current: false };
  let disconnectedAt: number | null = null;

  socket.on('connect', () => {
    // Check reconnect timeout before attempting auto-rejoin
    if (opts.reconnectTimeoutMs && disconnectedAt && Date.now() - disconnectedAt > opts.reconnectTimeoutMs) {
      clearSession(opts.sessionKey);
      reconnectExpired.current = true;
      disconnectedAt = null;
      return;
    }
    reconnectExpired.current = false;
    disconnectedAt = null;

    const session = loadSession(opts.sessionKey);
    if (!session) return;

    // If URL has a room code, only auto-reconnect if it matches the saved session
    const urlPath = window.location.pathname.replace(/^\//, '');
    const urlRoomCode = /^[A-Za-z0-9]{4}$/.test(urlPath) ? urlPath.toUpperCase() : null;
    if (!urlRoomCode) return;
    if (urlRoomCode !== session.roomCode) return;

    autoReconnecting.current = true;
    socket.emit('room:join', {
      roomCode: session.roomCode,
      playerName: session.playerName,
      sessionId: session.playerId,
    });
  });

  socket.on('disconnect', () => {
    if (!disconnectedAt) disconnectedAt = Date.now();
  });

  return { socket, autoReconnecting, reconnectExpired };
}
