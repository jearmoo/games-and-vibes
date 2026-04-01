import { existsSync, unlinkSync } from 'fs';
import { BaseRoom } from './BaseRoom.js';
import { RoomStore } from './store.js';
import { logger } from './logger.js';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH = 4;
const STALE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export interface RoomManagerOptions<T extends BaseRoom> {
  store?: RoomStore;
  roomFactory: (code: string, hostId: string) => T;
  roomFromJSON: (data: any) => T;
  snapshotPath?: string;
}

export class RoomManager<T extends BaseRoom> {
  private rooms: Map<string, T> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private snapshotInterval: ReturnType<typeof setInterval>;
  private store: RoomStore | null;
  private roomFactory: (code: string, hostId: string) => T;
  private roomFromJSON: (data: any) => T;
  private snapshotPath: string | null;

  constructor(opts: RoomManagerOptions<T>) {
    this.store = opts.store ?? null;
    this.roomFactory = opts.roomFactory;
    this.roomFromJSON = opts.roomFromJSON;
    this.snapshotPath = opts.snapshotPath ?? null;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.snapshotInterval = setInterval(() => this.snapshot(), 60_000);
  }

  private snapshot(): void {
    if (!this.store || !this.snapshotPath) return;
    if (this.rooms.size > 0) {
      this.save();
    } else if (this.snapshotPath && existsSync(this.snapshotPath)) {
      try {
        unlinkSync(this.snapshotPath);
      } catch (err) {
        logger.warn('rooms', 'Failed to delete empty snapshot', { error: String(err) });
      }
    }
  }

  private generateCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId: string): T {
    const code = this.generateCode();
    const room = this.roomFactory(code, hostId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): T | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomForPlayer(playerId: string): T | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  trackPlayer(playerId: string, roomCode: string): void {
    this.playerToRoom.set(playerId, roomCode);
  }

  untrackPlayer(playerId: string): void {
    this.playerToRoom.delete(playerId);
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.clearTimer();
      for (const [pid] of room.players) {
        this.playerToRoom.delete(pid);
      }
      this.rooms.delete(code);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > STALE_TIMEOUT) {
        this.deleteRoom(code);
      }
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getPlayerCount(): number {
    return this.playerToRoom.size;
  }

  save(): void {
    if (!this.store) return;
    const data = Array.from(this.rooms.values()).map((r) => r.toJSON());
    this.store.save(data);
  }

  restore(onRoomRestored?: (room: T) => void): void {
    if (!this.store) return;
    const entries = this.store.restore();
    if (!entries) return;

    for (const entry of entries) {
      const room = this.roomFromJSON(entry);
      this.rooms.set(room.code, room);
      for (const [pid] of room.players) {
        this.playerToRoom.set(pid, room.code);
      }
      onRoomRestored?.(room);
    }

    logger.info('rooms', 'Restored rooms', {
      rooms: entries.length,
      players: this.playerToRoom.size,
    });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    clearInterval(this.snapshotInterval);
  }
}
