import { useState } from 'react';
import { ConfirmModal } from '@games/client-core';
import { useCompStore } from '../../compStore';
import { HelpButton } from '../HelpModal';
import CompHistoryPanel from './CompHistoryPanel';

function navigateHome() {
  useCompStore.getState().resetToSetup();
  window.history.pushState(null, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function CompToolbar() {
  const phase = useCompStore((s) => s.phase);
  const roundHistory = useCompStore((s) => s.roundHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const hasHistory = roundHistory.length > 0;

  const handleLeave = () => {
    if (phase !== 'setup') {
      setConfirming(true);
    } else {
      navigateHome();
    }
  };

  return (
    <>
      <div className="fixed top-3 left-3 right-3 z-40 flex items-center justify-between pointer-events-none">
        {/* Left: leave + history */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={handleLeave}
            className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-gray-400 hover:text-amber-400 transition-colors"
            title="Leave"
            aria-label="Leave"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          {hasHistory && (
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
          )}
        </div>

        {/* Right: help button */}
        <div className="pointer-events-auto">
          <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-amber-400 transition-colors font-semibold" />
        </div>
      </div>

      {showHistory && <CompHistoryPanel onClose={() => setShowHistory(false)} />}
      {confirming && (
        <ConfirmModal
          title="Leave Game?"
          message="Your current game progress will be lost."
          confirmLabel="Leave"
          cancelLabel="Stay"
          confirmClass="btn-primary"
          onConfirm={() => {
            setConfirming(false);
            navigateHome();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
