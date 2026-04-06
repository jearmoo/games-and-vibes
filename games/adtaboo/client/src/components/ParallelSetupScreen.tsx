import { useState } from 'react';
import { useGameStore, useMyPlayer, useTeamPlayers, useTeamName } from '../store';
import { socket } from '../socket';

export default function ParallelSetupScreen() {
  const [input, setInput] = useState('');
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const [showWords, setShowWords] = useState(false);
  const me = useMyPlayer();
  const myTeam = me?.team;
  const opposingTeam = myTeam === 'A' ? 'B' : 'A';
  const opposingTeamName = useTeamName(opposingTeam);

  const challengeCards = useGameStore((s) => s.challengeCards);
  const tabooSuggestions = useGameStore((s) => s.tabooSuggestions);
  const ownClueGiverId = useGameStore((s) => s.ownClueGiverId);
  const setupStatus = useGameStore((s) => s.setupStatus);
  const tabooMasters = useGameStore((s) => s.tabooMasters);
  const settings = useGameStore((s) => s.settings);
  const round = useGameStore((s) => s.round);

  const isTM = me?.id === tabooMasters[myTeam!];
  const teamPlayers = useTeamPlayers(myTeam || 'A');
  const wordsLoading = challengeCards.length === 0;

  const challengeIAmCreating = myTeam ? setupStatus[opposingTeam!] : null;
  const challengeForMyTeam = myTeam ? setupStatus[myTeam!] : null;

  const clueGiverName = ownClueGiverId ? teamPlayers.find((p) => p.id === ownClueGiverId)?.name : null;
  const tmName = myTeam ? teamPlayers.find((p) => p.id === tabooMasters[myTeam])?.name : null;

  const handleAdd = () => {
    const word = input.trim();
    if (!word) return;
    socket.emit('setup:suggest', { word });
    setInput('');
  };

  const handleRefresh = (idx: number) => {
    if (refreshingIdx !== null) return;
    setRefreshingIdx(idx);
    socket.emit('setup:refresh-word', { cardIndex: idx });
    setTimeout(() => setRefreshingIdx(null), 3000);
  };

  const canLockIn = tabooSuggestions.length === settings.maxTabooWords && ownClueGiverId !== null;
  const isLocked = challengeIAmCreating?.ready ?? false;
  const otherReady = challengeForMyTeam?.ready ?? false;

  return (
    <div className="h-full flex flex-col animate-fade-in overflow-y-auto">
      {/* Compact header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 bg-surface-card/50">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
          R{round}
          {settings.rounds !== null ? `/${settings.rounds}` : ''}
        </div>
        <div className="font-display text-sm text-white tracking-wider">Setup</div>
        <OtherTeamBadge ready={otherReady} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Clue-giver — inline row */}
        <div className="flex items-center gap-2 min-h-[32px]">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">Cluer</span>
          {clueGiverName ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-emerald-400 font-semibold text-sm truncate">{clueGiverName}</span>
              {isTM && !isLocked && (
                <button
                  onClick={() => setShowWords(!showWords)}
                  className="text-[9px] text-gray-500 hover:text-white transition-colors shrink-0"
                >
                  swap
                </button>
              )}
            </div>
          ) : isTM ? (
            <div className="flex gap-1 flex-wrap flex-1">
              {teamPlayers
                .filter((p) => p.connected)
                .map((p) => (
                  <button
                    key={p.id}
                    data-testid={`setup-pick-clue-giver-${p.name}`}
                    onClick={() => socket.emit('setup:pick-clue-giver', { clueGiverId: p.id })}
                    className="px-2 py-1 bg-surface-raised hover:bg-surface-hover rounded-lg text-white text-xs
                             transition-all active:scale-[0.97] border border-white/5"
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          ) : (
            <span className="text-gray-500 text-xs">TM {tmName ?? '...'} picking...</span>
          )}
        </div>

        {/* Swap cluer (shown on tap) */}
        {isTM && !isLocked && clueGiverName && showWords && (
          <div className="flex flex-wrap gap-1 pl-10 animate-fade-in">
            {teamPlayers
              .filter((p) => p.id !== ownClueGiverId && p.connected)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    socket.emit('setup:pick-clue-giver', { clueGiverId: p.id });
                    setShowWords(false);
                  }}
                  className="text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-surface-raised rounded-lg transition-colors"
                >
                  {p.name}
                </button>
              ))}
          </div>
        )}

        {/* Words — collapsible */}
        <WordsSection
          cards={challengeCards}
          opposingTeamName={opposingTeamName}
          isTM={isTM}
          isLocked={isLocked}
          wordsLoading={wordsLoading}
          refreshingIdx={refreshingIdx}
          onRefresh={handleRefresh}
        />

        {/* Taboo section header */}
        <div className="text-[10px] uppercase tracking-wider text-center pt-1">
          {isTM ? (
            <span className="text-accent font-semibold">Set taboo words {opposingTeamName} can't say</span>
          ) : (
            <span className="text-gray-400">Suggest taboo words</span>
          )}
        </div>

        {/* Taboo input */}
        <div className="flex gap-1.5">
          <input
            data-testid="setup-taboo-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={isLocked ? 'Locked in' : 'Taboo word...'}
            maxLength={30}
            disabled={wordsLoading || isLocked}
            className="game-input flex-1 px-3 py-2 rounded-xl text-white text-sm placeholder-gray-600 disabled:opacity-50"
          />
          <button
            data-testid="setup-taboo-add-button"
            onClick={handleAdd}
            disabled={!input.trim() || wordsLoading || isLocked}
            className="btn-team-b px-3 py-2 rounded-xl text-white font-display text-xs tracking-wider
                       disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
          >
            Add
          </button>
        </div>

        {/* Taboo chips — compact grid */}
        <div className="flex flex-wrap gap-1.5">
          {tabooSuggestions.map((word, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1
              bg-team-b/15 text-team-b-glow rounded-lg text-xs font-medium border border-team-b/20"
            >
              {word}
              {isTM && !isLocked && (
                <button
                  onClick={() => socket.emit('setup:remove', { word })}
                  className="text-team-b-glow/50 hover:text-white text-[10px] leading-none"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>

        {/* Counter */}
        <div className="text-center text-[10px] text-gray-500">
          {tabooSuggestions.length}/{settings.maxTabooWords} taboo words
        </div>
      </div>

      {/* Sticky bottom: lock-in button */}
      <div className="p-3 pt-0 shrink-0 border-t border-white/5 bg-surface-card/30">
        {isTM ? (
          challengeIAmCreating?.ready ? (
            <button
              data-testid="setup-unconfirm-button"
              onClick={() => socket.emit('setup:unconfirm')}
              className="w-full py-3.5 bg-surface-raised hover:bg-surface-hover border border-emerald-500/30
                         rounded-2xl text-emerald-400 font-display text-base tracking-wider
                         transition-all active:scale-[0.97]"
            >
              Locked In — Tap to Unlock
            </button>
          ) : (
            <button
              data-testid="setup-confirm-button"
              onClick={() => socket.emit('setup:confirm')}
              disabled={!canLockIn || wordsLoading}
              className="btn-success w-full py-3.5 rounded-2xl text-white font-display text-base tracking-wider
                         disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]"
            >
              {!ownClueGiverId
                ? 'Pick clue-giver first'
                : tabooSuggestions.length !== settings.maxTabooWords
                  ? `${tabooSuggestions.length}/${settings.maxTabooWords} words`
                  : 'Lock In'}
            </button>
          )
        ) : (
          <div
            className={`w-full py-3 rounded-2xl text-center font-display tracking-wider text-sm ${
              isLocked
                ? 'border border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                : 'border border-white/5 text-gray-400'
            }`}
          >
            {isLocked ? 'Your team is locked in' : 'Waiting for TM to lock in...'}
          </div>
        )}
      </div>
    </div>
  );
}

function OtherTeamBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
      They're ready
    </span>
  ) : (
    <span className="text-gray-500 text-[9px] animate-pulse">Other team...</span>
  );
}

function WordsSection({
  cards,
  opposingTeamName,
  isTM,
  isLocked,
  wordsLoading,
  refreshingIdx,
  onRefresh,
}: {
  cards: Array<{ word: string }>;
  opposingTeamName: string;
  isTM: boolean;
  isLocked: boolean;
  wordsLoading: boolean;
  refreshingIdx: number | null;
  onRefresh: (idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-2.5 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Words for {opposingTeamName}</span>
          {!wordsLoading && <span className="text-[10px] text-gray-600">{cards.length}</span>}
        </div>
        <svg
          className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-white/[0.03]">
          {wordsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className="text-gray-400 text-xs">Fetching words...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1.5">
              {cards.map((card, i) => (
                <span key={`${i}-${card.word}`} className="inline-flex items-center gap-0.5">
                  <span className="font-display text-sm text-white tracking-wider">{card.word}</span>
                  {isTM && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefresh(i);
                      }}
                      disabled={refreshingIdx !== null || isLocked}
                      className={`text-[10px] transition-colors ${
                        refreshingIdx === i ? 'text-accent animate-spin' : 'text-gray-600 hover:text-accent'
                      } disabled:opacity-50`}
                    >
                      ↻
                    </button>
                  )}
                  {i < cards.length - 1 && <span className="text-gray-700 text-xs">,</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
