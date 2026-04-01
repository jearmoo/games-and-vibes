import { useGameStore, useLiveScore } from '../store';
import Timer from './Timer';

export default function GuesserScreen() {
  const cards = useGameStore(s => s.cards);
  const timerEnd = useGameStore(s => s.timerEnd);
  const cluingTeam = useGameStore(s => s.cluingTeam);
  const settings = useGameStore(s => s.settings);

  const { totalBuzzes, buzzedWords, liveScore, remaining } = useLiveScore();
  const correctCards = cards.filter(c => c.result === 'correct');

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
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex-1">{timerEnd && <Timer endTime={timerEnd} duration={settings.timerSeconds} />}</div>
        <div className="text-right ml-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Score</div>
          <div className={`font-display text-2xl ${liveScore >= 0 ? 'text-emerald-400' : 'text-team-b-glow'}`}>
            {liveScore >= 0 ? '+' : ''}{liveScore}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/5 w-full max-w-xs text-center">
        <div className="font-display text-xl text-white tracking-wider mb-4">
          Listen and guess!
        </div>
        <div className="text-gray-400 text-sm">
          Team {cluingTeam} is cluing
        </div>
      </div>

      {correctCards.length > 0 && (
        <div className="w-full max-w-xs space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">Got</div>
          {correctCards.map((card, i) => (
            <div key={i} className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm font-medium">
              {card.word} <span className="text-emerald-400/60">+3</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-gray-500 text-sm">
        {remaining} word{remaining !== 1 ? 's' : ''} remaining
        {totalBuzzes > 0 && <span className="text-team-b-glow"> · {totalBuzzes} buzz{totalBuzzes !== 1 ? 'es' : ''}</span>}
      </div>

      {buzzedWords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {buzzedWords.map(([word, count]) => (
            <span key={word} className="px-2 py-1 bg-team-b/10 text-team-b-glow/80 rounded-lg text-xs border border-team-b/15">
              {word}{count > 1 && ` ×${count}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
