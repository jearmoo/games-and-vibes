import { useCompStore } from '../../compStore';
import RoundCard from './RoundCard';

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
              .map(({ entry, roundNum }) => (
                <RoundCard key={roundNum} entry={entry} roundNum={roundNum} roundHistory={roundHistory} />
              ))
          )}
        </div>
      </div>
    </div>
  );
}
