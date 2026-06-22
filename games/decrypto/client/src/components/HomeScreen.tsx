import { useEffect, useState } from 'react';
import { getRoomCodeFromUrl, useGameStore } from '../store';

export default function HomeScreen() {
  const urlCode = getRoomCodeFromUrl();
  const roomError = useGameStore((s) => s.error);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(urlCode || '');
  const [mode, setMode] = useState<'menu' | 'join'>(urlCode ? 'join' : 'menu');
  const [showCustomRoomCode, setShowCustomRoomCode] = useState(false);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [customCodeError, setCustomCodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      showCustomRoomCode &&
      roomError &&
      (roomError.toLowerCase().includes('room code') || roomError.toLowerCase().includes('code is already'))
    ) {
      setCustomCodeError(roomError);
      setLoading(false);
    }
  }, [showCustomRoomCode, roomError]);

  const handleCreate = () => {
    if (!name.trim() || loading) return;
    const normalizedCustomCode = customRoomCode.trim().toUpperCase();
    const useCustomCode = showCustomRoomCode && normalizedCustomCode.length > 0;
    if (useCustomCode && !/^[A-Z0-9]{4}$/.test(normalizedCustomCode)) {
      setCustomCodeError('Custom room code must be 4 letters or numbers.');
      return;
    }
    setCustomCodeError(null);
    setLoading(true);
    useGameStore.getState().setPlayerName(name.trim());
    useGameStore
      .getState()
      .createRoom({ playerName: name.trim(), roomCode: useCustomCode ? normalizedCustomCode : undefined });
    setTimeout(() => setLoading(false), 5000);
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim() || loading) return;
    setLoading(true);
    useGameStore.getState().setPlayerName(name.trim());
    useGameStore.getState().joinRoom({ roomCode: joinCode.trim().toUpperCase(), playerName: name.trim() });
    setTimeout(() => setLoading(false), 5000);
  };

  const customCodeLength = customRoomCode.trim().length;
  const canCreate =
    !!name.trim() && !loading && (!showCustomRoomCode || customCodeLength === 0 || customCodeLength === 4);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-10 animate-fade-in decrypto-grid-bg overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[620px] h-[420px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-12%] right-[-10%] w-[520px] h-[360px] bg-rose-500/10 rounded-full blur-[130px]" />
      </div>

      <div className="text-center relative z-10">
        <h1 className="font-display text-6xl tracking-widest decrypto-title mb-3">DECRYPTO</h1>
        <p className="text-gray-400 text-sm tracking-widest uppercase">Transmit clues. Intercept codes.</p>
      </div>

      <div className="w-full max-w-xs space-y-2 relative z-10">
        <div className="space-y-1">
          <input
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
            className="game-input w-full px-5 py-4 rounded-2xl text-white text-center text-lg placeholder-gray-600 font-medium"
          />
          {mode === 'menu' && (
            <div className="flex justify-end -mr-2">
              <button
                type="button"
                onClick={() => {
                  setShowCustomRoomCode((showing) => !showing);
                  setCustomCodeError(null);
                }}
                className="grid h-5 w-8 place-items-center border-0 bg-transparent p-0 text-gray-500 transition hover:text-white focus:outline-none focus-visible:text-white focus-visible:drop-shadow-[0_0_6px_rgba(255,255,255,0.45)] active:scale-95"
                aria-label={showCustomRoomCode ? 'Hide custom room name' : 'Show custom room name'}
                aria-expanded={showCustomRoomCode}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-5 transition-transform duration-200 ${showCustomRoomCode ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {mode === 'menu' ? (
          <div className="space-y-3 animate-slide-up">
            {showCustomRoomCode && (
              <div className="space-y-1.5 animate-slide-up">
                <input
                  type="text"
                  placeholder="Custom room name"
                  value={customRoomCode}
                  onChange={(e) => {
                    setCustomRoomCode(
                      e.target.value
                        .replace(/[^A-Za-z0-9]/g, '')
                        .toUpperCase()
                        .slice(0, 4),
                    );
                    setCustomCodeError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) handleCreate();
                  }}
                  maxLength={4}
                  autoComplete="off"
                  className={`game-input w-full px-5 py-4 rounded-2xl text-white text-center text-lg placeholder-gray-600 font-medium ${
                    customCodeError ? 'border-red-400/60' : ''
                  }`}
                  aria-label="Custom room name"
                />
                {customCodeError && <div className="px-2 text-center text-xs text-red-200">{customCodeError}</div>}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="btn-decrypto w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
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
              type="text"
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              autoFocus={!urlCode}
              className="game-input w-full px-5 py-4 rounded-2xl text-white text-center text-3xl tracking-[0.4em] font-display placeholder-gray-600 uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || joinCode.length < 4 || loading}
              className="btn-success w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
            >
              {loading ? 'Joining...' : 'Enter'}
            </button>
            {!urlCode && (
              <button
                onClick={() => {
                  setMode('menu');
                  setJoinCode('');
                }}
                className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm"
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
