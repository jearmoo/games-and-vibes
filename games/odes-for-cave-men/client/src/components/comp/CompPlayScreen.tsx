import { useEffect } from 'react';
import { useCompStore } from '../../compStore';

export default function CompPlayScreen() {
  const currentWord = useCompStore((s) => s.currentWord);
  const timerEnd = useCompStore((s) => s.timerEnd);
  const roundCorrect = useCompStore((s) => s.roundCorrect);
  const roundSkips = useCompStore((s) => s.roundSkips);
  const roundBonks = useCompStore((s) => s.roundBonks);
  const teams = useCompStore((s) => s.teams);
  const currentTeamIndex = useCompStore((s) => s.currentTeamIndex);
  const markCorrect = useCompStore((s) => s.markCorrect);
  const markSkip = useCompStore((s) => s.markSkip);
  const markBonk = useCompStore((s) => s.markBonk);
  const endRound = useCompStore((s) => s.endRound);

  const teamColor = currentTeamIndex === 0 ? 'text-amber-400' : 'text-emerald-400';
  const score = roundCorrect - roundSkips - roundBonks;

  // Timer countdown
  const remaining = timerEnd ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)) : 0;

  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => {
      if (Date.now() >= timerEnd) {
        endRound();
      }
    }, 200);
    return () => clearInterval(id);
  }, [timerEnd, endRound]);

  return (
    <div className="h-full flex flex-col p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`font-display text-sm tracking-wider ${teamColor}`}>{teams[currentTeamIndex].name}</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{roundCorrect} pts</span>
          <span className="text-gray-500">{roundSkips} skip</span>
          <span className="text-red-400">{roundBonks} bonk</span>
        </div>
        <div
          className={`font-display text-lg tabular-nums ${remaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}
        >
          {remaining}s
        </div>
      </div>

      {/* Word card */}
      <div className="flex-1 flex items-center justify-center">
        {currentWord ? (
          <div className="glass-card rounded-3xl p-8 border border-white/10 w-full max-w-sm text-center">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">Describe with small words</div>
            <div
              className="font-display text-3xl text-white tracking-wider mb-1"
              style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}
            >
              {currentWord.word1}
            </div>
            <div className="text-gray-600 text-sm">{currentWord.word3}</div>
          </div>
        ) : (
          <div className="text-gray-500 animate-pulse">Loading word...</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <button
          onClick={markSkip}
          className="py-4 rounded-2xl bg-surface-raised border border-white/5 text-gray-400 font-display text-sm tracking-wider transition-all active:scale-[0.95]"
        >
          Skip
        </button>
        <button
          onClick={() => markCorrect(1)}
          className="py-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-display text-lg tracking-wider transition-all active:scale-[0.95]"
        >
          +1
        </button>
        <button
          onClick={() => markCorrect(3)}
          className="py-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-display text-lg tracking-wider transition-all active:scale-[0.95]"
        >
          +3
        </button>
      </div>
      <button
        onClick={markBonk}
        className="mt-2 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-display text-sm tracking-wider transition-all active:scale-[0.95]"
      >
        Bonk!
      </button>
    </div>
  );
}
