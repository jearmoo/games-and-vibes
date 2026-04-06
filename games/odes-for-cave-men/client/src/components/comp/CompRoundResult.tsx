import { useCompStore } from '../../compStore';

export default function CompRoundResult() {
  const teams = useCompStore((s) => s.teams);
  const roundHistory = useCompStore((s) => s.roundHistory);
  const currentTeamIndex = useCompStore((s) => s.currentTeamIndex);
  const nextRound = useCompStore((s) => s.nextRound);
  const endGame = useCompStore((s) => s.endGame);

  const lastRound = roundHistory[roundHistory.length - 1];

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      {lastRound && (
        <div className="glass-card rounded-2xl p-6 border border-white/5 w-full max-w-xs text-center">
          <div className="text-gray-500 text-xs tracking-wider uppercase mb-2">{lastRound.teamName}</div>
          <div className="text-gray-400 text-sm mb-3">{lastRound.cluerName} clueing</div>
          <div className="flex justify-center gap-4 text-sm mb-2">
            <span className="text-emerald-400">{lastRound.correct} pts</span>
            <span className="text-gray-500">{lastRound.skips} skip</span>
            <span className="text-red-400">{lastRound.bonks} bonk</span>
          </div>
          <div className={`font-display text-2xl ${lastRound.score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {lastRound.score >= 0 ? '+' : ''}
            {lastRound.score}
          </div>
        </div>
      )}

      {/* Total scores */}
      <div className="flex gap-10 text-center">
        <div>
          <div className="text-amber-400 font-display text-sm tracking-wider">{teams[0].name}</div>
          <div className="font-display text-3xl text-white mt-1" style={{ textShadow: '0 0 20px rgba(217,119,6,0.3)' }}>
            {teams[0].score}
          </div>
        </div>
        <div className="text-gray-700 font-display text-xl self-end mb-1">vs</div>
        <div>
          <div className="text-emerald-400 font-display text-sm tracking-wider">{teams[1].name}</div>
          <div className="font-display text-3xl text-white mt-1" style={{ textShadow: '0 0 20px rgba(5,150,105,0.3)' }}>
            {teams[1].score}
          </div>
        </div>
      </div>

      <div className="text-gray-500 text-xs text-center">Pass the phone to the next team</div>

      {/* Next round team picker */}
      <div className="w-full max-w-xs space-y-2">
        <div className="text-gray-500 text-[10px] uppercase tracking-wider text-center">Next team</div>
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <button
              key={i}
              onClick={() => nextRound(i)}
              className={`flex-1 py-3 rounded-xl font-display tracking-wider transition-all active:scale-[0.97] ${
                i === 0 ? 'btn-team-a text-white' : 'btn-team-b text-white'
              }`}
            >
              {teams[i].name}
            </button>
          ))}
        </div>
        <button
          onClick={endGame}
          className="w-full py-2.5 rounded-xl text-gray-400 border border-white/10 hover:text-white hover:border-white/20 font-display text-sm tracking-wider transition-all"
        >
          End Game
        </button>
      </div>
    </div>
  );
}
