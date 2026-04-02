import { createSocket } from '@games/client-core';
import { SESSION_KEY } from './constants';

const { socket, autoReconnecting } = createSocket({ sessionKey: SESSION_KEY });

export { socket, autoReconnecting };
export function clearAutoReconnecting() {
  autoReconnecting.current = false;
}
