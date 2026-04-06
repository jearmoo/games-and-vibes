import { useCompStore, useLeaderboard, type CompReviewCard, type RoundEntry } from '../../compStore';

function resultIcon(card: CompReviewCard): { icon: string; color: string } {
  if (card.result === 'correct') return { icon: '\u2713', color: 'text-emerald-400' };
  if (card.result === 'bonked') return { icon: '!', color: 'text-red-400' };
  if (card.result === 'timeout') return { icon: '\u23F1', color: 'text-gray-500' };
  return { icon: '\u2022', color: 'text-gray-600' };
}

function cardPointColor(pts: number): string {
  if (pts >= 3) return 'text-amber-400';
  if (pts > 0) return 'text-emerald-400';
  if (pts === 0) return 'text-gray-600';
  return 'text-red-400';
}

export default function CompGameOver() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const resetToSetup = useCompStore((s) => s.resetToSetup);
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
                  <RoundCard key={i} entry={entry} roundNum={i + 1} />
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
          onClick={resetToSetup}
          className="relative w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider btn-primary transition-all active:scale-[0.97]"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

function RoundCard({ entry, roundNum }: { entry: RoundEntry; roundNum: number }) {
  const isPositive = entry.score >= 0;

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-surface-card">
      {/* Round header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs text-gray-200 tracking-wider uppercase">Round {roundNum}</span>
          <span className="text-gray-600 text-[10px]">&middot;</span>
          <span className="text-amber-400 text-[11px] font-medium truncate">{entry.cluerName}</span>
        </div>
        <div
          className={`font-display text-sm tracking-wider ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}
          style={{
            textShadow: isPositive ? '0 0 12px rgba(16,185,129,0.3)' : '0 0 12px rgba(239,68,68,0.3)',
          }}
        >
          {isPositive ? '+' : ''}
          {entry.score}
        </div>
      </div>

      {/* Card list */}
      <div className="px-3.5 py-2 space-y-0.5">
        {entry.cards.map((card, i) => {
          const { icon, color } = resultIcon(card);
          const isCorrect = card.result === 'correct';
          const wasAdjusted = card.points !== card.originalPoints;

          return (
            <div key={i} className="flex items-center gap-1.5 text-[11px] leading-tight py-0.5">
              <span className={`w-3.5 text-center shrink-0 ${color}`}>{icon}</span>
              <span
                className={`truncate ${isCorrect ? 'text-gray-200' : 'text-gray-500 line-through decoration-gray-800'}`}
              >
                {card.word1}
              </span>
              {wasAdjusted && (
                <span className="text-gray-700 text-[9px] line-through shrink-0">
                  {card.originalPoints >= 0 ? '+' : ''}
                  {card.originalPoints}
                </span>
              )}
              <span className={`ml-auto shrink-0 text-[10px] font-display ${cardPointColor(card.points)}`}>
                {card.points >= 0 ? '+' : ''}
                {card.points}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="flex items-center gap-2 px-3.5 py-2 border-t border-white/[0.04] text-[10px]">
        <span className="text-emerald-400 font-medium">
          {entry.cards.filter((c) => c.result === 'correct').length} correct
        </span>
        {entry.skips > 0 && (
          <>
            <span className="text-gray-700">&middot;</span>
            <span className="text-gray-500">{entry.skips} skip</span>
          </>
        )}
        {entry.bonks > 0 && (
          <>
            <span className="text-gray-700">&middot;</span>
            <span className="text-red-400/70">{entry.bonks} bonk</span>
          </>
        )}
      </div>
    </div>
  );
}
