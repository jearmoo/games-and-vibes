import { useState } from 'react';
import { ConfirmModal } from '@games/client-core';
import { useCompStore } from '../../compStore';
import { HelpButton } from '../HelpModal';
import CompHistoryPanel from './CompHistoryPanel';
import CompSettingsModal from './CompSettingsModal';

function navigateHome() {
  useCompStore.getState().resetToSetup();
  window.history.pushState(null, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function CompToolbar() {
  const phase = useCompStore((s) => s.phase);
  const roundHistory = useCompStore((s) => s.roundHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

        {/* Right: settings + help */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {phase !== 'setup' && (
            <button
              onClick={() => setShowSettings(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-gray-400 hover:text-amber-400 transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          )}
          <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-amber-400 transition-colors font-semibold" />
        </div>
      </div>

      {showHistory && <CompHistoryPanel onClose={() => setShowHistory(false)} />}
      {showSettings && <CompSettingsModal onClose={() => setShowSettings(false)} />}
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
