import { useGameStore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';
import OdesCardContent from './OdesCardContent';
import { SwipeCard, ActionButtonBar } from '@games/client-core';
import { ODES_ZONES, ODES_HINTS, BUTTON_ROWS, OUTCOME_MAP } from '../odesCardConfig';

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
