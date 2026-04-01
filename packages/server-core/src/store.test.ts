import { describe, it, expect, afterEach } from 'vitest';
import { JsonFileStore } from './store.js';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

function tmpPath(): string {
  return path.join(os.tmpdir(), `test-store-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('JsonFileStore', () => {
  const paths: string[] = [];

  function createStore(): { store: JsonFileStore; filePath: string } {
    const filePath = tmpPath();
    paths.push(filePath);
    return { store: new JsonFileStore(filePath), filePath };
  }

  afterEach(() => {
    for (const p of paths) {
      try { unlinkSync(p); } catch { /* ok */ }
      try { unlinkSync(p + '.tmp'); } catch { /* ok */ }
    }
    paths.length = 0;
  });

  describe('save/restore', () => {
    it('save writes and restore reads', () => {
      const { store } = createStore();
      store.save([{ id: 1 }, { id: 2 }]);
      const result = store.restore();
      expect(result).toHaveLength(2);
      expect((result![0] as any).id).toBe(1);
    });

    it('save writes atomically (file exists after)', () => {
      const { store, filePath } = createStore();
      store.save([{ x: 1 }]);
      expect(existsSync(filePath)).toBe(true);
      expect(existsSync(filePath + '.tmp')).toBe(false);
    });

    it('restore falls back to .tmp file', () => {
      const { store, filePath } = createStore();
      writeFileSync(filePath + '.tmp', JSON.stringify([{ fallback: true }]));
      const result = store.restore();
      expect(result).toHaveLength(1);
      expect((result![0] as any).fallback).toBe(true);
    });

    it('restore returns null when no files exist', () => {
      const { store } = createStore();
      expect(store.restore()).toBeNull();
    });

    it('restore returns null on corrupt JSON', () => {
      const { store, filePath } = createStore();
      writeFileSync(filePath, 'not json{{{');
      expect(store.restore()).toBeNull();
    });

    it('restore returns null on non-array JSON', () => {
      const { store, filePath } = createStore();
      writeFileSync(filePath, JSON.stringify({ not: 'array' }));
      expect(store.restore()).toBeNull();
    });
  });

  describe('clear', () => {
    it('deletes both files', () => {
      const { store, filePath } = createStore();
      writeFileSync(filePath, '[]');
      writeFileSync(filePath + '.tmp', '[]');
      store.clear();
      expect(existsSync(filePath)).toBe(false);
      expect(existsSync(filePath + '.tmp')).toBe(false);
    });
  });

  describe('load', () => {
    it('reads and parses JSON', () => {
      const { store, filePath } = createStore();
      writeFileSync(filePath, JSON.stringify({ totals: { x: 1 } }));
      const result = store.load() as any;
      expect(result.totals.x).toBe(1);
    });

    it('returns null on missing file', () => {
      const { store } = createStore();
      expect(store.load()).toBeNull();
    });
  });

  describe('flush', () => {
    it('writes data async', async () => {
      const { store, filePath } = createStore();
      await store.flush({ value: 42 });
      expect(existsSync(filePath)).toBe(true);
      const result = store.load() as any;
      expect(result.value).toBe(42);
    });

    it('flushSync writes data synchronously', () => {
      const { store, filePath } = createStore();
      store.flushSync({ value: 99 });
      expect(existsSync(filePath)).toBe(true);
      const result = store.load() as any;
      expect(result.value).toBe(99);
    });
  });
});
