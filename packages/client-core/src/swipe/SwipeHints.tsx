import type { SwipeHint, SwipeDirection } from './types.js';

interface SwipeHintsProps {
  hints: SwipeHint[];
  activeDirection: SwipeDirection | null;
}

const POSITION_CLASSES: Record<SwipeDirection, string> = {
  left: 'absolute left-2 top-1/2 -translate-y-1/2',
  right: 'absolute right-2 top-1/2 -translate-y-1/2 text-right',
  up: 'absolute top-2 left-1/2 -translate-x-1/2 text-center',
  down: 'absolute bottom-2 left-1/2 -translate-x-1/2 text-center',
};

export default function SwipeHints({ hints, activeDirection }: SwipeHintsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {hints.map((hint) => (
        <div
          key={hint.direction}
          className={`${POSITION_CLASSES[hint.direction]} transition-opacity duration-150 ${
            activeDirection === hint.direction ? 'opacity-100' : 'opacity-20'
          }`}
        >
          <div className={`font-display text-sm tracking-wider ${hint.color}`}>{hint.label}</div>
          {hint.sublabel && <div className="text-[10px] text-gray-500 tracking-wider">{hint.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
