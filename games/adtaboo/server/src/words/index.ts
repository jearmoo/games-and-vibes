import { createWordFetcher } from './WordProvider.js';
import { charadesProvider } from './charades.js';

export const fetchWords = createWordFetcher(charadesProvider, 3);
