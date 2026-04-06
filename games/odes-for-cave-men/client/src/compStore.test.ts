import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCompStore } from './compStore';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockWords(count: number) {
  const words = Array.from({ length: count }, (_, i) => ({
    word1: `word${i}`,
    word3: `desc${i}`,
  }));
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => words,
  });
}

describe('compStore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useCompStore.getState().resetToSetup();
  });

  it('starts in setup phase, not active', () => {
    const state = useCompStore.getState();
    expect(state.phase).toBe('setup');
    expect(state.active).toBe(false);
  });

  it('startGame transitions to cluer-entry and resets state', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    const state = useCompStore.getState();
    expect(state.phase).toBe('cluer-entry');
    expect(state.players).toEqual({});
    expect(state.roundHistory).toHaveLength(0);
  });

  it('beginRound sets phase to playing with timer', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    const state = useCompStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.timerEnd).not.toBeNull();
    expect(state.currentWord).not.toBeNull();
    expect(state.roundCards).toHaveLength(0);
  });

  it('markCorrect increments score, advances word, and tracks card', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    const firstWord = useCompStore.getState().currentWord;

    useCompStore.getState().markCorrect(3);
    const state = useCompStore.getState();
    expect(state.roundCorrect).toBe(3);
    expect(state.currentWord).not.toEqual(firstWord);
    expect(state.roundCards).toHaveLength(1);
    expect(state.roundCards[0].word1).toBe(firstWord!.word1);
    expect(state.roundCards[0].result).toBe('correct');
    expect(state.roundCards[0].points).toBe(3);
    expect(state.roundCards[0].originalPoints).toBe(3);
  });

  it('markSkip increments skips and tracks card', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markSkip();
    expect(useCompStore.getState().roundSkips).toBe(1);
    expect(useCompStore.getState().roundCards).toHaveLength(1);
    expect(useCompStore.getState().roundCards[0].result).toBe('skipped');
  });

  it('markBonk increments bonks and tracks card', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markBonk();
    expect(useCompStore.getState().roundBonks).toBe(1);
    expect(useCompStore.getState().roundCards).toHaveLength(1);
    expect(useCompStore.getState().roundCards[0].result).toBe('bonked');
  });

  it('endRound transitions to review phase', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().markSkip();

    useCompStore.getState().endRound();
    const state = useCompStore.getState();
    expect(state.phase).toBe('review');
    expect(state.timerEnd).toBeNull();
    expect(state.roundCards).toHaveLength(3);
  });

  it('adjustCardPoints updates a card in review', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().endRound();

    useCompStore.getState().adjustCardPoints(0, 1);
    const card = useCompStore.getState().roundCards[0];
    expect(card.points).toBe(1);
    expect(card.originalPoints).toBe(3);
  });

  it('lockInReview calculates score and transitions to round-result', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().markSkip();
    useCompStore.getState().endRound();

    useCompStore.getState().lockInReview();
    const state = useCompStore.getState();
    expect(state.phase).toBe('round-result');
    expect(state.roundHistory).toHaveLength(1);
    expect(state.roundHistory[0].score).toBe(3); // 3 + 1 - 1
    expect(state.roundHistory[0].cluerName).toBe('Alice');
    expect(state.roundHistory[0].cards).toHaveLength(3);
    expect(state.roundHistory[0].cards[0].result).toBe('correct');
    expect(state.roundHistory[0].cards[0].points).toBe(3);
    expect(state.roundHistory[0].cards[2].result).toBe('skipped');
    expect(state.players['Alice']).toBe(3);
  });

  it('lockInReview uses adjusted points', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().markSkip();
    useCompStore.getState().endRound();

    // Adjust the skip from -1 to +1
    useCompStore.getState().adjustCardPoints(1, 1);
    useCompStore.getState().lockInReview();

    const state = useCompStore.getState();
    expect(state.roundHistory[0].score).toBe(4); // 3 + 1
    expect(state.roundHistory[0].cards[1].points).toBe(1); // adjusted from -1 to +1
    expect(state.roundHistory[0].cards[1].originalPoints).toBe(-1);
    expect(state.players['Alice']).toBe(4);
  });

  it('accumulates scores across multiple rounds for same player', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();

    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().endRound();
    useCompStore.getState().lockInReview();

    useCompStore.getState().nextRound();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().endRound();
    useCompStore.getState().lockInReview();

    expect(useCompStore.getState().players['Alice']).toBe(4); // 1 + 3
  });

  it('nextRound transitions to cluer-entry', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().endRound();
    useCompStore.getState().lockInReview();

    useCompStore.getState().nextRound();
    const state = useCompStore.getState();
    expect(state.phase).toBe('cluer-entry');
    expect(state.cluerName).toBe('');
  });

  it('endGame sets phase to game-over', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().endGame();
    expect(useCompStore.getState().phase).toBe('game-over');
  });

  it('resetToSetup clears all state and sets active false', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Bob');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().endRound();
    useCompStore.getState().lockInReview();

    useCompStore.getState().resetToSetup();
    const state = useCompStore.getState();
    expect(state.active).toBe(false);
    expect(state.phase).toBe('setup');
    expect(state.roundHistory).toHaveLength(0);
    expect(state.players).toEqual({});
    expect(state.roundCards).toHaveLength(0);
  });
});
