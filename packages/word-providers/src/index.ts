export type { WordProvider } from './types.js';
export { charadesProvider } from './charades.js';
export { randomWordApiProvider } from './randomWordApi.js';
export { FALLBACK_WORDS } from './fallbackWords.js';

import type { WordProvider } from './types.js';
import { FALLBACK_WORDS } from './fallbackWords.js';

export function createWordFetcher(provider: WordProvider, difficulty: number): (count: number) => Promise<string[]> {
  return async (count: number): Promise<string[]> => {
    try {
      const words = await provider(count, difficulty);
      return words.map((w) => w.toLowerCase());
    } catch {
      const shuffled = [...FALLBACK_WORDS].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    }
  };
}
