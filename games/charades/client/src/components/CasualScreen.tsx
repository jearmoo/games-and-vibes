import { motion, AnimatePresence } from 'framer-motion';
import { useCharadesStore } from '../store';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Very Hard'];

export default function CasualScreen() {
  const {
    casualDifficulty,
    casualWordCount,
    casualWords,
    casualLoading,
    setCasualDifficulty,
    setCasualWordCount,
    generateCasualWords,
    resetAll,
  } = useCharadesStore();

  return (
    <div className="h-full flex flex-col p-6">
      <button
        onClick={resetAll}
        className="text-gray-500 text-sm hover:text-gray-300 transition-colors self-start mb-6"
      >
        &larr; Back
      </button>

      <div className="flex-1 flex flex-col items-center gap-6 max-w-sm mx-auto w-full">
        <h2 className="font-display text-3xl text-white tracking-wider">Casual Mode</h2>

        <div className="w-full">
          <label className="text-gray-400 text-sm mb-2 block">Difficulty</label>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((name, i) => (
              <button
                key={name}
                onClick={() => setCasualDifficulty(i + 1)}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                  casualDifficulty === i + 1 ? 'btn-charades text-white' : 'glass-card text-gray-400 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <label className="text-gray-400 text-sm mb-2 block">Number of words</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCasualWordCount(Math.max(1, casualWordCount - 1))}
              className="w-10 h-10 rounded-xl glass-card text-white font-display text-xl flex items-center justify-center"
            >
              -
            </button>
            <span className="font-display text-3xl text-white w-12 text-center">{casualWordCount}</span>
            <button
              onClick={() => setCasualWordCount(Math.min(10, casualWordCount + 1))}
              className="w-10 h-10 rounded-xl glass-card text-white font-display text-xl flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={generateCasualWords}
          disabled={casualLoading}
          className="w-full py-4 rounded-2xl btn-charades text-white font-display text-xl tracking-wider disabled:opacity-50"
        >
          {casualLoading ? 'Generating...' : casualWords.length > 0 ? 'Generate More' : 'Generate Words'}
        </motion.button>

        <AnimatePresence mode="popLayout">
          {casualWords.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex flex-col gap-3"
            >
              {casualWords.map((word, i) => (
                <motion.div
                  key={`${word}-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="word-card rounded-2xl p-5 text-center"
                >
                  <span className="font-display text-2xl text-white tracking-wider capitalize">{word}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
