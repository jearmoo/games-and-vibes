import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Timer, SwipeCard, ActionButtonBar } from '@games/client-core';
import type {
  SwipeZoneMapping,
  SwipeHint,
  SwipeAction,
  ActionButtonConfig,
  SwipeZone,
  SwipeDirection,
} from '@games/client-core';
import { useCharadesStore, calcRoundScore } from '../store';

const CHARADES_ZONES: SwipeZoneMapping[] = [
  {
    direction: 'right',
    zone: {
      id: 'correct',
      label: 'CORRECT',
      labelColor: 'text-green-400',
      labelTextShadow: '0 0 30px rgba(16,185,129,0.6)',
      bgTint: 'rgba(16,185,129,0.12)',
      glowShadow: '0 0 60px rgba(16,185,129,0.4)',
      borderColor: 'rgba(16,185,129,0.5)',
    },
    threshold: 80,
  },
  {
    direction: 'left',
    zone: {
      id: 'pass',
      label: 'PASS',
      labelColor: 'text-red-400',
      labelTextShadow: '0 0 30px rgba(239,68,68,0.6)',
      bgTint: 'rgba(239,68,68,0.12)',
      glowShadow: '0 0 60px rgba(239,68,68,0.4)',
      borderColor: 'rgba(239,68,68,0.5)',
    },
    threshold: 80,
  },
];

const CHARADES_HINTS: SwipeHint[] = [
  { direction: 'left', label: 'Pass', color: 'text-red-400' },
  { direction: 'right', label: 'Correct', color: 'text-green-400' },
];

const BUTTON_ROWS: ActionButtonConfig[][] = [
  [
    {
      id: 'pass',
      label: 'Pass',
      className:
        'flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-pass transition-all active:scale-[0.97]',
    },
    {
      id: 'correct',
      label: 'Correct',
      className:
        'flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-correct transition-all active:scale-[0.97]',
    },
  ],
];

function ZoneLabel({ zone, direction }: { zone: SwipeZone | null; direction: SwipeDirection | null }) {
  if (!zone || !direction) return null;
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-x-0 top-4 flex justify-center pointer-events-none z-20"
    >
      <div
        className={`font-display text-lg tracking-wider ${zone.labelColor} drop-shadow-lg`}
        style={{ textShadow: zone.labelTextShadow }}
      >
        {zone.label}
      </div>
    </motion.div>
  );
}

export default function CompPlayScreen() {
  const {
    teams,
    currentTeamIndex,
    currentWord,
    timerEnd,
    timerDuration,
    roundCorrect,
    roundPasses,
    swipeFeedback,
    markCorrect,
    markPass,
    endRound,
    clearSwipeFeedback,
  } = useCharadesStore();

  const timerExpiredRef = useRef(false);

  useEffect(() => {
    if (swipeFeedback) {
      const timeout = setTimeout(clearSwipeFeedback, 400);
      return () => clearTimeout(timeout);
    }
  }, [swipeFeedback, clearSwipeFeedback]);

  useEffect(() => {
    if (!timerEnd) return;
    timerExpiredRef.current = false;
    const interval = setInterval(() => {
      if (Date.now() >= timerEnd && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        clearInterval(interval);
        endRound();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [timerEnd, endRound]);

  const handleAction = useCallback(
    async (id: string) => {
      if (timerExpiredRef.current) return;
      if (id === 'correct') {
        await markCorrect();
      } else {
        await markPass();
      }
    },
    [markCorrect, markPass],
  );

  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      handleAction(action.zoneId);
    },
    [handleAction],
  );

  const handleTap = useCallback(
    (side: 'left' | 'right') => {
      if (timerExpiredRef.current) return;
      handleAction(side === 'right' ? 'correct' : 'pass');
    },
    [handleAction],
  );

  const team = teams[currentTeamIndex];
  const liveScore = calcRoundScore(roundCorrect, roundPasses);
  const teamColorClass = currentTeamIndex === 0 ? 'text-team1' : 'text-team2';

  return (
    <div className="h-full flex flex-col relative select-none">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className={`${teamColorClass} font-display text-lg tracking-wider`}>{team.name}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="text-green-400">{roundCorrect} correct</span>
          <span className="text-red-400">{roundPasses} pass</span>
          <span className="text-white font-semibold">Score: {liveScore}</span>
        </div>
      </div>

      {/* Timer */}
      <div className="px-6">{timerEnd && <Timer endTime={timerEnd} duration={timerDuration} />}</div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <SwipeCard
          key={currentWord}
          dragAxis="x"
          dragElastic={0.8}
          zones={CHARADES_ZONES}
          hints={CHARADES_HINTS}
          onSwipe={handleSwipe}
          onTap={handleTap}
          exitStyle="flyout"
          cooldownMs={200}
          widthClass="w-full max-w-xs"
          aspectRatio="3 / 4"
          renderZoneLabel={(zone, dir) => <ZoneLabel zone={zone} direction={dir} />}
        >
          {/* Single-word card content */}
          <div
            className="h-full flex items-center justify-center p-8 relative"
            style={{ background: 'linear-gradient(145deg, #1c2440 0%, #161c32 100%)' }}
          >
            <span
              className="font-display text-white tracking-wider capitalize text-center break-words max-w-full overflow-hidden"
              style={{ fontSize: currentWord && currentWord.length > 12 ? '1.25rem' : '1.875rem' }}
            >
              {currentWord || '...'}
            </span>
            {/* Tap feedback */}
            {swipeFeedback === 'correct' && (
              <motion.div
                key="tap-correct"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 top-4 flex justify-center text-green-400 font-display text-lg tracking-wider pointer-events-none"
              >
                CORRECT
              </motion.div>
            )}
            {swipeFeedback === 'pass' && (
              <motion.div
                key="tap-pass"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 top-4 flex justify-center text-red-400 font-display text-lg tracking-wider pointer-events-none"
              >
                PASS
              </motion.div>
            )}
          </div>
        </SwipeCard>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-4">
        <ActionButtonBar rows={BUTTON_ROWS} onAction={handleAction} />
      </div>
    </div>
  );
}
