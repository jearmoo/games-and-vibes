import { describe, it, expect, vi } from 'vitest';

// Test the word fetcher creation logic from word-providers
import { createWordFetcher, FALLBACK_WORDS } from '@games/word-providers';
import type { WordProvider } from '@games/word-providers';

describe('Word fetcher', () => {
  it('returns lowercased words from provider', async () => {
    const mockProvider: WordProvider = vi.fn(async (count) => {
      return Array.from({ length: count }, (_, i) => `Word${i}`);
    });
    const fetcher = createWordFetcher(mockProvider, 2);
    const words = await fetcher(3);
    expect(words).toEqual(['word0', 'word1', 'word2']);
    expect(mockProvider).toHaveBeenCalledWith(3, 2);
  });

  it('falls back to shuffled fallback words on provider failure', async () => {
    const failingProvider: WordProvider = vi.fn(async () => {
      throw new Error('API down');
    });
    const fetcher = createWordFetcher(failingProvider, 1);
    const words = await fetcher(5);
    expect(words.length).toBe(5);
    words.forEach((w) => {
      expect(FALLBACK_WORDS).toContain(w);
    });
  });

  it('fallback words has enough entries', () => {
    expect(FALLBACK_WORDS.length).toBeGreaterThan(200);
  });
});
