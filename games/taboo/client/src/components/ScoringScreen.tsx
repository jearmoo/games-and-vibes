import { useGameStore, useIsHost, SESSION_KEY } from '../store';
import { socket } from '../socket';

export default function ScoringScreen() {
  const turnResults = useGameStore(s => s.turnResults);
  const scores = useGameStore(s => s.scores);
  const round = useGameStore(s => s.round);
  const settings = useGameStore(s => s.settings);
  const host = useIsHost();
  const phase = useGameStore(s => s.phase);
  const isGameOver = phase === 'GAME_OVER';

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <h2 className="font-display text-2xl text-white tracking-wider">
        {isGameOver ? 'Game Over' : `Round ${round} Complete`}
      </h2>

      {/* Per-team turn results */}
      <div className="flex gap-4 w-full max-w-sm">
        <TurnResult team="A" result={turnResults.A} />
        <TurnResult team="B" result={turnResults.B} />
      </div>

      {/* Overall scores */}
      <div className="flex gap-10 text-center animate-score-pop">
        <div>
          <div className="text-team-a-glow font-display text-sm tracking-wider">Team A</div>
          <div className="font-display text-4xl text-white mt-1"
               style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}>{scores.A}</div>
        </div>
        <div className="text-gray-700 font-display text-2xl self-end mb-1">vs</div>
        <div>
          <div className="text-team-b-glow font-display text-sm tracking-wider">Team B</div>
          <div className="font-display text-4xl text-white mt-1"
               style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>{scores.B}</div>
        </div>
      </div>

      {!isGameOver && (
        <div className="text-gray-500 text-xs tracking-wider uppercase">
          {round < settings.rounds ? `Round ${round + 1} next` : 'Final round'}
        </div>
      )}

      {host && !isGameOver && (
        <button onClick={() => socket.emit('round:next')}
          className="btn-primary w-full max-w-xs py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]">
          {round < settings.rounds ? 'Next Round' : 'See Final Results'}
        </button>
      )}
      {!host && !isGameOver && (
        <div className="text-gray-600 text-xs tracking-wider animate-pulse-slow">Waiting for host to continue...</div>
      )}

      {isGameOver && (
        <div className="w-full max-w-xs space-y-3">
          <button onClick={() => socket.emit('game:play-again')}
            className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97]">
            Play Again
          </button>
          <button onClick={() => { socket.emit('room:leave'); useGameStore.getState().reset(); localStorage.removeItem(SESSION_KEY); window.history.replaceState(null, '', '/'); }}
            className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm">
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}

function TurnResult({ team, result }: { team: 'A' | 'B'; result: { correct: number; missed: number; buzzes: number; points: number } | null }) {
  const color = team === 'A' ? 'border-team-a/20' : 'border-team-b/20';
  const textColor = team === 'A' ? 'text-team-a-glow' : 'text-team-b-glow';

  return (
    <div className={`flex-1 glass-card rounded-xl p-3 border ${color} animate-slide-up`}>
      <div className={`font-display text-sm tracking-wider mb-2 ${textColor}`}>Team {team}</div>
      {result ? (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-emerald-400">Correct</span>
            <span className="font-display text-emerald-400">+{result.correct * 3}</span>
          </div>
          {result.buzzes > 0 && (
            <div className="flex justify-between">
              <span className="text-team-b-glow">Buzzes</span>
              <span className="font-display text-team-b-glow">-{result.buzzes}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-1 flex justify-between">
            <span className="text-white font-medium">Turn</span>
            <span className="font-display text-white">{result.points >= 0 ? '+' : ''}{result.points}</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-600 text-xs">—</div>
      )}
    </div>
  );
}
