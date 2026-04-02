import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore, getRoomCodeFromUrl, SESSION_KEY } from '../store';

export default function HomeScreen() {
  const urlCode = getRoomCodeFromUrl();
  const storedName = useGameStore((s) => s.playerName);
  const [name, setName] = useState(storedName || '');
  const [joinCode, setJoinCode] = useState(urlCode || '');
  const [mode, setMode] = useState<'menu' | 'join'>(urlCode ? 'join' : 'menu');
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    useGameStore.getState().setPlayerName(name.trim());
    socket.emit('room:create', { playerName: name.trim() });
    setTimeout(() => setLoading(false), 5000);
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim() || loading) return;
    setLoading(true);
    useGameStore.getState().setPlayerName(name.trim());
    const code = joinCode.trim().toUpperCase();
    let sessionId: string | undefined;
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.roomCode === code) sessionId = session.playerId;
      }
    } catch {
      /* ignore parse errors */
    }
    socket.emit('room:join', { roomCode: code, playerName: name.trim(), sessionId });
    setTimeout(() => setLoading(false), 5000);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-10 animate-fade-in">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="text-center relative z-10">
        <h1
          className="font-display text-6xl tracking-wider text-white mb-3"
          style={{ textShadow: '0 0 40px rgba(99, 102, 241, 0.4)' }}
        >
          AD TABOO
        </h1>
        <p className="text-gray-400 text-sm tracking-widest uppercase">Adversarial Taboo</p>
      </div>

      <div className="w-full max-w-xs space-y-4 relative z-10">
        <input
          data-testid="home-name-input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              if (mode === 'menu') handleCreate();
              else if (mode === 'join' && joinCode.length >= 4) handleJoin();
            }
          }}
          maxLength={20}
          className="game-input w-full px-5 py-4 rounded-2xl text-white text-center text-lg placeholder-gray-500 font-medium"
        />

        {mode === 'menu' ? (
          <div className="space-y-3 animate-slide-up">
            <button
              data-testid="home-create-button"
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
              data-testid="home-join-mode-button"
              onClick={() => setMode('join')}
              disabled={!name.trim()}
              className="w-full py-4 bg-surface-raised hover:bg-surface-hover rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 transition-all active:scale-[0.97] border border-white/5"
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-slide-up">
            <input
              data-testid="home-code-input"
              type="text"
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              autoFocus={!urlCode}
              className="game-input w-full px-5 py-4 rounded-2xl text-white text-center text-3xl tracking-[0.4em] font-display placeholder-gray-500 uppercase"
            />
            <button
              data-testid="home-join-button"
              onClick={handleJoin}
              disabled={!name.trim() || joinCode.length < 4 || loading}
              className="btn-success w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
            {!urlCode && (
              <button
                onClick={() => {
                  setMode('menu');
                  setJoinCode('');
                }}
                className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Back
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
