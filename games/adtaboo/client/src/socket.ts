import { createSocket } from '@games/client-core';
import { SESSION_KEY } from './constants';

const { socket, autoReconnecting, reconnectExpired } = createSocket({
  sessionKey: SESSION_KEY,
  reconnectTimeoutMs: 130_000,
});

export { socket, autoReconnecting, reconnectExpired };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
