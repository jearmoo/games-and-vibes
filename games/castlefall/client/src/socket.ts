import { createSocket } from '@games/client-core';
import { SESSION_KEY } from './constants';

const { socket, autoReconnecting } = createSocket({ sessionKey: SESSION_KEY, reconnectTimeoutMs: 130_000 });

export { socket, autoReconnecting };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
