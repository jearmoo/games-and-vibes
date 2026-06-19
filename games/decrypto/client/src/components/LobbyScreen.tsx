import { useCallback, useState } from 'react';
import { ConfirmModal, RoomQrButton } from '@games/client-core';
import { socket } from '../socket';
import { useGameStore, useIsHost, useMyPlayer, useTeamPlayers, type DecryptoPlayerDTO, type TeamId } from '../store';
import LeaveRoomButton from './LeaveRoomButton';
import { HowToPlayPanel } from './shared';

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
  const offlineAwareness = useGameStore((s) => s.room?.settings.offlineAwareness ?? true);
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

  const redEligibleCount = offlineAwareness ? red.filter((p) => p.connected).length : red.length;
  const blueEligibleCount = offlineAwareness ? blue.filter((p) => p.connected).length : blue.length;
  const canStart = redEligibleCount >= 2 && blueEligibleCount >= 2;

  const handleStart = () => {
    if (!canStart || starting) return;
    setStarting(true);
    useGameStore.getState().startGame();
    setTimeout(() => setStarting(false), 5000);
  };

  const startLabel = !canStart
    ? offlineAwareness
      ? 'Need 2 online per team'
      : 'Need 2 per team'
    : starting
      ? 'Starting...'
      : 'Start Game';

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full max-w-4xl mx-auto flex-col gap-3 px-4 pb-28 pt-4 sm:gap-4 sm:px-5 sm:pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Room code</div>
          <div className="font-display text-4xl tracking-[0.3em] text-white decrypto-title">
            {roomCode}
          </div>
          <div className="mt-1 flex h-4 items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="text-cyan-300/80 text-xs transition-colors hover:text-cyan-200"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <RoomQrButton
              roomCode={roomCode}
              shareUrl={shareUrl}
              className="text-cyan-300/80 text-xs transition-colors hover:text-cyan-200"
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LeaveRoomButton
            className="text-gray-500 hover:text-white text-xs tracking-wider transition-colors px-3 py-1.5 border border-white/5 rounded-lg"
          >
            Leave
          </LeaveRoomButton>
          <div className="flex items-center gap-2">
            {me && (
              <div className="text-right leading-tight">
                <span className="text-gray-400 text-xs">Playing as </span>
                <span className="text-white text-sm font-semibold">{me.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="How to play Decrypto"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-surface-raised font-display text-base text-gray-300 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      <OfflineAwarenessControl enabled={offlineAwareness} host={host} />

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <TeamColumn
          team="red"
          players={red}
          hostId={hostId}
          myId={me?.id ?? null}
          canKick={host}
          onKick={setConfirmKickId}
          showOfflineStatus={offlineAwareness}
        />
        <TeamColumn
          team="blue"
          players={blue}
          hostId={hostId}
          myId={me?.id ?? null}
          canKick={host}
          onKick={setConfirmKickId}
          showOfflineStatus={offlineAwareness}
        />
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-gray-400 text-xs tracking-widest uppercase">Players</div>
            <div className="text-gray-500 text-xs mt-1">
              {offlineAwareness
                ? 'Decrypto needs 2 online players on each channel.'
                : 'Decrypto needs 2 players on each channel.'}
            </div>
          </div>
          <div className="text-right font-display text-white tracking-wider">
            {players.length}
            <span className="text-gray-500 text-xs font-sans ml-1">joined</span>
          </div>
        </div>
      </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 border-t border-white/10 bg-surface/85 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-5">
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
            {startLabel}
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

function OfflineAwarenessControl({ enabled, host }: { enabled: boolean; host: boolean }) {
  return (
    <div className="glass-card rounded-xl border border-white/10 p-3 sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-widest text-gray-400 uppercase sm:text-xs">Offline awareness</div>
          <div className="mt-0.5 text-[11px] text-gray-500 sm:mt-1 sm:text-xs">
            {enabled ? 'Visible offline status' : 'Hidden offline status'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!host}
          onClick={() => useGameStore.getState().setOfflineAwareness(!enabled)}
          className={`relative h-8 w-14 rounded-full border transition-all active:scale-[0.97] ${
            enabled
              ? 'border-cyan-300/40 bg-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
              : 'border-white/10 bg-surface-raised'
          } ${host ? 'cursor-pointer hover:bg-surface-hover' : 'cursor-not-allowed opacity-60'}`}
        >
          <span
            className={`absolute left-px top-px h-7 w-7 rounded-full transition-transform duration-200 ${
              enabled ? 'translate-x-6 bg-cyan-200' : 'translate-x-0 bg-gray-500'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  players,
  hostId,
  myId,
  canKick,
  onKick,
  showOfflineStatus,
}: {
  team: TeamId;
  players: DecryptoPlayerDTO[];
  hostId: string | null;
  myId: string | null;
  canKick: boolean;
  onKick: (id: string) => void;
  showOfflineStatus: boolean;
}) {
  const meta = TEAM_META[team];
  const mine = players.some((p) => p.id === myId);
  const onlineCount = players.filter((p) => p.connected).length;

  return (
    <div
      className={`glass-card rounded-xl border ${meta.border} ${mine ? meta.glow : ''} min-h-[9.5rem] p-2.5 sm:min-h-[16rem] sm:rounded-2xl sm:p-4`}
    >
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-4 sm:items-center sm:gap-3">
        <div className="min-w-0">
          <div className={`truncate font-display text-base tracking-wider sm:text-xl ${meta.text}`}>{meta.label}</div>
          <div className="text-[10px] text-gray-500 sm:text-xs">
            {showOfflineStatus ? `${onlineCount}/${players.length} online` : `${players.length} players`}
          </div>
        </div>
        {!mine && (
          <button
            onClick={() => useGameStore.getState().joinTeam(team)}
            className="rounded-lg border border-white/10 bg-surface-raised px-2 py-1.5 text-[10px] font-semibold tracking-wider text-white transition-all hover:bg-surface-hover active:scale-[0.97] sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
          >
            Join
          </button>
        )}
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
              p.id === myId ? 'bg-white/5 text-white font-semibold' : 'bg-black/10 text-gray-300'
            }`}
          >
            <span className="min-w-0 truncate">
              {p.name}
              {p.id === myId && <span className="ml-1 text-[10px] text-cyan-200 tracking-widest">(YOU)</span>}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {p.id === hostId && (
                <span className="rounded border border-amber-400/20 bg-amber-500/20 px-1 py-0.5 text-[8px] font-semibold leading-none tracking-wide text-amber-300 sm:px-1.5 sm:text-[9px]">
                  HOST
                </span>
              )}
              {showOfflineStatus && !p.connected && (
                <span className="rounded border border-white/10 bg-gray-500/15 px-1 py-0.5 text-[8px] font-semibold leading-none tracking-wide text-gray-400 sm:px-1.5 sm:text-[9px]">
                  OFFLINE
                </span>
              )}
              {canKick && p.id !== hostId && (
                <button
                  onClick={() => onKick(p.id)}
                  className="px-0.5 text-sm leading-none text-gray-500 transition-colors hover:text-rose-300 sm:px-1 sm:text-base"
                  title={`Kick ${p.name}`}
                >
                  &times;
                </button>
              )}
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <div className="py-5 text-center text-xs text-gray-600 sm:py-8 sm:text-sm">No operators yet.</div>
        )}
      </div>
    </div>
  );
}
