import { useGameStore, useTeamName } from '../store';
import type { CaveRoundArchiveEntry, CaveTurnData, WordCard } from '@games/odes-for-cave-men-shared';

export default function HistoryPanel({ onClose }: { onClose: () => void }) {
  const roundHistory = useGameStore((s) => s.roundHistory);

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

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {roundHistory.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">No completed turns yet</div>
          ) : (
            [...roundHistory].reverse().map((entry) => <RoundCard key={entry.round} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}

function RoundCard({ entry }: { entry: CaveRoundArchiveEntry }) {
  const scoreA = entry.teams.A?.score ?? 0;
  const scoreB = entry.teams.B?.score ?? 0;
  const winA = scoreA > scoreB;
  const winB = scoreB > scoreA;

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-surface-card">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-white/[0.02]">
        <span className="font-display text-xs text-gray-200 tracking-wider uppercase">Round {entry.round}</span>
        <div className="flex items-center gap-2.5 font-display text-xs tracking-wider">
          <span className={winA ? 'text-amber-400' : 'text-amber-400/40'}>
            {scoreA >= 0 ? '+' : ''}
            {scoreA}
          </span>
          <span className="text-gray-600">|</span>
          <span className={winB ? 'text-emerald-400' : 'text-emerald-400/40'}>
            {scoreB >= 0 ? '+' : ''}
            {scoreB}
          </span>
        </div>
      </div>

      <div className="flex divide-x divide-white/5">
        {entry.teams.A ? <TeamColumn team="A" data={entry.teams.A} /> : <EmptyColumn team="A" />}
        {entry.teams.B ? <TeamColumn team="B" data={entry.teams.B} /> : <EmptyColumn team="B" />}
      </div>
    </div>
  );
}

function resultIcon(card: WordCard): { icon: string; color: string } {
  if (card.result === 'correct') return { icon: '\u2713', color: 'text-emerald-400' };
  if (card.result === 'bonked') return { icon: '!', color: 'text-red-400' };
  if (card.result === 'timeout') return { icon: '\u23F1', color: 'text-gray-500' };
  return { icon: '\u2022', color: 'text-gray-600' };
}

function TeamColumn({ team, data }: { team: 'A' | 'B'; data: CaveTurnData }) {
  const glow = team === 'A' ? 'text-amber-400' : 'text-emerald-400';
  const teamName = useTeamName(team);

  return (
    <div className="flex-1 p-3 min-w-0 space-y-2">
      <div>
        <div className={`text-[9px] uppercase tracking-widest font-bold ${glow}`}>{teamName}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 truncate">
          <span className="text-gray-400">{data.cluerName}</span> clueing
        </div>
      </div>

      <div className="space-y-0.5">
        {data.words.map((card, i) => {
          const { icon, color } = resultIcon(card);
          const isCorrect = card.result === 'correct';
          return (
            <div key={i} className="flex items-center gap-1.5 text-[11px] leading-tight">
              <span className={`w-3 text-center shrink-0 ${color}`}>{icon}</span>
              <span
                className={`truncate ${isCorrect ? 'text-gray-200' : 'text-gray-500 line-through decoration-gray-800'}`}
              >
                {card.word1}
              </span>
              <span
                className={`ml-auto shrink-0 text-[10px] font-display ${card.points > 0 ? glow : card.points < 0 ? 'text-red-400' : 'text-gray-600'}`}
              >
                {card.points >= 0 ? '+' : ''}
                {card.points}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] pt-1.5 border-t border-white/[0.04]">
        <span className="text-emerald-400 font-medium">
          {data.words.filter((w) => w.result === 'correct').length} correct
        </span>
        <span className="text-gray-600">&middot;</span>
        <span className={`font-display tracking-wider ${data.score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {data.score >= 0 ? '+' : ''}
          {data.score}
        </span>
      </div>
    </div>
  );
}

function EmptyColumn({ team }: { team: 'A' | 'B' }) {
  const teamName = useTeamName(team);
  const glow = team === 'A' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="flex-1 p-3 min-w-0">
      <div className={`text-[9px] uppercase tracking-widest font-bold ${glow}`}>{teamName}</div>
      <div className="text-[10px] text-gray-500 mt-2 italic">In progress...</div>
    </div>
  );
}
