import { useState } from 'react';
import { motion } from 'motion/react';
import { useCharadesStore } from '../store';

export default function RoundResultScreen() {
  const { teams, roundHistory, startRound, endGame } = useCharadesStore();
  const [pickingTeam, setPickingTeam] = useState(false);
  const [starting, setStarting] = useState(false);

  const lastRound = roundHistory[roundHistory.length - 1];

  const handleStartRound = async (teamIndex: number) => {
    setStarting(true);
    await startRound(teamIndex);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 max-w-sm mx-auto w-full">
      <h2 className="font-display text-3xl text-white tracking-wider">Round Over</h2>

      {/* Last round summary */}
      {lastRound && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full word-card rounded-2xl p-5"
        >
          <div
            className={`font-display text-xl tracking-wider mb-3 ${lastRound.teamName === teams[0].name ? 'text-team1' : 'text-team2'}`}
          >
            {lastRound.teamName}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-display text-green-400">{lastRound.correct}</div>
              <div className="text-xs text-gray-400">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-display text-red-400">{lastRound.passes}</div>
              <div className="text-xs text-gray-400">Passes</div>
            </div>
            <div>
              <div className="text-2xl font-display text-white">
                {lastRound.score > 0 ? '+' : ''}
                {lastRound.score}
              </div>
              <div className="text-xs text-gray-400">Points</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Total scores */}
      <div className="w-full word-card rounded-2xl p-5">
        <div className="text-gray-400 text-sm mb-3 text-center">Total Scores</div>
        <div className="flex justify-around">
          {teams.map((team, i) => (
            <div key={i} className="text-center">
              <div className={`font-display text-3xl animate-score-pop ${i === 0 ? 'text-team1' : 'text-team2'}`}>
                {team.score}
              </div>
              <div className="text-sm text-gray-400">{team.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {!pickingTeam ? (
        <div className="w-full flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setPickingTeam(true)}
            className="w-full py-4 rounded-2xl btn-charades text-white font-display text-xl tracking-wider"
          >
            Next Round
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={endGame}
            className="w-full py-3 rounded-2xl glass-card text-gray-300 font-display tracking-wider border border-white/10"
          >
            End Game
          </motion.button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col gap-3"
        >
          <div className="text-gray-400 text-sm text-center">Which team goes next?</div>
          {teams.map((team, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStartRound(i)}
              disabled={starting}
              className={`w-full py-4 rounded-2xl ${i === 0 ? 'btn-team1' : 'btn-team2'} text-white font-display text-lg tracking-wider disabled:opacity-50`}
            >
              {team.name}
            </motion.button>
          ))}
          <button
            onClick={() => setPickingTeam(false)}
            className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </div>
  );
}
