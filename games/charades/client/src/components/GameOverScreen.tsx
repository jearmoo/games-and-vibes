import { motion } from 'motion/react';
import { useCharadesStore } from '../store';

export default function GameOverScreen() {
  const { teams, roundHistory, resetToSetup, resetAll } = useCharadesStore();

  const winnerIndex: number = teams[0].score > teams[1].score ? 0 : teams[1].score > teams[0].score ? 1 : -1;
  const winner = winnerIndex >= 0 ? teams[winnerIndex as 0 | 1] : null;
  const isTie = winnerIndex === -1;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 max-w-sm mx-auto w-full overflow-auto">
      <h2 className="font-display text-3xl text-white tracking-wider">Game Over</h2>

      {/* Winner */}
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
        {isTie ? (
          <div className="font-display text-2xl text-white tracking-wider">It&apos;s a tie!</div>
        ) : (
          <>
            <div
              className={`font-display text-4xl tracking-wider animate-score-pop ${winnerIndex === 0 ? 'text-team1' : 'text-team2'}`}
            >
              {winner!.name}
            </div>
            <div className="text-gray-400 text-sm mt-1">wins!</div>
          </>
        )}
      </motion.div>

      {/* Final scores */}
      <div className="w-full word-card rounded-2xl p-5">
        <div className="flex justify-around">
          {teams.map((team, i) => (
            <div key={i} className="text-center">
              <div className={`font-display text-4xl ${i === 0 ? 'text-team1' : 'text-team2'}`}>{team.score}</div>
              <div className="text-sm text-gray-400">{team.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Round history */}
      {roundHistory.length > 0 && (
        <div className="w-full word-card rounded-2xl p-4">
          <div className="text-gray-400 text-sm mb-3 text-center">Round History</div>
          <div className="flex flex-col gap-2">
            {roundHistory.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-2 py-1">
                <span className="text-gray-300">
                  R{i + 1}: {entry.teamName}
                </span>
                <span className="text-gray-400">
                  {entry.correct} correct, {entry.passes} pass ={' '}
                  <span className="text-white font-semibold">
                    {entry.score > 0 ? '+' : ''}
                    {entry.score}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetToSetup}
          className="w-full py-4 rounded-2xl btn-charades text-white font-display text-xl tracking-wider"
        >
          Play Again
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetAll}
          className="w-full py-3 rounded-2xl glass-card text-gray-300 font-display tracking-wider border border-white/10"
        >
          New Game
        </motion.button>
      </div>
    </div>
  );
}
