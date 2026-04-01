export interface SessionData {
  roomCode: string;
  playerId: string;
  playerName: string;
}

export function saveSession(key: string, data: SessionData): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadSession(key: string): SessionData | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (parsed.roomCode && parsed.playerId && parsed.playerName) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(key: string): void {
  localStorage.removeItem(key);
}
