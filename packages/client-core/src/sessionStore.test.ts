import { describe, it, expect, beforeEach } from 'vitest';
import { saveSession, loadSession, clearSession } from './sessionStore.js';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
};

// @ts-expect-error — inject mock
globalThis.localStorage = mockLocalStorage;

const KEY = 'test_session';

describe('sessionStore', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('saveSession writes JSON to localStorage', () => {
    saveSession(KEY, { roomCode: 'ABCD', playerId: 'p1', playerName: 'Alice' });
    const raw = store[KEY];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.roomCode).toBe('ABCD');
    expect(parsed.playerId).toBe('p1');
    expect(parsed.playerName).toBe('Alice');
  });

  it('loadSession reads and returns valid session', () => {
    saveSession(KEY, { roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob' });
    const session = loadSession(KEY);
    expect(session).toEqual({ roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob' });
  });

  it('loadSession preserves a future expiry', () => {
    saveSession(KEY, { roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob', expiresAt: 2_000 });
    const session = loadSession(KEY, 1_000);
    expect(session).toEqual({ roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob', expiresAt: 2_000 });
  });

  it('loadSession clears and rejects an expired session', () => {
    saveSession(KEY, { roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob', expiresAt: 1_000 });
    expect(loadSession(KEY, 2_000)).toBeNull();
    expect(store[KEY]).toBeUndefined();
  });

  it('loadSession rejects malformed expiry metadata', () => {
    store[KEY] = JSON.stringify({ roomCode: 'WXYZ', playerId: 'p2', playerName: 'Bob', expiresAt: 'soon' });
    expect(loadSession(KEY, 1_000)).toBeNull();
  });

  it('loadSession returns null for missing key', () => {
    expect(loadSession('nonexistent')).toBeNull();
  });

  it('loadSession returns null for corrupt JSON', () => {
    store[KEY] = 'not valid json{{{';
    expect(loadSession(KEY)).toBeNull();
  });

  it('loadSession returns null for incomplete data', () => {
    store[KEY] = JSON.stringify({ roomCode: 'ABCD' }); // missing playerId, playerName
    expect(loadSession(KEY)).toBeNull();
  });

  it('clearSession removes the key', () => {
    saveSession(KEY, { roomCode: 'ABCD', playerId: 'p1', playerName: 'Alice' });
    clearSession(KEY);
    expect(store[KEY]).toBeUndefined();
    expect(loadSession(KEY)).toBeNull();
  });

  it('round-trips correctly', () => {
    const data = { roomCode: 'TEST', playerId: 'id123', playerName: 'Charlie' };
    saveSession(KEY, data);
    expect(loadSession(KEY)).toEqual(data);
  });
});
