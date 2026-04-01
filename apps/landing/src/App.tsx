import { motion } from 'framer-motion';
import { games, type GameEntry } from './gameRegistry';

export default function App() {
  return (
    <div className="min-h-screen">
      <Hero />
      <GameGrid />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32 flex flex-col items-center justify-center text-center px-6">
      {/* Atmospheric glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-amber-500/6 rounded-full blur-[140px]" />
      </div>

      {/* Constellation dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-pulse-slow"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      <motion.h1
        className="relative z-10 font-display text-6xl sm:text-8xl tracking-widest text-white"
        style={{
          textShadow: '0 0 60px rgba(99, 102, 241, 0.3), 0 0 120px rgba(245, 158, 11, 0.15)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        JERPI GAMES
      </motion.h1>

      <motion.p
        className="relative z-10 mt-4 text-gray-500 text-lg sm:text-xl tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Party games for your crew
      </motion.p>
    </section>
  );
}

function GameGrid() {
  return (
    <section className="max-w-5xl mx-auto px-6 pb-24">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      className={`group relative glass-card rounded-2xl overflow-hidden transition-all duration-300 ${
        isAvailable ? 'hover:-translate-y-1 cursor-pointer' : 'opacity-50 cursor-default'
      }`}
      style={{
        boxShadow: isAvailable ? `0 0 0 rgba(0,0,0,0)` : undefined,
      }}
      whileHover={isAvailable ? { boxShadow: `0 0 40px ${game.accentGlow}, 0 8px 32px rgba(0,0,0,0.3)` } : undefined}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: isAvailable ? 1 : 0.5, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.5, ease: 'easeOut' }}
    >
      {/* Accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: game.accentColor }}
      />

      <div className="p-6 pl-7">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl tracking-wider text-white">{game.name}</h3>
          {!isAvailable && (
            <span className="shrink-0 text-[10px] uppercase tracking-widest text-gray-500 border border-gray-700 rounded-full px-2 py-0.5">
              Soon
            </span>
          )}
        </div>

        <p className="mt-2 text-gray-400 text-sm leading-relaxed">{game.tagline}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500 tracking-wide">{game.playerCount}</span>
          {isAvailable && (
            <span
              className="text-sm font-display tracking-wider transition-colors duration-200"
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
  return <footer className="text-center pb-8 text-gray-600 text-xs tracking-wide">jerpi.org</footer>;
}
