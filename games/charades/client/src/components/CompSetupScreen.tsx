import { useState } from 'react';
import { motion } from 'motion/react';
import { useCharadesStore } from '../store';

const TIMER_OPTIONS = [30, 45, 60, 90, 120];

export default function CompSetupScreen() {
  const { teams, timerDuration, setTeamName, setTimerDuration, startGame, resetAll } = useCharadesStore();
  const [startingTeam, setStartingTeam] = useState(0);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    await startGame(startingTeam);
  };

  return (
    <div className="h-full flex flex-col p-6">
      <button
        onClick={resetAll}
        className="text-gray-500 text-sm hover:text-gray-300 transition-colors self-start mb-6"
      >
        &larr; Back
      </button>

      <div className="flex-1 flex flex-col items-center gap-6 max-w-sm mx-auto w-full">
        <h2 className="font-display text-3xl text-white tracking-wider">Game Setup</h2>

        <div className="w-full flex flex-col gap-4">
          {teams.map((team, i) => (
            <div key={i}>
              <label className={`text-sm mb-1 block ${i === 0 ? 'text-team1' : 'text-team2'}`}>Team {i + 1}</label>
              <input
                type="text"
                value={team.name}
                onChange={(e) => setTeamName(i, e.target.value)}
                maxLength={20}
                className={`w-full px-4 py-3 rounded-xl bg-surface-raised border text-white font-sans focus:outline-none transition-colors ${i === 0 ? 'border-team1/30 focus:border-team1/50' : 'border-team2/30 focus:border-team2/50'}`}
              />
            </div>
          ))}
        </div>

        <div className="w-full">
          <label className="text-gray-400 text-sm mb-2 block">Timer (seconds)</label>
          <div className="grid grid-cols-5 gap-2">
            {TIMER_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTimerDuration(t)}
                className={`py-2 rounded-xl text-sm font-semibold transition-all ${
                  timerDuration === t ? 'btn-charades text-white' : 'glass-card text-gray-400 hover:text-white'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <label className="text-gray-400 text-sm mb-2 block">Starting Team</label>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((team, i) => (
              <button
                key={i}
                onClick={() => setStartingTeam(i)}
                className={`py-3 rounded-xl font-semibold transition-all ${
                  startingTeam === i
                    ? `${i === 0 ? 'btn-team1' : 'btn-team2'} text-white`
                    : 'glass-card text-gray-400 hover:text-white'
                }`}
              >
                {team.name || `Team ${i + 1}`}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          disabled={starting || !teams[0].name.trim() || !teams[1].name.trim()}
          className="w-full py-4 rounded-2xl btn-charades text-white font-display text-xl tracking-wider disabled:opacity-50 mt-4"
        >
          {starting ? 'Loading...' : 'Start Game'}
        </motion.button>
      </div>
    </div>
  );
}
