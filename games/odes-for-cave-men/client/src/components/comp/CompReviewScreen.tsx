import { useCompStore, type CompReviewCard } from '../../compStore';

const POINT_OPTIONS = [-1, 0, 1, 3] as const;

function pointColor(pts: number): string {
  if (pts === 3) return 'text-amber-400';
  if (pts === 1) return 'text-emerald-400';
  if (pts === 0) return 'text-gray-400';
  return 'text-red-400';
}

function pointBgColor(pts: number, active: boolean): string {
  if (!active) return 'bg-surface-raised text-gray-600 border-white/5';
  if (pts === 3) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (pts === 1) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (pts === 0) return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function statusLabel(result: string, points: number): string {
  if (points === 3) return 'Got It (+3)';
  if (points === 1) return 'Got It (+1)';
  if (points === 0) return 'Thrown Out';
  if (result === 'bonked') return 'Bonked';
  if (result === 'skipped') return 'Skipped';
  return 'Bonked';
}

function statusColor(points: number): string {
  if (points === 3) return 'text-amber-400/60';
  if (points === 1) return 'text-emerald-400/60';
  if (points === 0) return 'text-gray-500';
  return 'text-red-400/60';
}

function originalStatusLabel(card: CompReviewCard): string {
  if (card.result === 'correct') return card.originalPoints === 3 ? 'Got It (+3)' : 'Got It (+1)';
  if (card.result === 'bonked') return 'Bonked';
  if (card.result === 'timeout') return 'Time Up';
  return 'Skipped';
}

export default function CompReviewScreen() {
  const roundCards = useCompStore((s) => s.roundCards);
  const cluerName = useCompStore((s) => s.cluerName);
  const adjustCardPoints = useCompStore((s) => s.adjustCardPoints);
  const lockInReview = useCompStore((s) => s.lockInReview);

  const totalPoints = roundCards.reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="text-gray-500 text-xs tracking-wider uppercase mb-1">Turn Review</div>
        <div className="font-display text-lg tracking-wider text-amber-400">{cluerName}</div>
      </div>

      {/* Score summary */}
      <div className="flex items-center justify-center">
        <div className={`font-display text-sm ${totalPoints >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          Turn: {totalPoints >= 0 ? '+' : ''}
          {totalPoints}
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-auto space-y-2">
        {roundCards.map((card, i) => {
          const changed = card.points !== card.originalPoints;
          const origLabel = originalStatusLabel(card);
          const currLabel = statusLabel(card.result, card.points);

          return (
            <div key={i} className="glass-card rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-display text-sm tracking-wider truncate">{card.word1}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-white font-display text-sm tracking-wider truncate">{card.word3}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider mt-0.5 flex items-center gap-1">
                    {changed ? (
                      <>
                        <span className="text-gray-600 line-through">{origLabel}</span>
                        <span className="text-gray-600">&rarr;</span>
                        <span className={statusColor(card.points)}>{currLabel}</span>
                      </>
                    ) : (
                      <span className={statusColor(card.points)}>{origLabel}</span>
                    )}
                  </div>
                </div>
                <div className={`font-display text-lg ml-3 ${pointColor(card.points)}`}>
                  {card.points >= 0 ? '+' : ''}
                  {card.points}
                </div>
              </div>

              <div className="flex gap-1.5">
                {POINT_OPTIONS.map((pts) => (
                  <button
                    key={pts}
                    onClick={() => adjustCardPoints(i, pts)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-display tracking-wider border transition-all ${pointBgColor(pts, card.points === pts)}`}
                  >
                    {pts >= 0 ? '+' : ''}
                    {pts}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {roundCards.length === 0 && <div className="text-center text-gray-600 py-8">No cards were played</div>}
      </div>

      {/* Lock in button */}
      <button
        onClick={lockInReview}
        className="w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider btn-primary transition-all active:scale-[0.97]"
      >
        Lock In
      </button>
    </div>
  );
}
