import { useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Timer } from '@games/client-core';
import { useCharadesStore, calcRoundScore } from '../store';

const SWIPE_THRESHOLD = 80;

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

  const actingRef = useRef(false);
  const timerExpiredRef = useRef(false);

  // Clear swipe feedback after animation
  useEffect(() => {
    if (swipeFeedback) {
      const timeout = setTimeout(clearSwipeFeedback, 400);
      return () => clearTimeout(timeout);
    }
  }, [swipeFeedback, clearSwipeFeedback]);

  // Timer expiry check
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
    async (action: 'correct' | 'pass') => {
      if (actingRef.current || timerExpiredRef.current) return;
      actingRef.current = true;
      try {
        if (action === 'correct') {
          await markCorrect();
        } else {
          await markPass();
        }
      } finally {
        actingRef.current = false;
      }
    },
    [markCorrect, markPass],
  );

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const correctOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x > SWIPE_THRESHOLD) {
        handleAction('correct');
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        handleAction('pass');
      }
    },
    [handleAction],
  );

  const handleTapArea = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
      const relativeX = clientX - rect.left;
      if (relativeX > rect.width / 2) {
        handleAction('correct');
      } else {
        handleAction('pass');
      }
    },
    [handleAction],
  );

  const team = teams[currentTeamIndex];
  const liveScore = calcRoundScore(roundCorrect, roundPasses);

  return (
    <div
      className={`h-full flex flex-col relative select-none ${
        swipeFeedback === 'correct' ? 'animate-flash-correct' : swipeFeedback === 'pass' ? 'animate-flash-pass' : ''
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="text-charades font-display text-lg tracking-wider">{team.name}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="text-green-400">{roundCorrect} correct</span>
          <span className="text-red-400">{roundPasses} pass</span>
          <span className="text-white font-semibold">Score: {liveScore}</span>
        </div>
      </div>

      {/* Timer */}
      <div className="px-6">{timerEnd && <Timer endTime={timerEnd} duration={timerDuration} />}</div>

      {/* Card area - tappable */}
      <div className="flex-1 flex items-center justify-center p-6 relative" onClick={handleTapArea}>
        {/* Swipe hints */}
        <div className="swipe-hint left-4">
          PASS
          <br />
          &larr;
        </div>
        <div className="swipe-hint right-4 text-right">
          CORRECT
          <br />
          &rarr;
        </div>

        {/* Word card */}
        <motion.div
          key={currentWord}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragEnd={handleDragEnd}
          style={{ x, rotate }}
          className="word-card rounded-3xl p-8 w-full max-w-xs aspect-[3/4] flex items-center justify-center cursor-grab active:cursor-grabbing animate-card-in"
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            // Allow tap on card itself to work as area tap
            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
            const clientX = e.changedTouches[0].clientX;
            const relativeX = clientX - rect.left;
            if (relativeX > rect.width / 2) {
              handleAction('correct');
            } else {
              handleAction('pass');
            }
          }}
        >
          <div className="relative">
            {/* Correct overlay */}
            <motion.div
              style={{ opacity: correctOpacity }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-green-400 font-display text-lg tracking-wider"
            >
              CORRECT
            </motion.div>
            {/* Pass overlay */}
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-400 font-display text-lg tracking-wider"
            >
              PASS
            </motion.div>
            <span className="font-display text-3xl text-white tracking-wider capitalize text-center">
              {currentWord || '...'}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
