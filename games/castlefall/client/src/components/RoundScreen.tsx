import { useState } from 'react';
import { Timer } from '@games/client-core';
import type { WinningTeam } from '@games/castlefall-shared';
import { useGameStore } from '../store';

export default function RoundScreen() {
  const publicRound = useGameStore((s) => s.publicRound);
  const privateRound = useGameStore((s) => s.privateRound);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [wordRevealed, setWordRevealed] = useState(false);

  if (!publicRound) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading round...
      </div>
    );
  }

  if (!privateRound) {
    const showSpectatorTimer = publicRound.timerSeconds > 0 && publicRound.roundStartedAt !== undefined;
    const spectatorEndTime = showSpectatorTimer ? publicRound.roundStartedAt! + publicRound.timerSeconds * 1000 : 0;
    return (
      <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Spectating this round</div>
            <div className="font-display text-3xl tracking-wider text-stone-300">WATCHING</div>
          </div>
          {showSpectatorTimer && (
            <div className="w-32 shrink-0">
              <Timer endTime={spectatorEndTime} duration={publicRound.timerSeconds} />
            </div>
          )}
        </div>
        <div className="glass-card rounded-2xl border border-stone-600/40 bg-stone-800/30 p-5 text-center">
          <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">You joined mid round</div>
          <div className="font-display text-lg tracking-wider text-stone-200">
            You'll join the next round when the host starts it.
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">The 18 words</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {publicRound.words.map((word) => (
              <div
                key={word}
                className="px-2 py-3 rounded-xl border bg-surface-raised border-white/5 text-gray-200 text-center text-sm font-medium"
              >
                {word}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full py-3 text-center text-gray-500 text-xs tracking-wider">
          Sit tight while the active teams play it out.
        </div>
      </div>
    );
  }

  const showTimer = publicRound.timerSeconds > 0 && publicRound.roundStartedAt !== undefined;
  const endTime = showTimer ? publicRound.roundStartedAt! + publicRound.timerSeconds * 1000 : 0;

  const handleEndRound = (winningTeam: WinningTeam) => {
    if (ending) return;
    setEnding(true);
    useGameStore.getState().endRound({ winningTeam });
    setTimeout(() => setEnding(false), 5000);
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-3xl mx-auto w-full">
      {/* Header: team (always hidden during round) + timer */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Your team</div>
          <div className="font-display text-3xl tracking-wider text-stone-400">TEAM ???</div>
        </div>
        {showTimer && (
          <div className="w-32 shrink-0">
            <Timer endTime={endTime} duration={publicRound.timerSeconds} />
          </div>
        )}
      </div>

      {/* Secret word — tap to show/hide */}
      <button
        type="button"
        onClick={() => setWordRevealed((v) => !v)}
        className="glass-card rounded-2xl border border-stone-600/40 bg-stone-800/30 p-5 text-center w-full hover:bg-stone-800/50 active:scale-[0.99] transition-all"
      >
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">Your secret word</div>
        {wordRevealed ? (
          <>
            <div className="font-display text-4xl tracking-wider text-white break-words">{privateRound.secretWord}</div>
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mt-2">Tap to hide</div>
          </>
        ) : (
          <div className="font-display text-2xl tracking-[0.3em] text-stone-300">TAP TO SHOW</div>
        )}
      </button>

      {/* Public word grid */}
      <div className="flex-1 min-h-0">
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">The 18 words</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {publicRound.words.map((word) => {
            const isMine = wordRevealed && word === privateRound.secretWord;
            return (
              <div
                key={word}
                className={`px-2 py-3 rounded-xl border text-center text-sm font-medium transition-all ${
                  isMine
                    ? 'bg-castle-gold/20 border-castle-gold/60 text-castle-gold-text shadow-[0_0_20px_rgba(212,168,75,0.35)]'
                    : 'bg-surface-raised border-white/5 text-gray-200'
                }`}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* End-round controls (any player) */}
      <div className="mt-2">
        {pickerOpen ? (
          <div className="space-y-2">
            <div className="text-gray-400 text-xs tracking-widest uppercase text-center">Who won?</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleEndRound(1)}
                disabled={ending}
                className="btn-team-1 py-3 rounded-xl text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                Team 1
              </button>
              <button
                onClick={() => handleEndRound('draw')}
                disabled={ending}
                className="bg-surface-raised border border-white/10 py-3 rounded-xl text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                Draw
              </button>
              <button
                onClick={() => handleEndRound(2)}
                disabled={ending}
                className="btn-team-2 py-3 rounded-xl text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                Team 2
              </button>
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              className="w-full py-2 text-gray-500 hover:text-white text-xs tracking-wider transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-4 rounded-2xl btn-primary text-white font-display text-lg tracking-wider active:scale-[0.97] transition-all"
          >
            Reveal Team Numbers
          </button>
        )}
      </div>
    </div>
  );
}
