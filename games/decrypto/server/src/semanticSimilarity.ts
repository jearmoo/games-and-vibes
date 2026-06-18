import {
  getStoredEmbeddingIndex,
  getStoredEmbeddingTerms,
  getStoredTargetEmbeddingTerms,
  hasStoredEmbeddingTerm,
  STORED_EMBEDDING_SCORE_CEILING,
  STORED_EMBEDDING_SCORE_FLOOR,
  storedEmbeddingCosineByIndex,
} from './keywordEmbeddings.generated.js';

type FeatureMap = Map<string, number>;

const LEXICAL_WEIGHT = 0.08;
const WORD_WEIGHT = 0.15;
const FULL_WEIGHT_NEIGHBOR_RANK = 8;
const MAX_NEIGHBOR_RANK = 20;
const MAX_NON_EXACT_EMBEDDING_SCORE = 0.92;

const SEMANTIC_GROUPS: Record<string, string[]> = {
  celebration: ['festival', 'party', 'parade', 'carnival', 'celebration', 'concert', 'fair', 'ticket', 'opera'],
  publicEvent: ['festival', 'party', 'parade', 'market', 'opera', 'concert', 'ticket', 'fair'],
  music: ['festival', 'party', 'opera', 'concert', 'guitar', 'piano', 'drum', 'drums'],
  space: [
    'satellite',
    'asteroid',
    'comet',
    'rocket',
    'orbit',
    'galaxy',
    'planet',
    'moon',
    'meteor',
    'star',
    'space',
    'spacecraft',
  ],
  orbitingObject: ['satellite', 'asteroid', 'comet', 'rocket', 'orbit', 'planet', 'moon', 'meteor', 'spacecraft'],
  storm: ['thunder', 'lightning', 'storm', 'bolt', 'rain', 'weather', 'electricity', 'cloud'],
  weather: ['thunder', 'lightning', 'storm', 'rain', 'weather', 'cloud', 'zephyr', 'wind', 'horizon', 'iceberg'],
  machine: ['machine', 'engine', 'motor', 'robot', 'device', 'mechanism', 'factory', 'computer', 'camera'],
  toolObject: [
    'anchor',
    'compass',
    'dagger',
    'helmet',
    'jacket',
    'kettle',
    'lantern',
    'magnet',
    'mirror',
    'needle',
    'notebook',
    'saddle',
    'umbrella',
    'wallet',
    'window',
    'camera',
    'ladder',
    'machine',
    'engine',
  ],
  building: ['tower', 'temple', 'palace', 'library', 'harbor', 'village', 'kingdom', 'bridge', 'tunnel', 'fountain'],
  highStructure: ['tower', 'ladder', 'mountain', 'beacon', 'palace', 'temple'],
  forestNature: ['jungle', 'forest', 'garden', 'willow', 'island', 'mountain', 'canyon', 'desert', 'ocean', 'river'],
  water: ['river', 'ocean', 'harbor', 'fountain', 'island', 'iceberg', 'stream', 'water', 'sea'],
  travel: ['voyage', 'yacht', 'rocket', 'satellite', 'ticket', 'compass', 'harbor', 'bridge', 'tunnel'],
  royalty: ['crown', 'king', 'queen', 'kingdom', 'palace', 'jewel', 'emerald', 'trophy'],
  animal: ['falcon', 'rabbit', 'dragon', 'sphinx'],
  magic: ['wizard', 'dragon', 'sphinx', 'cipher', 'puzzle', 'shadow', 'whisper'],
  signal: ['signal', 'beacon', 'satellite', 'cipher', 'archive', 'notebook', 'whisper'],
  food: ['biscuit', 'apple', 'falafel', 'orange', 'banana', 'food', 'fruit'],
  fruit: ['apple', 'orange', 'banana', 'fruit'],
  colorMaterial: ['copper', 'silver', 'quartz', 'emerald', 'violet', 'velvet', 'jewel', 'neon'],
  sharpWeapon: ['dagger', 'quiver', 'arrow', 'needle'],
  clothing: ['helmet', 'jacket', 'saddle', 'wallet'],
  gamePuzzle: ['puzzle', 'cipher', 'notebook', 'archive'],
  sound: ['thunder', 'whisper', 'signal', 'opera', 'concert', 'guitar', 'piano', 'drum', 'drums'],
};

const FEATURE_INDEX = buildFeatureIndex();

export function normalizeSemanticAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeSemanticText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildFeatureIndex(): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const [feature, words] of Object.entries(SEMANTIC_GROUPS)) {
    for (const word of words) {
      const key = normalizeSemanticAnswer(word);
      index[key] ??= [];
      index[key].push(feature);
    }
  }
  return index;
}

function addFeature(features: FeatureMap, feature: string, weight: number): void {
  features.set(feature, (features.get(feature) ?? 0) + weight);
}

function lookupKeys(token: string): string[] {
  const compact = normalizeSemanticAnswer(token);
  const keys = [compact];
  if (compact.endsWith('ies') && compact.length > 4) keys.push(`${compact.slice(0, -3)}y`);
  if (compact.endsWith('es') && compact.length > 4) keys.push(compact.slice(0, -2));
  if (compact.endsWith('s') && compact.length > 3) keys.push(compact.slice(0, -1));
  if (compact.endsWith('ing') && compact.length > 5) keys.push(compact.slice(0, -3));
  return [...new Set(keys)];
}

function addSemanticFeatures(features: FeatureMap, token: string): boolean {
  let found = false;
  for (const key of lookupKeys(token)) {
    const semanticFeatures = FEATURE_INDEX[key];
    if (!semanticFeatures) continue;
    found = true;
    for (const feature of semanticFeatures) addFeature(features, `semantic:${feature}`, 1);
  }
  return found;
}

function featureMapFor(value: string): { features: FeatureMap; hasSemanticFeatures: boolean } {
  const text = normalizeSemanticText(value);
  const compact = normalizeSemanticAnswer(value);
  const features: FeatureMap = new Map();
  let hasSemanticFeatures = false;
  if (!text && !compact) return { features, hasSemanticFeatures };

  for (const token of text.split(/\s+/).filter(Boolean)) {
    const tokenKey = normalizeSemanticAnswer(token);
    if (!tokenKey) continue;
    addFeature(features, `word:${tokenKey}`, WORD_WEIGHT);
    hasSemanticFeatures = addSemanticFeatures(features, token) || hasSemanticFeatures;
  }

  const padded = `^${compact}$`;
  for (let index = 0; index <= padded.length - 3; index += 1) {
    addFeature(features, `char:${padded.slice(index, index + 3)}`, LEXICAL_WEIGHT);
  }

  return { features, hasSemanticFeatures };
}

function cosine(a: FeatureMap, b: FeatureMap): number {
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (const value of a.values()) aMagnitude += value * value;
  for (const value of b.values()) bMagnitude += value * value;
  for (const [feature, aValue] of a) dot += aValue * (b.get(feature) ?? 0);
  if (aMagnitude === 0 || bMagnitude === 0) return 0;
  return dot / Math.sqrt(aMagnitude * bMagnitude);
}

function clampSimilarity(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function storedVectorForSingleTerm(value: string): { key: string; index: number } | undefined {
  for (const key of lookupKeys(value)) {
    const index = getStoredEmbeddingIndex(key);
    if (index !== undefined) return { key, index };
  }
  return undefined;
}

function rankTargetForGuess(guessIndex: number, targetKey: string): number | undefined {
  const targetTerms = getStoredTargetEmbeddingTerms();
  const terms = getStoredEmbeddingTerms();
  const rankTerms = targetTerms.length > 0 ? targetTerms : terms;
  const scores = rankTerms
    .flatMap((key) => {
      const index = getStoredEmbeddingIndex(key);
      return index === undefined ? [] : [{ key, score: storedEmbeddingCosineByIndex(guessIndex, index) }];
    })
    .sort((a, b) => b.score - a.score);
  const rank = scores.findIndex((entry) => entry.key === targetKey);
  return rank === -1 ? undefined : rank + 1;
}

function neighborRankWeight(rank: number | undefined): number {
  if (rank === undefined || rank <= FULL_WEIGHT_NEIGHBOR_RANK) return 1;
  if (rank >= MAX_NEIGHBOR_RANK) return 0;
  return ((MAX_NEIGHBOR_RANK - rank) / (MAX_NEIGHBOR_RANK - FULL_WEIGHT_NEIGHBOR_RANK)) ** 2;
}

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
      rankWeight: number;
    }
  | {
      method: 'out-of-vocabulary';
      score: number;
      missing: string[];
    }
  | {
      method: 'fallback';
      score: number;
    };

export function getTiebreakerVocabulary(): readonly string[] {
  return getStoredEmbeddingTerms();
}

export function isKnownTiebreakerGuess(value: string): boolean {
  return hasStoredEmbeddingTerm(normalizeSemanticAnswer(value));
}

function calibratedEmbeddingSimilarity(a: string, b: string): SemanticSimilarityDetails | undefined {
  const aStored = storedVectorForSingleTerm(a);
  const bStored = storedVectorForSingleTerm(b);
  if (!aStored || !bStored) {
    if (getStoredEmbeddingTerms().length === 0) return undefined;
    return {
      method: 'out-of-vocabulary',
      score: 0,
      missing: [!aStored ? normalizeSemanticAnswer(a) : '', !bStored ? normalizeSemanticAnswer(b) : ''].filter(Boolean),
    };
  }

  const rawCosine = storedEmbeddingCosineByIndex(aStored.index, bStored.index);
  const calibrationRange = STORED_EMBEDDING_SCORE_CEILING - STORED_EMBEDDING_SCORE_FLOOR;
  // Tiebreaker scores are intentionally not raw MiniLM cosine values. Generated embeddings stay in
  // int8 form at runtime; cosine is computed as dot(qA, qB) / (norm(qA) * norm(qB)) with one cached
  // int8 norm per term. The raw score is calibrated against the generated Decrypto target-word
  // distribution, then weighted by where the target appears in the guess's nearest target words.
  // That rank gate prevents unrelated words from receiving partial credit just because transformer
  // cosine scores are usually positive. Non-exact embedding matches are capped below 1 so only exact
  // word guesses can display as 100%.
  const calibrated =
    calibrationRange <= 0.001
      ? clampSimilarity(rawCosine)
      : clampSimilarity((rawCosine - STORED_EMBEDDING_SCORE_FLOOR) / calibrationRange);
  const neighborRank = rankTargetForGuess(aStored.index, bStored.key);
  const rankWeight = neighborRankWeight(neighborRank);
  const uncappedScore = calibrated * rankWeight;
  return {
    method: 'stored-embedding',
    score: Math.min(MAX_NON_EXACT_EMBEDDING_SCORE, uncappedScore),
    rawCosine,
    calibratedScore: calibrated,
    neighborRank,
    rankWeight,
  };
}

export function fallbackSemanticSimilarity(a: string, b: string): number {
  if (normalizeSemanticAnswer(a) === normalizeSemanticAnswer(b)) return 1;
  const aEmbedding = featureMapFor(a);
  const bEmbedding = featureMapFor(b);
  const score = cosine(aEmbedding.features, bEmbedding.features);
  const hasSemanticComparison = aEmbedding.hasSemanticFeatures && bEmbedding.hasSemanticFeatures;
  return clampSimilarity(hasSemanticComparison ? score : score * 0.35);
}

export function semanticSimilarityDetails(a: string, b: string): SemanticSimilarityDetails {
  if (normalizeSemanticAnswer(a) === normalizeSemanticAnswer(b)) return { method: 'exact', score: 1 };
  const embeddingScore = calibratedEmbeddingSimilarity(a, b);
  if (embeddingScore) return embeddingScore;
  return {
    method: 'fallback',
    score: fallbackSemanticSimilarity(a, b),
  };
}

export function semanticSimilarity(a: string, b: string): number {
  return semanticSimilarityDetails(a, b).score;
}
