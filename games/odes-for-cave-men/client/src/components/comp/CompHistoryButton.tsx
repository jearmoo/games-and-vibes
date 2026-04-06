import { useState } from 'react';
import { useCompStore } from '../../compStore';
import CompHistoryPanel from './CompHistoryPanel';

export default function CompHistoryButton() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const [showHistory, setShowHistory] = useState(false);

  if (roundHistory.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowHistory(true)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-400 hover:bg-white/5 transition-colors"
        title="Round History"
        aria-label="Round History"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12,7 12,12 15.5,14" />
        </svg>
      </button>
      {showHistory && <CompHistoryPanel onClose={() => setShowHistory(false)} />}
    </>
  );
}
