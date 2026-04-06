import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore, useIsHost, useMyPlayer, useTeamName } from '../store';
import type { TeamId } from '../store';
import { socket } from '../socket';
import LeaveRoomButton from './LeaveRoomButton';
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

  const [showSettings, setShowSettings] = useState(false);

  const settingsSummary = `${settings.rounds === null ? '∞' : settings.rounds} rds · ${settings.timerSeconds}s · ${settings.wordsPerTurn}w · ${settings.maxTabooWords} taboo`;

  const content = (
    <div className="h-full flex flex-col p-4 gap-2 animate-fade-in overflow-y-auto">
      {/* Compact header row 1: room code + identity (pr-10 avoids floating help button) */}
      <div className="flex items-center justify-between pr-10">
        <div
          className="font-display text-2xl tracking-[0.2em] text-white"
          style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.3)' }}
        >
          {roomCode}
        </div>
        {me && (
          <div className="text-right">
            <span className="text-gray-400 text-xs">Playing as </span>
            <span className="text-white text-sm font-semibold">{me.name}</span>
          </div>
        )}
      </div>

      {/* Compact header row 2: copy link + settings summary */}
      <div className="flex items-center justify-between">
        <button onClick={handleCopy} className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        {host ? (
          <button
            data-testid="lobby-settings-trigger"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-gray-400 text-xs hover:text-white transition-colors"
          >
            <span>{settingsSummary}</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        ) : (
          <span className="text-gray-500 text-xs">{settingsSummary}</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex gap-3 flex-1 min-h-[200px]">
        <TeamColumn
          team="A"
          variant="a"
          players={teamA}
          myId={me?.id ?? null}
          myTeam={me?.team ?? null}
          tabooMasterId={tabooMasters.A}
          hostId={hostId}
          isHost={host}
          onSetMaster={(id) => socket.emit('taboo-master:set', { team: 'A', masterId: id })}
          isDragActive={!!activePlayer}
        />
        <TeamColumn
          team="B"
          variant="b"
          players={teamB}
          myId={me?.id ?? null}
          myTeam={me?.team ?? null}
          tabooMasterId={tabooMasters.B}
          hostId={hostId}
          isHost={host}
          onSetMaster={(id) => socket.emit('taboo-master:set', { team: 'B', masterId: id })}
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
            ? teamA.length < 2 || teamB.length < 2
              ? 'Need 2+ per team'
              : 'Each team needs a taboo master'
            : starting
              ? 'Starting...'
              : 'Start Game'}
        </button>
      )}
      {!host && (
        <div className="w-full py-3 text-center text-gray-500 text-xs tracking-wider">
          {me?.team ? 'Waiting for host to start the game' : 'Join a team to get started'}
        </div>
      )}

      <LeaveRoomButton className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm" />

      {/* Settings modal (host only) */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          timerInput={timerInput}
          setTimerInput={setTimerInput}
          onClose={() => setShowSettings(false)}
        />
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
      data-testid="lobby-unassigned"
      className={`rounded-xl px-3 py-2 transition-colors text-xs ${
        isOver ? 'bg-white/5 ring-1 ring-white/20' : ''
      } ${isDragActive && isHost ? 'border border-dashed border-white/10' : ''}`}
    >
      {players.length === 0 ? (
        <div className="text-center text-amber-400/80 font-medium">Drop here to unassign</div>
      ) : (
        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <span className="text-amber-400/80 font-medium mr-0.5">Unassigned:</span>
          {players.map((p, i) => (
            <UnassignedChip
              key={p.id}
              player={p}
              myId={myId}
              hostId={hostId}
              isHost={isHost}
              isLast={i === players.length - 1}
            />
          ))}
        </span>
      )}
    </div>
  );
}

function UnassignedChip({
  player,
  myId,
  hostId,
  isHost,
  isLast,
}: {
  player: { id: string; name: string; connected: boolean };
  myId: string | null;
  hostId: string | null;
  isHost: boolean;
  isLast: boolean;
}) {
  const isDraggable = isHost;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
    disabled: !isDraggable,
  });

  return (
    <span
      ref={isDraggable ? setNodeRef : undefined}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      data-testid={`lobby-player-${player.name}`}
      className={`inline-flex items-center whitespace-nowrap transition-all
        ${player.id === myId ? 'text-white font-semibold' : 'text-gray-300'}
        ${isDragging ? 'opacity-30' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
    >
      {player.name}
      {player.id === myId && <span className="text-[9px] opacity-60 ml-0.5">(you)</span>}
      {player.id === hostId && <span className="text-indigo-400 text-[9px] ml-0.5 font-medium">HOST</span>}
      {!player.connected && <span className="text-[8px] text-gray-500 ml-0.5 italic">offline</span>}
      {!isLast && <span className="text-gray-600">,</span>}
    </span>
  );
}

function PlayerPill({
  player,
  myId,
  hostId,
  isHost,
  highlight,
  actions,
}: {
  player: { id: string; name: string; connected: boolean };
  myId: string | null;
  hostId: string | null;
  isHost: boolean;
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
      data-testid={`lobby-player-${player.name}`}
      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all
        ${highlight ?? (player.id === myId ? 'text-white font-semibold' : 'text-gray-200')}
        ${isDragging ? 'opacity-30' : ''}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="truncate">
          {player.name}
          {player.id === myId && <span className="text-[10px] opacity-60 ml-1">(you)</span>}
          {!player.connected && <span className="text-[9px] text-gray-500 ml-1 italic">offline</span>}
        </span>
        {player.id === hostId && (
          <span className="shrink-0 text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 leading-none">
            H
          </span>
        )}
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
  tabooMasterId,
  hostId,
  isHost,
  onSetMaster,
  isDragActive,
}: {
  team: TeamId;
  variant: 'a' | 'b';
  players: Array<{ id: string; name: string; connected: boolean }>;
  myId: string | null;
  myTeam: TeamId | null;
  tabooMasterId: string | null;
  hostId: string | null;
  isHost: boolean;
  onSetMaster: (id: string) => void;
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
            highlight={p.id === myId ? `${colors.badge} font-semibold` : undefined}
            actions={
              <span className="flex items-center gap-1.5 shrink-0">
                {p.id === tabooMasterId && <span className="text-accent text-[10px] font-medium">TM</span>}
                {isHost && p.id !== tabooMasterId && (
                  <button
                    data-testid={`lobby-set-tm-${p.name}`}
                    onClick={() => onSetMaster(p.id)}
                    className="text-[10px] text-gray-400 hover:text-white transition-colors"
                  >
                    Set TM
                  </button>
                )}
                {isHost && p.id !== hostId && (
                  <button
                    onClick={() => socket.emit('player:kick', { targetId: p.id })}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors ml-1"
                    title="Kick player"
                  >
                    &times;
                  </button>
                )}
              </span>
            }
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

function SettingsModal({
  settings,
  timerInput,
  setTimerInput,
  onClose,
}: {
  settings: { rounds: number | null; timerSeconds: number; wordsPerTurn: number; maxTabooWords: number };
  timerInput: string;
  setTimerInput: (v: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl border border-white/10 max-w-xs w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="font-display text-lg text-white tracking-wider mb-4"
          style={{ textShadow: '0 0 20px rgba(99,102,241,0.3)' }}
        >
          Settings
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm" data-testid="lobby-settings">
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Rounds</span>
            <select
              data-testid="lobby-rounds-select"
              value={settings.rounds === null ? 'unlimited' : settings.rounds}
              onChange={(e) => {
                const val = e.target.value === 'unlimited' ? null : parseInt(e.target.value);
                socket.emit('settings:update', { rounds: val });
              }}
              className="bg-surface-raised text-white rounded-lg px-2 py-1.5 border border-white/5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="unlimited">∞</option>
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
              className="bg-surface-raised text-white rounded-lg px-2 py-1.5 border border-white/5 w-16 text-center"
            />
          </label>
          <label className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400">Words</span>
            <select
              data-testid="lobby-words-select"
              value={settings.wordsPerTurn}
              onChange={(e) => socket.emit('settings:update', { wordsPerTurn: parseInt(e.target.value) })}
              className="bg-surface-raised text-white rounded-lg px-2 py-1.5 border border-white/5"
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
              className="bg-surface-raised text-white rounded-lg px-2 py-1.5 border border-white/5"
            >
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {settings.wordsPerTurn > 0 && (
          <div className="text-center text-[10px] text-gray-500 mt-3">
            {Math.round(settings.timerSeconds / settings.wordsPerTurn)}s avg per word
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl text-white font-display tracking-wider btn-primary transition-all active:scale-[0.97]"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
