import { type FullConfig } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findFreePort, waitForPort } from './ports.js';

export interface GameSetupOptions {
  /** Absolute path to the game's server package (e.g. games/adtaboo/server) */
  serverDir: string;
  /** Absolute path to the game's client package (e.g. games/adtaboo/client) */
  clientDir: string;
  /** Env var name the client's vite config reads for the server port. Default: first segment of game name uppercased + '_SERVER_PORT' */
  serverPortEnvVar?: string;
  /** Extra env vars to pass to the server process */
  serverEnv?: Record<string, string>;
}

/**
 * Factory that returns a Playwright globalSetup function for a game.
 * Finds free ports, starts both server and Vite dev server, waits for them,
 * and returns a teardown function.
 */
export function createGameSetup(opts: GameSetupOptions) {
  const { serverDir, clientDir, serverPortEnvVar, serverEnv } = opts;

  let serverProc: ChildProcess | undefined;
  let viteProc: ChildProcess | undefined;

  return async function globalSetup(_config: FullConfig) {
    const serverPort = await findFreePort();
    const vitePort = await findFreePort();

    const roomsPath = path.join('/tmp', `e2e-rooms-${process.pid}.json`);
    const metricsPath = path.join('/tmp', `e2e-metrics-${process.pid}.json`);

    // Start game server
    serverProc = spawn(path.join(serverDir, 'node_modules/.bin/tsx'), ['src/index.ts'], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: String(serverPort),
        ROOMS_PATH: roomsPath,
        METRICS_PATH: metricsPath,
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        ...serverEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProc.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString();
      if (!msg.includes('ExperimentalWarning')) process.stderr.write(`[server] ${msg}`);
    });

    // Start Vite dev server
    const portEnvVar = serverPortEnvVar ?? `${path.basename(path.dirname(serverDir)).toUpperCase()}_SERVER_PORT`;
    viteProc = spawn(path.join(clientDir, 'node_modules/.bin/vite'), ['--port', String(vitePort), '--strictPort'], {
      cwd: clientDir,
      env: {
        ...process.env,
        [portEnvVar]: String(serverPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    viteProc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[vite] ${d}`));

    // Wait for both to be ready
    await Promise.all([waitForPort(serverPort), waitForPort(vitePort)]);

    // Set the base URL for all tests
    process.env.BASE_URL = `http://localhost:${vitePort}`;

    return async () => {
      serverProc?.kill('SIGTERM');
      viteProc?.kill('SIGTERM');

      for (const f of [roomsPath, metricsPath]) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
    };
  };
}
