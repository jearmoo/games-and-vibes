import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordBuffer } from './wordService';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockFetchResponse(words: string[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => words,
  });
}

describe('WordBuffer', () => {
  let buffer: WordBuffer;

  beforeEach(() => {
    buffer = new WordBuffer();
    mockFetch.mockReset();
  });

  it('prefetches a word', async () => {
    mockFetchResponse(['elephant', 'giraffe', 'penguin']);
    await buffer.prefetch();
    expect(buffer.hasNext()).toBe(true);
  });

  it('consume returns the prefetched word', async () => {
    mockFetchResponse(['elephant', 'giraffe']);
    await buffer.prefetch();
    // Mock for the background prefetch triggered by consume
    mockFetchResponse(['dolphin', 'kangaroo']);
    const word = await buffer.consume();
    expect(word).toBe('elephant');
  });

  it('tracks used words to prevent duplicates', async () => {
    mockFetchResponse(['elephant']);
    await buffer.prefetch();
    mockFetchResponse(['giraffe']);
    await buffer.consume();
    expect(buffer.usedWords.has('elephant')).toBe(true);
  });

  it('filters out already-used words', async () => {
    // First fetch returns elephant
    mockFetchResponse(['elephant']);
    await buffer.prefetch();
    mockFetchResponse(['giraffe']);
    const word1 = await buffer.consume();
    expect(word1).toBe('elephant');

    // Wait for background prefetch
    await new Promise((r) => setTimeout(r, 50));
    expect(buffer.usedWords.has('giraffe')).toBe(true);
  });

  it('reset clears state', async () => {
    mockFetchResponse(['elephant']);
    await buffer.prefetch();
    buffer.reset();
    expect(buffer.hasNext()).toBe(false);
    expect(buffer.usedWords.size).toBe(0);
  });

  it('does not duplicate prefetch calls', async () => {
    mockFetchResponse(['elephant', 'giraffe']);
    const p1 = buffer.prefetch();
    const p2 = buffer.prefetch();
    await Promise.all([p1, p2]);
    // Only one fetch call should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
