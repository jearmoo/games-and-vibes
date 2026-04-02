import { useState } from 'react';
import { motion } from 'framer-motion';
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
              <label className="text-gray-400 text-sm mb-1 block">Team {i + 1}</label>
              <input
                type="text"
                value={team.name}
                onChange={(e) => setTeamName(i, e.target.value)}
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-white/10 text-white font-sans focus:outline-none focus:border-charades/50 transition-colors"
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
                  startingTeam === i ? 'btn-charades text-white' : 'glass-card text-gray-400 hover:text-white'
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
