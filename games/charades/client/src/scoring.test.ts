import { describe, it, expect } from 'vitest';
import { calcRoundScore } from './store';

describe('calcRoundScore', () => {
  it('returns correct count when no passes', () => {
    expect(calcRoundScore(5, 0)).toBe(5);
  });

  it('first pass is free (no penalty)', () => {
    expect(calcRoundScore(3, 1)).toBe(3);
  });

  it('two passes cost 1 point', () => {
    expect(calcRoundScore(3, 2)).toBe(2);
  });

  it('three passes still cost 1 point', () => {
    expect(calcRoundScore(3, 3)).toBe(2);
  });

  it('four passes cost 2 points', () => {
    expect(calcRoundScore(3, 4)).toBe(1);
  });

  it('can result in negative score', () => {
    expect(calcRoundScore(0, 4)).toBe(-2);
  });

  it('zero correct and zero passes gives zero', () => {
    expect(calcRoundScore(0, 0)).toBe(0);
  });

  it('handles large numbers', () => {
    expect(calcRoundScore(10, 7)).toBe(7); // 10 - floor(7/2) = 10 - 3 = 7
  });
});
