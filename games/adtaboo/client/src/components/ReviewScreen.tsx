import { useGameStore, useMyRole, useMyPlayer } from '../store';
import { socket } from '../socket';

export default function ReviewScreen() {
  const cards = useGameStore((s) => s.cards);
  const tabooWords = useGameStore((s) => s.tabooWords);
  const tabooBuzzes = useGameStore((s) => s.tabooBuzzes);
  const scores = useGameStore((s) => s.scores);
  const cluingTeam = useGameStore((s) => s.cluingTeam);
  const turnResults = useGameStore((s) => s.turnResults);
  const role = useMyRole();
  const me = useMyPlayer();

  const isTM = role === 'taboo-master';
  const isOnCluingTeam = me?.team === cluingTeam;
  const teamColor = cluingTeam === 'A' ? 'text-amber-400' : 'text-emerald-400';
  const turnScore = cluingTeam ? turnResults[cluingTeam] : null;

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="text-gray-500 text-xs tracking-wider uppercase mb-1">Turn Review</div>
        <div className={`font-display text-lg tracking-wider ${teamColor}`}>Team {cluingTeam}</div>
      </div>

      {/* Score summary */}
      <div className="flex items-center justify-between px-2">
        <div className="flex gap-4">
          <span className="text-amber-400 font-display text-sm">A: {scores.A}</span>
          <span className="text-emerald-400 font-display text-sm">B: {scores.B}</span>
        </div>
        {turnScore && (
          <div className={`font-display text-sm ${turnScore.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            Turn: {turnScore.points >= 0 ? '+' : ''}
            {turnScore.points}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-auto space-y-2">
        {cards.map((card, i) => (
          <div key={i} className="glass-card rounded-xl p-3 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 text-center shrink-0 ${card.result === 'correct' ? 'text-emerald-400' : 'text-gray-600'}`}
              >
                {card.result === 'correct' ? '\u2713' : '\u2022'}
              </span>
              <span className={`truncate ${card.result === 'correct' ? 'text-white' : 'text-gray-500'}`}>
                {card.word}
              </span>
            </div>
            {isTM && (
              <button
                onClick={() => socket.emit('review:toggle-card', { cardIndex: i })}
                aria-label={`Toggle ${card.word} — ${card.result === 'correct' ? 'mark incorrect' : 'mark correct'}`}
                className={`shrink-0 px-2 py-1 rounded-lg text-xs font-display tracking-wider border transition-all ${
                  card.result === 'correct'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-surface-raised text-gray-600 border-white/5 hover:text-white'
                }`}
              >
                {card.result === 'correct' ? '+3' : '0'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Taboo section (for TM) */}
      {!isOnCluingTeam && tabooWords.length > 0 && (
        <div className="space-y-2">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider">Taboo Words</div>
          <div className="flex flex-wrap gap-1.5">
            {tabooWords.map((word) => {
              const buzzes = tabooBuzzes[word] || 0;
              return (
                <button
                  key={word}
                  onClick={() => {
                    if (!isTM) return;
                    if (buzzes > 0) {
                      socket.emit('review:undo-buzz', { tabooWord: word });
                    } else {
                      socket.emit('review:buzz', { tabooWord: word });
                    }
                  }}
                  disabled={!isTM}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    buzzes > 0
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : isTM
                        ? 'bg-surface-raised text-gray-400 border-white/5 hover:text-red-400 hover:border-red-500/30'
                        : 'bg-surface-raised text-gray-600 border-white/5'
                  }`}
                >
                  {word}
                  {buzzes > 0 ? ` \u00d7${buzzes}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lock in button (TM only) */}
      {isTM ? (
        <button
          onClick={() => socket.emit('review:lock-in')}
          className="w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider btn-primary transition-all active:scale-[0.97]"
        >
          Lock In
        </button>
      ) : (
        <div className="text-center text-gray-600 text-xs tracking-wider py-3 animate-pulse-slow">
          {isOnCluingTeam ? 'Opposing TM is reviewing...' : 'Taboo master is reviewing...'}
        </div>
      )}
    </div>
  );
}
