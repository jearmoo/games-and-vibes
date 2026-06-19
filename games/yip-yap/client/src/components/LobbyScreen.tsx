import { useState, useCallback } from 'react';
import { ConfirmModal } from '@games/client-core';
import { socket } from '../socket';
import { useGameStore, useIsHost, useMyPlayer, useSettings } from '../store';

const TIMER_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 0, label: 'No timer' },
];

export default function LobbyScreen() {
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.room?.players ?? []);
  const hostId = useGameStore((s) => s.room?.hostId ?? null);
  const roundsPlayed = useGameStore((s) => s.room?.roundsPlayed ?? 0);
  const settings = useSettings();
  const host = useIsHost();
  const me = useMyPlayer();
  const canControlStart = host || roundsPlayed > 0;

  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);

  const shareUrl = roomCode ? `${window.location.origin}/${roomCode}` : '';
  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const handleStart = () => {
    if (starting || players.length < 2) return;
    setStarting(true);
    useGameStore.getState().startRound();
    setTimeout(() => setStarting(false), 5000);
  };

  const handleLeave = () => {
    useGameStore.getState().leaveRoom();
  };

  const canStart = players.length >= 2;

  return (
    <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-xl mx-auto w-full">
      {/* Header: room code + leave */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Room code</div>
          <button
            onClick={handleCopy}
            className="font-display text-4xl tracking-[0.3em] castle-gold-text hover:opacity-90 transition-opacity"
            title="Tap to copy link"
          >
            {roomCode}
          </button>
          <div className="text-amber-400/80 text-xs mt-1 h-4">{copied ? 'Link copied!' : 'Tap code to copy link'}</div>
        </div>
        <button
          onClick={handleLeave}
          className="text-gray-500 hover:text-white text-xs tracking-wider transition-colors px-3 py-1.5 border border-white/5 rounded-lg"
        >
          Leave
        </button>
      </div>

      {/* Player list */}
      <div className="glass-card rounded-2xl border border-white/10 p-4">
        <div className="text-gray-400 text-xs tracking-widest uppercase mb-3">Players ({players.length})</div>
        <div className="space-y-1.5">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                p.id === me?.id ? 'bg-white/5 text-white font-semibold' : 'text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{p.name}</span>
                {p.id === me?.id && <span className="text-[10px] opacity-60">(you)</span>}
                {!p.connected && <span className="text-[10px] text-red-400/70">offline</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {p.id === hostId && (
                  <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/20 leading-none">
                    HOST
                  </span>
                )}
                {host && p.id !== hostId && (
                  <button
                    onClick={() => setConfirmKickId(p.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-base leading-none px-1"
                    title={`Kick ${p.name}`}
                  >
                    &times;
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Settings (host) / display (non-host) */}
      <div className="glass-card rounded-2xl border border-white/10 p-4">
        <div className="text-gray-400 text-xs tracking-widest uppercase mb-1">Response timer</div>
        <div className="text-gray-500 text-[10px] tracking-wider mb-3">
          starts after a correct clap · other team races to guess
        </div>
        {host ? (
          <select
            value={settings?.timerSeconds ?? 60}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              socket.emit('settings:update', { timerSeconds: val });
            }}
            className="bg-surface-raised text-white rounded-lg px-3 py-2 border border-white/10 w-full"
          >
            {TIMER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-white text-sm">
            {TIMER_OPTIONS.find((o) => o.value === (settings?.timerSeconds ?? 60))?.label ?? 'No timer'}
          </div>
        )}
      </div>

      {/* Start / waiting */}
      <div className="mt-auto">
        {canControlStart ? (
          <button
            onClick={handleStart}
            disabled={!canStart || starting}
            className={`w-full py-4 rounded-2xl font-display text-lg tracking-wider transition-all active:scale-[0.97]
              ${canStart && !starting ? 'btn-success text-white' : 'bg-surface-raised text-gray-600 border border-white/5'}`}
          >
            {!canStart ? 'Need 2+ players' : starting ? 'Starting...' : 'Start Round'}
          </button>
        ) : (
          <div className="w-full py-4 text-center text-gray-500 text-sm tracking-wider">Waiting for host...</div>
        )}
      </div>

      {confirmKickId && (
        <ConfirmModal
          title={`Kick ${players.find((p) => p.id === confirmKickId)?.name ?? 'player'}?`}
          message="They'll be removed from the keep."
          confirmLabel="Kick"
          cancelLabel="Cancel"
          onConfirm={() => {
            socket.emit('player:kick', { targetId: confirmKickId });
            setConfirmKickId(null);
          }}
          onCancel={() => setConfirmKickId(null)}
        />
      )}
    </div>
  );
}
