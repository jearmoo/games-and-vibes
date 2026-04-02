import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { SYSTEM_PROMPT, getFewShotMessages } from './prompt.js';

const cardSchema = z.object({
  cards: z.array(
    z.object({
      word1: z.string(),
      word3: z.string(),
    })
  ),
});

function extractFirstJson(text: string): unknown {
  // Find the first { and its matching }
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    if (depth === 0) {
      return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('No complete JSON object found in response');
}

export async function generateCards({
  count,
  difficulty,
  existingWords,
  temperature = 1.2,
}: {
  count: number;
  difficulty: 'gray' | 'red';
  existingWords: Set<string>;
  temperature?: number;
}) {
  const model = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
  })('google/gemini-3-flash-preview');

  const baseMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...getFewShotMessages(),
  ];

  const userPrompt = `Generate ${count} new and creative ${difficulty} cards. Use uncommon, surprising word1 values that people wouldn't immediately think of. Avoid obvious, generic words.`;

  type Card = { word1: string; word3: string };
  let allCards: Card[] = [];
  let duplicates: Card[] = [];
  const acceptedWords = new Set<string>();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const needed = count - allCards.length;
    if (needed <= 0) break;

    const messages =
      attempt === 0
        ? [...baseMessages, { role: 'user' as const, content: userPrompt }]
        : [
            ...baseMessages,
            { role: 'user' as const, content: userPrompt },
            {
              role: 'assistant' as const,
              content: JSON.stringify({ cards: duplicates }),
            },
            {
              role: 'user' as const,
              content: `These cards have word1 or word3 values that already exist in the word banks or were already generated: ${duplicates.map((c) => `${c.word1} -> ${c.word3}`).join(', ')}. Generate ${needed} replacement cards with completely different word1 AND word3 values. Same rules apply.`,
            },
          ];

    const result = await generateText({ model, messages, temperature });
    const parsed = cardSchema.parse(extractFirstJson(result.text));

    const fresh: Card[] = [];
    duplicates = [];

    for (const card of parsed.cards) {
      const w1 = card.word1.toLowerCase();
      const w3 = card.word3.toLowerCase();
      if (existingWords.has(w1) || existingWords.has(w3) || acceptedWords.has(w1) || acceptedWords.has(w3)) {
        duplicates.push(card);
      } else {
        fresh.push(card);
        acceptedWords.add(w1);
        acceptedWords.add(w3);
      }
    }

    allCards = allCards.concat(fresh.slice(0, count - allCards.length));

    if (duplicates.length === 0) break;
    console.log(`Retry ${attempt + 1}/${MAX_RETRIES}: ${duplicates.length} duplicates found, requesting replacements`);
  }

  return { cards: allCards };
}
