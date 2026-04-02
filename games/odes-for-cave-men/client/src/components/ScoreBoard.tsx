import { useGameStore, useMyPlayer } from '../store';

export default function ScoreBoard() {
  const scores = useGameStore((s) => s.scores);
  const round = useGameStore((s) => s.round);
  const settings = useGameStore((s) => s.settings);
  const phase = useGameStore((s) => s.phase);
  const playingTeam = useGameStore((s) => s.playingTeam);
  const me = useMyPlayer();

  const teamColor = me?.team === 'A' ? 'text-amber-400' : me?.team === 'B' ? 'text-emerald-400' : 'text-gray-400';

  const centerText =
    phase === 'PLAYING' || phase === 'READY' || phase === 'REVIEW'
      ? `Team ${playingTeam}`
      : `R${round}/${settings.rounds}`;

  return (
    <div className="bg-surface-card border-b border-white/5">
      {/* Player identity strip */}
      <div className="flex items-center justify-center gap-2 px-4 py-1 text-[10px] border-b border-white/[0.03]">
        <span className={`font-semibold ${teamColor}`}>{me?.name}</span>
        {me?.team && <span className="text-gray-600">&middot;</span>}
        {me?.team && <span className={teamColor}>Team {me.team}</span>}
      </div>

      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]" />
          <span className="text-amber-400 font-display text-sm tracking-wider">A: {scores.A}</span>
        </div>
        <div className="text-gray-600 text-[10px] tracking-[0.2em] uppercase font-medium">
          {centerText}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-display text-sm tracking-wider">B: {scores.B}</span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(5,150,105,0.5)]" />
        </div>
      </div>
    </div>
  );
}
