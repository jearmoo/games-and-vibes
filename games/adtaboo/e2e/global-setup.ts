import path from 'path';
import { createGameSetup } from '@games/e2e-core';

const ROOT = path.resolve(import.meta.dirname, '../../..');

export default createGameSetup({
  serverDir: path.join(ROOT, 'games/adtaboo/server'),
  clientDir: path.join(ROOT, 'games/adtaboo/client'),
  serverPortEnvVar: 'ADTABOO_SERVER_PORT',
});
