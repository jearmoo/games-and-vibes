import { useState } from 'react';
import { useGameStore, useMyPlayer, useTeamPlayers } from '../store';
import { socket } from '../socket';

export default function ParallelSetupScreen() {
  const [input, setInput] = useState('');
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const me = useMyPlayer();
  const myTeam = me?.team;
  const opposingTeam = myTeam === 'A' ? 'B' : 'A';

  const challengeCards = useGameStore(s => s.challengeCards);
  const tabooSuggestions = useGameStore(s => s.tabooSuggestions);
  const ownClueGiverId = useGameStore(s => s.ownClueGiverId);
  const setupStatus = useGameStore(s => s.setupStatus);
  const tabooMasters = useGameStore(s => s.tabooMasters);
  const settings = useGameStore(s => s.settings);
  const round = useGameStore(s => s.round);

  const isTM = me?.id === tabooMasters[myTeam!];
  const teamPlayers = useTeamPlayers(myTeam || 'A');
  const wordsLoading = challengeCards.length === 0;

  // setupStatus[X] = readiness of challenge FOR team X
  // "I'm creating" = challenge FOR the opposing team = setupStatus[opposingTeam]
  // "They're creating for me" = challenge FOR my team = setupStatus[myTeam]
  const challengeIAmCreating = myTeam ? setupStatus[opposingTeam!] : null;
  const challengeForMyTeam = myTeam ? setupStatus[myTeam!] : null;

  const clueGiverName = ownClueGiverId ? teamPlayers.find(p => p.id === ownClueGiverId)?.name : null;

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

  const canLockIn = tabooSuggestions.length >= 1 && ownClueGiverId !== null;
  const isLocked = challengeIAmCreating?.ready ?? false;

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Round {round} of {settings.rounds}</div>
        <div className="font-display text-lg text-white tracking-wider mt-1">Team Setup</div>
      </div>

      {/* Other team's status (collapsible) */}
      <OtherTeamStatus
        ready={challengeForMyTeam?.ready ?? false}
        tabooCount={challengeForMyTeam?.tabooCount ?? 0}
        hasClueGiver={challengeIAmCreating?.hasClueGiver ?? false}
      />

      {/* Pick clue-giver for own team */}
      <div className="glass-card rounded-xl p-3 border border-white/5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
          Your team's clue-giver
        </div>
        {clueGiverName ? (
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-semibold text-sm">{clueGiverName}</span>
            {isTM && !isLocked && (
              <div className="flex gap-1">
                {teamPlayers.filter(p => p.id !== ownClueGiverId && p.connected).map(p => (
                  <button key={p.id}
                    onClick={() => socket.emit('setup:pick-clue-giver', { clueGiverId: p.id })}
                    className="text-[10px] text-gray-500 hover:text-white px-2 py-1 bg-surface-raised rounded-lg transition-colors">
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : isTM ? (
          <div className="flex flex-wrap gap-1.5">
            {teamPlayers.filter(p => p.connected).map(p => (
              <button key={p.id}
                onClick={() => socket.emit('setup:pick-clue-giver', { clueGiverId: p.id })}
                className="px-3 py-1.5 bg-surface-raised hover:bg-surface-hover rounded-lg text-white text-sm
                           transition-all active:scale-[0.97] border border-white/5">
                {p.name} {p.id === me?.id && <span className="text-gray-500 text-[10px]">(you)</span>}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-xs">Waiting for TM to pick...</span>
        )}
      </div>

      {/* Words for opposing team */}
      <div className="glass-card rounded-xl p-3 border border-white/5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
          Words for Team {opposingTeam} to clue
        </div>
        {wordsLoading ? (
          <div className="flex items-center gap-2 py-1">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">Fetching words...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {challengeCards.map((card, i) => (
              <div key={`${i}-${card.word}`} className="flex items-center gap-1">
                <span className="font-display text-base text-white tracking-wider">{card.word}</span>
                {isTM && (
                  <button onClick={() => handleRefresh(i)}
                    disabled={refreshingIdx !== null || isLocked}
                    className={`text-xs transition-colors ${
                      refreshingIdx === i ? 'text-accent animate-spin' : 'text-gray-600 hover:text-accent'
                    } disabled:opacity-50`}>↻</button>
                )}
                {i < challengeCards.length - 1 && <span className="text-gray-700 mx-0.5">·</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Taboo word input */}
      <div className="text-center text-xs">
        {isTM
          ? <span className="text-accent font-semibold">Set taboo words Team {opposingTeam} can't say</span>
          : <span className="text-gray-400">Suggest taboo words</span>}
      </div>

      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={isLocked ? "Locked in" : "Type a taboo word..."} maxLength={30} disabled={wordsLoading || isLocked}
          className="game-input flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-600 disabled:opacity-50" />
        <button onClick={handleAdd}
          disabled={!input.trim() || tabooSuggestions.length >= settings.maxTabooWords || wordsLoading || isLocked}
          className="btn-team-b px-5 py-3 rounded-xl text-white font-display tracking-wider
                     disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]">
          Add
        </button>
      </div>

      {/* Taboo chips */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-wrap gap-2">
          {tabooSuggestions.map((word, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5
              bg-team-b/15 text-team-b-glow rounded-xl text-sm font-medium border border-team-b/20">
              {word}
              {isTM && !isLocked && (
                <button onClick={() => socket.emit('setup:remove', { word })}
                  className="text-team-b-glow/50 hover:text-white text-xs">&times;</button>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-gray-500">
        {tabooSuggestions.length}/{settings.maxTabooWords} taboo words
      </div>

      {/* Lock in / Unlock */}
      {isTM ? (
        challengeIAmCreating?.ready ? (
          <button onClick={() => socket.emit('setup:unconfirm')}
            className="w-full py-4 bg-surface-raised hover:bg-surface-hover border border-emerald-500/30
                       rounded-2xl text-emerald-400 font-display text-lg tracking-wider
                       transition-all active:scale-[0.97]">
            Locked In — Tap to Unlock
          </button>
        ) : (
          <button onClick={() => socket.emit('setup:confirm')}
            disabled={!canLockIn || wordsLoading}
            className="btn-success w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider
                       disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.97]">
            {!ownClueGiverId ? 'Pick clue-giver first' :
             tabooSuggestions.length < 1 ? 'Add taboo words first' :
             'Lock In'}
          </button>
        )
      ) : (
        <div className={`w-full py-3 rounded-2xl text-center font-display tracking-wider text-sm ${
          isLocked
            ? 'border border-emerald-500/20 text-emerald-400/80 bg-emerald-500/5'
            : 'border border-white/5 text-gray-600'
        }`}>
          {isLocked ? 'Your team is locked in' : 'Waiting for TM to lock in...'}
        </div>
      )}
    </div>
  );
}


function OtherTeamStatus({ ready, tabooCount, hasClueGiver }: {
  ready: boolean;
  tabooCount: number;
  hasClueGiver: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="glass-card rounded-xl border border-white/5 w-full text-left transition-all"
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Other team</span>
          {ready ? (
            <span className="text-emerald-400 font-semibold text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">Ready</span>
          ) : (
            <span className="text-accent text-[10px] animate-pulse">Setting up...</span>
          )}
        </div>
        <span className="text-gray-700 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-2.5 pt-0 border-t border-white/[0.03] mt-0">
          <div className="flex items-center justify-between text-[11px] pt-2">
            <span className="text-gray-600">Clue-giver</span>
            <span className={hasClueGiver ? 'text-emerald-400' : 'text-gray-700'}>
              {hasClueGiver ? 'Picked' : 'Not yet'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-gray-600">Taboo words</span>
            <span className="text-gray-400">{tabooCount}</span>
          </div>
        </div>
      )}
    </button>
  );
}
