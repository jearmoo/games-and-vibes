import { useState } from 'react';
import { motion } from 'motion/react';
import { getRoomCodeFromUrl, useGameStore } from '../store';

export default function HomeScreen() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const storedName = useGameStore((s) => s.playerName);
  const connected = useGameStore((s) => s.connected);

  const urlCode = getRoomCodeFromUrl();
  const [name, setName] = useState(storedName);
  const [code, setCode] = useState(urlCode ?? '');
  const [mode, setMode] = useState<'home' | 'join'>(urlCode ? 'join' : 'home');

  const canCreate = name.trim().length > 0 && connected;
  const canJoin = name.trim().length > 0 && code.trim().length === 4 && connected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex flex-col items-center justify-center p-6"
    >
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl sm:text-6xl mb-2 leading-none">
          <span className="text-boom-blue-glow">Two Rooms</span> <span className="text-white/70">&amp; a</span>{' '}
          <span className="text-boom-red-glow">Boom</span>
        </h1>
        <p className="text-white/50">Deal secret roles. The rest happens in the room.</p>
      </div>

      <div className="glass-card w-full max-w-sm p-6 space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">Your name</label>
          <input
            className="game-input w-full rounded-xl px-4 py-3 outline-none placeholder-gray-600"
            value={name}
            maxLength={20}
            placeholder="e.g. Alex"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {mode === 'join' && (
          <div>
            <label className="block text-sm text-white/60 mb-1">Room code</label>
            <input
              className="game-input w-full rounded-xl px-4 py-3 uppercase tracking-[0.4em] text-center outline-none placeholder-gray-600"
              value={code}
              maxLength={4}
              placeholder="ABCD"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
          </div>
        )}

        {mode === 'home' ? (
          <div className="space-y-3 pt-1">
            <button
              className="btn-primary w-full"
              disabled={!canCreate}
              onClick={() => createRoom({ playerName: name.trim() })}
            >
              Create a room
            </button>
            <button className="btn-ghost w-full" onClick={() => setMode('join')}>
              Join a room
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <button
              className="btn-primary w-full"
              disabled={!canJoin}
              onClick={() => joinRoom({ roomCode: code.trim(), playerName: name.trim() })}
            >
              Join room
            </button>
            <button className="btn-ghost w-full" onClick={() => setMode('home')}>
              Back
            </button>
          </div>
        )}

        {!connected && <p className="text-center text-xs text-amber-300">Connecting to server…</p>}
      </div>
    </motion.div>
  );
}
