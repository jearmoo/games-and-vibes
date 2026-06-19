import {
  getStoredEmbeddingIndex,
  getStoredEmbeddingTerms,
  getStoredTargetEmbeddingIndex,
  getStoredTargetEmbeddingTerms,
  hasStoredEmbeddingTerm,
  storedTargetEmbeddingCosineByIndex,
} from './keywordEmbeddings.generated.js';

const SCORE_SCALE = 100;

export type SemanticSimilarityDetails =
  | {
      method: 'exact';
      score: number;
    }
  | {
      method: 'stored-embedding';
      score: number;
      rawCosine: number;
      rawScore: number;
      neighborRank: number | undefined;
      rankMultiplier: number;
      rankCap: number;
      rankFloor: number;
      softBoost: number;
    }
  | {
      method: 'out-of-vocabulary';
      score: number;
      missing: string[];
    };

export function normalizeSemanticAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function lookupKeys(value: string): string[] {
  const compact = normalizeSemanticAnswer(value);
  const keys = [compact];
  if (compact.endsWith('ies') && compact.length > 4) keys.push(`${compact.slice(0, -3)}y`);
  if (compact.endsWith('es') && compact.length > 4) keys.push(compact.slice(0, -2));
  if (compact.endsWith('s') && compact.length > 3) keys.push(compact.slice(0, -1));
  if (compact.endsWith('ing') && compact.length > 5) keys.push(compact.slice(0, -3));
  return [...new Set(keys.filter(Boolean))];
}

function storedGuessVectorFor(value: string): { key: string; index: number } | undefined {
  for (const key of lookupKeys(value)) {
    const index = getStoredEmbeddingIndex(key);
    if (index !== undefined) return { key, index };
  }
  return undefined;
}

function storedTargetVectorFor(value: string): { key: string; index: number } | undefined {
  for (const key of lookupKeys(value)) {
    const index = getStoredTargetEmbeddingIndex(key);
    if (index !== undefined) return { key, index };
  }
  return undefined;
}

function rankTargetForGuess(guessIndex: number, targetKey: string): number | undefined {
  const scores = getStoredTargetEmbeddingTerms()
    .flatMap((key) => {
      const targetIndex = getStoredTargetEmbeddingIndex(key);
      return targetIndex === undefined
        ? []
        : [{ key, score: storedTargetEmbeddingCosineByIndex(guessIndex, targetIndex) }];
    })
    .sort((left, right) => right.score - left.score);
  const rank = scores.findIndex((entry) => entry.key === targetKey);
  return rank === -1 ? undefined : rank + 1;
}

function clampSimilarity(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function lerp(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number): number {
  if (value <= inputMin) return outputMin;
  if (value >= inputMax) return outputMax;
  const progress = (value - inputMin) / (inputMax - inputMin);
  return outputMin + progress * (outputMax - outputMin);
}

function rawCosineToConservativeScore(rawCosine: number): number {
  if (rawCosine < 0.3) return 0;
  if (rawCosine < 0.35) return lerp(rawCosine, 0.3, 0.35, 0, 0.1);
  if (rawCosine < 0.45) return lerp(rawCosine, 0.35, 0.45, 0.1, 0.4);
  if (rawCosine < 0.55) return lerp(rawCosine, 0.45, 0.55, 0.4, 0.7);
  if (rawCosine < 0.65) return lerp(rawCosine, 0.55, 0.65, 0.7, 0.9);
  if (rawCosine < 0.75) return lerp(rawCosine, 0.65, 0.75, 0.9, 1);
  return 1;
}

function multiplierForRank(rank: number | undefined): number {
  if (rank === undefined) return 0.1;
  if (rank === 1) return 1;
  if (rank <= 3) return 0.95;
  if (rank <= 5) return 0.9;
  if (rank <= 10) return 0.8;
  if (rank <= 20) return 0.65;
  if (rank <= 50) return 0.45;
  if (rank <= 100) return 0.25;
  return 0.1;
}

function capForRank(rank: number | undefined): number {
  if (rank === undefined) return 0.15;
  if (rank === 1) return 1;
  if (rank <= 3) return 0.92;
  if (rank <= 5) return 0.85;
  if (rank <= 10) return 0.75;
  if (rank <= 20) return 0.6;
  if (rank <= 50) return 0.45;
  if (rank <= 100) return 0.3;
  return 0.15;
}

function floorForRank(rank: number | undefined, rawCosine: number, rawScore: number): number {
  if (rank === undefined) return 0;
  if (rank === 1 && rawScore >= 0.45) return 0.75;
  if (rank === 1 && rawScore >= 0.4) return 0.7;
  if (rank === 1 && rawCosine >= 0.4) return 0.65;
  if (rank <= 2 && rawCosine >= 0.38) return 0.6;
  if (rank <= 3 && rawCosine >= 0.47) return 0.55;
  if (rank <= 3 && rawCosine >= 0.42 && rawCosine < 0.45) return 0.55;
  if (rank <= 3 && rawScore >= 0.55) return 0.65;
  if (rank <= 5 && rawScore >= 0.55) return 0.6;
  if (rank >= 4 && rank <= 10 && rawScore >= 0.4) return 0.55;
  if (rank >= 4 && rank <= 10 && rawCosine >= 0.42) return 0.35;
  return 0;
}

function softFloor(score: number, floor: number, strength: number): number {
  if (score >= floor || strength <= 0) return score;
  return score + (floor - score) * strength;
}

function broadMediumBoostStrength(rank: number | undefined, rawCosine: number): number {
  if (rank === undefined || rank < 4 || rank > 25 || rawCosine < 0.34) return 0;
  const rankStrength = rank <= 5 ? 0.65 : rank <= 10 ? 0.5 : 0.35;
  const cosineStrength = clampSimilarity((rawCosine - 0.34) / 0.06);
  return Math.min(0.85, rankStrength * 2 * cosineStrength);
}

export function getTiebreakerVocabulary(): readonly string[] {
  return getStoredEmbeddingTerms();
}

export function isKnownTiebreakerGuess(value: string): boolean {
  return hasStoredEmbeddingTerm(normalizeSemanticAnswer(value));
}

export function semanticSimilarityDetails(a: string, b: string): SemanticSimilarityDetails {
  if (normalizeSemanticAnswer(a) === normalizeSemanticAnswer(b)) return { method: 'exact', score: 1 };

  const guess = storedGuessVectorFor(a);
  const target = storedTargetVectorFor(b);
  if (!guess || !target) {
    return {
      method: 'out-of-vocabulary',
      score: 0,
      missing: [!guess ? normalizeSemanticAnswer(a) : '', !target ? normalizeSemanticAnswer(b) : ''].filter(Boolean),
    };
  }

  const rawCosine = storedTargetEmbeddingCosineByIndex(guess.index, target.index);
  const rawScore = rawCosineToConservativeScore(rawCosine);
  const neighborRank = rankTargetForGuess(guess.index, target.key);
  const rankMultiplier = multiplierForRank(neighborRank);
  const rankCap = capForRank(neighborRank);
  const rankFloor = floorForRank(neighborRank, rawCosine, rawScore);
  const softBoost = broadMediumBoostStrength(neighborRank, rawCosine);
  const hardAdjustedScore = Math.max(rawScore * rankMultiplier, rankFloor);
  const adjustedScore = Math.min(softFloor(hardAdjustedScore, 0.45, softBoost), rankCap);

  return {
    method: 'stored-embedding',
    score: clampSimilarity(Math.round(adjustedScore * SCORE_SCALE) / SCORE_SCALE),
    rawCosine,
    rawScore,
    neighborRank,
    rankMultiplier,
    rankCap,
    rankFloor,
    softBoost,
  };
}

export function semanticSimilarity(a: string, b: string): number {
  return semanticSimilarityDetails(a, b).score;
}
