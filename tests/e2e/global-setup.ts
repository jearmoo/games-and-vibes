import { type FullConfig } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PORTS_FILE = path.join('/tmp', `e2e-ports-${process.pid}.json`);

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      // Try localhost (resolves to IPv4 or IPv6 depending on system)
      const sock = net.createConnection({ port, host: 'localhost' });
      sock.on('connect', () => {
        sock.destroy();
        resolve();
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });
    };
    tryConnect();
  });
}

let serverProc: ChildProcess | undefined;
let viteProc: ChildProcess | undefined;

export default async function globalSetup(config: FullConfig) {
  const serverPort = await findFreePort();
  const vitePort = await findFreePort();

  const roomsPath = path.join('/tmp', `e2e-rooms-${process.pid}.json`);
  const metricsPath = path.join('/tmp', `e2e-metrics-${process.pid}.json`);

  const serverDir = path.join(ROOT, 'games/adtaboo/server');
  const clientDir = path.join(ROOT, 'games/adtaboo/client');

  // Start adtaboo server (use local tsx binary)
  serverProc = spawn(path.join(serverDir, 'node_modules/.bin/tsx'), ['src/index.ts'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(serverPort),
      ROOMS_PATH: roomsPath,
      METRICS_PATH: metricsPath,
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString();
    if (!msg.includes('ExperimentalWarning')) process.stderr.write(`[server] ${msg}`);
  });

  // Start Vite dev server (use local vite binary)
  viteProc = spawn(path.join(clientDir, 'node_modules/.bin/vite'), ['--port', String(vitePort), '--strictPort'], {
    cwd: clientDir,
    env: {
      ...process.env,
      ADTABOO_SERVER_PORT: String(serverPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  viteProc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[vite] ${d}`));

  // Wait for both to be ready
  await Promise.all([waitForPort(serverPort), waitForPort(vitePort)]);

  // Store ports so playwright.config.ts can read them
  const ports = { serverPort, vitePort };
  fs.writeFileSync(PORTS_FILE, JSON.stringify(ports));

  // Set the base URL for all tests
  process.env.BASE_URL = `http://localhost:${vitePort}`;
  process.env.E2E_PORTS_FILE = PORTS_FILE;

  return async () => {
    serverProc?.kill('SIGTERM');
    viteProc?.kill('SIGTERM');

    // Cleanup temp files
    for (const f of [PORTS_FILE, roomsPath, metricsPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  };
}
