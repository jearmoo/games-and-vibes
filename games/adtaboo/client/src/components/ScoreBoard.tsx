import { useState } from 'react';
import { useGameStore, useTeamPlayers, useMyPlayer, useMyRole, useTeamName } from '../store';
import { socket } from '../socket';
import HistoryPanel from './HistoryPanel';
import { HelpButton } from './HelpModal';

const ROLE_LABELS: Record<string, string> = {
  'clue-giver': 'Clue-Giver',
  guesser: 'Guesser',
  'taboo-master': 'Taboo Master',
  'taboo-watcher': 'Watcher',
};

export default function ScoreBoard() {
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scores = useGameStore((s) => s.scores);
  const round = useGameStore((s) => s.round);
  const settings = useGameStore((s) => s.settings);
  const phase = useGameStore((s) => s.phase);
  const cluingTeam = useGameStore((s) => s.cluingTeam);
  const tabooMasters = useGameStore((s) => s.tabooMasters);
  const hostId = useGameStore((s) => s.hostId);
  const roundHistory = useGameStore((s) => s.roundHistory);
  const teamA = useTeamPlayers('A');
  const teamB = useTeamPlayers('B');
  const me = useMyPlayer();
  const myRole = useMyRole();
  const teamAName = useTeamName('A');
  const teamBName = useTeamName('B');

  const teamColor = me?.team === 'A' ? 'text-team-a-glow' : me?.team === 'B' ? 'text-team-b-glow' : 'text-gray-300';

  return (
    <div className="bg-surface-card border-b border-white/5">
      {/* Player identity strip */}
      <div className="relative flex items-center justify-center gap-2 px-12 py-2 text-sm border-b border-white/[0.03]">
        {/* Left button group */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {roundHistory.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-accent hover:bg-white/5 transition-colors"
              title="Round History"
              aria-label="Round History"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8" r="6.5" />
                <polyline points="8,4.5 8,8 10.5,9.5" />
              </svg>
            </button>
          )}
        </div>

        <span className={`font-semibold ${teamColor}`}>{me?.name}</span>
        {me?.team && <span className="text-gray-400">&middot;</span>}
        {me?.team && <span className={`font-medium ${teamColor}`}>{me.team === 'A' ? teamAName : teamBName}</span>}
        {myRole && <span className="text-gray-400">&middot;</span>}
        {myRole && <span className="text-accent font-medium">{ROLE_LABELS[myRole] || myRole}</span>}

        {/* Right button group */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <HelpButton className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-400 hover:text-accent hover:bg-white/5 transition-colors font-semibold" />
        </div>
      </div>

      {/* Score bar */}
      <button onClick={() => setExpanded(!expanded)} className="w-full grid grid-cols-3 items-center px-4 py-2.5">
        <div className={`text-left ${cluingTeam && cluingTeam !== 'A' ? 'opacity-50' : ''}`}>
          <div className="text-team-a-glow font-display text-base tracking-wider">{teamAName}</div>
          <div className="text-team-a-glow font-display text-base tracking-wider">{scores.A}</div>
        </div>
        <div className="text-gray-300 text-xs tracking-[0.2em] uppercase font-medium text-center">
          {phase === 'PARALLEL_SETUP'
            ? 'Setup'
            : phase === 'CLUING_A'
              ? teamAName
              : phase === 'CLUING_B'
                ? teamBName
                : `R${round}/${settings.rounds}`}
          <span className="ml-1.5 text-gray-600">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
        <div className={`text-right ${cluingTeam && cluingTeam !== 'B' ? 'opacity-50' : ''}`}>
          <div className="text-team-b-glow font-display text-base tracking-wider">{teamBName}</div>
          <div className="text-team-b-glow font-display text-base tracking-wider">{scores.B}</div>
        </div>
      </button>

      {expanded && (
        <div className="flex gap-3 px-4 pb-3 animate-slide-up">
          <RosterColumn
            team="A"
            players={teamA}
            myId={me?.id ?? null}
            tabooMasterId={tabooMasters.A}
            hostId={hostId}
            phase={phase}
          />
          <RosterColumn
            team="B"
            players={teamB}
            myId={me?.id ?? null}
            tabooMasterId={tabooMasters.B}
            hostId={hostId}
            phase={phase}
          />
        </div>
      )}

      {/* History Panel */}
      {historyOpen && <HistoryPanel onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

function RosterColumn({
  team,
  players,
  myId,
  tabooMasterId,
  hostId,
  phase,
}: {
  team: 'A' | 'B';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  tabooMasterId: string | null;
  hostId: string | null;
  phase: string | null;
}) {
  const borderColor = team === 'A' ? 'border-team-a/20' : 'border-team-b/20';
  const textColor = team === 'A' ? 'text-team-a-glow' : 'text-team-b-glow';
  const isOnTeam = players.some((p) => p.id === myId);
  const teamName = useTeamName(team);

  return (
    <div className={`flex-1 rounded-xl border ${borderColor} bg-surface/50 p-2`}>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1 px-1">{teamName}</div>
      {players.map((p) => {
        const isTM = p.id === tabooMasterId;
        const isHost = p.id === hostId;

        return (
          <div
            key={p.id}
            className={`flex items-center justify-between px-2 py-1 text-xs rounded-lg ${
              p.id === myId ? `${textColor} font-semibold` : 'text-gray-300'
            } ${!p.connected ? 'opacity-30' : ''}`}
          >
            <span>
              {p.name}
              {isTM && <span className="text-accent text-[9px] ml-1">TM</span>}
              {isHost && <span className="text-indigo-400 text-[9px] ml-1">H</span>}
            </span>
            {isOnTeam && !isTM && p.connected && (!phase || phase === 'LOBBY' || phase === 'ROUND_RESULT') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  socket.emit('taboo-master:set', { team, masterId: p.id });
                }}
                className="text-[9px] text-gray-500 hover:text-accent transition-colors"
              >
                Set TM
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
