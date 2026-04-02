import { useState, useEffect, useCallback } from 'react';
import { useGameStore, useIsHost, useMyPlayer, useTeamName } from '../store';
import type { TeamId } from '../store';
import { socket } from '../socket';
import LeaveRoomButton from './LeaveRoomButton';

export default function LobbyScreen() {
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.players);
  const settings = useGameStore((s) => s.settings);
  const tabooMasters = useGameStore((s) => s.tabooMasters);
  const hostId = useGameStore((s) => s.hostId);
  const host = useIsHost();
  const me = useMyPlayer();

  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');
  const unassigned = players.filter((p) => !p.team);
  const canStart = teamA.length >= 2 && teamB.length >= 2 && !!tabooMasters.A && !!tabooMasters.B;
  const [starting, setStarting] = useState(false);

  const [timerInput, setTimerInput] = useState(String(settings.timerSeconds));
  useEffect(() => {
    setTimerInput(String(settings.timerSeconds));
  }, [settings.timerSeconds]);

  const shareUrl = `${window.location.origin}/${roomCode}`;
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Room code */}
      <div className="text-center py-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-medium">Room Code</div>
        <div
          className="font-display text-4xl tracking-[0.3em] text-white mt-1"
          style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.3)' }}
        >
          {roomCode}
        </div>
        <button onClick={handleCopy} className="text-indigo-400 text-xs mt-1 hover:text-indigo-300 transition-colors">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Player identity */}
      {me && (
        <div className="text-center">
          <span className="text-gray-400 text-xs">Playing as </span>
          <span className="text-white text-sm font-semibold">{me.name}</span>
        </div>
      )}

      {/* Teams */}
      <div className="flex gap-3 flex-1 min-h-0">
        <TeamColumn
          team="A"
          variant="a"
          players={teamA}
          myId={me?.id ?? null}
          tabooMasterId={tabooMasters.A}
          hostId={hostId}
          isHost={host}
          onJoin={() => socket.emit('team:join', { team: 'A' })}
          onSetMaster={(id) => socket.emit('taboo-master:set', { team: 'A', masterId: id })}
        />
        <TeamColumn
          team="B"
          variant="b"
          players={teamB}
          myId={me?.id ?? null}
          tabooMasterId={tabooMasters.B}
          hostId={hostId}
          isHost={host}
          onJoin={() => socket.emit('team:join', { team: 'B' })}
          onSetMaster={(id) => socket.emit('taboo-master:set', { team: 'B', masterId: id })}
        />
      </div>

      {unassigned.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-center text-amber-400/80 text-xs font-medium">Unassigned</div>
          {unassigned.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 glass-card rounded-xl text-sm ${
                p.id === me?.id ? 'text-white font-semibold' : 'text-gray-300'
              }`}
            >
              <span>
                {p.name}
                {p.id === me?.id && <span className="text-[10px] opacity-60 ml-1">(you)</span>}
                {p.id === hostId && <span className="text-indigo-400 text-[10px] ml-1 font-medium">HOST</span>}
              </span>
              {host && (
                <div className="flex gap-2">
                  <button
                    data-testid={`lobby-assign-${p.name}-a`}
                    onClick={() => socket.emit('team:assign', { team: 'A', targetPlayerId: p.id })}
                    className="text-[10px] text-team-a-glow hover:text-white transition-colors"
                  >
                    → A
                  </button>
                  <button
                    data-testid={`lobby-assign-${p.name}-b`}
                    onClick={() => socket.emit('team:assign', { team: 'B', targetPlayerId: p.id })}
                    className="text-[10px] text-team-b-glow hover:text-white transition-colors"
                  >
                    → B
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {host && (
        <div className="grid grid-cols-2 gap-3 text-xs" data-testid="lobby-settings">
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Rounds</span>
            <select
              data-testid="lobby-rounds-select"
              value={settings.rounds === null ? 'unlimited' : settings.rounds}
              onChange={(e) => {
                const val = e.target.value === 'unlimited' ? null : parseInt(e.target.value);
                socket.emit('settings:update', { rounds: val });
              }}
              className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="unlimited">Unlimited</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Timer (s)</span>
            <input
              data-testid="lobby-timer-input"
              type="number"
              min={10}
              max={600}
              value={timerInput}
              onChange={(e) => setTimerInput(e.target.value)}
              onBlur={() => {
                const v = parseInt(timerInput);
                if (v && v > 0) {
                  const clamped = Math.max(10, Math.min(600, v));
                  socket.emit('settings:update', { timerSeconds: clamped });
                  setTimerInput(String(clamped));
                } else {
                  setTimerInput(String(settings.timerSeconds));
                }
              }}
              className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm w-16 text-center"
            />
          </label>
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Words</span>
            <select
              data-testid="lobby-words-select"
              value={settings.wordsPerTurn}
              onChange={(e) => socket.emit('settings:update', { wordsPerTurn: parseInt(e.target.value) })}
              className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm"
            >
              {[3, 4, 5, 6, 7, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Taboos</span>
            <select
              data-testid="lobby-taboos-select"
              value={settings.maxTabooWords}
              onChange={(e) => socket.emit('settings:update', { maxTabooWords: parseInt(e.target.value) })}
              className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm"
            >
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Avg time info */}
      {host && settings.wordsPerTurn > 0 && (
        <div className="text-center text-[10px] text-gray-500">
          {Math.round(settings.timerSeconds / settings.wordsPerTurn)}s avg per word
        </div>
      )}

      {/* Start */}
      {host && (
        <button
          data-testid="lobby-start-button"
          onClick={() => {
            setStarting(true);
            socket.emit('game:start');
            setTimeout(() => setStarting(false), 5000);
          }}
          disabled={!canStart || starting}
          className={`w-full py-4 rounded-2xl font-display text-lg tracking-wider transition-all active:scale-[0.97]
            ${canStart && !starting ? 'btn-success text-white' : 'bg-surface-raised text-gray-500 border border-white/5'}`}
        >
          {!canStart
            ? !tabooMasters.A || !tabooMasters.B
              ? 'Each team needs a taboo master'
              : 'Need 2+ per team'
            : starting
              ? 'Starting...'
              : 'Start Game'}
        </button>
      )}
      {!host && (
        <div className="w-full py-3 text-center text-gray-500 text-xs tracking-wider">
          Waiting for host to set up the game...
        </div>
      )}

      <LeaveRoomButton className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm" />
    </div>
  );
}

function TeamColumn({
  team,
  variant,
  players,
  myId,
  tabooMasterId,
  hostId,
  isHost,
  onJoin,
  onSetMaster,
}: {
  team: TeamId;
  variant: 'a' | 'b';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  tabooMasterId: string | null;
  hostId: string | null;
  isHost: boolean;
  onJoin: () => void;
  onSetMaster: (id: string) => void;
}) {
  const isOnTeam = players.some((p) => p.id === myId);
  const teamName = useTeamName(team);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(teamName);

  useEffect(() => {
    setNameInput(teamName);
  }, [teamName]);

  const colors =
    variant === 'a'
      ? { header: 'btn-team-a', badge: 'bg-team-a/20 text-team-a-glow', border: 'border-team-a/20' }
      : { header: 'btn-team-b', badge: 'bg-team-b/20 text-team-b-glow', border: 'border-team-b/20' };

  const handleNameSubmit = () => {
    setEditing(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== teamName) {
      socket.emit('team-names:update', { teamNames: { [team]: trimmed } });
    } else {
      setNameInput(teamName);
    }
  };

  return (
    <div
      data-testid={`lobby-team-${team.toLowerCase()}`}
      className={`flex-1 flex flex-col glass-card rounded-2xl overflow-hidden ${colors.border} border`}
    >
      <div className={`${colors.header} text-center py-2.5 font-display text-sm tracking-wider`}>
        {editing ? (
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNameInput(teamName);
                setEditing(false);
              }
            }}
            maxLength={20}
            autoFocus
            className="bg-transparent text-center text-white font-display text-sm tracking-wider w-full outline-none border-b border-white/30"
          />
        ) : (
          <span
            onClick={() => {
              if (isHost) setEditing(true);
            }}
            className={isHost ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
            title={isHost ? 'Click to rename' : undefined}
          >
            {teamName}
          </span>
        )}
      </div>
      <div className="flex-1 p-2.5 space-y-1 overflow-auto">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm
            ${p.id === myId ? `${colors.badge} font-semibold` : 'text-gray-200'}
            ${!p.connected ? 'opacity-30' : ''}`}
          >
            <span>
              {p.name}
              {p.id === myId && <span className="text-[10px] opacity-60 ml-1">(you)</span>}
              {p.id === hostId && <span className="text-indigo-400 text-[10px] ml-1 font-medium">HOST</span>}
              {p.id === tabooMasterId && <span className="text-accent text-[10px] ml-1 font-medium">TM</span>}
              {!p.connected && <span className="text-[9px] text-gray-500 ml-1 italic">offline</span>}
            </span>
            {isHost && p.id !== tabooMasterId && (
              <button
                data-testid={`lobby-set-tm-${p.name}`}
                onClick={() => onSetMaster(p.id)}
                className="text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                Set TM
              </button>
            )}
          </div>
        ))}
      </div>
      {isHost && !isOnTeam && (
        <div className="p-2.5 pt-0">
          <button
            data-testid={`lobby-join-team-${team.toLowerCase()}`}
            onClick={onJoin}
            className={`w-full py-2.5 rounded-xl text-white text-sm font-display tracking-wider transition-all active:scale-[0.97] ${colors.header}`}
          >
            Join
          </button>
        </div>
      )}
    </div>
  );
}
