import { useState } from 'react';
import { useCompStore } from '../../compStore';

const TIMER_OPTIONS = [60, 90, 120, 180];

export default function CompSetupScreen() {
  const timerDuration = useCompStore((s) => s.timerDuration);
  const setTimerDuration = useCompStore((s) => s.setTimerDuration);
  const startGame = useCompStore((s) => s.startGame);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    await startGame();
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      <div className="text-center">
        <h1 className="font-display text-3xl text-white tracking-wider mb-1">Pass the Phone</h1>
        <p className="text-gray-500 text-xs tracking-wider">One device. Small words. Big fun.</p>
      </div>

      <div className="w-full max-w-xs space-y-6">
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
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 transition-all active:scale-[0.97]"
        >
          {loading ? 'Loading...' : 'Start Game'}
        </button>
      </div>
    </div>
  );
}
