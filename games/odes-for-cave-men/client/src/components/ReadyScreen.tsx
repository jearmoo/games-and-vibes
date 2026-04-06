import { useGameStore, useTeamPlayers, useIsHost } from '../store';
import { socket } from '../socket';

export default function ReadyScreen() {
  const playerId = useGameStore((s) => s.playerId);
  const cluerId = useGameStore((s) => s.cluerId);
  const cluerName = useGameStore((s) => s.cluerName);
  const playingTeam = useGameStore((s) => s.playingTeam);
  const round = useGameStore((s) => s.round);
  const players = useGameStore((s) => s.players);
  const teamPlayers = useTeamPlayers(playingTeam ?? 'A');
  const isHost = useIsHost();

  const isCluer = playerId === cluerId;
  const cluerPlayer = players.find((p) => p.id === cluerId);
  const cluerDisconnected = cluerPlayer ? !cluerPlayer.connected : false;
  const canStart = isCluer || (isHost && cluerDisconnected);
  const isOnPlayingTeam = teamPlayers.some((p) => p.id === playerId);
  const teamColor = playingTeam === 'A' ? 'text-amber-400' : 'text-emerald-400';
  const btnClass = playingTeam === 'A' ? 'btn-team-a' : 'btn-team-b';
  const chipActive =
    playingTeam === 'A'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <div className="text-gray-500 text-xs tracking-[0.2em] uppercase">Round {round}</div>

      <div className={`font-display text-lg tracking-wider ${teamColor}`}>Team {playingTeam}</div>

      {/* Cluer picker — visible to playing team members */}
      {isOnPlayingTeam && teamPlayers.length > 1 && (
        <div className="w-full max-w-xs">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center mb-2">Who's clueing?</div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {teamPlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => socket.emit('turn:pick-cluer', { cluerId: p.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-wider border transition-all ${
                  p.id === cluerId ? chipActive : 'bg-surface-raised text-gray-500 border-white/5 hover:text-white'
                }`}
              >
                {p.name}
                {p.id === playerId && <span className="opacity-50 ml-0.5">(you)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {canStart ? (
        <>
          <div className="text-center">
            <div className="text-gray-400 text-sm mb-2">You're the cluer!</div>
            <div className="text-gray-500 text-xs">Describe the words using only one-syllable words</div>
          </div>

          <button
            onClick={() => socket.emit('turn:start')}
            className={`${btnClass} w-full max-w-xs py-6 rounded-2xl text-white font-display text-3xl
                       tracking-wider transition-all active:scale-[0.95]`}
          >
            Start!
          </button>
        </>
      ) : (
        <>
          <div className="glass-card rounded-2xl p-8 border border-white/5 w-full max-w-xs text-center">
            <div className="text-gray-400 text-sm mb-3">Next cluer</div>
            <div
              className={`font-display text-3xl tracking-wider ${teamColor}`}
              style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}
            >
              {cluerName ?? '...'}
            </div>
          </div>

          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-gray-600 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
          <div className="text-gray-600 text-xs tracking-wider">Waiting for {cluerName} to start...</div>
        </>
      )}
    </div>
  );
}
