import type { SwipeZoneMapping, SwipeHint, ActionButtonConfig } from '@games/client-core';

export const ODES_ZONES: SwipeZoneMapping[] = [
  {
    direction: 'left',
    zone: {
      id: 'got1',
      label: '+1',
      labelColor: 'text-emerald-400',
      labelTextShadow: '0 0 30px rgba(16,185,129,0.6)',
      bgTint: 'rgba(16,185,129,0.12)',
      glowShadow: '0 0 60px rgba(16,185,129,0.4)',
      borderColor: 'rgba(16,185,129,0.5)',
    },
    threshold: 80,
  },
  {
    direction: 'right',
    zone: {
      id: 'got3',
      label: '+3',
      labelColor: 'text-amber-400',
      labelTextShadow: '0 0 30px rgba(251,191,36,0.6)',
      bgTint: 'rgba(251,191,36,0.12)',
      glowShadow: '0 0 80px rgba(251,191,36,0.5)',
      borderColor: 'rgba(251,191,36,0.5)',
    },
    threshold: 80,
  },
  {
    direction: 'up',
    zone: {
      id: 'skip',
      label: 'SKIP',
      labelColor: 'text-gray-400',
      labelTextShadow: '0 0 20px rgba(107,114,128,0.4)',
      bgTint: 'rgba(107,114,128,0.12)',
      glowShadow: '0 0 40px rgba(107,114,128,0.3)',
      borderColor: 'rgba(107,114,128,0.5)',
    },
    threshold: 100,
  },
  {
    direction: 'down',
    zone: {
      id: 'bonked',
      label: 'BONK!',
      labelColor: 'text-red-400',
      labelTextShadow: '0 0 30px rgba(239,68,68,0.6)',
      bgTint: 'rgba(239,68,68,0.15)',
      glowShadow: '0 0 60px rgba(239,68,68,0.4)',
      borderColor: 'rgba(239,68,68,0.5)',
    },
    threshold: 100,
  },
];

export const ODES_HINTS: SwipeHint[] = [
  { direction: 'left', label: '+1', sublabel: 'word', color: 'text-emerald-400' },
  { direction: 'right', label: '+3', sublabel: 'phrase', color: 'text-amber-400' },
  { direction: 'up', label: 'Skip', sublabel: '-1', color: 'text-gray-400' },
  { direction: 'down', label: 'Bonk', sublabel: '-1', color: 'text-red-400' },
];

export const BUTTON_ROWS: ActionButtonConfig[][] = [
  [
    {
      id: 'got1',
      label: '+1 Got It',
      className:
        'flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-team-b transition-all active:scale-[0.97]',
    },
    {
      id: 'got3',
      label: '+3 Got It',
      className:
        'flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-team-a transition-all active:scale-[0.97]',
    },
  ],
  [
    {
      id: 'bonked',
      label: 'I Bonked',
      className:
        'flex-1 py-2.5 rounded-2xl border border-red-700/50 text-red-400 font-display text-sm tracking-wider hover:border-red-500 hover:text-red-300 transition-all active:scale-[0.97]',
    },
    {
      id: 'skip',
      label: 'Skip',
      className:
        'flex-1 py-2.5 rounded-2xl border border-gray-700 text-gray-400 font-display text-sm tracking-wider hover:border-gray-500 hover:text-gray-300 transition-all active:scale-[0.97]',
    },
  ],
];

export const OUTCOME_MAP: Record<string, { result: string; points: number }> = {
  got1: { result: 'correct', points: 1 },
  got3: { result: 'correct', points: 3 },
  skip: { result: 'skipped', points: -1 },
  bonked: { result: 'bonked', points: -1 },
};
