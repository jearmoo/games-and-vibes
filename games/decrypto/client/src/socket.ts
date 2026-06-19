import { createSocket } from '@games/client-core';
import { AUTO_RECONNECT_TIMEOUT_MS, SESSION_KEY } from './constants';

const { socket, autoReconnecting, reconnectExpired } = createSocket({
  sessionKey: SESSION_KEY,
  reconnectTimeoutMs: AUTO_RECONNECT_TIMEOUT_MS,
});

export { socket, autoReconnecting, reconnectExpired };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
