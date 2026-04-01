type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'];

function log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    cat: category,
    msg: message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (cat: string, msg: string, data?: Record<string, unknown>) => log('debug', cat, msg, data),
  info: (cat: string, msg: string, data?: Record<string, unknown>) => log('info', cat, msg, data),
  warn: (cat: string, msg: string, data?: Record<string, unknown>) => log('warn', cat, msg, data),
  error: (cat: string, msg: string, data?: Record<string, unknown>) => log('error', cat, msg, data),
};
