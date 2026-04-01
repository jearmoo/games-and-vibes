export interface GameEntry {
  id: string;
  name: string;
  tagline: string;
  url: string;
  playerCount: string;
  accentColor: string;
  accentGlow: string;
  available: boolean;
}

export const games: GameEntry[] = [
  {
    id: 'adtaboo',
    name: 'Adversarial Taboo',
    tagline: 'Make your friends guess words while the enemy sets traps',
    url: 'https://adtaboo.jerpi.org',
    playerCount: '4-10 players',
    accentColor: '#6366f1',
    accentGlow: 'rgba(99, 102, 241, 0.4)',
    available: true,
  },
  {
    id: 'poetry',
    name: 'Poetry for Neanderthals',
    tagline: 'Explain big ideas with only small words',
    url: '#',
    playerCount: '2-12 players',
    accentColor: '#f59e0b',
    accentGlow: 'rgba(245, 158, 11, 0.4)',
    available: false,
  },
  {
    id: 'charades',
    name: 'Charades',
    tagline: 'Act it out without saying a word',
    url: '#',
    playerCount: '4-20 players',
    accentColor: '#10b981',
    accentGlow: 'rgba(16, 185, 129, 0.4)',
    available: false,
  },
  {
    id: 'hivemind',
    name: 'Hivemind',
    tagline: 'Think alike and score big together',
    url: '#',
    playerCount: '3-8 players',
    accentColor: '#06b6d4',
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    available: false,
  },
  {
    id: 'decrypto',
    name: 'Decrypto',
    tagline: 'Crack the code before your opponents do',
    url: '#',
    playerCount: '4-8 players',
    accentColor: '#f43f5e',
    accentGlow: 'rgba(244, 63, 94, 0.4)',
    available: false,
  },
];
