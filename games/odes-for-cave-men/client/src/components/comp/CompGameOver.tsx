import { useCompStore, useLeaderboard } from '../../compStore';
import RoundCard from './RoundCard';

export default function CompGameOver() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const resetGame = useCompStore((s) => s.resetGame);
  const leaderboard = useLeaderboard();

  const winner = leaderboard.length > 0 ? leaderboard[0] : null;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col items-center p-6 pt-12 gap-6">
          {/* Winner celebration */}
          <div className="text-center">
            <div className="text-gray-500 text-[10px] uppercase tracking-[0.3em] mb-3">Game Over</div>
            {winner && (
              <>
                <div
                  className="font-display text-2xl text-amber-400 tracking-wider mb-1"
                  style={{ textShadow: '0 0 30px rgba(217,119,6,0.4)' }}
                >
                  {winner.name} Wins!
                </div>
                <div
                  className="font-display text-5xl text-white"
                  style={{ textShadow: '0 0 40px rgba(255,255,255,0.1)' }}
                >
                  {winner.score}
                </div>
              </>
            )}
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 1 && (
            <div className="w-full max-w-sm">
              <div className="text-gray-500 text-[10px] uppercase tracking-[0.2em] text-center mb-2">
                Final Standings
              </div>
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

          {/* Detailed round history */}
          {roundHistory.length > 0 && (
            <div className="w-full max-w-sm">
              <div className="text-gray-500 text-[10px] uppercase tracking-[0.2em] text-center mb-2">Round History</div>
              <div className="space-y-2">
                {roundHistory.map((entry, i) => (
                  <RoundCard key={i} entry={entry} roundNum={i + 1} roundHistory={roundHistory} />
                ))}
              </div>
            </div>
          )}

          {/* Spacer for sticky button */}
          <div className="h-16 shrink-0" />
        </div>
      </div>

      {/* Sticky Play Again button */}
      <div className="shrink-0 p-4 pt-0">
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#080c18] to-transparent pointer-events-none" />
        <button
          onClick={resetGame}
          className="relative w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider btn-primary transition-all active:scale-[0.97]"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
