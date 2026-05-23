import { useState } from 'react';
import { useGameStore } from '../store';
import type { TeamId } from '@games/castlefall-shared';

export default function GameOverScreen() {
  const reveal = useGameStore((s) => s.reveal);
  const myId = useGameStore((s) => s.playerId);
  const [restarting, setRestarting] = useState(false);
  const [wordsRevealed, setWordsRevealed] = useState(false);

  if (!reveal) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading reveal...
      </div>
    );
  }

  const team1 = reveal.players.filter((p) => p.team === 1);
  const team2 = reveal.players.filter((p) => p.team === 2);
  const winningTeam = reveal.winningTeam;
  const myTeam = reveal.players.find((p) => p.id === myId)?.team;
  const myTeamColorClass = myTeam === 1 ? 'text-red-400' : myTeam === 2 ? 'text-blue-400' : 'text-stone-400';

  const clappingPlayerId = reveal.clappingPlayerId || null;
  const clapper = clappingPlayerId ? reveal.players.find((p) => p.id === clappingPlayerId) : null;
  const losingPlayerId = reveal.losingPlayerId;

  const renderPlayerRow = (p: { id: string; name: string; team: TeamId; points: number }) => {
    const isMe = p.id === myId;
    const lost = p.id === losingPlayerId;
    const isClapper = p.id === clappingPlayerId && reveal.outcome !== 'wrong-clap';
    const won = !lost && winningTeam !== 'draw' && p.team === winningTeam;
    return (
      <div
        key={p.id}
        className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
          lost
            ? 'bg-red-900/30 ring-1 ring-red-500/60 text-white'
            : isMe
              ? 'bg-castle-gold/20 ring-1 ring-castle-gold/60 text-white'
              : 'bg-white/5 text-white'
        }`}
      >
        <span className="flex-1 truncate">
          {p.name}
          {isMe && <span className="ml-1 text-castle-gold-text text-[10px] tracking-widest">(YOU)</span>}
          {isClapper && (
            <span className="ml-1 text-castle-gold-text text-[10px] tracking-widest">(CLAPPED)</span>
          )}
        </span>
        {lost && (
          <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 text-[10px] font-display tracking-wider">
            -1
          </span>
        )}
        {won && (
          <span className="px-1.5 py-0.5 rounded bg-castle-gold/30 text-castle-gold-text text-[10px] font-display tracking-wider">
            +1
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-black/30 text-castle-gold-text text-xs font-display tracking-wider min-w-[2.25rem] text-center">
          {p.points}
        </span>
      </div>
    );
  };

  const banner =
    reveal.winningTeam === 'draw'
      ? { text: 'DRAW', color: 'castle-gold-text' }
      : reveal.winningTeam === 1
        ? { text: 'TEAM 1 WINS', color: 'text-red-400' }
        : { text: 'TEAM 2 WINS', color: 'text-blue-400' };

  let subline: string | null = null;
  if (clapper) {
    if (reveal.outcome === 'wrong-clap') {
      subline = `${clapper.name} clapped wrong · -1`;
    } else if (reveal.outcome === 'guess-correct') {
      subline = `${clapper.name} clapped right · other team guessed it`;
    } else if (reveal.outcome === 'guess-wrong') {
      subline = `${clapper.name} clapped right · other team failed to guess`;
    }
  }
  const sublineColor =
    reveal.outcome === 'wrong-clap'
      ? 'text-red-300'
      : reveal.outcome === 'guess-correct'
        ? winningTeam === 1
          ? 'text-red-300'
          : 'text-blue-300'
        : 'text-castle-gold-text';

  const handleNewRound = () => {
    if (restarting) return;
    setRestarting(true);
    useGameStore.getState().startNewRound();
    setTimeout(() => setRestarting(false), 5000);
  };

  return (
    <div className="h-full flex flex-col p-5 gap-5 animate-fade-in overflow-y-auto max-w-2xl mx-auto w-full">
      {/* Your team — revealed at game over */}
      {myTeam && (
        <div className="text-center">
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Your team</div>
          <div className={`font-display text-3xl tracking-wider ${myTeamColorClass}`}>{`TEAM ${myTeam}`}</div>
        </div>
      )}

      {/* Banner */}
      <div className="text-center">
        <div
          className={`font-display text-5xl tracking-[0.2em] ${banner.color}`}
          style={{ textShadow: '0 0 30px rgba(212, 168, 75, 0.35)' }}
        >
          {banner.text}
        </div>
        {subline && (
          <div className={`text-xs tracking-[0.25em] uppercase mt-2 ${sublineColor}`}>{subline}</div>
        )}
      </div>

      {/* Words side by side — tap to reveal/hide */}
      <button
        type="button"
        onClick={() => setWordsRevealed((v) => !v)}
        className="block w-full hover:opacity-95 active:scale-[0.99] transition-all text-left"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl border border-red-500/40 bg-red-900/20 p-4 text-center">
            <div className="text-red-300 text-[10px] tracking-[0.3em] uppercase mb-1">Team 1's word</div>
            <div className="font-display text-2xl tracking-wider text-white break-words">
              {wordsRevealed ? reveal.team1Word : '???'}
            </div>
          </div>
          <div className="glass-card rounded-2xl border border-blue-500/40 bg-blue-900/20 p-4 text-center">
            <div className="text-blue-300 text-[10px] tracking-[0.3em] uppercase mb-1">Team 2's word</div>
            <div className="font-display text-2xl tracking-wider text-white break-words">
              {wordsRevealed ? reveal.team2Word : '???'}
            </div>
          </div>
        </div>
        <div className="text-center text-gray-500 text-[10px] tracking-[0.3em] uppercase mt-2">
          {wordsRevealed ? 'Tap to hide words' : 'Tap to show words'}
        </div>
      </button>

      {/* Roster by team */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="glass-card rounded-2xl border border-red-500/30 p-4 overflow-auto">
          <div className="text-red-300 text-xs tracking-widest uppercase mb-2">Team 1</div>
          <div className="space-y-1">
            {team1.map(renderPlayerRow)}
            {team1.length === 0 && <div className="text-gray-500 text-xs italic">No players</div>}
          </div>
        </div>
        <div className="glass-card rounded-2xl border border-blue-500/30 p-4 overflow-auto">
          <div className="text-blue-300 text-xs tracking-widest uppercase mb-2">Team 2</div>
          <div className="space-y-1">
            {team2.map(renderPlayerRow)}
            {team2.length === 0 && <div className="text-gray-500 text-xs italic">No players</div>}
          </div>
        </div>
      </div>

      {/* Start New Round (any player) */}
      <div className="mt-2">
        <button
          onClick={handleNewRound}
          disabled={restarting}
          className="w-full py-4 rounded-2xl btn-primary text-white font-display text-lg tracking-wider active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {restarting ? 'Starting...' : 'Start New Round'}
        </button>
      </div>
    </div>
  );
}
