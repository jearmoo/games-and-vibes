import { WordProvider } from './types.js';

const WORD_API = 'http://random-word-api.herokuapp.com/word';

export const randomWordApiProvider: WordProvider = async (count, difficulty) => {
  const res = await fetch(`${WORD_API}?number=${count}&diff=${difficulty}`);
  if (!res.ok) throw new Error(`random-word-api returned ${res.status}`);
  return (await res.json()) as string[];
};
