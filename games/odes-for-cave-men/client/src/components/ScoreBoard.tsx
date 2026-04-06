import { useState } from 'react';
import { ConfirmModal } from '@games/client-core';
import { useGameStore, useMyPlayer, useTeamPlayers, useTeamName } from '../store';
import { socket } from '../socket';
import { HelpButton } from './HelpModal';
import HistoryPanel from './HistoryPanel';

export default function ScoreBoard() {
  const scores = useGameStore((s) => s.scores);
  const round = useGameStore((s) => s.round);
  const settings = useGameStore((s) => s.settings);
  const phase = useGameStore((s) => s.phase);
  const playingTeam = useGameStore((s) => s.playingTeam);
  const roundHistory = useGameStore((s) => s.roundHistory);
  const me = useMyPlayer();
  const [showHistory, setShowHistory] = useState(false);
  const [showRoster, setShowRoster] = useState(false);

  const teamColor = me?.team === 'A' ? 'text-amber-400' : me?.team === 'B' ? 'text-emerald-400' : 'text-gray-400';

  const centerText =
    phase === 'PLAYING' || phase === 'READY' || phase === 'REVIEW'
      ? `Team ${playingTeam}`
      : settings.rounds !== null
        ? `R${round}/${settings.rounds}`
        : `R${round}`;

  return (
    <div className="bg-surface-card border-b border-white/5">
      {/* Player identity strip — with history (left) and help (right) */}
      <div className="relative flex items-center justify-center gap-2 px-12 py-2 text-[10px] border-b border-white/[0.03]">
        {/* Left button group */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {roundHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-400 hover:bg-white/5 transition-colors"
              title="Round History"
              aria-label="Round History"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <polyline points="12,7 12,12 15.5,14" />
              </svg>
            </button>
          )}
        </div>

        {/* Center — player name, tap to show roster */}
        <button
          onClick={() => setShowRoster(!showRoster)}
          aria-label={showRoster ? 'Hide player roster' : 'Show player roster'}
          aria-expanded={showRoster}
          className="flex items-center gap-1"
        >
          <span className={`font-semibold ${teamColor}`}>{me?.name}</span>
          {me?.team && <span className="text-gray-600">&middot;</span>}
          {me?.team && <span className={teamColor}>Team {me.team}</span>}
          <svg
            className={`w-2.5 h-2.5 text-gray-600 transition-transform ${showRoster ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Right button group */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <HelpButton className="w-7 h-7 flex items-center justify-center rounded-lg text-sm text-gray-400 hover:text-amber-400 hover:bg-white/5 transition-colors font-semibold" />
        </div>
      </div>

      {showRoster && <TeamRoster />}

      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]" />
          <span className="text-amber-400 font-display text-sm tracking-wider">A: {scores.A}</span>
        </div>
        <div className="text-gray-600 text-[10px] tracking-[0.2em] uppercase font-medium">{centerText}</div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-display text-sm tracking-wider">B: {scores.B}</span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(5,150,105,0.5)]" />
        </div>
      </div>

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function TeamRoster() {
  const teamA = useTeamPlayers('A');
  const teamB = useTeamPlayers('B');
  const nameA = useTeamName('A');
  const nameB = useTeamName('B');
  const hostId = useGameStore((s) => s.hostId);

  const myId = useGameStore((s) => s.playerId);

  return (
    <div className="flex border-b border-white/5 divide-x divide-white/5">
      <RosterColumn name={nameA} glow="text-amber-400" players={teamA} hostId={hostId} myId={myId} />
      <RosterColumn name={nameB} glow="text-emerald-400" players={teamB} hostId={hostId} myId={myId} />
    </div>
  );
}

function RosterColumn({
  name,
  glow,
  players,
  hostId,
  myId,
}: {
  name: string;
  glow: string;
  players: Array<{ id: string; name: string; connected: boolean }>;
  hostId: string | null;
  myId: string | null;
}) {
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const amHost = myId === hostId;

  return (
    <div className="flex-1 px-3 py-2 space-y-0.5">
      <div className={`text-[9px] uppercase tracking-widest font-bold ${glow}`}>{name}</div>
      {players.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1">
            <span className="text-gray-300">{p.name}</span>
            {p.id === hostId && <span className="text-amber-400/60 text-[8px]">H</span>}
          </span>
          {amHost && p.id !== hostId && (
            <button
              onClick={() => setConfirmKickId(p.id)}
              className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
              title="Kick"
            >
              &times;
            </button>
          )}
        </div>
      ))}
      {players.length === 0 && <div className="text-[10px] text-gray-600 italic">Empty</div>}

      {confirmKickId && (
        <ConfirmModal
          title={`Kick ${players.find((p) => p.id === confirmKickId)?.name ?? 'player'}?`}
          message="They'll be removed from the room."
          confirmLabel="Kick"
          cancelLabel="Cancel"
          confirmClass="btn-team-b"
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
