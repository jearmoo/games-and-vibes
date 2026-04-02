import { Component, type ReactNode, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReconnectBanner, ErrorToast, KickedScreen } from '@games/client-core';
import { useGameStore, useMyRole } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import ParallelSetupScreen from './components/ParallelSetupScreen';
import ClueGiverScreen from './components/ClueGiverScreen';
import GuesserScreen from './components/GuesserScreen';
import TabooWatcherScreen from './components/TabooWatcherScreen';
import ScoringScreen from './components/ScoringScreen';
import GameOverScreen from './components/GameOverScreen';
import TeamSelectScreen from './components/TeamSelectScreen';
import ScoreBoard from './components/ScoreBoard';
import { HelpButton } from './components/HelpModal';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const connected = useGameStore((s) => s.connected);
  const error = useGameStore((s) => s.error);
  const roomCode = useGameStore((s) => s.roomCode);
  const kickReason = useGameStore((s) => s.kickReason);
  const dismissError = useCallback(() => useGameStore.setState({ error: null }), []);

  if (kickReason) {
    return <KickedScreen reason={kickReason} onReturn={() => useGameStore.setState({ kickReason: null })} />;
  }

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
        <FloatingHelpButton />
        <ReconnectBanner visible={!connected} />
        <ErrorToast message={error} onDismiss={dismissError} />
      </>
    );

  return (
    <div className="h-full flex flex-col">
      {(phase === 'LOBBY' || phase === 'TEAM_SELECT') && <FloatingHelpButton />}
      {phase !== 'LOBBY' && phase !== 'TEAM_SELECT' && <ScoreBoard />}
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
      <ReconnectBanner visible={!connected} />
      <ErrorToast message={error} onDismiss={dismissError} />
    </div>
  );
}

function ScreenRouter({ phase }: { phase: string }) {
  const role = useMyRole();

  switch (phase) {
    case 'LOBBY':
      return <LobbyScreen />;
    case 'TEAM_SELECT':
      return <TeamSelectScreen />;
    case 'PARALLEL_SETUP':
      return <ParallelSetupScreen />;
    case 'CLUING_A':
    case 'CLUING_B':
      if (role === 'clue-giver') return <ClueGiverScreen />;
      if (role === 'guesser') return <GuesserScreen />;
      if (role === 'taboo-master') return <TabooWatcherScreen isMaster />;
      return <TabooWatcherScreen isMaster={false} />;
    case 'ROUND_RESULT':
      return <ScoringScreen />;
    case 'GAME_OVER':
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
  }
}

function FloatingHelpButton() {
  return (
    <div className="fixed top-3 right-3 z-40">
      <HelpButton className="w-7 h-7 flex items-center justify-center rounded-full glass-card border border-white/10 text-xs text-gray-400 hover:text-accent transition-colors font-semibold" />
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
