import { Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KickedScreen, ReconnectBanner, ErrorToast } from '@games/client-core';
import { useGameStore, usePhase, TwoRoomsPhase } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import RevealScreen from './components/RevealScreen';

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
        <div className="font-display text-xl text-white/40 animate-pulse">Connecting…</div>
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

function ScreenRouter({ phase }: { phase: TwoRoomsPhase }) {
  switch (phase) {
    case TwoRoomsPhase.REVEAL:
      return <RevealScreen />;
    case TwoRoomsPhase.LOBBY:
      return <LobbyScreen />;
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
          <div className="font-display text-2xl text-white tracking-wider">Something broke.</div>
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
