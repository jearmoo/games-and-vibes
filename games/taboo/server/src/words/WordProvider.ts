export type WordProvider = (count: number, difficulty: number) => Promise<string[]>;

const FALLBACK_WORDS = [
  // Animals
  'elephant', 'penguin', 'giraffe', 'dolphin', 'kangaroo', 'octopus', 'parrot',
  'chameleon', 'flamingo', 'cheetah', 'hedgehog', 'gorilla', 'seahorse', 'peacock',
  'hamster', 'lobster', 'raccoon', 'jellyfish', 'buffalo', 'porcupine', 'toucan',
  'armadillo', 'koala', 'walrus', 'panther', 'scorpion', 'iguana', 'pelican',
  // Food & Drink
  'pizza', 'chocolate', 'pancake', 'spaghetti', 'avocado', 'croissant', 'burrito',
  'pretzel', 'sushi', 'popcorn', 'marshmallow', 'cinnamon', 'hamburger', 'pineapple',
  'milkshake', 'lasagna', 'cucumber', 'watermelon', 'gingerbread', 'cheesecake',
  'broccoli', 'espresso', 'guacamole', 'muffin', 'coconut', 'lemonade', 'dumpling',
  // Objects & Things
  'guitar', 'telescope', 'umbrella', 'chandelier', 'trampoline', 'compass', 'hammock',
  'typewriter', 'kaleidoscope', 'binoculars', 'skateboard', 'accordion', 'lantern',
  'boomerang', 'parachute', 'megaphone', 'snowglobe', 'hourglass', 'toolbox',
  'briefcase', 'backpack', 'thermometer', 'microscope', 'saxophone', 'wheelchair',
  'dishwasher', 'stethoscope', 'trident', 'catapult', 'periscope', 'scarecrow',
  // Places & Buildings
  'library', 'volcano', 'lighthouse', 'pyramid', 'treehouse', 'aquarium', 'cathedral',
  'igloo', 'skyscraper', 'casino', 'fountain', 'dungeon', 'greenhouse', 'observatory',
  'colosseum', 'windmill', 'warehouse', 'stadium', 'planetarium', 'museum',
  'restaurant', 'airport', 'cemetery', 'pharmacy', 'laundromat', 'monastery',
  // People & Roles
  'astronaut', 'detective', 'pirate', 'wizard', 'gladiator', 'ninja', 'cowboy',
  'lifeguard', 'mechanic', 'bartender', 'dentist', 'clown', 'architect', 'blacksmith',
  'firefighter', 'ballerina', 'conductor', 'lumberjack', 'shepherd', 'surgeon',
  // Nature & Weather
  'avalanche', 'tornado', 'rainbow', 'earthquake', 'glacier', 'meteor', 'quicksand',
  'stalactite', 'tumbleweed', 'whirlpool', 'thunderstorm', 'blizzard', 'sandstorm',
  'waterfall', 'canyon', 'geyser', 'coral', 'mushroom', 'sunflower', 'bamboo',
  // Activities & Sports
  'surfing', 'karate', 'juggling', 'archery', 'fencing', 'bowling', 'snorkeling',
  'wrestling', 'marathon', 'dodgeball', 'gymnastics', 'skydiving', 'yodeling',
  'origami', 'pottery', 'knitting', 'gardening', 'kayaking', 'boxing', 'skiing',
  // Concepts & Events
  'fireworks', 'carnival', 'wedding', 'hibernation', 'camouflage', 'migration',
  'blackout', 'stampede', 'eclipse', 'graduation', 'bankruptcy', 'celebration',
  'nightmare', 'treasure', 'homework', 'vacation', 'rehearsal', 'auction',
  // Clothing & Accessories
  'sombrero', 'monocle', 'suspenders', 'tuxedo', 'flipflops', 'bandana', 'apron',
  'helmet', 'necklace', 'sunglasses', 'bathrobe', 'raincoat', 'mittens', 'bowtie',
  // Technology & Vehicles
  'submarine', 'helicopter', 'spaceship', 'bulldozer', 'motorcycle', 'tractor',
  'satellite', 'escalator', 'projector', 'microphone', 'headphones', 'joystick',
  'propeller', 'antenna', 'dashboard', 'carousel', 'gondola', 'rickshaw',
  // Miscellaneous
  'butterfly', 'moustache', 'lollipop', 'tadpole', 'snowflake', 'cobweb', 'fossil',
  'handshake', 'silhouette', 'labyrinth', 'mannequin', 'icicle', 'portrait',
  'blueprint', 'dominoes', 'pendulum', 'gargoyle', 'confetti', 'tightrope', 'mirage',
];

export function createWordFetcher(provider: WordProvider, difficulty: number): (count: number) => Promise<string[]> {
  return async (count: number): Promise<string[]> => {
    try {
      const words = await provider(count, difficulty);
      return words.map((w) => w.toLowerCase());
    } catch {
      const shuffled = [...FALLBACK_WORDS].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    }
  };
}
