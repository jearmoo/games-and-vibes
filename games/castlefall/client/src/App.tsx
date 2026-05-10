import { Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KickedScreen, ReconnectBanner, ErrorToast } from '@games/client-core';
import { CastlefallPhase } from '@games/castlefall-shared';
import { useGameStore, usePhase } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import RoundScreen from './components/RoundScreen';
import GameOverScreen from './components/GameOverScreen';

export default function App() {
  const phase = usePhase();
  const connected = useGameStore((s) => s.connected);
  const error = useGameStore((s) => s.error);
  const roomCode = useGameStore((s) => s.roomCode);
  const kickReason = useGameStore((s) => s.kickReason);

  if (kickReason) {
    return <KickedScreen reason={kickReason} onReturn={() => useGameStore.setState({ kickReason: null })} />;
  }

  if (!connected && !roomCode) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="font-display text-xl text-gray-500 animate-pulse-slow">Securing the keep...</div>
      </div>
    );
  }

  if (!phase) {
    return (
      <>
        <HomeScreen />
        <ReconnectBanner visible={!connected} />
        <ErrorToast message={error} onDismiss={() => useGameStore.setState({ error: null })} />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
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
      <ErrorToast message={error} onDismiss={() => useGameStore.setState({ error: null })} />
    </div>
  );
}

function ScreenRouter({ phase }: { phase: CastlefallPhase }) {
  switch (phase) {
    case CastlefallPhase.LOBBY:
      return <LobbyScreen />;
    case CastlefallPhase.ROUND:
      return <RoundScreen />;
    case CastlefallPhase.GAME_OVER:
      return <GameOverScreen />;
    default:
      return <HomeScreen />;
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
          <div className="font-display text-2xl text-white tracking-wider">The keep has fallen.</div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary px-8 py-3 rounded-2xl text-white font-display tracking-wider"
          >
            Rebuild
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
