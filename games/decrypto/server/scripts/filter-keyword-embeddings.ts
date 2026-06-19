import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VECTOR_ASSET_FILE = 'keywordEmbeddings.int8.bin';
const TERMS_ASSET_FILE = 'keywordTerms.generated.json';
const METADATA_ASSET_FILE = 'keywordEmbeddings.metadata.generated.json';
const GENERATED_SOURCE_FILE = 'keywordEmbeddings.generated.ts';
const DIMENSIONS = 384;

type StoredTermsPayload = {
  terms: string[];
  targetTerms: string[];
  targetEmbeddingInputs?: Record<string, string>;
};

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

function normalizeTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function reviewedTermsFromCsv(csv: string): Set<string> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? '');
  const termIndex = header.indexOf('term');
  if (termIndex === -1) throw new Error('Reviewed vocabulary CSV must include a term column.');

  const terms = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const term = normalizeTerm(cells[termIndex] ?? '');
    if (term) terms.add(term);
  }
  return terms;
}

function replaceExportedConst(source: string, name: string, value: string): string {
  const pattern = new RegExp(`export const ${name} = [^;]+;`);
  if (!pattern.test(source)) throw new Error(`Could not find generated const ${name}.`);
  return source.replace(pattern, `export const ${name} = ${value};`);
}

function replaceMetadataConst(source: string, metadata: unknown): string {
  const pattern = /export const STORED_EMBEDDING_METADATA = [\s\S]*? as const;\nexport const STORED_EMBEDDING_ASSET_FILES =/;
  if (!pattern.test(source)) throw new Error('Could not find generated metadata const.');
  return source.replace(
    pattern,
    `export const STORED_EMBEDDING_METADATA = ${JSON.stringify(metadata, null, 2)} as const;\nexport const STORED_EMBEDDING_ASSET_FILES =`,
  );
}

async function main() {
  const keptCsvPath = cliValue('kept-csv') ?? process.env.DECRYPTO_REVIEWED_VOCAB_CSV;
  if (!keptCsvPath) {
    throw new Error('Provide --kept-csv /path/to/vocab_kept.csv or DECRYPTO_REVIEWED_VOCAB_CSV.');
  }

  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
  const termsPath = resolve(srcDir, TERMS_ASSET_FILE);
  const vectorPath = resolve(srcDir, VECTOR_ASSET_FILE);
  const metadataPath = resolve(srcDir, METADATA_ASSET_FILE);
  const generatedPath = resolve(srcDir, GENERATED_SOURCE_FILE);

  const [csv, termsJson, oldVectors, metadataJson, generatedSource] = await Promise.all([
    readFile(keptCsvPath, 'utf8'),
    readFile(termsPath, 'utf8'),
    readFile(vectorPath),
    readFile(metadataPath, 'utf8'),
    readFile(generatedPath, 'utf8'),
  ]);

  const reviewedTerms = reviewedTermsFromCsv(csv);
  const payload = JSON.parse(termsJson) as StoredTermsPayload;
  const metadata = JSON.parse(metadataJson) as Record<string, unknown> & {
    source?: Record<string, unknown>;
    scoring?: Record<string, unknown>;
  };
  if (!Array.isArray(payload.terms) || !Array.isArray(payload.targetTerms)) {
    throw new Error('Generated terms payload has an invalid shape.');
  }

  const targetSet = new Set(payload.targetTerms);
  const oldTermIndex = new Map(payload.terms.map((term, index) => [term, index]));
  const newTerms = payload.terms.filter((term) => reviewedTerms.has(term) || targetSet.has(term));
  const missingReviewed = [...reviewedTerms].filter((term) => !oldTermIndex.has(term));
  if (newTerms.length === 0) throw new Error('Reviewed vocabulary filter removed every guess term.');
  if (missingReviewed.length > 0) {
    console.warn(`Ignored ${missingReviewed.length} reviewed terms that were not present in the current embedding asset.`);
  }

  const oldExpectedBytes = (payload.terms.length + payload.targetTerms.length) * DIMENSIONS;
  if (oldVectors.byteLength !== oldExpectedBytes) {
    throw new Error(`Current vector asset has ${oldVectors.byteLength} bytes; expected ${oldExpectedBytes}.`);
  }

  const newVectors = Buffer.alloc((newTerms.length + payload.targetTerms.length) * DIMENSIONS);
  newTerms.forEach((term, newIndex) => {
    const oldIndex = oldTermIndex.get(term);
    if (oldIndex === undefined) throw new Error(`Missing old vector for kept term ${term}.`);
    oldVectors.copy(newVectors, newIndex * DIMENSIONS, oldIndex * DIMENSIONS, (oldIndex + 1) * DIMENSIONS);
  });
  payload.targetTerms.forEach((term, targetIndex) => {
    const oldIndex = payload.terms.length + targetIndex;
    const newIndex = newTerms.length + targetIndex;
    oldVectors.copy(newVectors, newIndex * DIMENSIONS, oldIndex * DIMENSIONS, (oldIndex + 1) * DIMENSIONS);
    if (!targetSet.has(term)) throw new Error(`Unexpected missing target term ${term}.`);
  });

  const generatedAt = new Date().toISOString();
  const existingReviewedVocabulary =
    metadata.source &&
    typeof metadata.source.reviewedVocabulary === 'object' &&
    metadata.source.reviewedVocabulary !== null
      ? (metadata.source.reviewedVocabulary as { originalTerms?: unknown })
      : undefined;
  const originalTerms =
    typeof existingReviewedVocabulary?.originalTerms === 'number'
      ? existingReviewedVocabulary.originalTerms
      : payload.terms.length;
  metadata.vocabularySize = newTerms.length;
  metadata.generatedAt = generatedAt;
  metadata.source = {
    ...(metadata.source ?? {}),
    reviewedVocabulary: {
      sourceFile: basename(keptCsvPath),
      keptTerms: newTerms.length,
      originalTerms,
      missingReviewedTerms: missingReviewed.length,
    },
  };
  metadata.scoring = {
    ...(metadata.scoring ?? {}),
    transformation:
      'runtime tiebreaker scoring maps raw cosine with a conservative fixed piecewise curve, applies guarded hard rank floors for strong high-rank matches, softly boosts broad medium associations toward a target score, and caps/penalizes weak or nonspecific matches by target rank',
  };

  let nextGeneratedSource = replaceExportedConst(
    generatedSource,
    'STORED_EMBEDDINGS_GENERATED_AT',
    JSON.stringify(generatedAt),
  );
  nextGeneratedSource = replaceMetadataConst(nextGeneratedSource, metadata);
  nextGeneratedSource = replaceExportedConst(nextGeneratedSource, 'STORED_EMBEDDING_SCORE_FLOOR', '0.3');
  nextGeneratedSource = replaceExportedConst(nextGeneratedSource, 'STORED_EMBEDDING_SCORE_CEILING', '0.75');

  await writeFile(termsPath, `${JSON.stringify({ ...payload, terms: newTerms }, null, 2)}\n`);
  await writeFile(vectorPath, newVectors);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(generatedPath, nextGeneratedSource);

  console.info(
    `Filtered Decrypto embeddings from ${payload.terms.length} to ${newTerms.length} guess terms; kept ${payload.targetTerms.length} target terms.`,
  );
  console.info(`Wrote ${newVectors.byteLength} vector bytes to ${vectorPath}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
