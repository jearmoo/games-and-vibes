import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { CoreMessage } from 'ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SYSTEM_PROMPT = `You are a card generator for "Odes for Cave Men," a party word game.

How the game works: The Poet sees word1 and word3 on a card. Word1 is hidden inside word3 (as a substring). The Poet must describe word3 to the guessers WITHOUT saying word1. Guessers try to guess word1. The Bonker can penalize the Poet if they accidentally say word1.

CRITICAL RULE: word1 must carry the SAME MEANING in word3. It is not enough for word1 to appear as a substring. Word1 must be a meaningful, semantic root of word3. The player needs to be able to guess word1 from a description of word3, so the meaning must be preserved.

Good examples:
- "Crow" -> "Scarecrow" : a scarecrow scares CROWS. The word "crow" means the same bird in both.
- "Fire" -> "Fire Hydrant" : a hydrant used for FIRE. Same meaning.
- "Drum" -> "Drumstick" : a stick for a DRUM. Same meaning.
- "Bat" -> "Vampire Bat" : a BAT that is associated with vampires. Same meaning.

BAD examples (do NOT generate cards like these):
- "Bat" -> "Battery" : "bat" appears in "battery" but battery has nothing to do with bats. REJECTED.
- "Car" -> "Scar" : "car" appears in "scar" but scar has nothing to do with cars. REJECTED.
- "Art" -> "Start" : "art" appears in "start" but start has nothing to do with art. REJECTED.
- "Pin" -> "Spine" : "pin" appears in "spine" but spine has nothing to do with pins. REJECTED.
- "Ant" -> "Elegant" : "ant" appears in "elegant" but elegant has nothing to do with ants. REJECTED.

The test: if you cover up word1 in word3, can you still explain how word1 relates to the concept? If not, the card is invalid.

Good cards also have these qualities:
- Concrete and visual: word3 evokes a clear mental image the Poet can describe or act out
- Interesting connection: the phrase adds context that makes word1 more specific or surprising
- Universally recognizable: word3 should be a common phrase or compound word most English speakers know

There are two difficulty levels:
- Gray (easier): Common phrases, word1 typically appears at the start of word3, more straightforward connections (e.g. "Tooth" -> "Tooth Fairy", "Snow" -> "Snowball Fight")
- Red (harder): Word1 is embedded inside compound words or idiomatic phrases, requires more lateral thinking (e.g. "Crow" -> "Scarecrow", "Coast" -> "Rollercoaster"). Even for red cards, word1 MUST retain its original meaning in word3.

Rules for valid cards:
- word1 MUST appear as a meaningful component of word3, not just a coincidental substring
- word1 must mean the SAME THING in word3 as it does on its own
- word3 MUST be a real, recognizable English phrase or compound word
- No offensive or inappropriate content

Return cards as JSON: { "cards": [{ "word1": "...", "word3": "..." }, ...] }`;

export function getFewShotMessages(): CoreMessage[] {
  return [
    {
      role: 'user',
      content: 'Generate 3 gray (easier) cards.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Tooth', word3: 'Tooth Fairy' },
          { word1: 'Fire', word3: 'Fire Hydrant' },
          { word1: 'Hamster', word3: 'Hamster Wheel' },
        ],
      }),
    },
    {
      role: 'user',
      content: 'Generate 3 more gray cards.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Snow', word3: 'Snowball Fight' },
          { word1: 'Banana', word3: 'Banana Split' },
          { word1: 'Dream', word3: 'Dream Team' },
        ],
      }),
    },
    {
      role: 'user',
      content: 'Generate 3 gray cards with compound words.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Sun', word3: 'Sunburn' },
          { word1: 'Drum', word3: 'Drumstick' },
          { word1: 'Storm', word3: 'Thunderstorm' },
        ],
      }),
    },
    {
      role: 'user',
      content: 'Generate 3 red (harder) cards.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Crow', word3: 'Scarecrow' },
          { word1: 'Blade', word3: 'Rollerblade' },
          { word1: 'Mate', word3: 'Checkmate' },
        ],
      }),
    },
    {
      role: 'user',
      content: 'Generate 3 more red cards.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Coast', word3: 'Rollercoaster' },
          { word1: 'Hog', word3: 'Hedgehog' },
          { word1: 'Whistle', word3: 'Whistleblower' },
        ],
      }),
    },
    {
      role: 'user',
      content: 'Generate 3 red cards with idiomatic phrases.',
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        cards: [
          { word1: 'Rags', word3: 'Rags to Riches' },
          { word1: 'Piece', word3: 'Piece of Cake' },
          { word1: 'Partner', word3: 'Partner in Crime' },
        ],
      }),
    },
  ];
}

export function loadExistingWords(): Set<string> {
  const wordFiles = [
    join(__dirname, '..', 'server', 'src', 'words', 'base_game_gray.json'),
    join(__dirname, '..', 'server', 'src', 'words', 'base_game_red.json'),
    join(__dirname, '..', 'server', 'src', 'words', 'expansion_gray.json'),
    join(__dirname, '..', 'server', 'src', 'words', 'expansion_red.json'),
    join(__dirname, 'words', 'generated.json'),
    join(__dirname, 'words', 'rejected.json'),
  ];

  const words = new Set<string>();

  for (const filePath of wordFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1')) as { game_data: Array<{ '1': string; '3': string }> };
      for (const entry of data.game_data) {
        words.add(entry['1'].toLowerCase());
        words.add(entry['3'].toLowerCase());
      }
    } catch {
      // File may not exist yet, skip
    }
  }

  return words;
}
