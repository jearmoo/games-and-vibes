import { useCompStore, type CompReviewCard, type RoundEntry } from '../../compStore';

function resultIcon(card: CompReviewCard): { icon: string; color: string } {
  if (card.result === 'correct') return { icon: '\u2713', color: 'text-emerald-400' };
  if (card.result === 'bonked') return { icon: '!', color: 'text-red-400' };
  if (card.result === 'timeout') return { icon: '\u23F1', color: 'text-gray-500' };
  return { icon: '\u2022', color: 'text-gray-600' };
}

function pointColor(pts: number): string {
  if (pts >= 3) return 'text-amber-400';
  if (pts > 0) return 'text-emerald-400';
  if (pts === 0) return 'text-gray-600';
  return 'text-red-400';
}

export default function CompHistoryPanel({ onClose }: { onClose: () => void }) {
  const roundHistory = useCompStore((s) => s.roundHistory);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Round History"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl border border-white/10 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
          <div
            className="font-display text-base text-white tracking-wider"
            style={{ textShadow: '0 0 20px rgba(217,119,6,0.3)' }}
          >
            Round History
          </div>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            &times;
          </button>
        </div>

        {/* Rounds */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {roundHistory.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">No completed rounds yet</div>
          ) : (
            [...roundHistory]
              .map((entry, i) => ({ entry, roundNum: i + 1 }))
              .reverse()
              .map(({ entry, roundNum }) => <RoundCard key={roundNum} entry={entry} roundNum={roundNum} />)
          )}
        </div>
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
              <span className={`ml-auto shrink-0 text-[10px] font-display ${pointColor(card.points)}`}>
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
