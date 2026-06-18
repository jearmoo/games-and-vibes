import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(scriptDir, '..');
const sourceDir = resolve(serverDir, 'src');
const outputDir = resolve(serverDir, 'dist');

const assets = [
  'keywordEmbeddings.int8.bin',
  'keywordTerms.generated.json',
  'keywordEmbeddings.metadata.generated.json',
];

await mkdir(outputDir, { recursive: true });
await Promise.all(assets.map((asset) => copyFile(resolve(sourceDir, asset), resolve(outputDir, asset))));
