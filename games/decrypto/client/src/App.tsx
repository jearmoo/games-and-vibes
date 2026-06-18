import { Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorToast, KickedScreen, ReconnectBanner } from '@games/client-core';
import { DecryptoPhase } from '@games/decrypto-shared';
import { useGameStore, usePhase } from './store';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import WordSetupScreen from './components/WordSetupScreen';
import TurnScreen from './components/TurnScreen';
import RevealScreen from './components/RevealScreen';
import TieBreakerScreen from './components/TieBreakerScreen';
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
      <div className="h-full flex items-center justify-center decrypto-grid-bg">
        <div className="font-display text-xl text-gray-500 animate-pulse-slow">Opening channel...</div>
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
    <div className="h-full flex flex-col decrypto-grid-bg">
      <div className="flex-1 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
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

function ScreenRouter({ phase }: { phase: DecryptoPhase }) {
  switch (phase) {
    case DecryptoPhase.LOBBY:
      return <LobbyScreen />;
    case DecryptoPhase.WORDS:
      return <WordSetupScreen />;
    case DecryptoPhase.CLUE:
    case DecryptoPhase.GUESS:
      return <TurnScreen />;
    case DecryptoPhase.REVEAL:
      return <RevealScreen />;
    case DecryptoPhase.TIEBREAKER:
      return <TieBreakerScreen />;
    case DecryptoPhase.GAME_OVER:
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
        <div className="h-full flex flex-col items-center justify-center p-6 gap-6 decrypto-grid-bg">
          <div className="font-display text-2xl text-white tracking-wider">Transmission failed.</div>
          <button
            onClick={() => window.location.reload()}
            className="btn-decrypto px-8 py-3 rounded-2xl text-white font-display tracking-wider"
          >
            Reconnect
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
