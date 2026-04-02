import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWordFetcher, charadesProvider } from '@games/word-providers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: ReturnType<typeof express> = express();
const PORT = parseInt(process.env.PORT || '4050', 10);

const fetchers = new Map<number, (count: number) => Promise<string[]>>();

function getFetcher(difficulty: number) {
  if (!fetchers.has(difficulty)) {
    fetchers.set(difficulty, createWordFetcher(charadesProvider, difficulty));
  }
  return fetchers.get(difficulty)!;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', game: 'charades' });
});

app.get('/api/words', async (req, res) => {
  const count = Math.min(Math.max(parseInt(String(req.query.count)) || 1, 1), 20);
  const difficulty = Math.min(Math.max(parseInt(String(req.query.difficulty)) || 1, 1), 4);

  try {
    const words = await getFetcher(difficulty)(count);
    res.json(words);
  } catch (err) {
    console.error('Word fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Charades server listening on port ${PORT}`);
});

export { app };
