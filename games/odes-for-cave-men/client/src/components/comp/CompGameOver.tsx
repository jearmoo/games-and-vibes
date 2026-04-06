import { useCompStore } from '../../compStore';

export default function CompGameOver() {
  const teams = useCompStore((s) => s.teams);
  const roundHistory = useCompStore((s) => s.roundHistory);
  const resetToSetup = useCompStore((s) => s.resetToSetup);

  const winner = teams[0].score > teams[1].score ? teams[0] : teams[1].score > teams[0].score ? teams[1] : null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in overflow-auto">
      <h1 className="font-display text-3xl text-white tracking-wider">Game Over</h1>

      {winner ? (
        <div className="text-center">
          <div className="font-display text-xl text-amber-400 tracking-wider">{winner.name} Wins!</div>
          <div className="font-display text-4xl text-white mt-1">{winner.score}</div>
        </div>
      ) : (
        <div className="font-display text-xl text-gray-400 tracking-wider">It's a tie!</div>
      )}

      {/* Final scores */}
      <div className="flex gap-10 text-center">
        <div>
          <div className="text-amber-400 font-display text-sm">{teams[0].name}</div>
          <div className="font-display text-2xl text-white">{teams[0].score}</div>
        </div>
        <div>
          <div className="text-emerald-400 font-display text-sm">{teams[1].name}</div>
          <div className="font-display text-2xl text-white">{teams[1].score}</div>
        </div>
      </div>

      {/* Round history */}
      {roundHistory.length > 0 && (
        <div className="w-full max-w-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Round History</div>
          <div className="space-y-1">
            {roundHistory.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {r.teamName} — {r.cluerName}
                </span>
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
