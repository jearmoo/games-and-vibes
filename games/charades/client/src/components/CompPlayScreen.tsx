import { useEffect, useCallback, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { animate } from 'framer-motion/dom';
import { Timer } from '@games/client-core';
import { useCharadesStore, calcRoundScore } from '../store';

const SWIPE_THRESHOLD = 80;
const COOLDOWN_MS = 200;

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
  const isDraggingRef = useRef(false);
  // locked = fly-out in progress or post-action cooldown; disables all interaction
  const [locked, setLocked] = useState(false);

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

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const correctOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleAction = useCallback(
    (action: 'correct' | 'pass') => {
      if (locked || timerExpiredRef.current) return;
      setLocked(true);
      const direction = action === 'correct' ? 1 : -1;
      animate(x, direction * window.innerWidth, { duration: 0.25, ease: 'easeIn' }).then(async () => {
        if (action === 'correct') {
          await markCorrect();
        } else {
          await markPass();
        }
        // cooldown before unlocking
        setTimeout(() => setLocked(false), COOLDOWN_MS);
      });
    },
    [locked, markCorrect, markPass, x],
  );

  // Reset everything when new card mounts
  useEffect(() => {
    x.jump(0);
    clearSwipeFeedback();
    isDraggingRef.current = false;
    setLocked(false);
  }, [currentWord, x, clearSwipeFeedback]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x > SWIPE_THRESHOLD) {
        handleAction('correct');
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        handleAction('pass');
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    },
    [handleAction],
  );

  const handleTapArea = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isDraggingRef.current) return;
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

      {/* Card area - tappable */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative" onClick={handleTapArea}>
        {/* Swipe hints above card */}
        <div className="flex items-center justify-between w-full max-w-xs mb-3 pointer-events-none">
          <span className="text-xs text-white/20">&larr; PASS</span>
          <span className="text-xs text-white/20">CORRECT &rarr;</span>
        </div>

        {/* Word card */}
        <motion.div
          key={currentWord}
          drag={locked ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragStart={() => {
            isDraggingRef.current = true;
          }}
          onDragEnd={handleDragEnd}
          style={{ x, rotate }}
          className={`word-card rounded-3xl p-8 w-full max-w-xs aspect-[3/4] flex items-center justify-center animate-card-in relative ${locked ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            if (isDraggingRef.current) {
              e.stopPropagation();
              return;
            }
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
          {/* CORRECT / PASS labels — top of card */}
          <motion.div
            style={{ opacity: correctOpacity }}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-green-400 font-display text-lg tracking-wider pointer-events-none"
          >
            CORRECT
          </motion.div>
          <motion.div
            style={{ opacity: passOpacity }}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-red-400 font-display text-lg tracking-wider pointer-events-none"
          >
            PASS
          </motion.div>
          {swipeFeedback === 'correct' && (
            <motion.div
              key="tap-correct"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 text-green-400 font-display text-lg tracking-wider pointer-events-none"
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
              className="absolute top-4 left-1/2 -translate-x-1/2 text-red-400 font-display text-lg tracking-wider pointer-events-none"
            >
              PASS
            </motion.div>
          )}

          <span className="font-display text-3xl text-white tracking-wider capitalize text-center">
            {currentWord || '...'}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
