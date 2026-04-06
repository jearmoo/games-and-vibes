import { useGameStore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';
import OdesCardContent from './OdesCardContent';
import {
  SwipeCard,
  ActionButtonBar,
  type SwipeZoneMapping,
  type SwipeHint,
  type ActionButtonConfig,
} from '@games/client-core';

const ODES_ZONES: SwipeZoneMapping[] = [
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

const ODES_HINTS: SwipeHint[] = [
  { direction: 'left', label: '+1', sublabel: 'word', color: 'text-emerald-400' },
  { direction: 'right', label: '+3', sublabel: 'phrase', color: 'text-amber-400' },
  { direction: 'up', label: 'Skip', sublabel: '-1', color: 'text-gray-400' },
  { direction: 'down', label: 'Bonk', sublabel: '-1', color: 'text-red-400' },
];

const BUTTON_ROWS: ActionButtonConfig[][] = [
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

const OUTCOME_MAP: Record<string, { result: string; points: number }> = {
  got1: { result: 'correct', points: 1 },
  got3: { result: 'correct', points: 3 },
  skip: { result: 'skipped', points: -1 },
  bonked: { result: 'bonked', points: -1 },
};

export default function CluerScreen() {
  const currentWord = useGameStore((s) => s.currentWord);
  const timerEnd = useGameStore((s) => s.timerEnd);
  const settings = useGameStore((s) => s.settings);
  const wordsResolved = useGameStore((s) => s.wordsResolved);
  const bonkFlash = useGameStore((s) => s.bonkFlash);

  const handleAction = (id: string) => {
    const outcome = OUTCOME_MAP[id];
    if (outcome) socket.emit('word:resolve', outcome);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-2 animate-fade-in relative">
      {/* Bonk flash overlay */}
      {bonkFlash && (
        <div className="absolute inset-0 z-50 bg-red-600 flex items-center justify-center animate-bonk-flash pointer-events-none">
          <div
            className="font-display text-7xl text-white tracking-wider"
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.5)' }}
          >
            BONK!
          </div>
        </div>
      )}

      {/* Timer + stats */}
      <div className="flex items-start justify-between">
        <div className="flex-1">{timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}</div>
        <div className="text-right ml-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Cards</div>
          <div className="font-display text-2xl text-emerald-400">{wordsResolved}</div>
        </div>
      </div>

      {/* Swipeable card area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative">
        {currentWord ? (
          <SwipeCard
            key={`${currentWord.word1}-${currentWord.word3}-${wordsResolved}`}
            zones={ODES_ZONES}
            hints={ODES_HINTS}
            onSwipe={(action) => handleAction(action.zoneId)}
            exitStyle="flyout"
          >
            <OdesCardContent word1={currentWord.word1} word3={currentWord.word3} />
          </SwipeCard>
        ) : (
          <div
            className="w-52 rounded-2xl border-2 border-white/[0.08] overflow-hidden"
            style={{ aspectRatio: '2.5 / 4', background: 'linear-gradient(to bottom, #161c32, #0f1424)' }}
          >
            <div className="h-full flex items-center justify-center">
              <div className="font-display text-3xl text-gray-600 tracking-wider animate-pulse-slow">...</div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="pt-1">
        <ActionButtonBar rows={BUTTON_ROWS} onAction={handleAction} />
      </div>

      {/* End turn early */}
      <button
        onClick={() => socket.emit('clue:end-turn')}
        className="w-full py-2 rounded-xl text-gray-600 hover:text-gray-400 text-xs font-display tracking-wider transition-colors"
      >
        End Turn
      </button>
    </div>
  );
}
