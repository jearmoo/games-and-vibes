import { useState, useEffect, useCallback, useMemo } from 'react';

type GeneratedCard = { word1: string; word3: string; duplicate?: boolean };
type KeptCard = { '1': string; '3': string };
type AllCard = { word1: string; word3: string; source: string };

export default function App() {
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [keptCards, setKeptCards] = useState<KeptCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'gray' | 'red'>('gray');
  const [temperature, setTemperature] = useState(1.2);
  const [allCards, setAllCards] = useState<AllCard[]>([]);
  const [search, setSearch] = useState('');

  const fetchKeptCards = useCallback(async () => {
    try {
      const res = await fetch('/api/words');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setKeptCards(data.game_data ?? []);
    } catch (e) {
      console.error('Failed to fetch kept cards:', e);
    }
  }, []);

  const fetchAllCards = useCallback(async () => {
    try {
      const res = await fetch('/api/all-cards');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setAllCards(data.cards ?? []);
    } catch (e) {
      console.error('Failed to fetch all cards:', e);
    }
  }, []);

  useEffect(() => {
    fetchKeptCards();
    fetchAllCards();
  }, [fetchKeptCards, fetchAllCards]);

  const searchResults = useMemo(() => {
    if (search.length < 2) return [];
    const q = search.toLowerCase();
    return allCards.filter(
      (c) => c.word1.toLowerCase().includes(q) || c.word3.toLowerCase().includes(q),
    );
  }, [search, allCards]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, difficulty, temperature }),
      });
      if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
      const data = await res.json();
      setCards(data.cards ?? data);
      setRejected(new Set());
      setKept(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = async (index: number) => {
    const card = cards[index];
    if (!card) return;
    try {
      const res = await fetch('/api/keep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: [{ word1: card.word1, word3: card.word3 }] }),
      });
      if (!res.ok) throw new Error(`Keep failed: ${res.status}`);
      setKept((prev) => new Set(prev).add(index));
      await fetchKeptCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to keep card');
    }
  };

  const handleKeepAllUnrejected = async () => {
    const toKeep = cards
      .map((card, i) => ({ card, i }))
      .filter(({ card, i }) => !rejected.has(i) && !kept.has(i) && !card.duplicate);

    if (toKeep.length === 0) return;

    try {
      const res = await fetch('/api/keep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: toKeep.map(({ card }) => ({ word1: card.word1, word3: card.word3 })),
        }),
      });
      if (!res.ok) throw new Error(`Keep all failed: ${res.status}`);
      setKept((prev) => {
        const next = new Set(prev);
        toKeep.forEach(({ i }) => next.add(i));
        return next;
      });
      await fetchKeptCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to keep cards');
    }
  };

  const handleReject = async (index: number) => {
    const card = cards[index];
    if (!card) return;
    setRejected((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    try {
      await fetch('/api/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: [{ word1: card.word1, word3: card.word3 }] }),
      });
    } catch (e) {
      console.error('Failed to save rejection:', e);
    }
  };

  const keepableCount = cards.filter(
    (card, i) => !rejected.has(i) && !kept.has(i) && !card.duplicate,
  ).length;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-amber-500">Cave Card Generator</h1>
        <p className="text-stone-400 mt-1">Generate and curate word cards for Odes for Cave Men</p>
      </header>

      {/* Generate Controls */}
      <div className="bg-stone-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-stone-400 text-sm">Count</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="w-20 bg-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </label>

        <label className="flex items-center gap-2">
          <span className="text-stone-400 text-sm">Style</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'gray' | 'red')}
            className="bg-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="gray">Gray (Easier)</option>
            <option value="red">Red (Harder)</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-stone-400 text-sm">Temp</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Math.max(0, Math.min(2, Number(e.target.value))))}
            className="w-20 bg-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </label>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 disabled:cursor-not-allowed text-stone-900 font-semibold rounded-lg px-5 py-2 text-sm transition-colors flex items-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          Generate Cards
        </button>

        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>

      {/* Generated Cards */}
      {cards.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-stone-300">
              Generated Cards <span className="text-stone-500 text-base">({cards.length})</span>
            </h2>
            {keepableCount > 0 && (
              <button
                onClick={handleKeepAllUnrejected}
                className="bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Keep Remaining ({keepableCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card, i) => {
              const isRejected = rejected.has(i);
              const isKept = kept.has(i);
              const isDuplicate = !!card.duplicate;

              return (
                <div
                  key={i}
                  className={`bg-stone-800 rounded-xl p-4 transition-opacity ${isRejected || isDuplicate ? 'opacity-40' : ''}`}
                >
                  <div className="mb-3">
                    <span className={`text-amber-500 font-bold ${isDuplicate ? 'line-through' : ''}`}>{card.word1}</span>
                    <span className="text-stone-500 mx-2">&rarr;</span>
                    <span className={`text-white font-medium ${isDuplicate ? 'line-through' : ''}`}>{card.word3}</span>
                    {isDuplicate && <span className="ml-2 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">duplicate</span>}
                  </div>

                  {/* Actions */}
                  {isDuplicate ? (
                    <span className="text-xs text-stone-500">Already exists in word banks</span>
                  ) : isKept ? (
                    <span className="inline-block bg-green-800 text-green-200 text-sm font-medium px-3 py-1 rounded-lg">
                      Kept &#10003;
                    </span>
                  ) : isRejected ? (
                    <span className="inline-block bg-stone-700 text-stone-500 text-sm font-medium px-3 py-1 rounded-lg">
                      Rejected
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKeep(i)}
                        className="bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => handleReject(i)}
                        className="bg-stone-600 hover:bg-stone-500 text-stone-300 rounded-lg px-3 py-1.5 text-sm transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search Existing Cards */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-stone-300 mb-4">
          Search All Cards <span className="text-stone-500 text-base">({allCards.length} total)</span>
        </h2>
        <input
          type="text"
          placeholder="Search word1 or word3 (min 2 chars)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-stone-800 text-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-stone-500 mb-4"
        />
        {search.length >= 2 && (
          <div className="bg-stone-800 rounded-xl p-4">
            {searchResults.length === 0 ? (
              <p className="text-stone-500 text-center text-sm">No matches found</p>
            ) : (
              <>
                <p className="text-stone-500 text-xs mb-3">{searchResults.length} matches</p>
                <div className="flex flex-wrap gap-2">
                  {searchResults.map((card, i) => (
                    <span
                      key={i}
                      className={`text-sm px-3 py-1 rounded-lg ${
                        card.source === 'Rejected'
                          ? 'bg-red-900/30 text-red-300'
                          : card.source === 'Generated'
                            ? 'bg-amber-900/30 text-amber-300'
                            : 'bg-stone-700 text-stone-300'
                      }`}
                    >
                      <span className="font-bold">{card.word1}</span>
                      <span className="text-stone-500 mx-1">&rarr;</span>
                      <span>{card.word3}</span>
                      <span className="text-stone-500 ml-2 text-xs">({card.source})</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Kept Cards Library */}
      <section>
        <h2 className="text-xl font-semibold text-stone-300 mb-4">
          Card Library <span className="text-stone-500 text-base">({keptCards.length})</span>
        </h2>

        {keptCards.length === 0 ? (
          <p className="text-stone-500 bg-stone-800 rounded-xl p-6 text-center">
            No cards yet. Generate and keep some cards above.
          </p>
        ) : (
          <div className="bg-stone-800 rounded-xl p-4">
            <div className="flex flex-wrap gap-2">
              {keptCards.map((card, j) => (
                <span
                  key={j}
                  className="bg-stone-700 text-stone-300 text-sm px-3 py-1 rounded-lg"
                >
                  {card['1']} &rarr; {card['3']}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
