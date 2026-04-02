import type { Socket } from 'socket.io-client';
import { clearSession } from './sessionStore.js';

export interface LeaveRoomOptions {
  socket: Socket;
  sessionKey: string;
  resetStore: () => void;
}

export function leaveRoom({ socket, sessionKey, resetStore }: LeaveRoomOptions): void {
  socket.emit('room:leave');
  clearSession(sessionKey);
  resetStore();
  window.history.replaceState(null, '', '/');
}
