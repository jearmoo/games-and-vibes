import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  buildDeck,
  DECK_GROUPS,
  DECK_ITEM_MAP,
  resolveSelection,
  type DeckItem,
  type RoleTeam,
} from '@games/two-rooms-and-a-boom-shared';
import { socket } from '../socket';
import { useGameStore, useIsHost, useSelection } from '../store';
import RolesInPlay from './RolesInPlay';

const TEAM_DOT: Record<RoleTeam, string> = {
  blue: 'bg-boom-blue',
  red: 'bg-boom-red',
  grey: 'bg-boom-grey',
};

export default function LobbyScreen() {
  const room = useGameStore((s) => s.room)!;
  const isHost = useIsHost();
  const selection = useSelection();
  const updateSelection = useGameStore((s) => s.updateSelection);
  const startGame = useGameStore((s) => s.startGame);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const playerId = useGameStore((s) => s.playerId);

  const [search, setSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [copied, setCopied] = useState(false);

  const connectedPlayers = room.players.filter((p) => p.connected);
  const playerCount = connectedPlayers.length;
  const selected = useMemo(() => new Set(resolveSelection(selection)), [selection]);

  // Live deck preview: chosen cards + auto-balanced filler for this headcount.
  const deck = useMemo(() => buildDeck({ selectedItemIds: [...selected], playerCount }), [selected, playerCount]);

  /** Toggle an item; selecting/clearing cascades through requirements server-side too. */
  function toggle(item: DeckItem): void {
    const next = new Set(selected);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    updateSelection(resolveSelection([...next]));
  }

  function clearAll(): void {
    updateSelection([]);
  }

  /** Group → items filtered by search, hiding requirement-locked items until ready. */
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DECK_GROUPS.map((group) => ({
      ...group,
      items: group.itemIds
        .map((id) => DECK_ITEM_MAP.get(id))
        .filter((it): it is DeckItem => {
          if (!it || it.kind === 'locked') return false;
          if (q && !it.label.toLowerCase().includes(q)) return false;
          return true;
        }),
    })).filter((group) => group.items.length > 0);
  }, [search]);

  function copyLink(): void {
    const url = `${window.location.origin}/${room.code}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-full p-4 sm:p-6 max-w-2xl mx-auto w-full animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <button onClick={copyLink} className="text-left">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">Room code · tap to copy</div>
          <div className="font-display text-4xl tracking-[0.3em] text-accent">{room.code}</div>
          <div className="text-accent/80 text-xs mt-1 h-4">{copied ? 'Link copied!' : ''}</div>
        </button>
        <button onClick={leaveRoom} className="btn-ghost btn-ghost-sm">
          Leave
        </button>
      </div>

      {/* Players */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <h2 className="text-gray-400 text-xs tracking-widest uppercase mb-3">Players ({playerCount})</h2>
        <div className="space-y-1.5">
          {room.players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                p.id === playerId ? 'bg-white/5 text-white font-semibold' : 'text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 rounded-full ${p.connected ? 'bg-green-400' : 'bg-white/25'}`} />
                <span className="truncate">{p.name}</span>
                {p.id === playerId && <span className="text-[10px] opacity-60">(you)</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {room.hostId === p.id && (
                  <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/20 leading-none">
                    HOST
                  </span>
                )}
                {isHost && p.id !== playerId && (
                  <button
                    onClick={() => socket.emit('player:kick', { targetId: p.id })}
                    className="text-gray-500 hover:text-boom-red-glow transition-colors text-base leading-none px-1"
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

      {/* Deck preview */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-gray-400 text-xs tracking-widest uppercase">Deck for {playerCount} players</h2>
          <span className={`text-sm font-semibold ${deck.valid ? 'text-green-400' : 'text-boom-red-glow'}`}>
            {deck.valid ? `${deck.cardCount} cards` : `${deck.overBy} too many`}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          President &amp; Bomber are always in. Blue/Red team members
          {deck.gambler > 0 ? ' and a Gambler' : ''} fill the rest automatically.
        </p>
        <RolesInPlay composition={deck.composition} />
        {!deck.valid && (
          <p className="text-boom-red-glow text-xs mt-2">
            Remove {deck.overBy} selected card{deck.overBy === 1 ? '' : 's'} to fit {playerCount} players.
          </p>
        )}

        {isHost && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-ghost btn-ghost-sm" onClick={() => setShowCatalog((v) => !v)}>
              {showCatalog ? 'Done choosing' : 'Choose roles'}
            </button>
            {selected.size > 0 && (
              <button className="btn-ghost btn-ghost-sm" onClick={clearAll}>
                Clear extras
              </button>
            )}
          </div>
        )}
      </div>

      {/* Catalog of selectable items, grouped like the rulebook */}
      {isHost && showCatalog && (
        <div className="glass-card rounded-2xl p-4 mb-4">
          <input
            className="game-input w-full rounded-xl px-4 py-2 mb-3 text-white placeholder-gray-600 outline-none"
            placeholder="Search roles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-96 overflow-y-auto no-scrollbar space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.id}>
                <div className="mb-1.5">
                  <div className="font-display text-sm tracking-wide text-white">{group.name}</div>
                  <div className="text-[11px] text-gray-500 leading-snug">{group.blurb}</div>
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const on = selected.has(item.id);
                    const locked = !!item.requires && !selected.has(item.requires);
                    return (
                      <li key={item.id}>
                        <button
                          disabled={locked && !on}
                          onClick={() => toggle(item)}
                          className={`w-full flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            on ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-white/5'
                          } ${locked && !on ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                              item.kind === 'pack'
                                ? 'bg-gradient-to-r from-boom-blue to-boom-red'
                                : TEAM_DOT[item.team ?? 'grey']
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {item.label}
                              {item.kind === 'pack' && <span className="text-[10px] text-gray-500"> · pack</span>}
                              {locked && (
                                <span className="text-[10px] text-amber-300/80">
                                  {' '}
                                  · needs {DECK_ITEM_MAP.get(item.requires!)?.label}
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-[11px] text-gray-500">{item.blurb}</span>
                          </span>
                          <span className={`text-lg leading-none shrink-0 ${on ? 'text-accent' : 'text-gray-600'}`}>
                            {on ? '✓' : '+'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start */}
      {isHost ? (
        <button
          className="btn-primary w-full py-4 font-display text-lg tracking-wider disabled:opacity-30"
          disabled={!deck.valid || playerCount < 1}
          onClick={startGame}
        >
          {deck.valid ? 'Deal roles & start' : `Too many cards (${deck.overBy} over)`}
        </button>
      ) : (
        <div className="w-full py-4 text-center text-gray-500 text-sm tracking-wider">
          Waiting for the host to deal…
        </div>
      )}
    </motion.div>
  );
}
