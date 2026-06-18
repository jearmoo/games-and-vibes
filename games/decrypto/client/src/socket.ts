import { createSocket } from '@games/client-core';
import { RECONNECT_SESSION_TTL_MS, SESSION_KEY } from './constants';

const { socket, autoReconnecting, reconnectExpired } = createSocket({
  sessionKey: SESSION_KEY,
  reconnectTimeoutMs: RECONNECT_SESSION_TTL_MS,
});

export { socket, autoReconnecting, reconnectExpired };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
