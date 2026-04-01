import { useGameStore, type RoundArchiveEntry, type TeamRoundData } from '../store';

export default function HistoryPanel({ onClose }: { onClose: () => void }) {
  const roundHistory = useGameStore(s => s.roundHistory);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Round History" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-t-2xl sm:rounded-2xl border border-white/10 w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
          <div
            className="font-display text-base text-white tracking-wider"
            style={{ textShadow: '0 0 20px rgba(99,102,241,0.3)' }}
          >
            Round History
          </div>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {roundHistory.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-8">No completed rounds yet</div>
          ) : (
            [...roundHistory].reverse().map(entry => (
              <RoundCard key={entry.round} entry={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RoundCard({ entry }: { entry: RoundArchiveEntry }) {
  const ptsA = entry.teams.A.turnScore.points;
  const ptsB = entry.teams.B.turnScore.points;
  const winA = ptsA > ptsB;
  const winB = ptsB > ptsA;

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-surface-card">
      {/* Round header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-white/[0.02]">
        <span className="font-display text-xs text-gray-300 tracking-wider uppercase">Round {entry.round}</span>
        <div className="flex items-center gap-2.5 font-display text-xs tracking-wider">
          <span className={winA ? 'text-team-a-glow' : 'text-team-a-glow/40'}>
            {ptsA >= 0 ? '+' : ''}{ptsA}
          </span>
          <span className="text-gray-700">|</span>
          <span className={winB ? 'text-team-b-glow' : 'text-team-b-glow/40'}>
            {ptsB >= 0 ? '+' : ''}{ptsB}
          </span>
        </div>
      </div>

      {/* Two team columns */}
      <div className="flex divide-x divide-white/5">
        <TeamColumn team="A" data={entry.teams.A} />
        <TeamColumn team="B" data={entry.teams.B} />
      </div>
    </div>
  );
}

function TeamColumn({ team, data }: { team: 'A' | 'B'; data: TeamRoundData }) {
  const glow = team === 'A' ? 'text-team-a-glow' : 'text-team-b-glow';

  return (
    <div className="flex-1 p-3 min-w-0 space-y-2">
      {/* Team + clue-giver */}
      <div>
        <div className={`text-[9px] uppercase tracking-widest font-bold ${glow}`}>Team {team}</div>
        <div className="text-[10px] text-gray-600 mt-0.5 truncate">
          <span className="text-gray-500">{data.clueGiverName}</span> cluing
        </div>
      </div>

      {/* Word results */}
      <div className="space-y-0.5">
        {data.cards.map((card, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] leading-tight">
            <span className={`w-3 text-center shrink-0 ${card.result === 'correct' ? 'text-emerald-400' : 'text-gray-700'}`}>
              {card.result === 'correct' ? '\u2713' : '\u2022'}
            </span>
            <span className={`truncate ${card.result === 'correct' ? 'text-gray-300' : 'text-gray-600 line-through decoration-gray-800'}`}>
              {card.word}
            </span>
          </div>
        ))}
      </div>

      {/* Taboo words */}
      {data.tabooWords.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-gray-700 mb-1">
            Taboo <span className="normal-case text-gray-600">by {data.tabooMasterName}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {data.tabooWords.map(word => {
              const buzzes = data.tabooBuzzes[word] || 0;
              return (
                <span
                  key={word}
                  className={`inline-block px-1.5 py-px rounded text-[10px] leading-snug ${
                    buzzes > 0
                      ? 'bg-team-b/20 text-team-b-glow border border-team-b/25'
                      : 'bg-white/[0.03] text-gray-600 border border-white/[0.04]'
                  }`}
                >
                  {word}{buzzes > 0 ? ` \u00d7${buzzes}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Score summary */}
      <div className="flex items-center gap-1.5 text-[10px] pt-1.5 border-t border-white/[0.04]">
        <span className="text-emerald-400 font-medium">{data.turnScore.correct} correct</span>
        {data.turnScore.buzzes > 0 && (
          <>
            <span className="text-gray-700">&middot;</span>
            <span className="text-team-b-glow">{data.turnScore.buzzes} buzz</span>
          </>
        )}
        <span className="text-gray-700">&middot;</span>
        <span className={`font-display tracking-wider ${data.turnScore.points >= 0 ? 'text-emerald-400' : 'text-team-b-glow'}`}>
          {data.turnScore.points >= 0 ? '+' : ''}{data.turnScore.points}
        </span>
      </div>
    </div>
  );
}
