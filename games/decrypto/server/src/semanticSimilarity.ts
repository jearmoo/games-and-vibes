import {
  getStoredEmbeddingIndex,
  getStoredEmbeddingTerms,
  getStoredTargetEmbeddingIndex,
  getStoredTargetEmbeddingTerms,
  hasStoredEmbeddingTerm,
  STORED_EMBEDDING_SCORE_CEILING,
  STORED_EMBEDDING_SCORE_FLOOR,
  storedTargetEmbeddingCosineByIndex,
} from './keywordEmbeddings.generated.js';

const MAX_NON_EXACT_EMBEDDING_SCORE = 0.98;

export type SemanticSimilarityDetails =
  | {
      method: 'exact';
      score: number;
    }
  | {
      method: 'stored-embedding';
      score: number;
      rawCosine: number;
      calibratedScore: number;
      neighborRank: number | undefined;
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
  const calibrationRange = STORED_EMBEDDING_SCORE_CEILING - STORED_EMBEDDING_SCORE_FLOOR;
  const calibratedScore =
    calibrationRange <= 0.001
      ? clampSimilarity(rawCosine)
      : clampSimilarity((rawCosine - STORED_EMBEDDING_SCORE_FLOOR) / calibrationRange);

  return {
    method: 'stored-embedding',
    score: Math.min(MAX_NON_EXACT_EMBEDDING_SCORE, calibratedScore),
    rawCosine,
    calibratedScore,
    neighborRank: rankTargetForGuess(guess.index, target.key),
  };
}

export function semanticSimilarity(a: string, b: string): number {
  return semanticSimilarityDetails(a, b).score;
}
