import { useGameStore } from '../store';
import Timer from './Timer';

export default function GuesserScreen() {
  const timerEnd = useGameStore((s) => s.timerEnd);
  const settings = useGameStore((s) => s.settings);
  const wordsResolved = useGameStore((s) => s.wordsResolved);
  const scores = useGameStore((s) => s.scores);
  const players = useGameStore((s) => s.players);
  const cluerId = useGameStore((s) => s.cluerId);

  const cluerName = players.find((p) => p.id === cluerId)?.name ?? 'Cluer';

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      {/* Timer */}
      <div className="w-full max-w-xs">
        {timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}
      </div>

      {/* Main prompt */}
      <div className="glass-card rounded-2xl p-8 border border-white/5 w-full max-w-xs text-center">
        <div className="font-display text-2xl text-white tracking-wider mb-3">Listen and guess!</div>
        <div className="text-gray-500 text-sm">{cluerName} is describing a word using only one-syllable words</div>
      </div>

      {/* Stats */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Cards done</div>
        <div className="font-display text-2xl text-emerald-400">{wordsResolved}</div>
      </div>

      {/* Score */}
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400/60">Team A</div>
          <div className="font-display text-xl text-amber-400">{scores.A}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/60">Team B</div>
          <div className="font-display text-xl text-emerald-400">{scores.B}</div>
        </div>
      </div>

      {/* Waiting animation */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
