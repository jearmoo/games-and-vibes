import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { KEYWORD_CARDS, normalizeCardKey } from '../src/wordbank.js';

const DEFAULT_MODEL = 'text-embedding-3-large';
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_VOCABULARY_WORD_LIMIT = 150_000;
const DEFAULT_SOURCE_POOL_SIZE = 0;
const DEFAULT_ZIPF_FREQUENCY_FLOOR = 1.5;
const DEFAULT_WORDFREQ_WORDLIST = 'best';
const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_MAX_WORD_LENGTH = 18;
const DEFAULT_BATCH_SIZE = 1_024;
const QUANTIZATION_SCALE = 127;
const VECTOR_ASSET_FILE = 'keywordEmbeddings.int8.bin';
const TERMS_ASSET_FILE = 'keywordTerms.generated.json';
const METADATA_ASSET_FILE = 'keywordEmbeddings.metadata.generated.json';
const SUPPLEMENTAL_TIEBREAKER_TERMS = ['teapot'];

type OpenAIEmbeddingResponse = {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
};

type PythonCommonWordsResponse = {
  terms: string[];
  stats: VocabularyFilterStats;
};

type VocabularyFilterStats = {
  requestedLimit: number;
  sourcePoolSize: number | null;
  wordfreqWordlist: string;
  fullWordlist: boolean;
  scanned: number;
  accepted: number;
  zipfFrequencyFloor: number;
  minLength: number;
  maxLength: number;
  alphabeticOnly: boolean;
  allowHyphen: boolean;
  lowercaseOnly: boolean;
  profanityAdultTermsExcluded: false;
  stopwordCount: number;
  rejected: Record<string, number>;
};

type GenerationOptions = {
  model: string;
  dimensions: number;
  vocabularyWordLimit: number;
  sourcePoolSize: number;
  zipfFrequencyFloor: number;
  wordfreqWordlist: string;
  minWordLength: number;
  maxWordLength: number;
  batchSize: number;
};

type EmbeddingItem = {
  key: string;
  text: string;
};

type EmbeddingMetadata = {
  provider: 'openai';
  model: string;
  vocabularySize: number;
  targetVocabularySize: number;
  generatedAt: string;
  source: {
    library: 'wordfreq';
    language: 'en';
    filterSettings: VocabularyFilterStats;
    forcedTargetTerms: number;
    forcedSupplementalTerms: number;
    guessEmbeddingInput: string;
    targetEmbeddingInput: string;
  };
  embedding: {
    dimensions: number;
    normalized: boolean;
    requestedDimensions: number;
    dimensionalityReduction: string;
    quantization: string;
    runtimeVectorFormat: string;
  };
  assets: {
    vectors: string;
    terms: string;
    metadata: string;
  };
  scoring: {
    rawCosine: string;
    transformation: string;
  };
};

function normalizeEmbeddingTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function cliValue(name: string): string | undefined {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === exact) return process.argv[index + 1];
    if (arg?.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function optionValue(envNames: string[], cliName: string): string | undefined {
  return (
    cliValue(cliName) ??
    envNames.map((name) => process.env[name]).find((value) => value !== undefined && value.trim() !== '')
  );
}

function positiveIntegerOption(envNames: string[], cliName: string, fallback: number): number {
  const raw = optionValue(envNames, cliName);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${cliName} must be a non-negative integer.`);
  return value;
}

function positiveNumberOption(envNames: string[], cliName: string, fallback: number): number {
  const raw = optionValue(envNames, cliName);
  if (raw === undefined) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${cliName} must be a non-negative number.`);
  return value;
}

function generationOptions(): GenerationOptions {
  return {
    model: optionValue(['OPENAI_EMBEDDING_MODEL', 'DECRYPTO_EMBEDDING_MODEL'], 'model') ?? DEFAULT_MODEL,
    dimensions: positiveIntegerOption(
      ['OPENAI_EMBEDDING_DIMENSIONS', 'DECRYPTO_EMBEDDING_DIMENSIONS'],
      'dimensions',
      DEFAULT_DIMENSIONS,
    ),
    vocabularyWordLimit: positiveIntegerOption(
      ['DECRYPTO_EMBEDDING_VOCAB_SIZE', 'EMBEDDING_VOCAB_WORD_LIMIT', 'COMMON_EMBEDDING_WORD_LIMIT'],
      'word-limit',
      DEFAULT_VOCABULARY_WORD_LIMIT,
    ),
    sourcePoolSize: positiveIntegerOption(['EMBEDDING_SOURCE_POOL_SIZE'], 'source-pool-size', DEFAULT_SOURCE_POOL_SIZE),
    zipfFrequencyFloor: positiveNumberOption(
      ['EMBEDDING_ZIPF_FREQUENCY_FLOOR'],
      'zipf-floor',
      DEFAULT_ZIPF_FREQUENCY_FLOOR,
    ),
    wordfreqWordlist: optionValue(['EMBEDDING_WORDFREQ_WORDLIST'], 'wordfreq-wordlist') ?? DEFAULT_WORDFREQ_WORDLIST,
    minWordLength: positiveIntegerOption(['EMBEDDING_MIN_WORD_LENGTH'], 'min-word-length', DEFAULT_MIN_WORD_LENGTH),
    maxWordLength: positiveIntegerOption(['EMBEDDING_MAX_WORD_LENGTH'], 'max-word-length', DEFAULT_MAX_WORD_LENGTH),
    batchSize: positiveIntegerOption(['DECRYPTO_EMBEDDING_BATCH_SIZE'], 'batch-size', DEFAULT_BATCH_SIZE),
  };
}

function pythonExecutable(): string {
  const configured = process.env.DECRYPTO_VOCABULARY_PYTHON || process.env.DECRYPTO_EMBEDDINGS_PYTHON;
  if (configured) return configured;
  const localVenv = resolve(dirname(fileURLToPath(import.meta.url)), '../.venv/bin/python3');
  return existsSync(localVenv) ? localVenv : 'python3';
}

async function requestPython<T>(payload: Record<string, unknown>): Promise<T> {
  const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'vocabulary-helper.py');
  const child = spawn(pythonExecutable(), [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TOKENIZERS_PARALLELISM: process.env.TOKENIZERS_PARALLELISM ?? 'false',
    },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  child.stdin.end(JSON.stringify(payload));

  const code = await new Promise<number | null>((resolveProcess, reject) => {
    child.on('error', reject);
    child.on('close', resolveProcess);
  });
  if (code !== 0) {
    throw new Error(`Embedding vocabulary helper failed (${code}): ${stderr.trim() || stdout.trim()}`);
  }
  return JSON.parse(stdout) as T;
}

async function commonEnglishTerms(options: GenerationOptions): Promise<PythonCommonWordsResponse> {
  if (options.vocabularyWordLimit <= 0) {
    return {
      terms: [],
      stats: {
        requestedLimit: 0,
        sourcePoolSize: options.sourcePoolSize > 0 ? options.sourcePoolSize : null,
        wordfreqWordlist: options.wordfreqWordlist,
        fullWordlist: options.sourcePoolSize <= 0,
        scanned: 0,
        accepted: 0,
        zipfFrequencyFloor: options.zipfFrequencyFloor,
        minLength: options.minWordLength,
        maxLength: options.maxWordLength,
        alphabeticOnly: true,
        allowHyphen: false,
        lowercaseOnly: true,
        profanityAdultTermsExcluded: false,
        stopwordCount: 0,
        rejected: {},
      },
    };
  }
  const response = await requestPython<PythonCommonWordsResponse>({
    action: 'commonWords',
    limit: options.vocabularyWordLimit,
    sourcePoolSize: options.sourcePoolSize,
    zipfFloor: options.zipfFrequencyFloor,
    wordlist: options.wordfreqWordlist,
    minLength: options.minWordLength,
    maxLength: options.maxWordLength,
  });
  return {
    terms: response.terms.map(normalizeEmbeddingTerm).filter(Boolean),
    stats: response.stats,
  };
}

function uniqueEmbeddingItems(
  commonTerms: readonly string[],
  vocabularyWordLimit: number,
): {
  targetTerms: string[];
  supplementalTerms: string[];
  guessTerms: string[];
  guessItems: EmbeddingItem[];
  targetItems: EmbeddingItem[];
  targetEmbeddingInputs: Record<string, string>;
} {
  const targetCards = KEYWORD_CARDS.map((card) => ({
    key: normalizeCardKey(card.displayWord),
    text: card.displayWord,
  })).filter(({ key }) => key);
  const targetTerms = [...new Set(targetCards.map(({ key }) => key))].sort();
  const targetItems = targetTerms.map((term) => {
    const card = targetCards.find((targetCard) => targetCard.key === term);
    if (!card) throw new Error(`Missing target card for ${term}.`);
    return { key: targetVectorKey(term), text: card.text };
  });
  const supplementalTerms = [
    ...new Set(SUPPLEMENTAL_TIEBREAKER_TERMS.map(normalizeEmbeddingTerm).filter(Boolean)),
  ].sort();
  const forcedGuessText = new Map(
    KEYWORD_CARDS.map((card) => [normalizeCardKey(card.displayWord), card.displayWord] as const).filter(([key]) => key),
  );
  for (const term of supplementalTerms) forcedGuessText.set(term, term);
  const guessTerms: string[] = [];
  const guessItems: EmbeddingItem[] = [];
  const targetEmbeddingInputs: Record<string, string> = {};

  for (const term of targetTerms) {
    const card = targetCards.find((targetCard) => targetCard.key === term);
    if (!card) throw new Error(`Missing target card for ${term}.`);
    targetEmbeddingInputs[term] = card.text;
  }
  const seenGuessTerms = new Set<string>();
  const addGuessTerm = (term: string, text = term) => {
    if (!term || seenGuessTerms.has(term) || guessTerms.length >= vocabularyWordLimit) return;
    seenGuessTerms.add(term);
    guessTerms.push(term);
    guessItems.push({ key: term, text });
  };
  for (const [term, text] of [...forcedGuessText.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    addGuessTerm(term, text);
  }
  for (const term of commonTerms) addGuessTerm(term);
  return { targetTerms, supplementalTerms, guessTerms, guessItems, targetItems, targetEmbeddingInputs };
}

async function createEmbeddings(
  items: readonly EmbeddingItem[],
  model: string,
  dimensions: number,
  batchSize: number,
): Promise<Map<string, readonly number[]>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY must be set to generate Decrypto OpenAI embeddings.');
  }
  const vectors = new Map<string, readonly number[]>();
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: batch.map((item) => item.text),
        dimensions,
        encoding_format: 'float',
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embeddings request failed (${response.status}): ${errorText.slice(0, 500)}`);
    }
    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    for (const [batchIndex, item] of batch.entries()) {
      const embedding = payload.data.find((entry) => entry.index === batchIndex)?.embedding;
      if (!embedding) throw new Error(`OpenAI embeddings response did not include ${item.key}.`);
      if (embedding.length !== dimensions) {
        throw new Error(`OpenAI returned ${embedding.length} dimensions for ${item.key}; expected ${dimensions}.`);
      }
      vectors.set(item.key, quantizeVector(normalizeVector(embedding)));
    }
    console.info(`Generated embeddings for ${Math.min(index + batchSize, items.length)} / ${items.length} terms.`);
  }
  return vectors;
}

function cosineVector(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    dot += aValue * bValue;
    aMagnitude += aValue * aValue;
    bMagnitude += bValue * bValue;
  }
  if (aMagnitude === 0 || bMagnitude === 0) return 0;
  return dot / Math.sqrt(aMagnitude * bMagnitude);
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const index = Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * percentile)));
  return values[index] ?? 0;
}

function calibrationFor(targetTerms: readonly string[], embeddings: ReadonlyMap<string, readonly number[]>) {
  const scores: number[] = [];
  for (let left = 0; left < targetTerms.length; left += 1) {
    for (let right = left + 1; right < targetTerms.length; right += 1) {
      scores.push(
        cosineVector(
          embeddings.get(targetVectorKey(targetTerms[left]!)) ?? [],
          embeddings.get(targetVectorKey(targetTerms[right]!)) ?? [],
        ),
      );
    }
  }
  scores.sort((a, b) => a - b);
  const floor = quantile(scores, 0.2);
  const ceiling = Math.max(floor + 0.08, quantile(scores, 0.985));
  return {
    floor: roundNumber(floor),
    ceiling: roundNumber(Math.min(1, ceiling)),
  };
}

function targetVectorKey(term: string): string {
  return `target:${term}`;
}

function normalizeVector(vector: readonly number[]): number[] {
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  if (magnitude === 0) return [...vector];
  const scale = 1 / Math.sqrt(magnitude);
  return vector.map((value) => value * scale);
}

function quantizeVector(vector: readonly number[]): number[] {
  return vector.map((value) => Math.max(-127, Math.min(127, Math.round(value * QUANTIZATION_SCALE))));
}

function roundNumber(value: number): number {
  return Number(value.toFixed(6));
}

function encodedVectorBytes(
  guessTerms: readonly string[],
  targetTerms: readonly string[],
  embeddings: ReadonlyMap<string, readonly number[]>,
): Buffer {
  const firstKey = guessTerms[0] ?? targetVectorKey(targetTerms[0] ?? '');
  const dimensions = firstKey ? (embeddings.get(firstKey)?.length ?? 0) : 0;
  const vectorKeys = [...guessTerms, ...targetTerms.map(targetVectorKey)];
  const bytes = Buffer.alloc(vectorKeys.length * dimensions);
  vectorKeys.forEach((key, termIndex) => {
    const embedding = embeddings.get(key);
    if (!embedding) throw new Error(`Missing generated embedding for ${key}.`);
    embedding.forEach((value, dimensionIndex) => {
      bytes.writeInt8(value, termIndex * dimensions + dimensionIndex);
    });
  });
  return bytes;
}

function generatedSource(metadata: EmbeddingMetadata, calibration: { floor: number; ceiling: number }): string {
  return `// Generated by \`pnpm --filter @games/decrypto-server generate:embeddings\`.
// Do not edit by hand.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type StoredTermsPayload = {
  terms: string[];
  targetTerms: string[];
  targetEmbeddingInputs?: Record<string, string>;
};

type StoredEmbeddingAssetStatus = {
  terms: number;
  targetTerms: number;
  dimensions: number;
  vectorBytes: number;
  expectedVectorBytes: number;
};

export const STORED_EMBEDDING_PROVIDER = 'openai';
export const STORED_EMBEDDING_MODEL = ${JSON.stringify(metadata.model)};
export const STORED_EMBEDDING_DIMENSIONS = ${metadata.embedding.dimensions};
export const STORED_EMBEDDING_NORMALIZED = true;
export const STORED_EMBEDDING_QUANTIZATION = ${JSON.stringify(metadata.embedding.quantization)};
export const STORED_EMBEDDINGS_GENERATED_AT = ${JSON.stringify(metadata.generatedAt)};
export const STORED_EMBEDDING_METADATA = ${JSON.stringify(metadata, null, 2)} as const;
export const STORED_EMBEDDING_ASSET_FILES = ${JSON.stringify(metadata.assets, null, 2)} as const;
export const STORED_EMBEDDING_SCORE_FLOOR = ${calibration.floor};
export const STORED_EMBEDDING_SCORE_CEILING = ${calibration.ceiling};

let termsPayloadCache: StoredTermsPayload | undefined;
let termIndexCache: Map<string, number> | undefined;
let targetIndexCache: Map<string, number> | undefined;
let vectorBytesCache: Int8Array | undefined;
let vectorNormCache: Float32Array | undefined;

function assetPath(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, filename),
    resolve(currentDir, '../src', filename),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(\`Missing generated Decrypto embedding asset: \${filename}\`);
  return found;
}

function loadTermsPayload(): StoredTermsPayload {
  termsPayloadCache ??= JSON.parse(readFileSync(assetPath(STORED_EMBEDDING_ASSET_FILES.terms), 'utf8')) as StoredTermsPayload;
  if (!Array.isArray(termsPayloadCache.terms) || !Array.isArray(termsPayloadCache.targetTerms)) {
    throw new Error('Generated Decrypto embedding terms asset has an invalid shape.');
  }
  return termsPayloadCache;
}

function termIndexMap(): Map<string, number> {
  termIndexCache ??= new Map(loadTermsPayload().terms.map((term, index) => [term, index]));
  return termIndexCache;
}

function targetIndexMap(): Map<string, number> {
  targetIndexCache ??= new Map(loadTermsPayload().targetTerms.map((term, index) => [term, index]));
  return targetIndexCache;
}

function totalVectorCount(): number {
  const termsPayload = loadTermsPayload();
  return termsPayload.terms.length + termsPayload.targetTerms.length;
}

function targetVectorIndex(targetIndex: number): number {
  return getStoredEmbeddingTerms().length + targetIndex;
}

function vectorBytes(): Int8Array {
  if (vectorBytesCache) return vectorBytesCache;
  const buffer = readFileSync(assetPath(STORED_EMBEDDING_ASSET_FILES.vectors));
  const expectedLength = totalVectorCount() * STORED_EMBEDDING_DIMENSIONS;
  if (buffer.byteLength !== expectedLength) {
    throw new Error(
      \`Generated Decrypto embedding vector asset has \${buffer.byteLength} bytes; expected \${expectedLength}.\`,
    );
  }
  vectorBytesCache = new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return vectorBytesCache;
}

function vectorNorms(): Float32Array {
  if (vectorNormCache) return vectorNormCache;
  const bytes = vectorBytes();
  const norms = new Float32Array(totalVectorCount());
  for (let vectorIndex = 0; vectorIndex < norms.length; vectorIndex += 1) {
    const offset = vectorIndex * STORED_EMBEDDING_DIMENSIONS;
    let magnitude = 0;
    for (let dimension = 0; dimension < STORED_EMBEDDING_DIMENSIONS; dimension += 1) {
      const value = bytes[offset + dimension] ?? 0;
      magnitude += value * value;
    }
    norms[vectorIndex] = Math.sqrt(magnitude);
  }
  vectorNormCache = norms;
  return norms;
}

function assertVectorIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= totalVectorCount()) {
    throw new Error(\`Stored Decrypto embedding index out of range: \${index}\`);
  }
}

export function getStoredEmbeddingTerms(): readonly string[] {
  return loadTermsPayload().terms;
}

export function getStoredTargetEmbeddingTerms(): readonly string[] {
  return loadTermsPayload().targetTerms;
}

export function getStoredTargetEmbeddingInputs(): Readonly<Record<string, string>> {
  return loadTermsPayload().targetEmbeddingInputs ?? {};
}

export function getStoredEmbeddingIndex(term: string): number | undefined {
  return termIndexMap().get(term);
}

export function getStoredTargetEmbeddingIndex(term: string): number | undefined {
  return targetIndexMap().get(term);
}

export function hasStoredEmbeddingTerm(term: string): boolean {
  return getStoredEmbeddingIndex(term) !== undefined;
}

export function assertStoredEmbeddingAssetsAvailable(): StoredEmbeddingAssetStatus {
  const termsPayload = loadTermsPayload();
  const metadataPath = assetPath(STORED_EMBEDDING_ASSET_FILES.metadata);
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as {
    vocabularySize?: number;
    targetVocabularySize?: number;
    embedding?: { dimensions?: number };
  };

  if (termsPayload.terms.length !== STORED_EMBEDDING_METADATA.vocabularySize) {
    throw new Error(
      \`Generated Decrypto embedding terms asset has \${termsPayload.terms.length} terms; expected \${STORED_EMBEDDING_METADATA.vocabularySize}.\`,
    );
  }
  if (termsPayload.targetTerms.length !== STORED_EMBEDDING_METADATA.targetVocabularySize) {
    throw new Error(
      \`Generated Decrypto target terms asset has \${termsPayload.targetTerms.length} terms; expected \${STORED_EMBEDDING_METADATA.targetVocabularySize}.\`,
    );
  }
  if (
    metadata.vocabularySize !== STORED_EMBEDDING_METADATA.vocabularySize ||
    metadata.targetVocabularySize !== STORED_EMBEDDING_METADATA.targetVocabularySize ||
    metadata.embedding?.dimensions !== STORED_EMBEDDING_DIMENSIONS
  ) {
    throw new Error('Generated Decrypto embedding metadata asset does not match the compiled loader metadata.');
  }

  const vectorPath = assetPath(STORED_EMBEDDING_ASSET_FILES.vectors);
  const vectorBytes = statSync(vectorPath).size;
  const expectedVectorBytes = totalVectorCount() * STORED_EMBEDDING_DIMENSIONS;
  if (vectorBytes !== expectedVectorBytes) {
    throw new Error(
      \`Generated Decrypto embedding vector asset has \${vectorBytes} bytes; expected \${expectedVectorBytes}.\`,
    );
  }

  return {
    terms: termsPayload.terms.length,
    targetTerms: termsPayload.targetTerms.length,
    dimensions: STORED_EMBEDDING_DIMENSIONS,
    vectorBytes,
    expectedVectorBytes,
  };
}

export function storedEmbeddingInt8Norm(index: number): number {
  assertVectorIndex(index);
  return vectorNorms()[index] ?? 0;
}

export function storedEmbeddingCosineByIndex(leftIndex: number, rightIndex: number): number {
  assertVectorIndex(leftIndex);
  assertVectorIndex(rightIndex);
  const leftNorm = storedEmbeddingInt8Norm(leftIndex);
  const rightNorm = storedEmbeddingInt8Norm(rightIndex);
  if (leftNorm === 0 || rightNorm === 0) return 0;

  const bytes = vectorBytes();
  const leftOffset = leftIndex * STORED_EMBEDDING_DIMENSIONS;
  const rightOffset = rightIndex * STORED_EMBEDDING_DIMENSIONS;
  let dot = 0;
  for (let dimension = 0; dimension < STORED_EMBEDDING_DIMENSIONS; dimension += 1) {
    dot += (bytes[leftOffset + dimension] ?? 0) * (bytes[rightOffset + dimension] ?? 0);
  }
  return dot / (leftNorm * rightNorm);
}

export function storedTargetEmbeddingCosineByIndex(guessIndex: number, targetIndex: number): number {
  return storedEmbeddingCosineByIndex(guessIndex, targetVectorIndex(targetIndex));
}

export function storedEmbeddingCosineByTerm(leftTerm: string, rightTerm: string): number | undefined {
  const leftIndex = getStoredEmbeddingIndex(leftTerm);
  const rightIndex = getStoredEmbeddingIndex(rightTerm);
  return leftIndex === undefined || rightIndex === undefined
    ? undefined
    : storedEmbeddingCosineByIndex(leftIndex, rightIndex);
}

export function storedTargetEmbeddingCosineByTerm(guessTerm: string, targetTerm: string): number | undefined {
  const guessIndex = getStoredEmbeddingIndex(guessTerm);
  const targetIndex = getStoredTargetEmbeddingIndex(targetTerm);
  return guessIndex === undefined || targetIndex === undefined
    ? undefined
    : storedTargetEmbeddingCosineByIndex(guessIndex, targetIndex);
}

function dequantizedNormalizedVector(index: number): Float32Array {
  assertVectorIndex(index);
  const bytes = vectorBytes();
  const offset = index * STORED_EMBEDDING_DIMENSIONS;
  const vector = new Float32Array(STORED_EMBEDDING_DIMENSIONS);
  let magnitude = 0;
  for (let dimension = 0; dimension < STORED_EMBEDDING_DIMENSIONS; dimension += 1) {
    const value = (bytes[offset + dimension] ?? 0) / ${QUANTIZATION_SCALE};
    vector[dimension] = value;
    magnitude += value * value;
  }
  if (magnitude === 0) return vector;
  const scale = 1 / Math.sqrt(magnitude);
  for (let dimension = 0; dimension < vector.length; dimension += 1) vector[dimension] *= scale;
  return vector;
}

export function referenceDequantizedCosineByIndex(leftIndex: number, rightIndex: number): number {
  const left = dequantizedNormalizedVector(leftIndex);
  const right = dequantizedNormalizedVector(rightIndex);
  let dot = 0;
  for (let dimension = 0; dimension < STORED_EMBEDDING_DIMENSIONS; dimension += 1) {
    dot += (left[dimension] ?? 0) * (right[dimension] ?? 0);
  }
  return dot;
}

export function referenceDequantizedTargetCosineByIndex(guessIndex: number, targetIndex: number): number {
  return referenceDequantizedCosineByIndex(guessIndex, targetVectorIndex(targetIndex));
}
`;
}

async function main() {
  const options = generationOptions();
  const commonWordResult = await commonEnglishTerms(options);
  const commonTerms = commonWordResult.terms;
  const { targetTerms, supplementalTerms, guessTerms, guessItems, targetItems, targetEmbeddingInputs } =
    uniqueEmbeddingItems(commonTerms, options.vocabularyWordLimit);
  console.info(
    `Preparing ${guessTerms.length} guess terms and ${targetTerms.length} Decrypto target vectors (${supplementalTerms.length} supplemental terms, ${commonTerms.length} filtered common words).`,
  );

  const guessEmbeddings = await createEmbeddings(guessItems, options.model, options.dimensions, options.batchSize);
  const targetEmbeddings = await createEmbeddings(targetItems, options.model, options.dimensions, options.batchSize);
  const embeddings = new Map([...guessEmbeddings, ...targetEmbeddings]);
  const firstVector = embeddings.values().next().value as readonly number[] | undefined;
  const dimensionsFromResponse = firstVector?.length ?? 0;
  if (dimensionsFromResponse === 0) throw new Error('Generated embeddings were empty.');

  const metadata: EmbeddingMetadata = {
    provider: 'openai',
    model: options.model,
    vocabularySize: guessTerms.length,
    targetVocabularySize: targetTerms.length,
    generatedAt: new Date().toISOString(),
    source: {
      library: 'wordfreq',
      language: 'en',
      filterSettings: commonWordResult.stats,
      forcedTargetTerms: targetTerms.length,
      forcedSupplementalTerms: supplementalTerms.length,
      guessEmbeddingInput:
        'Guess terms are embedded directly from the submitted/display word text after normalized vocabulary lookup.',
      targetEmbeddingInput:
        'Decrypto target terms are embedded directly from the card displayWord; exact target input strings are in keywordTerms.generated.json targetEmbeddingInputs.',
    },
    embedding: {
      dimensions: dimensionsFromResponse,
      normalized: true,
      requestedDimensions: options.dimensions,
      dimensionalityReduction:
        'OpenAI embeddings API dimensions parameter; vectors are normalized locally before int8 quantization',
      quantization: `int8/${QUANTIZATION_SCALE}`,
      runtimeVectorFormat:
        'keywordEmbeddings.int8.bin loaded lazily as an Int8Array; guess vectors are stored first, target vectors second; cosine uses int8 dot product divided by precomputed int8 norms, with no full Float32 matrix materialized',
    },
    assets: {
      vectors: VECTOR_ASSET_FILE,
      terms: TERMS_ASSET_FILE,
      metadata: METADATA_ASSET_FILE,
    },
    scoring: {
      rawCosine: 'cosine approximation over normalized OpenAI embeddings after int8 quantization',
      transformation:
        'runtime tiebreaker scoring maps raw cosine with a conservative fixed piecewise curve, applies guarded hard rank floors for strong high-rank matches, softly boosts broad medium associations toward a target score, and caps/penalizes weak or nonspecific matches by target rank',
    },
  };

  const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/keywordEmbeddings.generated.ts');
  const vectorPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${VECTOR_ASSET_FILE}`);
  const termsPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${TERMS_ASSET_FILE}`);
  const metadataPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${METADATA_ASSET_FILE}`);
  await mkdir(dirname(outputPath), { recursive: true });
  const calibration = calibrationFor(targetTerms, embeddings);
  await writeFile(outputPath, generatedSource(metadata, calibration));
  await writeFile(vectorPath, encodedVectorBytes(guessTerms, targetTerms, embeddings));
  await writeFile(termsPath, `${JSON.stringify({ terms: guessTerms, targetTerms, targetEmbeddingInputs }, null, 2)}\n`);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.info(
    `Wrote ${guessTerms.length} stored guess embeddings and ${targetTerms.length} target embeddings to ${outputPath}.`,
  );
  console.info(`Wrote int8 embedding matrix to ${vectorPath}.`);
  console.info(`Wrote embedding terms to ${termsPath}.`);
  console.info(`Wrote embedding metadata to ${metadataPath}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
