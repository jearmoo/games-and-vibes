import { getStoredEmbeddingIndex, storedEmbeddingCosineByIndex } from './keywordEmbeddings.generated.js';

export interface DecryptoCard {
  displayWord: string;
  category: string;
  embeddingText: string;
}

type CardGroup = {
  category: string;
  words: string[];
};

const CARD_GROUPS: CardGroup[] = [
  {
    category: 'Everyday Objects',
    words: [
      'Key',
      'Mirror',
      'Candle',
      'Blanket',
      'Backpack',
      'Clock',
      'Ladder',
      'Envelope',
      'Magnet',
      'Button',
      'Bottle',
      'Scissors',
      'Umbrella',
      'Helmet',
      'Notebook',
      'Pillow',
      'Wallet',
      'Flashlight',
      'Spoon',
      'Remote',
    ],
  },
  {
    category: 'Places & Landmarks',
    words: [
      'Island',
      'Desert',
      'Volcano',
      'Harbor',
      'Castle',
      'Village',
      'Market',
      'Tunnel',
      'Bridge',
      'Temple',
      'Canyon',
      'Airport',
      'Museum',
      'Stadium',
      'Library',
      'Jungle',
      'Glacier',
      'Palace',
      'Subway',
      'Garden',
    ],
  },
  {
    category: 'Nature & Weather',
    words: [
      'Storm',
      'Lightning',
      'Rainbow',
      'Fog',
      'Breeze',
      'Thunder',
      'Snowflake',
      'Tornado',
      'Sunrise',
      'Moonlight',
      'Pebble',
      'River',
      'Meadow',
      'Forest',
      'Ocean',
      'Mountain',
      'Flower',
      'Shadow',
      'Coral',
      'Autumn',
    ],
  },
  {
    category: 'Animals',
    words: [
      'Tiger',
      'Eagle',
      'Dolphin',
      'Penguin',
      'Octopus',
      'Wolf',
      'Rabbit',
      'Cobra',
      'Elephant',
      'Giraffe',
      'Falcon',
      'Shark',
      'Panda',
      'Kangaroo',
      'Raven',
      'Turtle',
      'Fox',
      'Whale',
      'Lion',
      'Butterfly',
    ],
  },
  {
    category: 'Food & Drink',
    words: [
      'Pizza',
      'Sushi',
      'Taco',
      'Burger',
      'Pasta',
      'Curry',
      'Waffle',
      'Chocolate',
      'Popcorn',
      'Mango',
      'Avocado',
      'Coffee',
      'Tea',
      'Honey',
      'Cheese',
      'Noodle',
      'Donut',
      'Lemon',
      'Caramel',
      'Omelet',
    ],
  },
  {
    category: 'Sports & Games',
    words: [
      'Soccer',
      'Basketball',
      'Tennis',
      'Baseball',
      'Chess',
      'Poker',
      'Monopoly',
      'Bowling',
      'Golf',
      'Boxing',
      'Skateboard',
      'Marathon',
      'Olympics',
      'Dart',
      'Billiards',
      'Volleyball',
      'Cricket',
      'Hockey',
      'Domino',
      'Fortnite',
    ],
  },
  {
    category: 'Arts & Entertainment',
    words: [
      'Opera',
      'Ballet',
      'Graffiti',
      'Portrait',
      'Sculpture',
      'Jazz',
      'Cinema',
      'Poetry',
      'Novel',
      'Theater',
      'Mosaic',
      'Symphony',
      'Comedy',
      'Cartoon',
      'Festival',
      'Fashion',
      'Tattoo',
      'Podcast',
      'Manga',
      'Broadway',
    ],
  },
  {
    category: 'Science & Technology',
    words: [
      'Robot',
      'Laser',
      'Algorithm',
      'Satellite',
      'Microscope',
      'Battery',
      'Circuit',
      'Rocket',
      'Quantum',
      'Genome',
      'Vaccine',
      'Telescope',
      'Database',
      'Pixel',
      'Keyboard',
      'Gravity',
      'Fossil',
      'Plasma',
      'Neural',
      'Transformer',
    ],
  },
  {
    category: 'History & Mythology',
    words: [
      'Pyramid',
      'Pharaoh',
      'Viking',
      'Samurai',
      'Gladiator',
      'Oracle',
      'Atlantis',
      'Excalibur',
      'Achilles',
      'Zeus',
      'Athena',
      'Medusa',
      'Caesar',
      'Sparta',
      'Napoleon',
      'Cleopatra',
      'Mummy',
      'Trojan',
      'Colosseum',
      'Renaissance',
    ],
  },
  {
    category: 'Famous People & Characters',
    words: [
      'Sherlock',
      'Einstein',
      'Elon',
      'Beyonce',
      'Shakespeare',
      'Gandhi',
      'Darwin',
      'Mozart',
      'Picasso',
      'Batman',
      'Superman',
      'Barbie',
      'Mario',
      'Gandalf',
      'Hermione',
      'Bond',
      'Godzilla',
      'Dracula',
      'Cinderella',
      'Yoda',
    ],
  },
  {
    category: 'Brands & Organizations',
    words: [
      'OpenAI',
      'NASA',
      'Google',
      'Apple',
      'Microsoft',
      'Amazon',
      'Tesla',
      'Disney',
      'Netflix',
      'YouTube',
      'Wikipedia',
      'Lego',
      'Nike',
      'Starbucks',
      'McDonalds',
      'Pokemon',
      'Marvel',
      'Spotify',
      'Instagram',
      'FIFA',
    ],
  },
  {
    category: 'Professions & Roles',
    words: [
      'Detective',
      'Doctor',
      'Chef',
      'Pilot',
      'Teacher',
      'Engineer',
      'Farmer',
      'Judge',
      'Actor',
      'Soldier',
      'Scientist',
      'Nurse',
      'Pirate',
      'Wizard',
      'Journalist',
      'Architect',
      'Comedian',
      'Librarian',
      'Mechanic',
      'Astronaut',
    ],
  },
  {
    category: 'Abstract Concepts & Emotions',
    words: [
      'Courage',
      'Jealousy',
      'Wisdom',
      'Panic',
      'Hope',
      'Pride',
      'Greed',
      'Patience',
      'Curiosity',
      'Trust',
      'Fear',
      'Joy',
      'Anger',
      'Luck',
      'Guilt',
      'Loyalty',
      'Chaos',
      'Mercy',
      'Ambition',
      'Doubt',
    ],
  },
  {
    category: 'Actions & Events',
    words: [
      'Escape',
      'Whisper',
      'Chase',
      'Celebrate',
      'Betray',
      'Invent',
      'Discover',
      'Repair',
      'Trade',
      'Rescue',
      'Explode',
      'Transform',
      'Negotiate',
      'Balance',
      'Compete',
      'Confess',
      'Pretend',
      'Harvest',
      'Launch',
      'Surrender',
    ],
  },
  {
    category: 'Materials & Shapes',
    words: [
      'Gold',
      'Silver',
      'Glass',
      'Velvet',
      'Leather',
      'Marble',
      'Crystal',
      'Paper',
      'Plastic',
      'Steel',
      'Cotton',
      'Diamond',
      'Circle',
      'Triangle',
      'Spiral',
      'Cube',
      'Ruby',
      'Emerald',
      'Ivory',
      'Neon',
    ],
  },
  {
    category: 'Time & Occasions',
    words: [
      'Midnight',
      'Birthday',
      'Wedding',
      'Funeral',
      'Holiday',
      'Summer',
      'Winter',
      'Century',
      'Deadline',
      'Countdown',
      'Anniversary',
      'Morning',
      'Eclipse',
      'Season',
      'Solstice',
      'Election',
      'Revolution',
      'Finale',
      'Encore',
      'Tomorrow',
    ],
  },
  {
    category: 'Transportation & Travel',
    words: [
      'Train',
      'Taxi',
      'Bicycle',
      'Airplane',
      'Ship',
      'Scooter',
      'Canoe',
      'Motorcycle',
      'Submarine',
      'Helicopter',
      'Passport',
      'Suitcase',
      'Compass',
      'Map',
      'Ticket',
      'Highway',
      'Crosswalk',
      'Cruise',
      'Parachute',
      'Elevator',
    ],
  },
  {
    category: 'Home & Relationships',
    words: [
      'Kitchen',
      'Bedroom',
      'Garage',
      'Balcony',
      'Neighbor',
      'Roommate',
      'Family',
      'Baby',
      'Grandparent',
      'Cousin',
      'Pet',
      'Dinner',
      'Laundry',
      'Doorbell',
      'Fireplace',
      'Basement',
      'Couch',
      'Shower',
      'Mailbox',
      'Fence',
    ],
  },
  {
    category: 'School & Work',
    words: [
      'Homework',
      'Exam',
      'Diploma',
      'Lecture',
      'Professor',
      'Intern',
      'Resume',
      'Meeting',
      'Application',
      'Promotion',
      'Office',
      'Spreadsheet',
      'Presentation',
      'Project',
      'Contract',
      'Salary',
      'Startup',
      'Factory',
      'Laboratory',
      'Uniform',
    ],
  },
  {
    category: 'Secrets & Power',
    words: [
      'Secret',
      'Spy',
      'Treasure',
      'Trap',
      'Evidence',
      'Alibi',
      'Password',
      'Vault',
      'Crown',
      'Empire',
      'Rebel',
      'Dictator',
      'Trial',
      'Prison',
      'Assassin',
      'Hostage',
      'Blackmail',
      'Fingerprint',
      'Poison',
      'Propaganda',
    ],
  },
  {
    category: 'Fantasy & Sci-Fi',
    words: [
      'Dragon',
      'Portal',
      'Alien',
      'Zombie',
      'Vampire',
      'Ghost',
      'Monster',
      'Magic',
      'Potion',
      'Spell',
      'Spaceship',
      'Timewarp',
      'Dystopia',
      'Utopia',
      'Cyborg',
      'Mutant',
      'Witch',
      'Knight',
      'Prophecy',
      'Curse',
    ],
  },
  {
    category: 'Internet & Modern Life',
    words: [
      'Meme',
      'Emoji',
      'Hashtag',
      'Influencer',
      'Livestream',
      'Viral',
      'Selfie',
      'Drone',
      'Blog',
      'Avatar',
      'Chatbot',
      'Crypto',
      'Firewall',
      'Cloud',
      'Spam',
      'Streaming',
      'App',
      'Notification',
      'Login',
      'Screenshot',
    ],
  },
];

const EMBEDDING_TEXT_OVERRIDES: Record<string, string> = {
  Key: 'Key, a small metal object used to unlock a lock',
  Remote: 'Remote, a handheld device for controlling electronics',
  Shadow: 'Shadow, a dark shape cast when light is blocked',
  Monopoly: 'Monopoly, the classic board game about buying property',
  Olympics: 'Olympics, the international athletic competition',
  Dart: 'Dart, a small pointed projectile used in a throwing game',
  Domino: 'Domino, a rectangular tile used in matching games',
  Fortnite: 'Fortnite, the online battle royale video game',
  Broadway: 'Broadway, the New York theater district',
  Neural: 'Neural, relating to nerves or neural networks',
  Transformer: 'Transformer, the neural network machine learning architecture',
  Oracle: 'Oracle, a prophetic figure in ancient mythology',
  Atlantis: 'Atlantis, the mythical lost island city',
  Excalibur: 'Excalibur, the legendary sword of King Arthur',
  Achilles: 'Achilles, the Greek mythological hero of the Trojan War',
  Zeus: 'Zeus, the king of the Greek gods',
  Athena: 'Athena, the Greek goddess of wisdom and war',
  Medusa: 'Medusa, the snake-haired monster from Greek mythology',
  Caesar: 'Julius Caesar, the ancient Roman leader',
  Sparta: 'Sparta, the ancient Greek warrior city-state',
  Napoleon: 'Napoleon Bonaparte, the French emperor and military leader',
  Cleopatra: 'Cleopatra, the ancient Egyptian queen',
  Mummy: 'Mummy, a preserved ancient wrapped body',
  Trojan: 'Trojan, relating to ancient Troy and the Trojan Horse',
  Colosseum: 'Colosseum, the ancient Roman amphitheater',
  Renaissance: 'Renaissance, the European cultural rebirth period',
  Sherlock: 'Sherlock Holmes, the fictional detective',
  Einstein: 'Albert Einstein, famous physicist',
  Elon: 'Elon Musk, technology entrepreneur',
  Beyonce: 'Beyonce, the famous pop singer and performer',
  Shakespeare: 'William Shakespeare, the English playwright',
  Gandhi: 'Mahatma Gandhi, Indian independence leader',
  Darwin: 'Charles Darwin, scientist known for evolution by natural selection',
  Mozart: 'Wolfgang Amadeus Mozart, classical composer',
  Picasso: 'Pablo Picasso, influential modern artist',
  Batman: 'Batman, the fictional superhero detective',
  Superman: 'Superman, the fictional superhero from Krypton',
  Barbie: 'Barbie, the fashion doll and movie character',
  Mario: 'Mario, the Nintendo video game character',
  Gandalf: 'Gandalf, the wizard from The Lord of the Rings',
  Hermione: 'Hermione Granger, the Harry Potter character',
  Bond: 'James Bond, fictional spy',
  Godzilla: 'Godzilla, the giant fictional movie monster',
  Dracula: 'Dracula, the fictional vampire count',
  Cinderella: 'Cinderella, the fairy tale princess',
  Yoda: 'Yoda, the Jedi master from Star Wars',
  OpenAI: 'OpenAI, artificial intelligence research company',
  NASA: 'NASA, the United States space agency',
  Google: 'Google, the internet search and technology company',
  Apple: 'Apple, the technology company',
  Microsoft: 'Microsoft, the software and technology company',
  Amazon: 'Amazon, the technology and e-commerce company',
  Tesla: 'Tesla, the electric vehicle and energy company',
  Disney: 'Disney, the entertainment and animation company',
  Netflix: 'Netflix, the streaming television and movie company',
  YouTube: 'YouTube, the online video sharing platform',
  Wikipedia: 'Wikipedia, the online encyclopedia',
  Lego: 'Lego, the interlocking toy brick brand',
  Nike: 'Nike, the sportswear and athletic shoe company',
  Starbucks: 'Starbucks, the coffeehouse chain',
  McDonalds: 'McDonalds, the fast food restaurant chain',
  Pokemon: 'Pokemon, the video game and animated creature franchise',
  Marvel: 'Marvel, the superhero comic book and movie franchise',
  Spotify: 'Spotify, the music streaming service',
  Instagram: 'Instagram, the photo and video social media platform',
  FIFA: 'FIFA, the international soccer organization',
  Resume: 'Resume, a document listing work experience and qualifications',
  Startup: 'Startup, a new high-growth business venture',
  Crown: 'Crown, the royal headpiece symbolizing monarchy',
  Cloud: 'Cloud, internet cloud computing infrastructure',
  Crypto: 'Crypto, cryptocurrency and blockchain technology',
  App: 'App, a software application',
};

const DEAL_ATTEMPTS = 160;
const SAME_CATEGORY_PENALTY = 0.18;

function defaultEmbeddingText(displayWord: string, category: string): string {
  return `${displayWord}, a ${category.toLowerCase()} concept`;
}

export function normalizeCardKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export const KEYWORD_CARDS: DecryptoCard[] = CARD_GROUPS.flatMap(({ category, words }) =>
  words.map((displayWord) => ({
    displayWord,
    category,
    embeddingText: EMBEDDING_TEXT_OVERRIDES[displayWord] ?? defaultEmbeddingText(displayWord, category),
  })),
);

export const KEYWORDS = KEYWORD_CARDS.map((card) => card.displayWord);

const CARD_BY_KEY = new Map(KEYWORD_CARDS.map((card) => [normalizeCardKey(card.displayWord), card]));
const KEYWORD_VOCABULARY = [...new Set(KEYWORDS.map(normalizeCardKey).filter(Boolean))].sort();
const KEYWORD_VOCABULARY_SET = new Set(KEYWORD_VOCABULARY);

export function getCardByDisplayWord(displayWord: string): DecryptoCard | undefined {
  return CARD_BY_KEY.get(normalizeCardKey(displayWord));
}

export function getKeywordVocabulary(): readonly string[] {
  return KEYWORD_VOCABULARY;
}

export function isKnownKeywordGuess(value: string): boolean {
  return KEYWORD_VOCABULARY_SET.has(normalizeCardKey(value));
}

export function getEmbeddingInput(card: DecryptoCard): string {
  return `Decrypto target concept. Word: ${card.displayWord}. Category: ${card.category}. Meaning: ${card.embeddingText}.`;
}

export function validateKeywordCards(cards: readonly DecryptoCard[] = KEYWORD_CARDS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, card] of cards.entries()) {
    if (!card.displayWord?.trim()) errors.push(`Card ${index} is missing displayWord.`);
    if (!card.category?.trim()) errors.push(`Card ${card.displayWord || index} is missing category.`);
    if (!card.embeddingText?.trim()) errors.push(`Card ${card.displayWord || index} is missing embeddingText.`);
    const key = normalizeCardKey(card.displayWord);
    if (seen.has(key)) errors.push(`Duplicate displayWord: ${card.displayWord}.`);
    if (key) seen.add(key);
  }
  return errors;
}

const validationErrors = validateKeywordCards();
if (validationErrors.length > 0) {
  throw new Error(`Invalid Decrypto keyword cards:\n${validationErrors.join('\n')}`);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function embeddingIndexFor(card: DecryptoCard): number | undefined {
  return getStoredEmbeddingIndex(normalizeCardKey(card.displayWord));
}

function embeddingSimilarity(left: DecryptoCard, right: DecryptoCard): number {
  const leftIndex = embeddingIndexFor(left);
  const rightIndex = embeddingIndexFor(right);
  if (leftIndex === undefined || rightIndex === undefined) return left.category === right.category ? 0.35 : 0;
  return storedEmbeddingCosineByIndex(leftIndex, rightIndex);
}

function pairPenalty(left: DecryptoCard, right: DecryptoCard): number {
  const semanticPenalty = Math.max(0, embeddingSimilarity(left, right));
  const categoryPenalty = left.category === right.category ? SAME_CATEGORY_PENALTY : 0;
  return semanticPenalty + categoryPenalty;
}

function scoreCardSet(cards: readonly DecryptoCard[]): number {
  if (cards.length < 2) return 0;
  let maxPenalty = 0;
  let penaltySum = 0;
  let pairCount = 0;
  for (let left = 0; left < cards.length; left += 1) {
    for (let right = left + 1; right < cards.length; right += 1) {
      const penalty = pairPenalty(cards[left]!, cards[right]!);
      maxPenalty = Math.max(maxPenalty, penalty);
      penaltySum += penalty;
      pairCount += 1;
    }
  }
  return maxPenalty * 2 + penaltySum / pairCount;
}

function pickUnrelatedCards(excludedKeys: ReadonlySet<string>, count: number): DecryptoCard[] {
  const candidates = KEYWORD_CARDS.filter((card) => !excludedKeys.has(normalizeCardKey(card.displayWord)));
  if (candidates.length <= count) return candidates;

  let best = shuffle(candidates).slice(0, count);
  let bestScore = scoreCardSet(best);
  for (let attempt = 0; attempt < DEAL_ATTEMPTS; attempt += 1) {
    const pool = shuffle(candidates);
    const selected: DecryptoCard[] = [];
    while (selected.length < count && pool.length > 0) {
      if (selected.length === 0) {
        selected.push(pool.shift()!);
        continue;
      }
      let bestIndex = 0;
      let bestCandidatePenalty = Number.POSITIVE_INFINITY;
      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index]!;
        const candidatePenalty = Math.max(...selected.map((selectedCard) => pairPenalty(candidate, selectedCard)));
        if (candidatePenalty < bestCandidatePenalty) {
          bestCandidatePenalty = candidatePenalty;
          bestIndex = index;
        }
      }
      selected.push(pool.splice(bestIndex, 1)[0]!);
    }

    const score = scoreCardSet(selected);
    if (score < bestScore) {
      best = selected;
      bestScore = score;
    }
  }
  return best;
}

export function pickKeywordSets(): { red: string[]; blue: string[] } {
  const redCards = pickUnrelatedCards(new Set(), 4);
  const used = new Set(redCards.map((card) => normalizeCardKey(card.displayWord)));
  const blueCards = pickUnrelatedCards(used, 4);
  return {
    red: redCards.map((card) => card.displayWord),
    blue: blueCards.map((card) => card.displayWord),
  };
}

export function pickReplacementKeyword(existing: string[]): string {
  const used = new Set(existing.map(normalizeCardKey));
  const candidates = KEYWORD_CARDS.filter((card) => !used.has(normalizeCardKey(card.displayWord)));
  const pool = candidates.length > 0 ? candidates : KEYWORD_CARDS;
  const existingCards = existing.flatMap((word) => {
    const card = getCardByDisplayWord(word);
    return card ? [card] : [];
  });

  if (existingCards.length === 0) return pool[Math.floor(Math.random() * pool.length)]!.displayWord;

  let bestScore = Number.POSITIVE_INFINITY;
  const bestCards: DecryptoCard[] = [];
  for (const candidate of pool) {
    const score = Math.max(...existingCards.map((card) => pairPenalty(candidate, card)));
    if (score < bestScore - 0.000001) {
      bestScore = score;
      bestCards.length = 0;
      bestCards.push(candidate);
    } else if (Math.abs(score - bestScore) < 0.000001) {
      bestCards.push(candidate);
    }
  }
  return bestCards[Math.floor(Math.random() * bestCards.length)]!.displayWord;
}
