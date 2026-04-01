import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockStore } from '@games/test-utils';
import { MetricsCollector } from './metrics.js';

describe('MetricsCollector', () => {
  let store: MockStore;
  let metrics: MetricsCollector;

  beforeEach(() => {
    store = new MockStore();
    metrics = new MetricsCollector(store);
  });

  afterEach(() => {
    metrics.destroy();
  });

  it('increments counters', () => {
    metrics.roomCreated();
    metrics.gameStarted();
    metrics.gameCompleted();
    metrics.playerJoined();
    metrics.playerJoined();

    const stats = metrics.getStats() as any;
    expect(stats.totals.roomsCreated).toBe(1);
    expect(stats.totals.gamesStarted).toBe(1);
    expect(stats.totals.gamesCompleted).toBe(1);
    expect(stats.totals.playersJoined).toBe(2);
  });

  it('creates daily buckets', () => {
    metrics.roomCreated();
    const stats = metrics.getStats() as any;
    const today = new Date().toISOString().slice(0, 10);
    expect(stats.daily[today].rooms).toBe(1);
  });

  it('getStats with days filter', () => {
    metrics.roomCreated();
    const stats = metrics.getStats({ days: 7 }) as any;
    expect(stats.period.days).toBe(7);
    expect(stats.aggregated.rooms).toBe(1);
  });

  it('passes gauges through', () => {
    const stats = metrics.getStats({ connections: 5, activePlayers: 3, activeRooms: 1 }) as any;
    expect(stats.gauges.connections).toBe(5);
    expect(stats.gauges.activePlayers).toBe(3);
    expect(stats.gauges.activeRooms).toBe(1);
  });

  it('loads from store on construction', () => {
    store.loadData = {
      totals: { roomsCreated: 10, gamesStarted: 5, gamesCompleted: 3, playersJoined: 20 },
      daily: {},
    };
    const m2 = new MetricsCollector(store);
    const stats = m2.getStats() as any;
    expect(stats.totals.roomsCreated).toBe(10);
    m2.destroy();
  });

  it('destroy flushes to store', () => {
    metrics.roomCreated();
    metrics.destroy();
    expect(store.flushCalls).toBeGreaterThan(0);
    expect((store.metricsData as any).totals.roomsCreated).toBe(1);
  });

  it('flush writes to store', async () => {
    metrics.roomCreated();
    await metrics.flush();
    expect(store.flushCalls).toBeGreaterThan(0);
  });
});
