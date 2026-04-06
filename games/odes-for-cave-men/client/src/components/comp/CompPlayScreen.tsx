import { useEffect, useState } from 'react';
import { useCompStore } from '../../compStore';
import { SwipeCard, ActionButtonBar } from '@games/client-core';
import OdesCardContent from '../OdesCardContent';
import { ODES_ZONES, ODES_HINTS, BUTTON_ROWS, OUTCOME_MAP } from '../../odesCardConfig';

export default function CompPlayScreen() {
  const currentWord = useCompStore((s) => s.currentWord);
  const timerEnd = useCompStore((s) => s.timerEnd);
  const roundCorrect = useCompStore((s) => s.roundCorrect);
  const roundSkips = useCompStore((s) => s.roundSkips);
  const roundBonks = useCompStore((s) => s.roundBonks);
  const roundCards = useCompStore((s) => s.roundCards);
  const cluerName = useCompStore((s) => s.cluerName);
  const markCorrect = useCompStore((s) => s.markCorrect);
  const markSkip = useCompStore((s) => s.markSkip);
  const markBonk = useCompStore((s) => s.markBonk);
  const endRound = useCompStore((s) => s.endRound);

  const [now, setNow] = useState(Date.now);
  const remaining = timerEnd ? Math.max(0, Math.ceil((timerEnd - now) / 1000)) : 0;

  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= timerEnd) {
        clearInterval(id);
        endRound();
      }
    }, 200);
    return () => clearInterval(id);
  }, [timerEnd, endRound]);

  const handleAction = (id: string) => {
    const outcome = OUTCOME_MAP[id];
    if (!outcome) return;
    if (outcome.result === 'correct') markCorrect(outcome.points);
    else if (outcome.result === 'skipped') markSkip();
    else if (outcome.result === 'bonked') markBonk();
  };

  return (
    <div className="h-full flex flex-col p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-sm tracking-wider text-amber-400 truncate">{cluerName}</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{roundCorrect} pts</span>
          <span className="text-gray-500">{roundSkips} skip</span>
          <span className="text-red-400">{roundBonks} bonk</span>
        </div>
        <div
          className={`font-display text-lg tabular-nums ${remaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}
        >
          {remaining}s
        </div>
      </div>

      {/* Swipeable card area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative">
        {currentWord ? (
          <SwipeCard
            key={`${currentWord.word1}-${currentWord.word3}-${roundCards.length}`}
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
        onClick={endRound}
        className="w-full py-2 rounded-xl text-gray-600 hover:text-gray-400 text-xs font-display tracking-wider transition-colors mt-1"
      >
        End Turn
      </button>
    </div>
  );
}
