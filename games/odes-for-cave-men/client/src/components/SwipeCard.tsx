import { useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';

type SwipeResult =
  | { result: 'correct'; points: 1 }
  | { result: 'correct'; points: 3 }
  | { result: 'skipped'; points: -1 }
  | { result: 'bonked'; points: -1 };

interface SwipeCardProps {
  word1: string;
  word3: string;
  onSwipe: (outcome: SwipeResult) => void;
}

const SWIPE_X_THRESHOLD = 80;
const SWIPE_X_FAR_THRESHOLD = 160;
const SWIPE_Y_THRESHOLD = 100;

type SwipeZone = 'none' | 'skip' | 'got1' | 'got3' | 'bonked';

function getSwipeZone(x: number, y: number): SwipeZone {
  // Down = bonk (when clearly downward)
  if (y > SWIPE_Y_THRESHOLD && y > Math.abs(x) * 0.7) return 'bonked';
  // Up = skip (when clearly upward)
  if (y < -SWIPE_Y_THRESHOLD && -y > Math.abs(x) * 0.7) return 'skip';
  // Right = +3
  if (x > SWIPE_X_THRESHOLD) return 'got3';
  // Left = +1
  if (x < -SWIPE_X_THRESHOLD) return 'got1';
  return 'none';
}

const ZONE_CONFIG: Record<SwipeZone, { label: string; color: string; bg: string; shadow: string; border: string }> = {
  none: {
    label: '',
    color: '',
    bg: '',
    shadow: '0 4px 30px rgba(0,0,0,0.4)',
    border: 'rgba(255,255,255,0.08)',
  },
  got1: {
    label: '+1',
    color: 'text-emerald-400',
    bg: 'rgba(16,185,129,0.12)',
    shadow: '0 0 60px rgba(16,185,129,0.4)',
    border: 'rgba(16,185,129,0.5)',
  },
  got3: {
    label: '+3',
    color: 'text-amber-400',
    bg: 'rgba(251,191,36,0.12)',
    shadow: '0 0 80px rgba(251,191,36,0.5)',
    border: 'rgba(251,191,36,0.5)',
  },
  skip: {
    label: 'SKIP',
    color: 'text-gray-400',
    bg: 'rgba(107,114,128,0.12)',
    shadow: '0 0 40px rgba(107,114,128,0.3)',
    border: 'rgba(107,114,128,0.5)',
  },
  bonked: {
    label: 'BONK!',
    color: 'text-red-400',
    bg: 'rgba(239,68,68,0.15)',
    shadow: '0 0 60px rgba(239,68,68,0.4)',
    border: 'rgba(239,68,68,0.5)',
  },
};

const ZONE_TEXT_SHADOW: Record<SwipeZone, string> = {
  none: '',
  got1: '0 0 30px rgba(16,185,129,0.6)',
  got3: '0 0 30px rgba(251,191,36,0.6)',
  skip: '0 0 20px rgba(107,114,128,0.4)',
  bonked: '0 0 30px rgba(239,68,68,0.6)',
};

export default function SwipeCard({ word1, word3, onSwipe }: SwipeCardProps) {
  const [zone, setZone] = useState<SwipeZone>('none');
  const [exiting, setExiting] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);

  const handleDrag = useCallback((_: unknown, info: PanInfo) => {
    setZone(getSwipeZone(info.offset.x, info.offset.y));
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const finalZone = getSwipeZone(info.offset.x, info.offset.y);

      if (finalZone === 'none') {
        setZone('none');
        return;
      }

      setExiting(true);

      const outcomeMap: Record<Exclude<SwipeZone, 'none'>, SwipeResult> = {
        got1: { result: 'correct', points: 1 },
        got3: { result: 'correct', points: 3 },
        skip: { result: 'skipped', points: -1 },
        bonked: { result: 'bonked', points: -1 },
      };

      setTimeout(() => onSwipe(outcomeMap[finalZone]), 200);
    },
    [onSwipe],
  );

  const cfg = ZONE_CONFIG[zone];
  const active = zone !== 'none';

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: '100%' }}>
      <SwipeHints zone={zone} />

      <motion.div
        drag={!exiting}
        dragElastic={0.7}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, y, rotate, boxShadow: cfg.shadow }}
        animate={
          exiting
            ? {
                x: zone === 'got1' ? -400 : zone === 'got3' ? 400 : 0,
                y: zone === 'bonked' ? 400 : zone === 'skip' ? -400 : 0,
                opacity: 0,
                scale: 0.8,
              }
            : undefined
        }
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative touch-none select-none cursor-grab active:cursor-grabbing z-10"
      >
        <div
          className="w-52 rounded-2xl overflow-hidden transition-colors duration-150"
          style={{ aspectRatio: '2.5 / 4', background: active ? cfg.bg : 'transparent' }}
        >
          <div
            className="h-full flex flex-col rounded-2xl overflow-hidden border-2 transition-colors duration-150"
            style={{ borderColor: cfg.border }}
          >
            {/* Top: 1pt word (dark surface) */}
            <div
              className="flex-1 flex flex-col items-center justify-center p-4 relative"
              style={{ background: 'linear-gradient(to bottom, #161c32, #0f1424)' }}
            >
              <div className="absolute top-2.5 left-3">
                <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400/70">
                  1 pt
                </span>
              </div>
              <div
                className="font-display text-2xl text-white tracking-wider text-center leading-tight"
                style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
              >
                {word1}
              </div>
            </div>

            {/* Divider */}
            <div className="relative h-0">
              <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            </div>

            {/* Bottom: 3pt phrase (slightly warmer dark) */}
            <div
              className="flex-1 flex flex-col items-center justify-center p-4 relative"
              style={{ background: 'linear-gradient(to bottom, #1a1525, #120e1e)' }}
            >
              <div className="absolute top-2.5 left-3">
                <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/70">
                  3 pts
                </span>
              </div>
              <div
                className="font-display text-xl text-white tracking-wider text-center leading-tight"
                style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
              >
                {word3}
              </div>
            </div>
          </div>
        </div>

        {/* Floating zone label overlay */}
        {active && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div
              className={`font-display text-5xl tracking-wider ${cfg.color} drop-shadow-lg`}
              style={{ textShadow: ZONE_TEXT_SHADOW[zone] }}
            >
              {cfg.label}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function SwipeHints({ zone }: { zone: SwipeZone }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Left: +1 */}
      <div
        className={`absolute left-2 top-1/2 -translate-y-1/2 transition-opacity duration-150 ${
          zone === 'got1' ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <div className="font-display text-sm tracking-wider text-emerald-400">+1</div>
        <div className="text-[10px] text-gray-500 tracking-wider">word</div>
      </div>

      {/* Right: +3 */}
      <div
        className={`absolute right-2 top-1/2 -translate-y-1/2 text-right transition-opacity duration-150 ${
          zone === 'got3' ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <div className="font-display text-sm tracking-wider text-amber-400">+3</div>
        <div className="text-[10px] text-gray-500 tracking-wider">phrase</div>
      </div>

      {/* Top: Skip */}
      <div
        className={`absolute top-2 left-1/2 -translate-x-1/2 text-center transition-opacity duration-150 ${
          zone === 'skip' ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <div className="font-display text-sm tracking-wider text-gray-400">Skip</div>
        <div className="text-[10px] text-gray-500 tracking-wider">-1</div>
      </div>

      {/* Bottom: Bonk */}
      <div
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-center transition-opacity duration-150 ${
          zone === 'bonked' ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <div className="font-display text-sm tracking-wider text-red-400">Bonk</div>
        <div className="text-[10px] text-gray-500 tracking-wider">-1</div>
      </div>
    </div>
  );
}
