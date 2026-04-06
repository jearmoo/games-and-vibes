import { useCompStore, useLeaderboard } from '../../compStore';

export default function CompGameOver() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const resetToSetup = useCompStore((s) => s.resetToSetup);
  const leaderboard = useLeaderboard();

  const winner = leaderboard.length > 0 ? leaderboard[0] : null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in overflow-auto">
      <h1 className="font-display text-3xl text-white tracking-wider">Game Over</h1>

      {winner && (
        <div className="text-center">
          <div className="font-display text-xl text-amber-400 tracking-wider">{winner.name} Wins!</div>
          <div className="font-display text-4xl text-white mt-1">{winner.score}</div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 1 && (
        <div className="w-full max-w-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Final Standings</div>
          <div className="space-y-1">
            {leaderboard.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  i === 0 ? 'glass-card border border-amber-500/20' : 'glass-card border border-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                  <span className={i === 0 ? 'text-amber-400 font-semibold' : 'text-white'}>{p.name}</span>
                </div>
                <span className={`font-display text-sm ${p.score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round history */}
      {roundHistory.length > 0 && (
        <div className="w-full max-w-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Round History</div>
          <div className="space-y-1">
            {roundHistory.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{r.cluerName}</span>
                <span className={r.score >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {r.score >= 0 ? '+' : ''}
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={resetToSetup}
        className="btn-primary w-full max-w-xs py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]"
      >
        Play Again
      </button>
    </div>
  );
}
