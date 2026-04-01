import { useState } from 'react';
import { useGameStore, useLiveScore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';

export default function ClueGiverScreen() {
  const cards = useGameStore(s => s.cards);
  const timerEnd = useGameStore(s => s.timerEnd);
  const cluingTeam = useGameStore(s => s.cluingTeam);
  const settings = useGameStore(s => s.settings);

  const { buzzedWords, totalBuzzes, liveScore } = useLiveScore();
  const timerNotStarted = timerEnd === null;
  const [beginning, setBeginning] = useState(false);

  // Before timer starts: don't show words yet
  if (timerNotStarted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2">
            Team {cluingTeam}'s turn
          </div>
          <div className="font-display text-2xl text-white tracking-wider">
            You're the Clue-Giver
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 max-w-xs border border-white/5 text-center">
          <p className="text-gray-400 text-sm leading-relaxed">
            You have {cards.length} words to describe.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Words and the {settings.timerSeconds}s timer will appear when you press begin.
          </p>
        </div>

        <button onClick={() => { setBeginning(true); socket.emit('clue:begin'); }}
          disabled={beginning}
          className="btn-success w-full max-w-sm py-5 rounded-2xl text-white font-display text-xl
                     tracking-wider transition-all active:scale-[0.97] disabled:opacity-50">
          {beginning ? 'Starting...' : 'Begin Cluing'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Timer + live score */}
      <div className="flex items-start justify-between">
        <div className="flex-1">{timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}</div>
        <div className="text-right ml-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Score</div>
          <div className={`font-display text-2xl ${liveScore >= 0 ? 'text-emerald-400' : 'text-team-b-glow'}`}>
            {liveScore >= 0 ? '+' : ''}{liveScore}
          </div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 text-center">
        Describe these words — any order
      </div>

      {/* 5 word cards */}
      <div className="flex-1 overflow-auto space-y-2">
        {cards.map((card, i) => {
          const isFirstPending = card.result === null && !cards.slice(0, i).some(c => c.result === null);
          return (
          <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            card.result === 'correct'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : isFirstPending
                ? 'glass-card border-accent/30 shadow-[0_0_12px_rgba(251,191,36,0.1)]'
                : 'glass-card border-white/5'
          }`}>
            <div className="flex items-center gap-3">
              {card.result === 'correct' && <span className="text-emerald-400 font-display">✓</span>}
              <span className={`font-display text-xl tracking-wider ${
                card.result === 'correct' ? 'text-emerald-300' : 'text-white'
              }`} style={card.result !== 'correct' ? { textShadow: '0 0 20px rgba(251,191,36,0.2)' } : {}}>
                {card.word}
              </span>
              {card.result === 'correct' && (
                <span className="text-emerald-400/60 text-sm font-display">+3</span>
              )}
            </div>
            {card.result === 'correct' ? (
              <button onClick={() => socket.emit('clue:undo', { cardIndex: i })}
                className="text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-surface-raised">
                Undo
              </button>
            ) : (
              <button onClick={() => socket.emit('clue:got-it', { cardIndex: i })}
                className="btn-success px-4 py-2 rounded-xl text-white font-display text-sm tracking-wider transition-all active:scale-[0.95]">
                Got It!
              </button>
            )}
          </div>
          );
        })}
      </div>

      {/* Buzzed taboo words */}
      {buzzedWords.length > 0 && (
        <div className="glass-card rounded-xl p-3 border border-team-b/20">
          <div className="text-[10px] uppercase tracking-wider text-team-b-glow/60 mb-1.5">
            Buzzed taboo words (-{totalBuzzes})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {buzzedWords.map(([word, count]) => (
              <span key={word} className="px-2.5 py-1 bg-team-b/15 text-team-b-glow rounded-lg text-sm border border-team-b/20">
                {word}{count > 1 && <span className="text-[10px] ml-1">×{count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* End Turn Early */}
      <button onClick={() => socket.emit('clue:end-turn')}
        className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-500 font-display text-xs
                   tracking-wider hover:border-gray-500 hover:text-gray-300 hover:bg-white/[0.03]
                   transition-all active:scale-[0.97]">
        End Turn
      </button>
    </div>
  );
}
