import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadExistingWords } from './prompt.js';
import { generateCards } from './generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseJsonPermissive(raw: string): unknown {
  return JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1'));
}

const app = express();
app.use(cors());
app.use(express.json());

const GENERATED_PATH = join(__dirname, 'words', 'generated.json');
const REJECTED_PATH = join(__dirname, 'words', 'rejected.json');

app.post('/api/generate', async (req, res) => {
  try {
    const { count, difficulty, temperature } = req.body as {
      count: number;
      difficulty: 'gray' | 'red';
      temperature?: number;
    };
    const existingWords = loadExistingWords();
    const result = await generateCards({ count, difficulty, existingWords, temperature });
    const seen = new Set<string>();
    const cards = result.cards.map((card) => {
      const w1 = card.word1.toLowerCase();
      const w3 = card.word3.toLowerCase();
      const batchDuplicate = seen.has(w1) || seen.has(w3);
      seen.add(w1);
      seen.add(w3);
      return {
        ...card,
        duplicate: existingWords.has(w1) || existingWords.has(w3) || batchDuplicate,
      };
    });
    res.json({ cards });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate cards' });
  }
});

app.post('/api/keep', (req, res) => {
  try {
    const { cards } = req.body as {
      cards: Array<{ word1: string; word3: string }>;
    };

    const raw = readFileSync(GENERATED_PATH, 'utf-8');
    const data = parseJsonPermissive(raw) as { game_data: Array<Record<string, string>> };

    for (const card of cards) {
      data.game_data.push({
        '1': card.word1,
        '3': card.word3,
      });
    }

    writeFileSync(GENERATED_PATH, JSON.stringify(data, null, 2) + '\n');
    res.json({ success: true, total: data.game_data.length });
  } catch (error) {
    console.error('Keep error:', error);
    res.status(500).json({ error: 'Failed to save cards' });
  }
});

app.post('/api/reject', (req, res) => {
  try {
    const { cards } = req.body as {
      cards: Array<{ word1: string; word3: string }>;
    };

    const raw = readFileSync(REJECTED_PATH, 'utf-8');
    const data = parseJsonPermissive(raw) as { game_data: Array<Record<string, string>> };

    for (const card of cards) {
      data.game_data.push({ '1': card.word1, '3': card.word3 });
    }

    writeFileSync(REJECTED_PATH, JSON.stringify(data, null, 2) + '\n');
    res.json({ success: true, total: data.game_data.length });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to save rejected cards' });
  }
});

app.get('/api/words', (_req, res) => {
  try {
    const raw = readFileSync(GENERATED_PATH, 'utf-8');
    res.json(parseJsonPermissive(raw));
  } catch (error) {
    console.error('Words error:', error);
    res.status(500).json({ error: 'Failed to read words' });
  }
});

app.get('/api/existing', (_req, res) => {
  try {
    const words = loadExistingWords();
    res.json({ words: [...words] });
  } catch (error) {
    console.error('Existing words error:', error);
    res.status(500).json({ error: 'Failed to load existing words' });
  }
});

app.get('/api/all-cards', (_req, res) => {
  try {
    const sources: Array<{ path: string; label: string }> = [
      { path: join(__dirname, '..', 'server', 'src', 'words', 'base_game_gray.json'), label: 'Base Gray' },
      { path: join(__dirname, '..', 'server', 'src', 'words', 'base_game_red.json'), label: 'Base Red' },
      { path: join(__dirname, '..', 'server', 'src', 'words', 'expansion_gray.json'), label: 'Expansion Gray' },
      { path: join(__dirname, '..', 'server', 'src', 'words', 'expansion_red.json'), label: 'Expansion Red' },
      { path: GENERATED_PATH, label: 'Generated' },
      { path: REJECTED_PATH, label: 'Rejected' },
    ];

    const cards: Array<{ word1: string; word3: string; source: string }> = [];
    for (const { path, label } of sources) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const data = parseJsonPermissive(raw) as { game_data: Array<{ '1': string; '3': string }> };
        for (const entry of data.game_data) {
          cards.push({ word1: entry['1'], word3: entry['3'], source: label });
        }
      } catch {
        // File may not exist
      }
    }

    res.json({ cards, total: cards.length });
  } catch (error) {
    console.error('All cards error:', error);
    res.status(500).json({ error: 'Failed to load all cards' });
  }
});

const PORT = 4050;
app.listen(PORT, () => {
  console.log(`Card generation dev server running on port ${PORT}`);
});
