import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getEmbeddingInput, KEYWORD_CARDS, normalizeCardKey } from '../src/wordbank.js';

const DEFAULT_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const DEFAULT_TRUNCATE_DIM = 0;
const DEFAULT_VOCABULARY_WORD_LIMIT = 150_000;
const DEFAULT_SOURCE_POOL_SIZE = 0;
const DEFAULT_ZIPF_FREQUENCY_FLOOR = 1.5;
const DEFAULT_WORDFREQ_WORDLIST = 'best';
const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_MAX_WORD_LENGTH = 18;
const BATCH_SIZE = 2_048;
const QUANTIZATION_SCALE = 127;
const VECTOR_ASSET_FILE = 'keywordEmbeddings.int8.bin';
const TERMS_ASSET_FILE = 'keywordTerms.generated.json';
const METADATA_ASSET_FILE = 'keywordEmbeddings.metadata.generated.json';
const SUPPLEMENTAL_TIEBREAKER_TERMS = [
  'teapot',
];

type PythonEmbeddingResponse = {
  model: string;
  dimensions: number;
  embeddings: Record<string, number[]>;
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
  truncateDim: number;
  vocabularyWordLimit: number;
  sourcePoolSize: number;
  zipfFrequencyFloor: number;
  wordfreqWordlist: string;
  minWordLength: number;
  maxWordLength: number;
};

type EmbeddingItem = {
  key: string;
  text: string;
};

type EmbeddingMetadata = {
  provider: 'sentence-transformers';
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
    targetEmbeddingInput: string;
  };
  embedding: {
    dimensions: number;
    normalized: boolean;
    truncateDimension: number | null;
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
  return cliValue(cliName) ?? envNames.map((name) => process.env[name]).find((value) => value !== undefined && value.trim() !== '');
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
    model: optionValue(['SENTENCE_TRANSFORMER_MODEL'], 'model') ?? DEFAULT_MODEL,
    truncateDim: positiveIntegerOption(
      ['SENTENCE_TRANSFORMER_TRUNCATE_DIM'],
      'truncate-dim',
      DEFAULT_TRUNCATE_DIM,
    ),
    vocabularyWordLimit: positiveIntegerOption(
      ['DECRYPTO_EMBEDDING_VOCAB_SIZE', 'EMBEDDING_VOCAB_WORD_LIMIT', 'COMMON_EMBEDDING_WORD_LIMIT'],
      'word-limit',
      DEFAULT_VOCABULARY_WORD_LIMIT,
    ),
    sourcePoolSize: positiveIntegerOption(
      ['EMBEDDING_SOURCE_POOL_SIZE'],
      'source-pool-size',
      DEFAULT_SOURCE_POOL_SIZE,
    ),
    zipfFrequencyFloor: positiveNumberOption(
      ['EMBEDDING_ZIPF_FREQUENCY_FLOOR'],
      'zipf-floor',
      DEFAULT_ZIPF_FREQUENCY_FLOOR,
    ),
    wordfreqWordlist: optionValue(['EMBEDDING_WORDFREQ_WORDLIST'], 'wordfreq-wordlist') ?? DEFAULT_WORDFREQ_WORDLIST,
    minWordLength: positiveIntegerOption(['EMBEDDING_MIN_WORD_LENGTH'], 'min-word-length', DEFAULT_MIN_WORD_LENGTH),
    maxWordLength: positiveIntegerOption(['EMBEDDING_MAX_WORD_LENGTH'], 'max-word-length', DEFAULT_MAX_WORD_LENGTH),
  };
}

function pythonExecutable(): string {
  const configured = process.env.SENTENCE_TRANSFORMERS_PYTHON || process.env.DECRYPTO_EMBEDDINGS_PYTHON;
  if (configured) return configured;
  const localVenv = resolve(dirname(fileURLToPath(import.meta.url)), '../.venv/bin/python3');
  return existsSync(localVenv) ? localVenv : 'python3';
}

async function requestPython<T>(payload: Record<string, unknown>): Promise<T> {
  const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'embed-sentence-transformer.py');
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
    throw new Error(`Sentence Transformers helper failed (${code}): ${stderr.trim() || stdout.trim()}`);
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

function uniqueEmbeddingItems(commonTerms: readonly string[]): {
  targetTerms: string[];
  supplementalTerms: string[];
  allTerms: string[];
  embeddingItems: EmbeddingItem[];
  targetEmbeddingInputs: Record<string, string>;
} {
  const targetItems = KEYWORD_CARDS.map((card) => ({
    key: normalizeCardKey(card.displayWord),
    text: getEmbeddingInput(card),
  }))
    .filter(({ key }) => key)
    .sort((left, right) => left.key.localeCompare(right.key));
  const targetTerms = [...new Set(targetItems.map(({ key }) => key))];
  const supplementalTerms = [...new Set(SUPPLEMENTAL_TIEBREAKER_TERMS.map(normalizeEmbeddingTerm).filter(Boolean))].sort();
  const allTerms: string[] = [];
  const embeddingItems: EmbeddingItem[] = [];
  const targetEmbeddingInputs: Record<string, string> = {};
  const seen = new Set<string>();
  for (const item of targetItems) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    allTerms.push(item.key);
    embeddingItems.push(item);
    targetEmbeddingInputs[item.key] = item.text;
  }
  for (const term of [...supplementalTerms, ...commonTerms]) {
    if (!term || seen.has(term)) continue;
    seen.add(term);
    allTerms.push(term);
    embeddingItems.push({ key: term, text: term });
  }
  return { targetTerms, supplementalTerms, allTerms, embeddingItems, targetEmbeddingInputs };
}

async function createEmbeddings(
  items: readonly EmbeddingItem[],
  model: string,
  truncateDim: number,
): Promise<Map<string, readonly number[]>> {
  const vectors = new Map<string, readonly number[]>();
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    const response = await requestPython<PythonEmbeddingResponse>({
      action: 'embed',
      model,
      items: batch,
      ...(truncateDim > 0 ? { truncateDim } : {}),
    });
    for (const item of batch) {
      const embedding = response.embeddings[item.key];
      if (!embedding) throw new Error(`Sentence Transformers response did not include ${item.key}.`);
      vectors.set(item.key, quantizeVector(embedding));
    }
    console.info(`Generated embeddings for ${Math.min(index + BATCH_SIZE, items.length)} / ${items.length} terms.`);
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
      scores.push(cosineVector(embeddings.get(targetTerms[left]!) ?? [], embeddings.get(targetTerms[right]!) ?? []));
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

function quantizeVector(vector: readonly number[]): number[] {
  return vector.map((value) => Math.max(-127, Math.min(127, Math.round(value * QUANTIZATION_SCALE))));
}

function roundNumber(value: number): number {
  return Number(value.toFixed(6));
}

function encodedVectorBytes(terms: readonly string[], embeddings: ReadonlyMap<string, readonly number[]>): Buffer {
  const firstTerm = terms[0];
  const dimensions = firstTerm ? embeddings.get(firstTerm)?.length ?? 0 : 0;
  const bytes = Buffer.alloc(terms.length * dimensions);
  terms.forEach((term, termIndex) => {
    const embedding = embeddings.get(term);
    if (!embedding) throw new Error(`Missing generated embedding for ${term}.`);
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

export const STORED_EMBEDDING_PROVIDER = 'sentence-transformers';
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

function vectorBytes(): Int8Array {
  if (vectorBytesCache) return vectorBytesCache;
  const buffer = readFileSync(assetPath(STORED_EMBEDDING_ASSET_FILES.vectors));
  const expectedLength = getStoredEmbeddingTerms().length * STORED_EMBEDDING_DIMENSIONS;
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
  const terms = getStoredEmbeddingTerms();
  const norms = new Float32Array(terms.length);
  for (let termIndex = 0; termIndex < terms.length; termIndex += 1) {
    const offset = termIndex * STORED_EMBEDDING_DIMENSIONS;
    let magnitude = 0;
    for (let dimension = 0; dimension < STORED_EMBEDDING_DIMENSIONS; dimension += 1) {
      const value = bytes[offset + dimension] ?? 0;
      magnitude += value * value;
    }
    norms[termIndex] = Math.sqrt(magnitude);
  }
  vectorNormCache = norms;
  return norms;
}

function assertVectorIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= getStoredEmbeddingTerms().length) {
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
  const expectedVectorBytes = termsPayload.terms.length * STORED_EMBEDDING_DIMENSIONS;
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

export function storedEmbeddingCosineByTerm(leftTerm: string, rightTerm: string): number | undefined {
  const leftIndex = getStoredEmbeddingIndex(leftTerm);
  const rightIndex = getStoredEmbeddingIndex(rightTerm);
  return leftIndex === undefined || rightIndex === undefined
    ? undefined
    : storedEmbeddingCosineByIndex(leftIndex, rightIndex);
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
`;
}

async function main() {
  const options = generationOptions();
  const commonWordResult = await commonEnglishTerms(options);
  const commonTerms = commonWordResult.terms;
  const { targetTerms, supplementalTerms, allTerms, embeddingItems, targetEmbeddingInputs } = uniqueEmbeddingItems(commonTerms);
  console.info(
    `Preparing ${allTerms.length} terms (${targetTerms.length} Decrypto targets, ${supplementalTerms.length} supplemental terms, ${commonTerms.length} filtered common words).`,
  );

  const embeddings = await createEmbeddings(embeddingItems, options.model, options.truncateDim);
  const firstVector = embeddings.values().next().value as readonly number[] | undefined;
  const dimensionsFromResponse = firstVector?.length ?? 0;
  if (dimensionsFromResponse === 0) throw new Error('Generated embeddings were empty.');

  const metadata: EmbeddingMetadata = {
    provider: 'sentence-transformers',
    model: options.model,
    vocabularySize: allTerms.length,
    targetVocabularySize: targetTerms.length,
    generatedAt: new Date().toISOString(),
    source: {
      library: 'wordfreq',
      language: 'en',
      filterSettings: commonWordResult.stats,
      forcedTargetTerms: targetTerms.length,
      forcedSupplementalTerms: supplementalTerms.length,
      targetEmbeddingInput:
        'Decrypto target terms are stored by normalized display word, but embedded from getEmbeddingInput(card); exact target input strings are in keywordTerms.generated.json targetEmbeddingInputs.',
    },
    embedding: {
      dimensions: dimensionsFromResponse,
      normalized: true,
      truncateDimension: options.truncateDim > 0 ? options.truncateDim : null,
      dimensionalityReduction:
        options.truncateDim > 0
          ? 'SentenceTransformer.encode truncate_dim option'
          : 'none; full model output dimensions are stored',
      quantization: `int8/${QUANTIZATION_SCALE}`,
      runtimeVectorFormat:
        'keywordEmbeddings.int8.bin loaded lazily as an Int8Array; cosine uses int8 dot product divided by precomputed int8 norms, with no full Float32 matrix materialized',
    },
    assets: {
      vectors: VECTOR_ASSET_FILE,
      terms: TERMS_ASSET_FILE,
      metadata: METADATA_ASSET_FILE,
    },
    scoring: {
      rawCosine: 'cosine approximation over normalized Sentence Transformers embeddings after int8 quantization',
      transformation:
        'raw cosine is linearly calibrated from stored target-word distribution floor/ceiling, clamped to 0..1, multiplied by a target-neighbor rank weight, then capped below 1 for non-exact embedding matches; non-neighbor unrelated words can intentionally score 0',
    },
  };

  const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/keywordEmbeddings.generated.ts');
  const vectorPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${VECTOR_ASSET_FILE}`);
  const termsPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${TERMS_ASSET_FILE}`);
  const metadataPath = resolve(dirname(fileURLToPath(import.meta.url)), `../src/${METADATA_ASSET_FILE}`);
  await mkdir(dirname(outputPath), { recursive: true });
  const calibration = calibrationFor(targetTerms, embeddings);
  await writeFile(outputPath, generatedSource(metadata, calibration));
  await writeFile(vectorPath, encodedVectorBytes(allTerms, embeddings));
  await writeFile(termsPath, `${JSON.stringify({ terms: allTerms, targetTerms, targetEmbeddingInputs }, null, 2)}\n`);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.info(`Wrote ${allTerms.length} stored embedding loader to ${outputPath}.`);
  console.info(`Wrote int8 embedding matrix to ${vectorPath}.`);
  console.info(`Wrote embedding terms to ${termsPath}.`);
  console.info(`Wrote embedding metadata to ${metadataPath}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
