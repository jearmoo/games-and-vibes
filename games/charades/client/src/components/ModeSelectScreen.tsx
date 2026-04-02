import { motion } from 'framer-motion';
import { useCharadesStore } from '../store';

export default function ModeSelectScreen() {
  const setMode = useCharadesStore((s) => s.setMode);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="font-display text-5xl text-white tracking-wider mb-2">Charades</h1>
        <p className="text-gray-400 text-sm">Act it out without saying a word</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMode('casual')}
          className="w-full p-6 rounded-2xl word-card text-left transition-all hover:border-charades/30"
        >
          <div className="font-display text-2xl text-white tracking-wider mb-1">Casual</div>
          <p className="text-gray-400 text-sm">Pick words, no pressure. Pass the phone around.</p>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMode('competitive')}
          className="w-full p-6 rounded-2xl word-card text-left transition-all hover:border-charades/30"
        >
          <div className="font-display text-2xl text-white tracking-wider mb-1">Competitive</div>
          <p className="text-gray-400 text-sm">Teams, timer, and scoring. Game on.</p>
        </motion.button>
      </div>

      <a href="https://games.jerpi.org" className="text-gray-500 text-sm hover:text-gray-300 transition-colors mt-4">
        &larr; Back to games
      </a>
    </div>
  );
}
