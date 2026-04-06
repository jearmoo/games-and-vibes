import { useGameStore, useIsHost } from '../store';
import { socket } from '../socket';

export default function ScoringScreen() {
  const scores = useGameStore((s) => s.scores);
  const round = useGameStore((s) => s.round);
  const settings = useGameStore((s) => s.settings);
  const host = useIsHost();

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <h2 className="font-display text-2xl text-white tracking-wider">Round {round} Complete</h2>

      {/* Overall scores */}
      <div className="flex gap-10 text-center animate-score-pop">
        <div>
          <div className="text-amber-400 font-display text-sm tracking-wider">Team A</div>
          <div
            className="font-display text-4xl text-white mt-1"
            style={{ textShadow: '0 0 20px rgba(217, 119, 6, 0.3)' }}
          >
            {scores.A}
          </div>
        </div>
        <div className="text-gray-700 font-display text-2xl self-end mb-1">vs</div>
        <div>
          <div className="text-emerald-400 font-display text-sm tracking-wider">Team B</div>
          <div
            className="font-display text-4xl text-white mt-1"
            style={{ textShadow: '0 0 20px rgba(5, 150, 105, 0.3)' }}
          >
            {scores.B}
          </div>
        </div>
      </div>

      <div className="text-gray-500 text-xs tracking-wider uppercase">
        {settings.rounds !== null && round >= settings.rounds ? 'Final round' : `Round ${round + 1} next`}
      </div>

      {host ? (
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => socket.emit('game:next-round')}
            className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]"
          >
            Next Round
          </button>
          <button
            onClick={() => socket.emit('game:end')}
            className="w-full py-3 rounded-2xl text-gray-400 border border-white/10 hover:text-white hover:border-white/20 font-display text-sm tracking-wider transition-all active:scale-[0.97]"
          >
            End Game
          </button>
        </div>
      ) : (
        <div className="text-gray-600 text-xs tracking-wider animate-pulse-slow">Waiting for host to continue...</div>
      )}
    </div>
  );
}
