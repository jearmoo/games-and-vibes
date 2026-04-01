import type { RoomStore, MetricsStore } from '@games/server-core';

/** In-memory RoomStore + MetricsStore for unit tests. No disk I/O. */
export class MockStore implements RoomStore, MetricsStore {
  savedData: object[] | null = null;
  metricsData: object | null = null;
  saveCalls = 0;
  flushCalls = 0;
  restoreCalls = 0;

  /** Data to return from restore(). Set before calling restore. */
  restoreData: object[] | null = null;
  /** Data to return from load(). Set before calling load. */
  loadData: object | null = null;

  save(data: object[]): void {
    this.savedData = data;
    this.saveCalls++;
  }

  restore(): object[] | null {
    this.restoreCalls++;
    return this.restoreData;
  }

  clear(): void {
    this.savedData = null;
    this.metricsData = null;
  }

  load(): object | null {
    return this.loadData;
  }

  async flush(data: object): Promise<void> {
    this.metricsData = data;
    this.flushCalls++;
  }

  flushSync(data: object): void {
    this.metricsData = data;
    this.flushCalls++;
  }
}
