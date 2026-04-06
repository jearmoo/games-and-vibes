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
  });

  it('markCorrect increments score and advances word', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    const firstWord = useCompStore.getState().currentWord;

    useCompStore.getState().markCorrect(3);
    const state = useCompStore.getState();
    expect(state.roundCorrect).toBe(3);
    expect(state.currentWord).not.toEqual(firstWord);
  });

  it('markSkip increments skips', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markSkip();
    expect(useCompStore.getState().roundSkips).toBe(1);
  });

  it('markBonk increments bonks', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markBonk();
    expect(useCompStore.getState().roundBonks).toBe(1);
  });

  it('endRound calculates score and adds to player leaderboard', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().markSkip();

    useCompStore.getState().endRound();
    const state = useCompStore.getState();
    expect(state.phase).toBe('round-result');
    expect(state.roundHistory).toHaveLength(1);
    expect(state.roundHistory[0].correct).toBe(4);
    expect(state.roundHistory[0].skips).toBe(1);
    expect(state.roundHistory[0].score).toBe(3); // 4 - 1
    expect(state.roundHistory[0].cluerName).toBe('Alice');
    expect(state.players['Alice']).toBe(3);
  });

  it('accumulates scores across multiple rounds for same player', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();

    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(1);
    useCompStore.getState().endRound();

    useCompStore.getState().nextRound();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().markCorrect(3);
    useCompStore.getState().endRound();

    expect(useCompStore.getState().players['Alice']).toBe(4); // 1 + 3
  });

  it('nextRound transitions to cluer-entry', async () => {
    mockWords(20);
    await useCompStore.getState().startGame();
    useCompStore.getState().setCluerName('Alice');
    useCompStore.getState().beginRound();
    useCompStore.getState().endRound();

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

    useCompStore.getState().resetToSetup();
    const state = useCompStore.getState();
    expect(state.active).toBe(false);
    expect(state.phase).toBe('setup');
    expect(state.roundHistory).toHaveLength(0);
    expect(state.players).toEqual({});
  });
});
