import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WORDS_PATH = join(__dirname, '..', 'data', 'words.json');

const ALL_WORDS: string[] = JSON.parse(readFileSync(WORDS_PATH, 'utf-8'));

export const TOTAL_WORD_COUNT = ALL_WORDS.length;

export function pickWords({ count }: { count: number }): string[] {
  const pool = [...ALL_WORDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function pickTeamWords({ words }: { words: string[] }): { 1: string; 2: string } {
  if (words.length < 2) {
    throw new Error('Not enough words to pick two distinct team words');
  }
  const i = Math.floor(Math.random() * words.length);
  let j = Math.floor(Math.random() * (words.length - 1));
  if (j >= i) j += 1;
  return { 1: words[i], 2: words[j] };
}
