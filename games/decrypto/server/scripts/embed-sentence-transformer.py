#!/usr/bin/env python3
import json
import re
import sys


DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

BASE_STOPWORDS = {
    "a",
    "about",
    "above",
    "after",
    "again",
    "against",
    "all",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "below",
    "between",
    "both",
    "but",
    "by",
    "can",
    "cannot",
    "could",
    "did",
    "do",
    "does",
    "doing",
    "down",
    "during",
    "each",
    "few",
    "for",
    "from",
    "further",
    "had",
    "has",
    "have",
    "having",
    "he",
    "her",
    "here",
    "hers",
    "herself",
    "him",
    "himself",
    "his",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "just",
    "may",
    "might",
    "more",
    "most",
    "must",
    "my",
    "myself",
    "no",
    "nor",
    "not",
    "now",
    "of",
    "off",
    "on",
    "once",
    "only",
    "or",
    "other",
    "our",
    "ours",
    "ourselves",
    "out",
    "over",
    "own",
    "same",
    "shall",
    "she",
    "should",
    "so",
    "some",
    "such",
    "than",
    "that",
    "the",
    "their",
    "theirs",
    "them",
    "themselves",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "to",
    "too",
    "under",
    "until",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "whom",
    "why",
    "will",
    "with",
    "would",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
}


def normalize_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.strip().lower())


def stopwords() -> set[str]:
    try:
        from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

        return BASE_STOPWORDS.union(ENGLISH_STOP_WORDS)
    except Exception:
        return BASE_STOPWORDS


def common_words(
    limit: int,
    source_pool_size: int,
    zipf_floor: float,
    min_length: int,
    max_length: int,
    wordlist: str,
) -> dict:
    from wordfreq import iter_wordlist, zipf_frequency

    terms: list[str] = []
    seen: set[str] = set()
    rejected = {
        "format": 0,
        "length": 0,
        "stopword": 0,
        "frequency": 0,
        "duplicate": 0,
    }
    stopword_set = stopwords()
    word_pattern = re.compile(r"^[a-z]+$")

    scanned = 0
    for raw in iter_wordlist("en", wordlist=wordlist):
        scanned += 1
        if source_pool_size > 0 and scanned > source_pool_size:
            break
        candidate = raw.strip().lower()
        if (
            not word_pattern.fullmatch(candidate)
            or "http" in candidate
            or "www" in candidate
            or "@" in candidate
            or "_" in candidate
        ):
            rejected["format"] += 1
            continue
        if len(candidate) < min_length or len(candidate) > max_length:
            rejected["length"] += 1
            continue
        if candidate in stopword_set:
            rejected["stopword"] += 1
            continue
        if zipf_frequency(candidate, "en", wordlist=wordlist) < zipf_floor:
            rejected["frequency"] += 1
            continue
        if candidate in seen:
            rejected["duplicate"] += 1
            continue
        seen.add(candidate)
        terms.append(candidate)
        if len(terms) >= limit:
            break

    return {
        "terms": terms,
        "stats": {
            "requestedLimit": limit,
            "sourcePoolSize": source_pool_size if source_pool_size > 0 else None,
            "wordfreqWordlist": wordlist,
            "fullWordlist": source_pool_size <= 0,
            "scanned": scanned,
            "accepted": len(terms),
            "zipfFrequencyFloor": zipf_floor,
            "minLength": min_length,
            "maxLength": max_length,
            "alphabeticOnly": True,
            "allowHyphen": False,
            "lowercaseOnly": True,
            "profanityAdultTermsExcluded": False,
            "stopwordCount": len(stopword_set),
            "rejected": rejected,
        },
    }


def embed_texts(model_name: str, keyed_texts: list[tuple[str, str]], truncate_dim: int | None) -> dict:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name)
    texts = [text for _, text in keyed_texts]
    embeddings = model.encode(
        texts,
        batch_size=128,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
        truncate_dim=truncate_dim,
    )
    return {
        "model": model_name,
        "dimensions": int(embeddings.shape[1]) if len(keyed_texts) else 0,
        "embeddings": {key: embeddings[index].astype(float).tolist() for index, (key, _) in enumerate(keyed_texts)},
    }


def main() -> int:
    request = json.load(sys.stdin)
    action = request.get("action")
    if action == "commonWords":
        limit = int(request.get("limit", 30000))
        source_pool_size = int(request.get("sourcePoolSize", 0))
        zipf_floor = float(request.get("zipfFloor", 3.0))
        min_length = int(request.get("minLength", 3))
        max_length = int(request.get("maxLength", 18))
        wordlist = request.get("wordlist") or "best"
        json.dump(common_words(limit, source_pool_size, zipf_floor, min_length, max_length, wordlist), sys.stdout)
        return 0
    if action == "embed":
        keyed_texts: list[tuple[str, str]] = []
        if isinstance(request.get("items"), list):
            for item in request.get("items", []):
                if not isinstance(item, dict):
                    continue
                key = normalize_term(str(item.get("key", "")))
                text = str(item.get("text", "")).strip()
                if key and text:
                    keyed_texts.append((key, text))
        else:
            terms = [normalize_term(term) for term in request.get("terms", [])]
            keyed_texts = [(term, term) for term in terms if term]
        model = request.get("model") or DEFAULT_MODEL
        truncate_dim = request.get("truncateDim")
        json.dump(embed_texts(model, keyed_texts, int(truncate_dim) if truncate_dim else None), sys.stdout)
        return 0
    raise ValueError(f"Unknown action: {action}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
