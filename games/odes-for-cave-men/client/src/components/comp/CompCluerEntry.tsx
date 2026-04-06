import { useCompStore } from '../../compStore';

export default function CompCluerEntry() {
  const teams = useCompStore((s) => s.teams);
  const currentTeamIndex = useCompStore((s) => s.currentTeamIndex);
  const cluerName = useCompStore((s) => s.cluerName);
  const setCluerName = useCompStore((s) => s.setCluerName);
  const beginRound = useCompStore((s) => s.beginRound);

  const team = teams[currentTeamIndex];
  const teamColor = currentTeamIndex === 0 ? 'text-amber-400' : 'text-emerald-400';
  const btnClass = currentTeamIndex === 0 ? 'btn-team-a' : 'btn-team-b';

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <div className={`font-display text-lg tracking-wider ${teamColor}`}>{team.name}</div>

      <div className="text-gray-400 text-sm text-center">Who's clueing this round?</div>

      <input
        value={cluerName}
        onChange={(e) => setCluerName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && cluerName.trim() && beginRound()}
        maxLength={20}
        placeholder="Enter your name"
        autoFocus
        className="game-input w-full max-w-xs px-5 py-4 rounded-2xl text-white text-center text-lg placeholder-gray-600 font-medium"
      />

      <button
        onClick={beginRound}
        disabled={!cluerName.trim()}
        className={`${btnClass} w-full max-w-xs py-5 rounded-2xl text-white font-display text-2xl tracking-wider disabled:opacity-30 transition-all active:scale-[0.95]`}
      >
        Go!
      </button>

      <div className="text-gray-600 text-xs text-center max-w-xs">
        Pass the phone to the cluer face-down. They'll see the word when they tap Go.
      </div>
    </div>
  );
}
