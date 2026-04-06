import { useTeamPlayers, useTeamName } from '../store';
import { socket } from '../socket';
import type { TeamId } from '@games/odes-for-cave-men-shared';

export default function TeamSelectScreen() {
  const teamAPlayers = useTeamPlayers('A');
  const teamBPlayers = useTeamPlayers('B');

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      <div className="text-center">
        <h2 className="font-display text-2xl tracking-wider text-white mb-2">Game in Progress</h2>
        <p className="text-gray-400 text-sm">Pick a team to jump in</p>
      </div>

      <div className="flex gap-4 w-full max-w-md">
        <TeamButton team="A" playerCount={teamAPlayers.length} />
        <TeamButton team="B" playerCount={teamBPlayers.length} />
      </div>
    </div>
  );
}

function TeamButton({ team, playerCount }: { team: TeamId; playerCount: number }) {
  const colorClass = team === 'A' ? 'text-amber-400 border-amber-500/40' : 'text-emerald-400 border-emerald-500/40';
  const glowClass =
    team === 'A' ? 'hover:shadow-[0_0_30px_rgba(217,119,6,0.3)]' : 'hover:shadow-[0_0_30px_rgba(5,150,105,0.3)]';
  const teamName = useTeamName(team);

  return (
    <button
      onClick={() => socket.emit('team:join', { team })}
      className={`flex-1 glass-card border ${colorClass} ${glowClass} rounded-xl p-6 text-center transition-all duration-150 active:scale-[0.97]`}
    >
      <div className={`font-display text-xl tracking-wider ${colorClass} mb-2`}>{teamName}</div>
      <div className="text-gray-400 text-xs">
        {playerCount} player{playerCount !== 1 ? 's' : ''}
      </div>
    </button>
  );
}
