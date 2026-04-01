import { motion } from 'framer-motion';
import { games, type GameEntry } from './gameRegistry';

const vibesColors = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e'];

export default function App() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Page-level atmospheric glows — no overflow clipping */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/[0.06] rounded-full blur-[160px]" />
        <div className="absolute top-[15%] left-[20%] w-[400px] h-[400px] bg-amber-500/[0.035] rounded-full blur-[140px]" />
        <div className="absolute top-[55%] right-[25%] w-[350px] h-[350px] bg-rose-500/[0.025] rounded-full blur-[130px]" />
      </motion.div>

      {/* Page-wide constellation dots */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/[0.07] animate-pulse-slow"
            style={{
              width: `${0.5 + Math.random() * 2}px`,
              height: `${0.5 + Math.random() * 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${2 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Hero />
        <GameGrid />
        <Footer />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-20 sm:pt-28 sm:pb-24 flex flex-col items-center justify-center text-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h1 className="font-display leading-none">
          <span
            className="block text-4xl sm:text-5xl lg:text-7xl tracking-[0.2em] text-white"
            style={{
              textShadow: '0 0 60px rgba(99, 102, 241, 0.25)',
            }}
          >
            GAMES
          </span>
          <span className="block tracking-[0.35em] mt-2 text-lg sm:text-xl lg:text-2xl">
            <span className="text-gray-500">AND </span>
            {'VIBES'.split('').map((letter, i) => (
              <motion.span
                key={i}
                className="inline-block"
                style={{
                  color: vibesColors[i],
                  textShadow: `0 0 20px ${vibesColors[i]}44`,
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  textShadow: [
                    `0 0 12px ${vibesColors[i]}33`,
                    `0 0 24px ${vibesColors[i]}66`,
                    `0 0 12px ${vibesColors[i]}33`,
                  ],
                }}
                transition={{
                  opacity: { duration: 0.3, delay: 0.4 + i * 0.08 },
                  y: { duration: 0.3, delay: 0.4 + i * 0.08 },
                  textShadow: {
                    duration: 2.5,
                    repeat: Infinity,
                    delay: 0.8 + i * 0.3,
                    ease: 'easeInOut',
                  },
                }}
              >
                {letter}
              </motion.span>
            ))}
          </span>
        </h1>
      </motion.div>

      {/* Multi-color separator */}
      <motion.div
        className="mt-10 h-px w-16 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${vibesColors[0]}40, ${vibesColors[1]}40, ${vibesColors[2]}40, ${vibesColors[3]}40, ${vibesColors[4]}40, transparent)`,
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      />
    </section>
  );
}

function GameGrid() {
  return (
    <section className="max-w-4xl mx-auto px-6 pb-24 flex-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game, i) => (
          <GameCard key={game.id} game={game} index={i} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ game, index }: { game: GameEntry; index: number }) {
  const isAvailable = game.available;

  return (
    <motion.a
      href={isAvailable ? game.url : undefined}
      className={`group relative glass-card rounded-xl overflow-hidden transition-colors duration-300 ${
        isAvailable ? 'cursor-pointer' : 'opacity-40 cursor-default'
      }`}
      whileHover={
        isAvailable
          ? {
              y: -3,
              scale: 1.01,
              boxShadow: `0 0 30px ${game.accentGlow}, 0 4px 20px rgba(0,0,0,0.4)`,
              transition: { duration: 0.15, ease: 'easeOut' },
            }
          : undefined
      }
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isAvailable ? 1 : 0.4,
        y: 0,
        transition: { delay: 0.8 + index * 0.08, duration: 0.45, ease: 'easeOut' },
      }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300 group-hover:w-1"
        style={{ backgroundColor: game.accentColor }}
      />

      {/* Live indicator dot */}
      {isAvailable && (
        <div
          className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full animate-pulse-slow"
          style={{ backgroundColor: game.accentColor, boxShadow: `0 0 6px ${game.accentGlow}` }}
        />
      )}

      <div className="p-5 pl-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base tracking-wider text-white">{game.name}</h3>
          {!isAvailable && (
            <span className="shrink-0 text-[9px] uppercase tracking-[0.15em] text-gray-600 border border-gray-700/60 rounded-full px-2 py-0.5">
              Soon
            </span>
          )}
        </div>

        <p className="mt-1.5 text-gray-500 text-xs leading-relaxed">{game.tagline}</p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-600 tracking-wide">{game.playerCount}</span>
          {isAvailable && (
            <span
              className="text-xs font-display tracking-wider transition-all duration-200 opacity-60 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: game.accentColor }}
            >
              Play &rarr;
            </span>
          )}
        </div>
      </div>
    </motion.a>
  );
}

function Footer() {
  return (
    <footer className="text-center pb-8 pt-4">
      <div className="mx-auto mb-4 w-32 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      <span className="text-gray-700 text-[11px] tracking-widest uppercase">jerpi.org</span>
    </footer>
  );
}
