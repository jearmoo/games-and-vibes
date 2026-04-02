import { Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useCharadesStore } from './store';
import ModeSelectScreen from './components/ModeSelectScreen';
import CasualScreen from './components/CasualScreen';
import CompSetupScreen from './components/CompSetupScreen';
import CompPlayScreen from './components/CompPlayScreen';
import RoundResultScreen from './components/RoundResultScreen';
import GameOverScreen from './components/GameOverScreen';

function getScreenKey(mode: string | null, phase: string | null): string {
  if (!mode) return 'mode-select';
  if (mode === 'casual') return 'casual';
  return `comp-${phase}`;
}

export default function App() {
  const mode = useCharadesStore((s) => s.mode);
  const phase = useCharadesStore((s) => s.phase);

  const screenKey = getScreenKey(mode, phase);

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <ScreenRouter mode={mode} phase={phase} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ScreenRouter({ mode, phase }: { mode: string | null; phase: string | null }) {
  if (!mode) return <ModeSelectScreen />;
  if (mode === 'casual') return <CasualScreen />;

  switch (phase) {
    case 'setup':
      return <CompSetupScreen />;
    case 'playing':
      return <CompPlayScreen />;
    case 'round-result':
      return <RoundResultScreen />;
    case 'game-over':
      return <GameOverScreen />;
    default:
      return <ModeSelectScreen />;
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
          <div className="font-display text-2xl text-white tracking-wider">Something went wrong</div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary px-8 py-3 rounded-2xl text-white font-display tracking-wider"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
