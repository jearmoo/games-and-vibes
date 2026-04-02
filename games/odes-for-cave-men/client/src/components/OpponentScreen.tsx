import { useState } from 'react';
import { useGameStore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';

export default function OpponentScreen() {
  const currentWord = useGameStore((s) => s.currentWord);
  const timerEnd = useGameStore((s) => s.timerEnd);
  const settings = useGameStore((s) => s.settings);
  const wordsResolved = useGameStore((s) => s.wordsResolved);
  const scores = useGameStore((s) => s.scores);

  const [wordsHidden, setWordsHidden] = useState(false);

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Timer + stats */}
      <div className="flex items-start justify-between">
        <div className="flex-1">{timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}</div>
        <div className="text-right ml-4 space-y-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Cards</div>
            <div className="font-display text-lg text-emerald-400">{wordsResolved}</div>
          </div>
        </div>
      </div>

      {/* Current word card in portrait style */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
        <div className="flex items-center justify-between w-56 mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">They're describing</div>
          <button
            onClick={() => setWordsHidden(!wordsHidden)}
            className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors px-2 py-0.5 rounded border border-white/10"
          >
            {wordsHidden ? 'Show' : 'Hide'}
          </button>
        </div>

        {currentWord && !wordsHidden ? (
          <div className="w-52 rounded-2xl overflow-hidden border-2 border-white/[0.08]" style={{ aspectRatio: '2.5 / 4' }}>
            <div className="h-full flex flex-col">
              {/* Top: 1pt word */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 relative"
                style={{ background: 'linear-gradient(to bottom, #161c32, #0f1424)' }}
              >
                <div className="absolute top-2.5 left-3">
                  <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400/70">1 pt</span>
                </div>
                <div className="font-display text-2xl text-white tracking-wider text-center leading-tight"
                  style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
                >
                  {currentWord.word1}
                </div>
              </div>
              <div className="relative h-0">
                <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              </div>
              {/* Bottom: 3pt phrase */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 relative"
                style={{ background: 'linear-gradient(to bottom, #1a1525, #120e1e)' }}
              >
                <div className="absolute top-2.5 left-3">
                  <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/70">3 pts</span>
                </div>
                <div className="font-display text-xl text-white tracking-wider text-center leading-tight"
                  style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
                >
                  {currentWord.word3}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-52 rounded-2xl overflow-hidden border-2 border-white/[0.08]"
            style={{ aspectRatio: '2.5 / 4', background: 'linear-gradient(to bottom, #161c32, #0f1424)' }}
          >
            <div className="h-full flex items-center justify-center">
              <div className="font-display text-xl text-gray-600 tracking-wider">
                {wordsHidden ? 'Words hidden' : '...'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="text-center text-red-300/70 text-sm font-display tracking-wider">
        Bonk when they use a big word!
      </div>

      {/* BONK button */}
      <div className="flex items-center justify-center py-2">
        <button
          onClick={() => socket.emit('bonk:alert')}
          className="bonk-btn w-36 h-36 rounded-full text-white font-display text-4xl tracking-wider
                     flex items-center justify-center"
        >
          BONK!
        </button>
      </div>

      {/* Score */}
      <div className="flex gap-6 text-center justify-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400/60">Team A</div>
          <div className="font-display text-xl text-amber-400">{scores.A}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/60">Team B</div>
          <div className="font-display text-xl text-emerald-400">{scores.B}</div>
        </div>
      </div>
    </div>
  );
}
