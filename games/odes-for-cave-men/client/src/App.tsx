import { Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGameStore, useMyRole } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import ReadyScreen from './components/ReadyScreen';
import CluerScreen from './components/CluerScreen';
import GuesserScreen from './components/GuesserScreen';
import OpponentScreen from './components/OpponentScreen';
import ReviewScreen from './components/ReviewScreen';
import ScoringScreen from './components/ScoringScreen';
import GameOverScreen from './components/GameOverScreen';
import ScoreBoard from './components/ScoreBoard';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const connected = useGameStore((s) => s.connected);
  const error = useGameStore((s) => s.error);
  const roomCode = useGameStore((s) => s.roomCode);

  if (!connected && !roomCode) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="font-display text-xl text-gray-500 animate-pulse-slow">Connecting...</div>
      </div>
    );
  }

  if (!phase)
    return (
      <>
        <HomeScreen />
        {!connected && <ReconnectBanner />}
        {error && <ErrorToast message={error} />}
      </>
    );

  return (
    <div className="h-full flex flex-col">
      {phase !== 'LOBBY' && <ScoreBoard />}
      <div className="flex-1 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ScreenRouter phase={phase} />
          </motion.div>
        </AnimatePresence>
      </div>
      {!connected && <ReconnectBanner />}
      {error && <ErrorToast message={error} />}
    </div>
  );
}

function ScreenRouter({ phase }: { phase: string }) {
  const role = useMyRole();

  switch (phase) {
    case 'LOBBY':
      return <LobbyScreen />;
    case 'READY':
      return <ReadyScreen />;
    case 'PLAYING': {
      if (role === 'cluer') return <CluerScreen />;
      if (role === 'guesser') return <GuesserScreen />;
      if (role === 'opponent') return <OpponentScreen />;
      return (
        <div className="h-full flex items-center justify-center">
          <div className="font-display text-lg text-gray-500 animate-pulse-slow">Loading...</div>
        </div>
      );
    }
    case 'REVIEW':
      return <ReviewScreen />;
    case 'ROUND_RESULT':
      return <ScoringScreen />;
    case 'GAME_OVER':
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
  }
}

function ReconnectBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-center text-sm py-1.5 animate-fade-in">
      <span className="animate-pulse">Reconnecting...</span>
    </div>
  );
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center animate-slide-up">
      <div className="glass-card border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 max-w-sm">
        {message}
      </div>
    </div>
  );
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
