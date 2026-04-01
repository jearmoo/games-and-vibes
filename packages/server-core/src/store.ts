import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs';
import { writeFile } from 'fs/promises';
import { dirname } from 'path';
import { logger } from './logger.js';

/** Storage interface for room persistence. Swap implementation for Redis/Postgres later. */
export interface RoomStore {
  save(data: object[]): void;
  restore(): object[] | null;
  clear(): void;
}

/** Storage interface for metrics persistence. */
export interface MetricsStore {
  flush(data: object): Promise<void>;
  load(): object | null;
  flushSync(data: object): void;
}

/** Default implementation: atomic JSON file writes with crash recovery. */
export class JsonFileStore implements RoomStore, MetricsStore {
  constructor(private readonly path: string) {}

  save(data: object[]): void {
    try {
      const tmp = this.path + '.tmp';
      writeFileSync(tmp, JSON.stringify(data, null, 2));
      renameSync(tmp, this.path);
      logger.info('store', 'Saved state to disk', { path: this.path, entries: data.length });
    } catch (err) {
      logger.error('store', 'Failed to save state', { path: this.path, error: String(err) });
    }
  }

  restore(): object[] | null {
    for (const candidate of [this.path, this.path + '.tmp']) {
      try {
        if (!existsSync(candidate)) continue;
        const raw = readFileSync(candidate, 'utf-8');
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) continue;
        logger.info('store', 'Restored state from disk', { source: candidate, entries: entries.length });
        // Don't delete files here — they'll be overwritten on the next save()
        return entries;
      } catch (err) {
        logger.error('store', 'Failed to restore from file', { file: candidate, error: String(err) });
      }
    }
    return null;
  }

  clear(): void {
    try { unlinkSync(this.path); } catch { /* ok */ }
    try { unlinkSync(this.path + '.tmp'); } catch { /* ok */ }
  }

  load(): object | null {
    try {
      const raw = readFileSync(this.path, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async flush(data: object): Promise<void> {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      await writeFile(this.path, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('store', 'Failed to flush to disk', { path: this.path, error: String(err) });
    }
  }

  flushSync(data: object): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('store', 'Failed to flush to disk (sync)', { path: this.path, error: String(err) });
    }
  }
}
