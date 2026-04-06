import { useCompStore, useLeaderboard } from '../../compStore';
import CompHistoryButton from './CompHistoryButton';

export default function CompRoundResult() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const nextRound = useCompStore((s) => s.nextRound);
  const endGame = useCompStore((s) => s.endGame);
  const leaderboard = useLeaderboard();

  const lastRound = roundHistory[roundHistory.length - 1];

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in relative">
      <div className="absolute top-4 right-4">
        <CompHistoryButton />
      </div>
      {/* Last round result */}
      {lastRound && (
        <div className="glass-card rounded-2xl p-6 border border-white/5 w-full max-w-xs text-center">
          <div className="text-amber-400 font-display text-sm tracking-wider mb-1">{lastRound.cluerName}</div>
          <div className="flex justify-center gap-4 text-xs mb-2">
            <span className="text-emerald-400">{lastRound.correct} pts</span>
            <span className="text-gray-500">{lastRound.skips} skip</span>
            <span className="text-red-400">{lastRound.bonks} bonk</span>
          </div>
          <div className={`font-display text-2xl ${lastRound.score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {lastRound.score >= 0 ? '+' : ''}
            {lastRound.score}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="w-full max-w-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Leaderboard</div>
          <div className="space-y-1">
            {leaderboard.map((p, i) => (
              <div
                key={p.name}
                className="flex items-center justify-between glass-card rounded-lg px-3 py-2 border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                  <span className="text-white text-sm">{p.name}</span>
                </div>
                <span className={`font-display text-sm ${p.score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-gray-500 text-xs text-center">Pass the phone to the next cluer</div>

      <div className="w-full max-w-xs space-y-2">
        <button
          onClick={nextRound}
          className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]"
        >
          Next Round
        </button>
        <button
          onClick={endGame}
          className="w-full py-2.5 rounded-2xl text-gray-400 border border-white/10 hover:text-white hover:border-white/20 font-display text-sm tracking-wider transition-all"
        >
          End Game
        </button>
      </div>
    </div>
  );
}
