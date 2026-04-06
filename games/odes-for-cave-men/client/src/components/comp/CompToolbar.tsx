import { useState } from 'react';
import { useCompStore } from '../../compStore';
import { HelpButton } from '../HelpModal';
import CompHistoryPanel from './CompHistoryPanel';

export default function CompToolbar() {
  const roundHistory = useCompStore((s) => s.roundHistory);
  const [showHistory, setShowHistory] = useState(false);
  const hasHistory = roundHistory.length > 0;

  return (
    <>
      <div className="fixed top-3 left-3 right-3 z-40 flex items-center justify-between pointer-events-none">
        {/* Left: history button */}
        <div className="pointer-events-auto">
          {hasHistory ? (
            <button
              onClick={() => setShowHistory(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-gray-400 hover:text-amber-400 transition-colors"
              title="Round History"
              aria-label="Round History"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <polyline points="12,7 12,12 15.5,14" />
              </svg>
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Right: help button */}
        <div className="pointer-events-auto">
          <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-amber-400 transition-colors font-semibold" />
        </div>
      </div>

      {showHistory && <CompHistoryPanel onClose={() => setShowHistory(false)} />}
    </>
  );
}
