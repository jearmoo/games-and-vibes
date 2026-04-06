import { useState } from 'react';
import { useCompStore } from '../../compStore';

const TIMER_OPTIONS = [60, 90, 120, 180];

export default function CompSetupScreen() {
  const teams = useCompStore((s) => s.teams);
  const timerDuration = useCompStore((s) => s.timerDuration);
  const setTeamName = useCompStore((s) => s.setTeamName);
  const setTimerDuration = useCompStore((s) => s.setTimerDuration);
  const startGame = useCompStore((s) => s.startGame);
  const [startingTeam, setStartingTeam] = useState(0);
  const [loading, setLoading] = useState(false);

  const canStart = teams[0].name.trim() && teams[1].name.trim();

  const handleStart = async () => {
    if (!canStart || loading) return;
    setLoading(true);
    await startGame(startingTeam);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <div className="text-center">
        <h1 className="font-display text-3xl text-white tracking-wider mb-1">Pass the Phone</h1>
        <p className="text-gray-500 text-xs tracking-wider">One device. Small words. Big fun.</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <div className="space-y-2">
          <input
            value={teams[0].name}
            onChange={(e) => setTeamName(0, e.target.value)}
            maxLength={20}
            placeholder="Team 1"
            className="game-input w-full px-4 py-3 rounded-xl text-amber-400 text-center font-display tracking-wider placeholder-gray-600"
          />
          <input
            value={teams[1].name}
            onChange={(e) => setTeamName(1, e.target.value)}
            maxLength={20}
            placeholder="Team 2"
            className="game-input w-full px-4 py-3 rounded-xl text-emerald-400 text-center font-display tracking-wider placeholder-gray-600"
          />
        </div>

        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Timer</div>
          <div className="flex justify-center gap-2">
            {TIMER_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTimerDuration(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-wider border transition-all ${
                  timerDuration === s
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-surface-raised text-gray-500 border-white/5'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Starting team</div>
          <div className="flex justify-center gap-2">
            {[0, 1].map((i) => (
              <button
                key={i}
                onClick={() => setStartingTeam(i)}
                className={`px-4 py-1.5 rounded-lg text-xs font-display tracking-wider border transition-all ${
                  startingTeam === i
                    ? i === 0
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-surface-raised text-gray-500 border-white/5'
                }`}
              >
                {teams[i].name || `Team ${i + 1}`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart || loading}
          className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 transition-all active:scale-[0.97]"
        >
          {loading ? 'Loading...' : 'Start Game'}
        </button>
      </div>
    </div>
  );
}
