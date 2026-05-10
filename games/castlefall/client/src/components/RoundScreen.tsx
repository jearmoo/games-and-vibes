import { useState } from 'react';
import { Timer } from '@games/client-core';
import type { WinningTeam } from '@games/castlefall-shared';
import { useGameStore, useIsHost } from '../store';

export default function RoundScreen() {
  const publicRound = useGameStore((s) => s.publicRound);
  const privateRound = useGameStore((s) => s.privateRound);
  const host = useIsHost();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  if (!publicRound || !privateRound) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading round...
      </div>
    );
  }

  const myTeam = privateRound.team;
  const teamColorClass = myTeam === 1 ? 'text-red-400' : 'text-blue-400';
  const teamBorderClass = myTeam === 1 ? 'border-red-500/40' : 'border-blue-500/40';
  const teamBgClass = myTeam === 1 ? 'bg-red-900/30' : 'bg-blue-900/30';
  const teamHighlightClass =
    myTeam === 1
      ? 'bg-red-900/40 border-red-500/60 text-red-100 shadow-[0_0_20px_rgba(185,28,28,0.4)]'
      : 'bg-blue-900/40 border-blue-500/60 text-blue-100 shadow-[0_0_20px_rgba(37,99,235,0.4)]';

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
      {/* Header: team + secret + timer */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Your team</div>
          <div className={`font-display text-3xl tracking-wider ${teamColorClass}`}>TEAM {myTeam}</div>
        </div>
        {showTimer && (
          <div className="w-32 shrink-0">
            <Timer endTime={endTime} duration={publicRound.timerSeconds} />
          </div>
        )}
      </div>

      {/* Secret word */}
      <div className={`glass-card rounded-2xl border ${teamBorderClass} ${teamBgClass} p-5 text-center`}>
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">Your secret word</div>
        <div className="font-display text-4xl tracking-wider text-white break-words">
          {privateRound.secretWord}
        </div>
      </div>

      {/* Public word grid */}
      <div className="flex-1 min-h-0">
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">The 18 words</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {publicRound.words.map((word) => {
            const isMine = word === privateRound.secretWord;
            return (
              <div
                key={word}
                className={`px-2 py-3 rounded-xl border text-center text-sm font-medium transition-all ${
                  isMine
                    ? teamHighlightClass
                    : 'bg-surface-raised border-white/5 text-gray-200'
                }`}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Host controls */}
      <div className="mt-2">
        {host ? (
          pickerOpen ? (
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
              End Round
            </button>
          )
        ) : (
          <div className="w-full py-3 text-center text-gray-500 text-xs tracking-wider">
            Host will end the round when the team is ready.
          </div>
        )}
      </div>
    </div>
  );
}
