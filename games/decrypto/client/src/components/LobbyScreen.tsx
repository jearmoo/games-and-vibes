import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmModal } from '@games/client-core';
import { socket } from '../socket';
import { useGameStore, useIsHost, useMyPlayer, useTeamPlayers, type DecryptoPlayerDTO, type TeamId } from '../store';

const TEAM_META: Record<TeamId, { label: string; border: string; text: string; glow: string }> = {
  red: {
    label: 'Red channel',
    border: 'border-rose-500/40',
    text: 'text-rose-300',
    glow: 'shadow-[0_0_28px_rgba(244,63,94,0.16)]',
  },
  blue: {
    label: 'Blue channel',
    border: 'border-cyan-400/40',
    text: 'text-cyan-200',
    glow: 'shadow-[0_0_28px_rgba(34,211,238,0.16)]',
  },
};

export default function LobbyScreen() {
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.room?.players ?? []);
  const hostId = useGameStore((s) => s.room?.hostId ?? null);
  const host = useIsHost();
  const me = useMyPlayer();
  const red = useTeamPlayers('red');
  const blue = useTeamPlayers('blue');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const shareUrl = roomCode ? `${window.location.origin}/${roomCode}` : '';
  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const canStart = red.filter((p) => p.connected).length >= 2 && blue.filter((p) => p.connected).length >= 2;

  const handleStart = () => {
    if (!canStart || starting) return;
    setStarting(true);
    useGameStore.getState().startGame();
    setTimeout(() => setStarting(false), 5000);
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Room code</div>
          <button
            onClick={handleCopy}
            className="font-display text-4xl tracking-[0.3em] text-white hover:opacity-90 transition-opacity decrypto-title"
            title="Tap to copy link"
          >
            {roomCode}
          </button>
          <div className="text-cyan-300/80 text-xs mt-1 h-4">{copied ? 'Link copied!' : 'Tap code to copy link'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="How to play Decrypto"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface-raised font-display text-base text-gray-300 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            ?
          </button>
          <button
            onClick={() => useGameStore.getState().leaveRoom()}
            className="text-gray-500 hover:text-white text-xs tracking-wider transition-colors px-3 py-1.5 border border-white/5 rounded-lg"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamColumn
          team="red"
          players={red}
          hostId={hostId}
          myId={me?.id ?? null}
          canKick={host}
          onKick={setConfirmKickId}
        />
        <TeamColumn
          team="blue"
          players={blue}
          hostId={hostId}
          myId={me?.id ?? null}
          canKick={host}
          onKick={setConfirmKickId}
        />
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-gray-400 text-xs tracking-widest uppercase">Players</div>
            <div className="text-gray-500 text-xs mt-1">
              Decrypto needs at least 2 connected players on each channel.
            </div>
          </div>
          <div className="text-right font-display text-white tracking-wider">
            {players.length}
            <span className="text-gray-500 text-xs font-sans ml-1">joined</span>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        {host ? (
          <button
            onClick={handleStart}
            disabled={!canStart || starting}
            className={`w-full py-4 rounded-2xl font-display text-lg tracking-wider transition-all active:scale-[0.97] ${
              canStart && !starting
                ? 'btn-decrypto text-white'
                : 'bg-surface-raised text-gray-600 border border-white/5'
            }`}
          >
            {!canStart ? 'Need 2 per team' : starting ? 'Starting...' : 'Start Game'}
          </button>
        ) : (
          <div className="w-full py-4 text-center text-gray-500 text-sm tracking-wider">Waiting for host...</div>
        )}
      </div>

      {confirmKickId && (
        <ConfirmModal
          title={`Kick ${players.find((p) => p.id === confirmKickId)?.name ?? 'player'}?`}
          message="They will be removed from the room."
          confirmLabel="Kick"
          cancelLabel="Cancel"
          onConfirm={() => {
            socket.emit('player:kick', { targetId: confirmKickId });
            setConfirmKickId(null);
          }}
          onCancel={() => setConfirmKickId(null)}
        />
      )}
      {helpOpen && <HowToPlayPanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function HowToPlayPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play Decrypto"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)] animate-fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">How to play</div>
            <div className="font-display text-2xl tracking-wider text-white">Decrypto</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how to play"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-xl leading-none text-gray-400 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-gray-300">
          <p>
            Each team has 4 secret keywords. Your team gives clues that point to three of those words in a hidden order.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-[10px] tracking-[0.25em] text-gray-500 uppercase">Round flow</div>
            <p>
              The encryptor sees a 3-number code, gives three clues, then teammates guess the order. From round 2 on,
              the other team also tries to intercept your code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <div className="font-display tracking-wider text-emerald-200">Win</div>
              <p className="mt-1 text-xs text-gray-300">Intercept 2 enemy transmissions.</p>
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
              <div className="font-display tracking-wider text-rose-200">Avoid</div>
              <p className="mt-1 text-xs text-gray-300">2 team miscommunications.</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Round 1 has no intercept. Clues can be typed or drawn, but keep them clear enough for your team and vague
            enough to hide your keywords.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TeamColumn({
  team,
  players,
  hostId,
  myId,
  canKick,
  onKick,
}: {
  team: TeamId;
  players: DecryptoPlayerDTO[];
  hostId: string | null;
  myId: string | null;
  canKick: boolean;
  onKick: (id: string) => void;
}) {
  const meta = TEAM_META[team];
  const mine = players.some((p) => p.id === myId);

  return (
    <div className={`glass-card rounded-2xl border ${meta.border} ${mine ? meta.glow : ''} p-4 min-h-[16rem]`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className={`font-display text-xl tracking-wider ${meta.text}`}>{meta.label}</div>
          <div className="text-gray-500 text-xs">{players.length} players</div>
        </div>
        {!mine && (
          <button
            onClick={() => useGameStore.getState().joinTeam(team)}
            className="px-3 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-white text-xs font-semibold tracking-wider transition-all active:scale-[0.97]"
          >
            Join
          </button>
        )}
      </div>

      <div className="space-y-2">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm ${
              p.id === myId ? 'bg-white/5 text-white font-semibold' : 'bg-black/10 text-gray-300'
            }`}
          >
            <span className="min-w-0 truncate">
              {p.name}
              {p.id === myId && <span className="ml-1 text-[10px] text-cyan-200 tracking-widest">(YOU)</span>}
              {!p.connected && <span className="ml-1 text-[10px] text-rose-300/80">offline</span>}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {p.id === hostId && (
                <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/20 leading-none">
                  HOST
                </span>
              )}
              {canKick && p.id !== hostId && (
                <button
                  onClick={() => onKick(p.id)}
                  className="text-gray-500 hover:text-rose-300 transition-colors text-base leading-none px-1"
                  title={`Kick ${p.name}`}
                >
                  &times;
                </button>
              )}
            </span>
          </div>
        ))}
        {players.length === 0 && <div className="text-gray-600 text-sm py-8 text-center">No operators yet.</div>}
      </div>
    </div>
  );
}
