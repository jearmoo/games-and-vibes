import { useGameStore, useLiveScore } from '../store';
import { socket } from '../socket';
import Timer from './Timer';

export default function TabooWatcherScreen({ isMaster }: { isMaster: boolean }) {
  const cards = useGameStore(s => s.cards);
  const tabooWords = useGameStore(s => s.tabooWords);
  const tabooBuzzes = useGameStore(s => s.tabooBuzzes);
  const timerEnd = useGameStore(s => s.timerEnd);
  const cluingTeam = useGameStore(s => s.cluingTeam);
  const settings = useGameStore(s => s.settings);

  const { totalBuzzes, liveScore } = useLiveScore();

  if (!timerEnd) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
        <div className="glass-card rounded-2xl p-6 border border-white/5 max-w-xs text-center">
          <div className="font-display text-xl text-white tracking-wider mb-2">
            Team {cluingTeam}'s Turn
          </div>
          <div className="text-gray-500 text-sm">Waiting for clue-giver to begin...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in">
      {/* Timer + score */}
      <div className="flex items-start justify-between">
        <div className="flex-1">{timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}</div>
        <div className="text-right ml-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Their Score</div>
          <div className={`font-display text-2xl ${liveScore >= 0 ? 'text-emerald-400' : 'text-team-b-glow'}`}>
            {liveScore >= 0 ? '+' : ''}{liveScore}
          </div>
        </div>
      </div>

      {/* Role indicator */}
      <div className="text-center text-xs">
        {isMaster
          ? <span className="text-accent font-semibold">You are the Taboo Master — tap words they say</span>
          : <span className="text-gray-500">Watching for taboo violations</span>}
      </div>

      {/* 5 clue words */}
      <div className="glass-card rounded-xl p-3 border border-white/5">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Clue Words</div>
        <div className="flex flex-wrap gap-2">
          {cards.map((card, i) => (
            <span key={i} className={`px-3 py-1.5 rounded-lg text-sm font-display tracking-wider ${
              card.result === 'correct'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-surface-raised text-white border border-white/10'
            }`}>
              {card.result === 'correct' ? '✓ ' : ''}{card.word}
            </span>
          ))}
        </div>
      </div>

      {/* Taboo words — buzz chips for master, read-only for others */}
      <div className="flex-1 overflow-auto">
        <div className="text-[10px] uppercase tracking-wider text-team-b-glow/60 mb-2">
          Taboo Words {isMaster && '(tap to buzz)'}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabooWords.map((word) => {
            const buzzCount = tabooBuzzes[word] || 0;
            const isBuzzed = buzzCount > 0;

            if (isMaster) {
              return (
                <div key={word} className="flex items-center gap-0.5">
                  <button
                    onClick={() => socket.emit('taboo:buzz', { tabooWord: word })}
                    className={`px-3 py-2 min-h-[44px] rounded-l-xl text-sm font-medium transition-all active:scale-[0.95] border ${
                      isBuzzed
                        ? 'bg-team-b/30 text-team-b-glow border-team-b/40'
                        : 'bg-team-b/10 text-team-b-glow/80 border-team-b/20 hover:bg-team-b/20'
                    }`}>
                    {word}
                    {buzzCount > 0 && <span className="ml-1 text-[10px]">×{buzzCount}</span>}
                  </button>
                  {isBuzzed && (
                    <button
                      onClick={() => socket.emit('taboo:undo-buzz', { tabooWord: word })}
                      className="px-2 py-2 min-h-[44px] rounded-r-xl bg-surface-raised text-gray-500 hover:text-white text-xs border border-white/10 transition-colors">
                      −
                    </button>
                  )}
                  {!isBuzzed && <div className="w-0" />}
                </div>
              );
            }

            return (
              <span key={word} className={`px-3 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-medium border ${
                isBuzzed
                  ? 'bg-team-b/20 text-team-b-glow border-team-b/30'
                  : 'bg-team-b/10 text-team-b-glow/60 border-team-b/15'
              }`}>
                {word}
                {buzzCount > 0 && <span className="ml-1 text-[10px]">×{buzzCount}</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Buzz summary */}
      {totalBuzzes > 0 && (
        <div className="text-center text-sm text-team-b-glow">
          {totalBuzzes} buzz{totalBuzzes !== 1 ? 'es' : ''} ({-totalBuzzes} pts)
        </div>
      )}
    </div>
  );
}
