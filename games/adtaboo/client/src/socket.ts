import { createSocket } from '@games/client-core';
import { SESSION_KEY } from './constants';

const { socket, autoReconnecting, reconnectExpired } = createSocket({
  sessionKey: SESSION_KEY,
  reconnectTimeoutMs: 130_000,
});

// Expose socket on window for e2e tests
(window as any).__socket = socket;

export { socket, autoReconnecting, reconnectExpired };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
