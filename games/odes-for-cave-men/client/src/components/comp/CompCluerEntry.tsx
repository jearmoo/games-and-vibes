import { useState } from 'react';
import { useCompStore } from '../../compStore';

export default function CompCluerEntry() {
  const cluerName = useCompStore((s) => s.cluerName);
  const setCluerName = useCompStore((s) => s.setCluerName);
  const beginRound = useCompStore((s) => s.beginRound);
  const players = useCompStore((s) => s.players);

  const playerNames = Object.keys(players);
  const hasPlayers = playerNames.length > 0;
  const [showInput, setShowInput] = useState(false);

  const handlePickPlayer = (name: string) => {
    setCluerName(name);
    beginRound();
  };

  const handleNewPlayer = () => {
    if (cluerName.trim()) beginRound();
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 pt-12 gap-6 animate-fade-in">
      <div className="text-gray-400 text-sm text-center">Who's clueing this round?</div>

      {/* Existing player chips */}
      {hasPlayers && (
        <div className="flex flex-wrap justify-center gap-2 w-full max-w-xs">
          {playerNames.map((name) => (
            <button
              key={name}
              onClick={() => handlePickPlayer(name)}
              className="glass-card rounded-xl px-4 py-3 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all active:scale-[0.95] flex items-center gap-2"
            >
              <span className="text-white text-sm font-medium">{name}</span>
              <span className="text-amber-400 text-xs font-display">{players[name]}</span>
            </button>
          ))}

          {/* Add player toggle */}
          {!showInput && (
            <button
              onClick={() => setShowInput(true)}
              className="rounded-xl px-4 py-3 border border-dashed border-white/10 text-gray-500 hover:text-amber-400 hover:border-amber-500/30 transition-all text-sm"
            >
              + New
            </button>
          )}
        </div>
      )}

      {/* New player input — always visible on first round, toggled after */}
      {(!hasPlayers || showInput) && (
        <div className="w-full max-w-xs space-y-3 animate-fade-in">
          <input
            value={cluerName}
            onChange={(e) => setCluerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cluerName.trim() && handleNewPlayer()}
            maxLength={20}
            placeholder="Enter your name"
            autoFocus
            className="game-input w-full px-5 py-4 rounded-2xl text-white text-center text-lg placeholder-gray-600 font-medium"
          />

          <button
            onClick={handleNewPlayer}
            disabled={!cluerName.trim()}
            className="btn-primary w-full py-5 rounded-2xl text-white font-display text-2xl tracking-wider disabled:opacity-30 transition-all active:scale-[0.95]"
          >
            Go!
          </button>
        </div>
      )}

      <div className="text-gray-600 text-xs text-center max-w-xs">
        Pass the phone to the cluer face-down. They'll see the word when they tap Go.
      </div>
    </div>
  );
}
