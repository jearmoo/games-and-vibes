const FETCH_COUNT = 5;
const MAX_RETRIES = 3;

async function fetchWordsFromApi(count: number, difficulty: number): Promise<string[]> {
  const res = await fetch(`/api/words?count=${count}&difficulty=${difficulty}`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return (await res.json()) as string[];
}

async function fetchUniqueWords(count: number, difficulty: number, usedWords: Set<string>): Promise<string[]> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const words = await fetchWordsFromApi(count, difficulty);
    const fresh = words.filter((w) => !usedWords.has(w.toLowerCase()));
    if (fresh.length > 0) return fresh;
  }
  return [];
}

export class WordBuffer {
  private nextWord: string | null = null;
  private fetchPromise: Promise<void> | null = null;
  readonly usedWords = new Set<string>();
  private difficulty = 4; // very hard for competitive

  setDifficulty(d: number) {
    this.difficulty = d;
  }

  async prefetch(): Promise<void> {
    if (this.nextWord || this.fetchPromise) return;
    this.fetchPromise = this._fetch();
    await this.fetchPromise;
  }

  private async _fetch(): Promise<void> {
    try {
      const words = await fetchUniqueWords(FETCH_COUNT, this.difficulty, this.usedWords);
      if (words.length > 0) {
        const word = words[0].toLowerCase();
        this.usedWords.add(word);
        this.nextWord = word;
      }
    } finally {
      this.fetchPromise = null;
    }
  }

  async consume(): Promise<string | null> {
    if (!this.nextWord && !this.fetchPromise) {
      await this.prefetch();
    }
    if (this.fetchPromise) {
      await this.fetchPromise;
    }
    const word = this.nextWord;
    this.nextWord = null;
    // Immediately start fetching next word in background
    this.prefetch();
    return word;
  }

  hasNext(): boolean {
    return this.nextWord !== null;
  }

  reset() {
    this.nextWord = null;
    this.fetchPromise = null;
    this.usedWords.clear();
  }
}

export async function fetchCasualWords(count: number, difficulty: number, usedWords: Set<string>): Promise<string[]> {
  const words = await fetchUniqueWords(Math.max(count, FETCH_COUNT), difficulty, usedWords);
  const result = words.slice(0, count).map((w) => w.toLowerCase());
  result.forEach((w) => usedWords.add(w));
  return result;
}
