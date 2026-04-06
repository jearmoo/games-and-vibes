export interface CaveWord {
  word1: string;
  word3: string;
}

const API_BASE = '';

async function fetchWords(count: number): Promise<CaveWord[]> {
  const res = await fetch(`${API_BASE}/api/words?count=${count}`);
  if (!res.ok) throw new Error('Failed to fetch words');
  return res.json();
}

export class WordBuffer {
  private queue: CaveWord[] = [];
  private used = new Set<string>();

  async prefetch(count = 10): Promise<void> {
    const words = await fetchWords(count);
    for (const w of words) {
      const key = `${w.word1}|${w.word3}`;
      if (!this.used.has(key)) {
        this.queue.push(w);
        this.used.add(key);
      }
    }
  }

  consume(): CaveWord | null {
    if (this.queue.length <= 3) {
      this.prefetch(10).catch(() => {});
    }
    return this.queue.shift() ?? null;
  }

  reset(): void {
    this.queue = [];
    this.used.clear();
  }
}
