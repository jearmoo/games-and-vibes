import { createPortal } from 'react-dom';
import { useCompStore } from '../../compStore';

const TIMER_OPTIONS = [60, 90, 120, 180];

export default function CompSettingsModal({ onClose }: { onClose: () => void }) {
  const timerDuration = useCompStore((s) => s.timerDuration);
  const phase = useCompStore((s) => s.phase);
  const setTimerDuration = useCompStore((s) => s.setTimerDuration);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl border border-white/10 max-w-sm w-full overflow-auto p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-base"
        >
          &times;
        </button>

        <div
          className="font-display text-lg text-white tracking-wider mb-5"
          style={{ textShadow: '0 0 20px rgba(217, 119, 6, 0.3)' }}
        >
          Settings
        </div>

        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Timer per turn</div>
          <div className="flex justify-center gap-2">
            {TIMER_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTimerDuration(s)}
                className={`px-4 py-2 rounded-lg text-sm font-display tracking-wider border transition-all ${
                  timerDuration === s
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-surface-raised text-gray-500 border-white/5 hover:text-white'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
          {phase === 'playing' && <div className="text-gray-600 text-xs text-center mt-2">Takes effect next round</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
