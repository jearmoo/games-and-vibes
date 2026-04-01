import { MetricsStore } from './store.js';
import { logger } from './logger.js';

interface DailyBucket {
  rooms: number;
  games: number;
  gamesCompleted: number;
  players: number;
}

interface MetricsData {
  totals: {
    roomsCreated: number;
    gamesStarted: number;
    gamesCompleted: number;
    playersJoined: number;
  };
  daily: Record<string, DailyBucket>;
}

function emptyBucket(): DailyBucket {
  return { rooms: 0, games: 0, gamesCompleted: 0, players: 0 };
}

function defaultMetrics(): MetricsData {
  return {
    totals: { roomsCreated: 0, gamesStarted: 0, gamesCompleted: 0, playersJoined: 0 },
    daily: {},
  };
}

export class MetricsCollector {
  private data: MetricsData;
  private readonly store: MetricsStore;
  private readonly maxDays = 30;
  private flushInterval: ReturnType<typeof setInterval>;

  constructor(store: MetricsStore) {
    this.store = store;
    this.data = this.load();
    this.flushInterval = setInterval(() => this.flush(), 60_000);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private ensureDay(): DailyBucket {
    const d = this.today();
    if (!this.data.daily[d]) this.data.daily[d] = emptyBucket();
    return this.data.daily[d];
  }

  roomCreated(): void {
    this.data.totals.roomsCreated++;
    this.ensureDay().rooms++;
  }

  gameStarted(): void {
    this.data.totals.gamesStarted++;
    this.ensureDay().games++;
  }

  gameCompleted(): void {
    this.data.totals.gamesCompleted++;
    this.ensureDay().gamesCompleted++;
  }

  playerJoined(): void {
    this.data.totals.playersJoined++;
    this.ensureDay().players++;
  }

  getStats(opts: { days?: number; connections?: number; activePlayers?: number; activeRooms?: number } = {}): object {
    const gauges = {
      connections: opts.connections ?? 0,
      activePlayers: opts.activePlayers ?? 0,
      activeRooms: opts.activeRooms ?? 0,
    };

    if (!opts.days) {
      return { totals: { ...this.data.totals }, gauges, daily: { ...this.data.daily } };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered: Record<string, DailyBucket> = {};
    const agg = emptyBucket();

    for (const [date, bucket] of Object.entries(this.data.daily)) {
      if (date >= cutoffStr) {
        filtered[date] = bucket;
        agg.rooms += bucket.rooms;
        agg.games += bucket.games;
        agg.gamesCompleted += bucket.gamesCompleted;
        agg.players += bucket.players;
      }
    }

    return {
      period: { days: opts.days, from: cutoffStr, to: this.today() },
      aggregated: agg,
      gauges,
      daily: filtered,
    };
  }

  private load(): MetricsData {
    try {
      const parsed = this.store.load();
      if (parsed && typeof parsed === 'object') {
        const d = parsed as any;
        logger.info('metrics', 'Loaded metrics from disk', {
          roomsCreated: d.totals?.roomsCreated,
          gamesStarted: d.totals?.gamesStarted,
        });
        return {
          totals: { ...defaultMetrics().totals, ...d.totals },
          daily: d.daily ?? {},
        };
      }
    } catch (err) {
      logger.error('metrics', 'Failed to load metrics, starting fresh', { error: String(err) });
    }
    return defaultMetrics();
  }

  private pruneOldDays(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.maxDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const date of Object.keys(this.data.daily)) {
      if (date < cutoffStr) delete this.data.daily[date];
    }
  }

  async flush(): Promise<void> {
    this.pruneOldDays();
    await this.store.flush(this.data);
  }

  destroy(): void {
    clearInterval(this.flushInterval);
    this.pruneOldDays();
    this.store.flushSync(this.data);
  }
}
