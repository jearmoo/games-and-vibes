import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordBuffer } from './wordService';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockFetchResponse(words: Array<{ word1: string; word3: string }>) {
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

  it('prefetches words from API', async () => {
    mockFetchResponse([
      { word1: 'cat', word3: 'feline' },
      { word1: 'dog', word3: 'canine' },
    ]);
    await buffer.prefetch(2);
    const word = buffer.consume();
    expect(word).toEqual({ word1: 'cat', word3: 'feline' });
  });

  it('consume returns null when empty', () => {
    expect(buffer.consume()).toBeNull();
  });

  it('tracks used words to prevent duplicates', async () => {
    mockFetchResponse([{ word1: 'cat', word3: 'feline' }]);
    await buffer.prefetch(1);
    buffer.consume();

    // Second prefetch with same word should be filtered
    mockFetchResponse([{ word1: 'cat', word3: 'feline' }]);
    await buffer.prefetch(1);
    expect(buffer.consume()).toBeNull();
  });

  it('reset clears queue and used set', async () => {
    mockFetchResponse([{ word1: 'cat', word3: 'feline' }]);
    await buffer.prefetch(1);
    buffer.reset();
    expect(buffer.consume()).toBeNull();
  });
});
