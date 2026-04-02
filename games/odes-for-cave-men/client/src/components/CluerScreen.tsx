import { useGameStore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';
import SwipeCard from './SwipeCard';

export default function CluerScreen() {
  const currentWord = useGameStore((s) => s.currentWord);
  const timerEnd = useGameStore((s) => s.timerEnd);
  const settings = useGameStore((s) => s.settings);
  const wordsResolved = useGameStore((s) => s.wordsResolved);
  const bonkFlash = useGameStore((s) => s.bonkFlash);

  const handleSwipe = (outcome: { result: 'correct' | 'skipped' | 'bonked'; points: number }) => {
    socket.emit('word:resolve', outcome);
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
            word1={currentWord.word1}
            word3={currentWord.word3}
            onSwipe={handleSwipe}
          />
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
      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
          <button
            onClick={() => socket.emit('word:resolve', { result: 'correct', points: 1 })}
            className="flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-team-b
                       transition-all active:scale-[0.97]"
          >
            +1 Got It
          </button>
          <button
            onClick={() => socket.emit('word:resolve', { result: 'correct', points: 3 })}
            className="flex-1 py-3 rounded-2xl text-white font-display text-base tracking-wider btn-team-a
                       transition-all active:scale-[0.97]"
          >
            +3 Got It
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => socket.emit('word:resolve', { result: 'bonked', points: -1 })}
            className="flex-1 py-2.5 rounded-2xl border border-red-700/50 text-red-400 font-display text-sm
                       tracking-wider hover:border-red-500 hover:text-red-300 transition-all active:scale-[0.97]"
          >
            I Bonked
          </button>
          <button
            onClick={() => socket.emit('word:resolve', { result: 'skipped', points: -1 })}
            className="flex-1 py-2.5 rounded-2xl border border-gray-700 text-gray-400 font-display text-sm
                       tracking-wider hover:border-gray-500 hover:text-gray-300 transition-all active:scale-[0.97]"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
