import { createWordFetcher, charadesProvider } from '@games/word-providers';

export const fetchWords = createWordFetcher(charadesProvider, 3);
