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
}: {
  count: number;
  difficulty: 'gray' | 'red';
  existingWords: Set<string>;
}) {
  const model = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
  })('google/gemini-3-flash-preview');

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...getFewShotMessages(),
    {
      role: 'user' as const,
      content: `Generate ${count} new and creative ${difficulty} cards. Use uncommon, surprising word1 values that people wouldn't immediately think of. Avoid obvious, generic words.`,
    },
  ];

  const result = await generateText({
    model,
    messages,
    temperature: 1.2,
  });

  const parsed = extractFirstJson(result.text);
  return cardSchema.parse(parsed);
}
