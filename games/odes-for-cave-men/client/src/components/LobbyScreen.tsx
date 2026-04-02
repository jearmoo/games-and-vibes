import { useState, useEffect, useCallback } from 'react';
import { useGameStore, useIsHost, useMyPlayer } from '../store';
import { socket } from '../socket';

export default function LobbyScreen() {
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.players);
  const settings = useGameStore((s) => s.settings);
  const hostId = useGameStore((s) => s.hostId);
  const host = useIsHost();
  const me = useMyPlayer();

  const teamA = players.filter((p) => p.team === 'A');
  const teamB = players.filter((p) => p.team === 'B');
  const unassigned = players.filter((p) => !p.team);
  const canStart = teamA.length >= 2 && teamB.length >= 2;
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
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Room Code</div>
        <div
          className="font-display text-4xl tracking-[0.3em] text-white mt-1"
          style={{ textShadow: '0 0 30px rgba(217, 119, 6, 0.3)' }}
        >
          {roomCode}
        </div>
        <button onClick={handleCopy} className="text-amber-400 text-xs mt-1 hover:text-amber-300 transition-colors">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Player identity */}
      {me && (
        <div className="text-center">
          <span className="text-gray-500 text-xs">Playing as </span>
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
          hostId={hostId}
          isHost={host}
          onJoin={() => socket.emit('team:join', { team: 'A' })}
        />
        <TeamColumn
          team="B"
          variant="b"
          players={teamB}
          myId={me?.id ?? null}
          hostId={hostId}
          isHost={host}
          onJoin={() => socket.emit('team:join', { team: 'B' })}
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
                {p.id === hostId && <span className="text-amber-400 text-[10px] ml-1 font-medium">HOST</span>}
              </span>
              {host && (
                <div className="flex gap-2">
                  <button
                    onClick={() => socket.emit('team:assign', { team: 'A', targetPlayerId: p.id })}
                    className="text-[10px] text-team-a-glow hover:text-white transition-colors"
                  >
                    → A
                  </button>
                  <button
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="flex items-center justify-between text-gray-400">
              <span className="text-gray-500">Rounds</span>
              <select
                value={settings.rounds}
                onChange={(e) => socket.emit('settings:update', { rounds: parseInt(e.target.value) })}
                className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between text-gray-400">
              <span className="text-gray-500">Timer (s)</span>
              <input
                type="number"
                min={30}
                max={180}
                value={timerInput}
                onChange={(e) => setTimerInput(e.target.value)}
                onBlur={() => {
                  const v = parseInt(timerInput);
                  if (v && v > 0) {
                    const clamped = Math.max(30, Math.min(180, v));
                    socket.emit('settings:update', { timerSeconds: clamped });
                    setTimerInput(String(clamped));
                  } else {
                    setTimerInput(String(settings.timerSeconds));
                  }
                }}
                className="bg-surface-raised text-white rounded-lg px-2 py-1 border border-white/5 text-sm w-16 text-center"
              />
            </label>
          </div>
        </div>
      )}

      {/* Start */}
      {host && (
        <button
          onClick={() => {
            setStarting(true);
            socket.emit('game:start');
            setTimeout(() => setStarting(false), 5000);
          }}
          disabled={!canStart || starting}
          className={`w-full py-4 rounded-2xl font-display text-lg tracking-wider transition-all active:scale-[0.97]
            ${canStart && !starting ? 'btn-success text-white' : 'bg-surface-raised text-gray-600 border border-white/5'}`}
        >
          {!canStart ? 'Need 2+ per team' : starting ? 'Starting...' : 'Start Game'}
        </button>
      )}
      {!host && (
        <div className="w-full py-3 text-center text-gray-600 text-xs tracking-wider">
          Waiting for host to set up the game...
        </div>
      )}
    </div>
  );
}

function TeamColumn({
  team,
  variant,
  players,
  myId,
  hostId,
  isHost,
  onJoin,
}: {
  team: string;
  variant: 'a' | 'b';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  hostId: string | null;
  isHost: boolean;
  onJoin: () => void;
}) {
  const isOnTeam = players.some((p) => p.id === myId);
  const colors =
    variant === 'a'
      ? { header: 'btn-team-a', badge: 'bg-team-a/20 text-team-a-glow', border: 'border-team-a/20' }
      : { header: 'btn-team-b', badge: 'bg-team-b/20 text-team-b-glow', border: 'border-team-b/20' };

  return (
    <div className={`flex-1 flex flex-col glass-card rounded-2xl overflow-hidden ${colors.border} border`}>
      <div className={`${colors.header} text-center py-2.5 font-display text-sm tracking-wider`}>Team {team}</div>
      <div className="flex-1 p-2.5 space-y-1 overflow-auto">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm
            ${p.id === myId ? `${colors.badge} font-semibold` : 'text-gray-300'}
            ${!p.connected ? 'opacity-30' : ''}`}
          >
            <span>
              {p.name}
              {p.id === myId && <span className="text-[10px] opacity-60 ml-1">(you)</span>}
              {p.id === hostId && <span className="text-amber-400 text-[10px] ml-1 font-medium">HOST</span>}
            </span>
          </div>
        ))}
      </div>
      {isHost && !isOnTeam && (
        <div className="p-2.5 pt-0">
          <button
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
