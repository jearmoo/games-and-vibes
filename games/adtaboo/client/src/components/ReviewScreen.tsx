import { useGameStore, useMyRole, useMyPlayer, useIsHost, useClueGiverInfo } from '../store';
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
  const isHost = useIsHost();
  const { disconnected: cluerDisconnected } = useClueGiverInfo();

  const isCluer = role === 'clue-giver';
  const canReview = isCluer || (isHost && cluerDisconnected);
  const isOnCluingTeam = me?.team === cluingTeam;
  const turnScore = cluingTeam ? turnResults[cluingTeam] : null;

  const isTeamA = cluingTeam === 'A';
  const teamGlow = isTeamA ? 'rgba(59,130,246,0.35)' : 'rgba(239,68,68,0.35)';
  const teamTextClass = isTeamA ? 'text-team-a-glow' : 'text-team-b-glow';
  const teamBorderClass = isTeamA ? 'border-team-a/20' : 'border-team-b/20';

  const correctCount = cards.filter((c) => c.result === 'correct').length;
  const totalBuzzes = Object.values(tabooBuzzes).reduce((sum, c) => sum + c, 0);

  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-fade-in relative">
      {/* Ambient team glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] rounded-full blur-[100px] opacity-30 pointer-events-none"
        style={{ background: teamGlow }}
      />

      {/* Header — turn score hero */}
      <div className="text-center relative z-10 pt-1">
        <div className="text-gray-500 text-[10px] uppercase tracking-[0.3em] mb-2">Turn Review</div>
        <div className={`font-display text-sm tracking-wider ${teamTextClass} mb-3`}>Team {cluingTeam}</div>

        {/* Score pill */}
        {turnScore && (
          <div className="inline-flex items-center gap-3 glass-card rounded-2xl px-5 py-2.5 border border-white/5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-emerald-400 font-display">{correctCount}</span>
              <span className="text-gray-600">&times;3</span>
            </div>
            {totalBuzzes > 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-red-400 font-display">{totalBuzzes}</span>
                  <span className="text-gray-600">buzz</span>
                </div>
              </>
            )}
            <div className="w-px h-4 bg-white/10" />
            <div
              className={`font-display text-xl tabular-nums ${turnScore.points >= 0 ? 'text-white' : 'text-red-400'}`}
              style={{
                textShadow:
                  turnScore.points >= 0
                    ? '0 0 20px rgba(255,255,255,0.15)'
                    : '0 0 20px rgba(239,68,68,0.3)',
              }}
            >
              {turnScore.points >= 0 ? '+' : ''}
              {turnScore.points}
            </div>
          </div>
        )}
      </div>

      {/* Team scores strip */}
      <div className="flex items-center justify-center gap-6 relative z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-team-a" />
          <span className="text-team-a-glow font-display text-xs tabular-nums">{scores.A}</span>
        </div>
        <div className="text-gray-700 text-[10px] font-display">VS</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-team-b" />
          <span className="text-team-b-glow font-display text-xs tabular-nums">{scores.B}</span>
        </div>
      </div>

      {/* Word cards */}
      <div className="flex-1 min-h-0 overflow-auto space-y-1.5 relative z-10">
        {cards.map((card, i) => {
          const isCorrect = card.result === 'correct';
          return (
            <div
              key={i}
              className={`rounded-xl p-3 flex items-center justify-between transition-all duration-200 border ${
                isCorrect
                  ? 'glass-card border-emerald-500/20 bg-emerald-500/[0.04]'
                  : 'glass-card border-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all ${
                    isCorrect
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/[0.03] text-gray-700'
                  }`}
                >
                  {isCorrect ? '\u2713' : '\u2022'}
                </div>
                <div className="min-w-0">
                  <span
                    className={`font-display text-sm tracking-wider truncate block ${
                      isCorrect ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {card.word}
                  </span>
                  {isCorrect && (
                    <span className="text-emerald-400/50 text-[10px] tracking-wider">+3 pts</span>
                  )}
                </div>
              </div>
              {canReview && (
                <button
                  onClick={() => socket.emit('review:toggle-card', { cardIndex: i })}
                  aria-label={`Toggle ${card.word} — ${isCorrect ? 'mark incorrect' : 'mark correct'}`}
                  className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-display tracking-wider border transition-all active:scale-[0.92] ${
                    isCorrect
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                      : 'bg-surface-raised text-gray-600 border-white/5 hover:text-white hover:border-white/15'
                  }`}
                >
                  {isCorrect ? '+3' : '0'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Taboo section */}
      {tabooWords.length > 0 && (
        <div className={`glass-card rounded-xl p-3 border ${teamBorderClass} relative z-10`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-red-400/60 text-[10px] uppercase tracking-[0.2em] font-medium">Taboo Words</div>
            {totalBuzzes > 0 && (
              <div className="text-red-400 text-[10px] font-display ml-auto">
                &minus;{totalBuzzes} pts
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabooWords.map((word) => {
              const buzzCount = tabooBuzzes[word] || 0;
              const isBuzzed = buzzCount > 0;

              if (canReview) {
                return (
                  <div key={word} className="flex items-center gap-px">
                    <button
                      onClick={() => socket.emit('review:buzz', { tabooWord: word })}
                      className={`px-3 py-2 min-h-[44px] text-sm font-medium transition-all active:scale-[0.95] border ${
                        isBuzzed
                          ? 'rounded-l-xl bg-red-500/25 text-red-400 border-red-500/35'
                          : 'rounded-xl bg-white/[0.03] text-gray-500 border-white/5 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20'
                      }`}
                    >
                      {word}
                      {buzzCount > 0 && (
                        <span className="ml-1.5 text-[10px] font-display opacity-80">&times;{buzzCount}</span>
                      )}
                    </button>
                    {isBuzzed && (
                      <button
                        onClick={() => socket.emit('review:undo-buzz', { tabooWord: word })}
                        className="px-2.5 py-2 min-h-[44px] rounded-r-xl bg-surface-raised text-gray-500 hover:text-white text-xs border border-white/5 transition-all active:scale-[0.95]"
                      >
                        &minus;
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <span
                  key={word}
                  className={`px-3 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-medium border ${
                    isBuzzed
                      ? 'bg-red-500/15 text-red-400 border-red-500/25'
                      : 'bg-white/[0.03] text-gray-600 border-white/5'
                  }`}
                >
                  {word}
                  {buzzCount > 0 && (
                    <span className="ml-1.5 text-[10px] font-display opacity-80">&times;{buzzCount}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Lock in button (cluer, or host if cluer disconnected) */}
      <div className="relative z-10">
        {canReview ? (
          <button
            onClick={() => socket.emit('review:lock-in')}
            className="w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider btn-primary transition-all active:scale-[0.97]"
          >
            Lock In
          </button>
        ) : (
          <div className="text-center text-gray-600 text-xs tracking-wider py-3 animate-pulse-slow">
            Cluer is reviewing...
          </div>
        )}
      </div>
    </div>
  );
}
