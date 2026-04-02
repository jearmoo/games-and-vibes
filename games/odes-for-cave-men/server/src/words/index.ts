import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface WordEntry {
  word1: string;
  word3: string;
}

function loadList(filename: string): WordEntry[] {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  const data = JSON.parse(raw);
  const entries: Array<{ '1': string; '3': string }> = Array.isArray(data) ? data : data.game_data;
  return entries.map((e) => ({ word1: e['1'], word3: e['3'] }));
}

const ALL_WORDS: WordEntry[] = [
  ...loadList('base_game_gray.json'),
  ...loadList('base_game_red.json'),
  ...loadList('expansion_gray.json'),
  ...loadList('expansion_red.json'),
  ...loadList('generated.json'),
];

export const TOTAL_WORD_COUNT = ALL_WORDS.length;

/**
 * Returns `count` random words, excluding any indices in `usedIndices`.
 * Returns the words along with their indices so the caller can track usage.
 */
export function getRandomWords(count: number, usedIndices: Set<number>): Array<WordEntry & { index: number }> {
  const available = ALL_WORDS.map((w, i) => ({ ...w, index: i })).filter((w) => !usedIndices.has(w.index));

  // If not enough unused words remain, reset (return from full pool)
  const pool = available.length >= count ? available : ALL_WORDS.map((w, i) => ({ ...w, index: i }));

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
