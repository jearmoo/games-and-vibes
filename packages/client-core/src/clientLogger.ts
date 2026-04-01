const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const isProd =
  typeof location !== 'undefined' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

function getThreshold(): number {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('LOG_LEVEL') as Level | null;
    if (stored && stored in LEVELS) return LEVELS[stored];
  }
  return isProd ? LEVELS.warn : LEVELS.debug;
}

function log(level: Level, cat: string, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < getThreshold()) return;
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[method](`[${cat}] ${msg}`, data ?? '');
}

export const clientLogger = {
  debug: (cat: string, msg: string, data?: Record<string, unknown>) => log('debug', cat, msg, data),
  info: (cat: string, msg: string, data?: Record<string, unknown>) => log('info', cat, msg, data),
  warn: (cat: string, msg: string, data?: Record<string, unknown>) => log('warn', cat, msg, data),
  error: (cat: string, msg: string, data?: Record<string, unknown>) => log('error', cat, msg, data),
};
