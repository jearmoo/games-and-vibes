import { useState, useEffect, useCallback } from 'react';
import { useGameStore, useIsHost, useMyPlayer, useTeamName } from '../store';
import type { TeamId } from '@games/odes-for-cave-men-shared';
import { socket } from '../socket';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

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
  const canStart = teamA.length >= 1 && teamB.length >= 1;
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

  // Drag-and-drop (host only)
  const [activePlayer, setActivePlayer] = useState<{ id: string; name: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const player = players.find((p) => p.id === event.active.id);
    if (player) setActivePlayer({ id: player.id, name: player.name });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActivePlayer(null);
    if (!event.over) return;
    const targetTeam = event.over.id === 'drop-unassigned' ? null : (event.over.id as TeamId);
    const playerId = event.active.id as string;
    const player = players.find((p) => p.id === playerId);
    if (!player || player.team === targetTeam) return;
    socket.emit('team:assign', { team: targetTeam, targetPlayerId: playerId });
  };

  const content = (
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
          myTeam={me?.team ?? null}
          hostId={hostId}
          isHost={host}
          isDragActive={!!activePlayer}
        />
        <TeamColumn
          team="B"
          variant="b"
          players={teamB}
          myId={me?.id ?? null}
          myTeam={me?.team ?? null}
          hostId={hostId}
          isHost={host}
          isDragActive={!!activePlayer}
        />
      </div>

      {/* Unassigned */}
      <UnassignedSection
        players={unassigned}
        myId={me?.id ?? null}
        hostId={hostId}
        isHost={host}
        isDragActive={!!activePlayer}
      />

      {/* Settings */}
      {host && (
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
          {!canStart ? 'Need 1+ per team' : starting ? 'Starting...' : 'Start Game'}
        </button>
      )}
      {!host && (
        <div className="w-full py-3 text-center text-gray-600 text-xs tracking-wider">
          {me?.team ? 'Waiting for host to start the game' : 'Join a team to get started'}
        </div>
      )}
    </div>
  );

  return (
    <DndContext sensors={host ? sensors : undefined} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {content}
      {host && (
        <DragOverlay>
          {activePlayer && (
            <div className="px-3 py-2 glass-card rounded-xl text-sm text-white font-semibold shadow-lg shadow-black/40 border border-white/10">
              {activePlayer.name}
            </div>
          )}
        </DragOverlay>
      )}
    </DndContext>
  );
}

function UnassignedSection({
  players,
  myId,
  hostId,
  isHost,
  isDragActive,
}: {
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  hostId: string | null;
  isHost: boolean;
  isDragActive: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'drop-unassigned' });

  if (players.length === 0 && !isDragActive) return null;

  return (
    <div
      ref={isHost ? setNodeRef : undefined}
      className={`space-y-1.5 rounded-xl transition-colors ${
        isOver ? 'bg-white/5 ring-1 ring-white/20' : ''
      } ${isDragActive && isHost ? 'p-2 border border-dashed border-white/10' : ''}`}
    >
      <div className="text-center text-amber-400/80 text-xs font-medium">
        {players.length > 0 ? 'Unassigned' : 'Drop here to unassign'}
      </div>
      {players.map((p) => (
        <PlayerPill key={p.id} player={p} myId={myId} hostId={hostId} isHost={isHost} hostBadgeColor="text-amber-400" />
      ))}
    </div>
  );
}

function PlayerPill({
  player,
  myId,
  hostId,
  isHost,
  hostBadgeColor,
  highlight,
  actions,
}: {
  player: { id: string; name: string; connected: boolean };
  myId: string | null;
  hostId: string | null;
  isHost: boolean;
  hostBadgeColor: string;
  highlight?: string;
  actions?: React.ReactNode;
}) {
  const isDraggable = isHost;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled: !isDraggable,
  });

  return (
    <div
      ref={isDraggable ? setNodeRef : undefined}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all
        ${highlight ?? (player.id === myId ? 'text-white font-semibold' : 'text-gray-300')}
        ${!player.connected ? 'opacity-30' : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
    >
      <span className="truncate">
        {player.name}
        {player.id === myId && <span className="text-[10px] opacity-60 ml-1">(you)</span>}
        {player.id === hostId && <span className={`${hostBadgeColor} text-[10px] ml-1 font-medium`}>HOST</span>}
        {!player.connected && <span className="text-[9px] text-gray-500 ml-1 italic">offline</span>}
      </span>
      {actions}
    </div>
  );
}

function TeamColumn({
  team,
  variant,
  players,
  myId,
  myTeam,
  hostId,
  isHost,
  isDragActive,
}: {
  team: TeamId;
  variant: 'a' | 'b';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  myTeam: TeamId | null;
  hostId: string | null;
  isHost: boolean;
  isDragActive: boolean;
}) {
  const teamName = useTeamName(team);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(teamName);
  const { isOver, setNodeRef } = useDroppable({ id: team });

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
      ref={isHost ? setNodeRef : undefined}
      data-testid={`lobby-team-${team.toLowerCase()}`}
      className={`flex-1 flex flex-col glass-card rounded-2xl overflow-hidden ${colors.border} border transition-all
        ${isOver ? 'ring-2 ring-white/30 scale-[1.02]' : ''}
        ${isDragActive && isHost ? 'ring-1 ring-white/10' : ''}`}
    >
      {/* Header: team name */}
      <div className={`${colors.header} text-center py-2.5`}>
        {editing ? (
          <input
            data-testid={`lobby-team-name-input-${team.toLowerCase()}`}
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
            className="bg-transparent text-center text-white font-display text-sm tracking-wider w-full outline-none px-2"
            style={{ height: '1.5em', lineHeight: '1.5em' }}
          />
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <span
              onClick={() => {
                if (isHost) setEditing(true);
              }}
              className={`font-display text-sm tracking-wider ${isHost ? 'cursor-text hover:opacity-80' : ''} transition-opacity`}
              title={isHost ? 'Click to rename' : undefined}
              style={{ height: '1.5em', lineHeight: '1.5em' }}
            >
              {teamName}
            </span>
            {isHost && (
              <svg className="w-2.5 h-2.5 opacity-40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Player list */}
      <div className="flex-1 p-2.5 space-y-1 overflow-auto">
        {players.map((p) => (
          <PlayerPill
            key={p.id}
            player={p}
            myId={myId}
            hostId={hostId}
            isHost={isHost}
            hostBadgeColor="text-amber-400"
            highlight={p.id === myId ? `${colors.badge} font-semibold` : undefined}
          />
        ))}
        {players.length === 0 && (
          <div className="text-center text-gray-500 text-[11px] py-4">
            {isDragActive && isHost ? 'Drop here' : 'No players yet'}
          </div>
        )}
      </div>

      {/* Join / Leave button */}
      {myId && (
        <div className="p-2.5 pt-0">
          {myTeam === team ? (
            <button
              data-testid={`lobby-leave-team-${team.toLowerCase()}`}
              onClick={() => socket.emit('team:join', { team: null })}
              className="w-full py-2 rounded-xl text-sm font-medium text-gray-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
            >
              Leave
            </button>
          ) : (
            <button
              data-testid={`lobby-join-team-${team.toLowerCase()}`}
              onClick={() => socket.emit('team:join', { team })}
              className={`w-full py-2 rounded-xl text-sm font-medium text-white ${colors.header} transition-all active:scale-[0.97]`}
            >
              Join
            </button>
          )}
        </div>
      )}
    </div>
  );
}
