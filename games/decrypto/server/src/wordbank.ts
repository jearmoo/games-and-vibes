export interface DecryptoCard {
  displayWord: string;
  category: string;
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

export function validateKeywordCards(cards: readonly DecryptoCard[] = KEYWORD_CARDS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, card] of cards.entries()) {
    if (!card.displayWord?.trim()) errors.push(`Card ${index} is missing displayWord.`);
    if (!card.category?.trim()) errors.push(`Card ${card.displayWord || index} is missing category.`);
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

export function pickKeywordSets(): { red: string[]; blue: string[] } {
  const cards = shuffle(KEYWORD_CARDS).slice(0, 8);
  return {
    red: cards.slice(0, 4).map((card) => card.displayWord),
    blue: cards.slice(4, 8).map((card) => card.displayWord),
  };
}

export function pickReplacementKeyword(existing: string[]): string {
  const used = new Set(existing.map(normalizeCardKey));
  const candidates = KEYWORD_CARDS.filter((card) => !used.has(normalizeCardKey(card.displayWord)));
  const pool = candidates.length > 0 ? candidates : KEYWORD_CARDS;
  return pool[Math.floor(Math.random() * pool.length)]!.displayWord;
}
