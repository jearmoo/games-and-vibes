# Decrypto

Two teams each receive four private keywords. On each turn, one encryptor gets a three-digit code and writes clues that point to their team's keyword numbers. Their teammates try to decrypt the code while the opposing team tries to intercept it.

## Local Development

```bash
pnpm run dev:decrypto
```

- Server: `http://localhost:4090`
- Client: `http://localhost:5176`

## Keyword Embeddings

The tiebreaker scorer uses stored Sentence Transformers vectors when they are available, then falls back to the lightweight local scorer for terms that have not been generated yet. Generate vectors for the Decrypto dictionary plus common English words with:

```bash
pnpm --filter @games/decrypto-server setup:embeddings
pnpm --filter @games/decrypto-server generate:embeddings
```

By default this uses `sentence-transformers/all-MiniLM-L6-v2`, stores the model's full 384-dimensional normalized embeddings, quantizes them as `int8/127` for repo size, iterates the full English `wordfreq` `best` wordlist, and stores up to 150,000 filtered candidate words plus all Decrypto target words and a small supplemental list for common playtest misses such as `teapot`. Filters keep lowercase alphabetic words from 3-18 letters, remove stopwords/function words, require Zipf frequency >= 1.5, and de-duplicate the result. Profanity and adult terms are not specially excluded. The production runtime keeps the matrix in `keywordEmbeddings.int8.bin` and computes cosine directly with `dot(qA, qB) / (norm(qA) * norm(qB))`, caching only one small norm per vocabulary term instead of materializing a full `Float32Array` matrix.

Tiebreaker guesses are single words only and must exist in the generated vocabulary. Unknown words are rejected with a friendly validation error instead of being silently scored as zero.

Generation can be configured with environment variables or script flags:

```bash
DECRYPTO_EMBEDDING_VOCAB_SIZE=150000 \
EMBEDDING_ZIPF_FREQUENCY_FLOOR=1.5 \
EMBEDDING_WORDFREQ_WORDLIST=best \
pnpm --filter @games/decrypto-server generate:embeddings

pnpm --filter @games/decrypto-server generate:embeddings -- --word-limit=150000 --zipf-floor=1.5 --wordfreq-wordlist=best
```

By default `EMBEDDING_SOURCE_POOL_SIZE` / `--source-pool-size` is `0`, which means scan the full wordfreq list. Set it only when you intentionally want a capped source scan.

For Raspberry Pi deployments under memory pressure, regenerate a smaller embedding asset while keeping the same filters:

```bash
DECRYPTO_EMBEDDING_VOCAB_SIZE=75000 pnpm --filter @games/decrypto-server generate:embeddings
DECRYPTO_EMBEDDING_VOCAB_SIZE=100000 pnpm --filter @games/decrypto-server generate:embeddings
```

`DECRYPTO_EMBEDDING_VOCAB_SIZE` is an alias for `EMBEDDING_VOCAB_WORD_LIMIT` / `--word-limit`; the default remains `150000`.

To tighten the OOV gate during playtesting, regenerate with a smaller candidate set and higher frequency floor, for example:

```bash
pnpm --filter @games/decrypto-server generate:embeddings -- --word-limit=40000 --source-pool-size=150000 --zipf-floor=2.8
```

Other knobs: `SENTENCE_TRANSFORMER_MODEL`, `SENTENCE_TRANSFORMER_TRUNCATE_DIM`, `EMBEDDING_MIN_WORD_LENGTH`, and `EMBEDDING_MAX_WORD_LENGTH`. `SENTENCE_TRANSFORMER_TRUNCATE_DIM` / `--truncate-dim` defaults to `0`, which means no dimensionality reduction; set it only if we intentionally want to compare a smaller embedding file against the full 384-dimensional baseline.

The stored tiebreaker score is not raw cosine. Raw MiniLM cosine is linearly calibrated from generated target-word floor/ceiling values, clamped to 0-1, then multiplied by a target-neighbor rank weight. Non-exact embedding matches are capped below 100%, so only exact word guesses can display as perfect. This keeps semantically close guesses high while unrelated guesses that are not near the target can intentionally score 0.

## Rules Implemented

- 2 teams, requiring 2 connected players per team to start
- Private keyword sets per team
- Rotating encryptor per team
- Three-clue transmissions for codes using 3 unique digits from 1-4
- No interception attempt in round 1
- Opponent intercept tokens and active-team miscommunication tokens
- Game ends when a team reaches 2 intercepts or the opposing team reaches 2 miscommunications
