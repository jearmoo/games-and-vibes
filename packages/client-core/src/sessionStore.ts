export interface SessionData {
  roomCode: string;
  playerId: string;
  playerName: string;
  expiresAt?: number;
}

export function saveSession(key: string, data: SessionData): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadSession(key: string, now = Date.now()): SessionData | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (
      typeof parsed?.roomCode !== 'string' ||
      typeof parsed?.playerId !== 'string' ||
      typeof parsed?.playerName !== 'string' ||
      !parsed.roomCode ||
      !parsed.playerId ||
      !parsed.playerName
    ) {
      return null;
    }
    if (parsed.expiresAt !== undefined) {
      if (typeof parsed.expiresAt !== 'number' || !Number.isFinite(parsed.expiresAt)) return null;
      if (parsed.expiresAt <= now) {
        clearSession(key);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(key: string): void {
  localStorage.removeItem(key);
}
