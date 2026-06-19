import { useState } from 'react';
import type {
  GameEndReason,
  GameWinner,
  PublicTiebreakerRepeatState,
  TeamId,
  TiebreakerResult,
} from '@games/decrypto-shared';
import { useGameStore } from '../store';
import { ClueBank, ScoreStrip, SignalHistory, TEAM_STYLES, otherTeam } from './shared';

const TEAMS: TeamId[] = ['red', 'blue'];

function sentenceCaseGuess(guess: string): string {
  const normalized = guess.trim().toLowerCase();
  if (!normalized) return '';
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function formatSimilarityScore(score?: number): string {
  return `${((score ?? 0) * 100).toFixed(0)}%`;
}

export default function GameOverScreen() {
  const room = useGameStore((s) => s.room);
  const privateState = useGameStore((s) => s.privateState);
  const finalState = room?.finalState;
  const winner = finalState?.winner ?? room?.reveal?.winner;
  const [resetting, setResetting] = useState(false);
  const [releasingTeam, setReleasingTeam] = useState<TeamId | null>(null);
  const [requestingRepeat, setRequestingRepeat] = useState(false);

  if (!room || !finalState || !winner) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading final result...
      </div>
    );
  }

  const winningTeam = isTeamWinner(winner) ? winner : undefined;
  const winnerStyle = winningTeam ? TEAM_STYLES[winningTeam] : undefined;
  const winningPlayers = winningTeam ? room.players.filter((player) => player.team === winningTeam) : [];
  const reason = getReasonText(winner, finalState.reason, room.settings, finalState.tiebreaker);
  const showTiebreakerRepeat =
    winner === 'tie' &&
    finalState.reason === 'tie' &&
    finalState.tiebreaker?.reason === 'tie' &&
    room.tiebreaker?.repeat;

  const handleReset = () => {
    if (resetting) return;
    setResetting(true);
    useGameStore.getState().resetGame();
    setTimeout(() => setResetting(false), 5000);
  };

  const handleReleaseWords = (team: TeamId) => {
    if (releasingTeam || privateState?.team !== team || room.finalState?.releasedWords[team]) return;
    setReleasingTeam(team);
    useGameStore.getState().releaseWords({ team });
    setTimeout(() => setReleasingTeam(null), 1500);
  };

  const handleRequestRepeat = () => {
    const repeat = room.tiebreaker?.repeat;
    const myTeam = privateState?.team;
    if (requestingRepeat || !repeat?.available || !myTeam || repeat.requests[myTeam]) return;
    setRequestingRepeat(true);
    useGameStore.getState().requestTiebreakerRepeat();
    setTimeout(() => setRequestingRepeat(false), 1500);
  };

  return (
    <div className="min-h-full flex flex-col px-5 pt-5 pb-28 gap-5 animate-fade-in overflow-y-auto max-w-4xl mx-auto w-full">
      <div className="text-center py-4">
        <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-2">Channel closed</div>
        <div className={`font-display text-5xl tracking-[0.18em] ${winnerStyle?.text ?? 'text-white'}`}>
          {winningTeam ? `${winnerStyle?.label} wins` : 'Game tied'}
        </div>
        {winningPlayers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {winningPlayers.map((player) => (
              <span
                key={player.id}
                className={`rounded-lg border ${winnerStyle?.border} ${winnerStyle?.bg} px-2.5 py-1 text-sm font-semibold text-white`}
              >
                {player.name}
              </span>
            ))}
          </div>
        )}
        <div className="text-gray-300 text-sm tracking-wider mt-3">{reason}</div>
      </div>

      <ScoreStrip scores={room.scores} />

      <WordReleasePanel
        myTeam={privateState?.team}
        releasedWords={room.finalState?.releasedWords}
        releasingTeam={releasingTeam}
        onRelease={handleReleaseWords}
      />

      {finalState.tiebreaker && <TiebreakerResultPanel result={finalState.tiebreaker} />}

      {showTiebreakerRepeat && (
        <TiebreakerRepeatPanel
          myTeam={privateState?.team}
          repeat={room.tiebreaker!.repeat!}
          requesting={requestingRepeat}
          onRequest={handleRequestRepeat}
        />
      )}

      <ClueBank
        myTeam={privateState?.team ?? winningTeam ?? 'red'}
        keywords={privateState?.keywords}
        history={room.clueHistory}
        finalKeywords={room.finalState?.keywords}
        compactMobile
      />

      <SignalHistory history={room.clueHistory} includeIntercept />

      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 border-t border-white/10 bg-surface/85 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="btn-decrypto w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {resetting ? 'Resetting...' : 'Back to Lobby'}
        </button>
      </div>
    </div>
  );
}

function TiebreakerRepeatPanel({
  myTeam,
  repeat,
  requesting,
  onRequest,
}: {
  myTeam?: TeamId;
  repeat: PublicTiebreakerRepeatState;
  requesting: boolean;
  onRequest: () => void;
}) {
  const myTeamRequested = myTeam ? repeat.requests[myTeam] : false;
  const canRequest = repeat.available && !!myTeam && !myTeamRequested && !requesting;
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-3 sm:rounded-2xl sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.24em] text-gray-500 uppercase sm:text-[10px] sm:tracking-[0.3em]">
            Tiebreaker repeat
          </div>
          <div className="mt-1 font-display text-lg tracking-wider text-white sm:text-xl">
            {repeat.used ? 'Repeat already used' : 'Run it back?'}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {repeat.used ? 'The second tied tiebreaker is final.' : 'Both teams must agree. This is the only repeat.'}
          </div>
        </div>
        {!repeat.used && (
          <button
            type="button"
            onClick={onRequest}
            disabled={!canRequest}
            className="shrink-0 rounded-xl border border-white/10 bg-surface-raised px-4 py-3 text-sm font-semibold tracking-wider text-white transition-all hover:bg-surface-hover active:scale-[0.97] disabled:opacity-45 sm:min-w-44"
          >
            {requesting ? 'Requesting...' : myTeamRequested ? 'Waiting' : 'Agree'}
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
        {TEAMS.map((team) => {
          const style = TEAM_STYLES[team];
          const requested = repeat.requests[team];
          return (
            <div
              key={team}
              className={`rounded-lg border ${style.border} ${style.bg} px-2.5 py-2 sm:rounded-xl sm:px-3`}
            >
              <div className={`font-display text-sm tracking-wider ${style.text}`}>{style.label}</div>
              <div
                className={`text-[10px] tracking-widest uppercase ${requested ? 'text-emerald-300' : 'text-gray-500'}`}
              >
                {requested ? 'Agreed' : repeat.used ? 'Closed' : 'Waiting'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isTeamWinner(winner?: GameWinner): winner is TeamId {
  return winner === 'red' || winner === 'blue';
}

function getReasonText(
  winner: GameWinner,
  reason: GameEndReason | undefined,
  settings: { maxIntercepts: number; maxMiscommunications: number },
  tiebreaker?: TiebreakerResult,
) {
  if (winner === 'tie' || reason === 'tie') {
    return 'The keyword tiebreaker was close enough to call the game a tie.';
  }
  if (!isTeamWinner(winner)) return 'Final scores locked.';
  const winnerStyle = TEAM_STYLES[winner];
  const losingStyle = TEAM_STYLES[otherTeam(winner)];
  if (reason === 'interceptions') {
    return `${winnerStyle.label} intercepted ${settings.maxIntercepts} transmissions.`;
  }
  if (reason === 'miscommunications') {
    return `${losingStyle.label} recorded ${settings.maxMiscommunications} miscommunications.`;
  }
  if (reason === 'tiebreaker-exact' && tiebreaker) {
    const winnerResult = tiebreaker.results[winner];
    const loserResult = tiebreaker.results[otherTeam(winner)];
    return `${winnerStyle.label} won the keyword tiebreaker ${winnerResult.exactMatches}-${loserResult.exactMatches}.`;
  }
  if (reason === 'tiebreaker-similarity' && tiebreaker) {
    return `${winnerStyle.label} won on keyword similarity after exact guesses tied.`;
  }
  return 'Final scores locked.';
}

function TiebreakerResultPanel({ result }: { result: TiebreakerResult }) {
  return (
    <section className="glass-card rounded-xl border border-white/10 p-2.5 sm:rounded-2xl sm:p-4">
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.22em] text-gray-500 uppercase sm:text-[10px] sm:tracking-[0.3em]">
            Tiebreaker result
          </div>
          <div className="mt-1 hidden text-xs text-gray-400 sm:block">
            Exact matches first, similarity only if exact matches tie.
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[9px] tracking-widest text-gray-500 uppercase sm:bg-transparent sm:px-0 sm:py-0 sm:text-[10px]">
          <span className="sm:hidden">±</span>
          <span className="hidden sm:inline">Threshold </span>
          {(result.similarityThreshold * 100).toFixed(0)}%
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {TEAMS.map((team) => {
          const style = TEAM_STYLES[team];
          const teamResult = result.results[team];
          const won = result.winner === team;
          return (
            <div
              key={team}
              className={`min-w-0 rounded-lg border ${style.border} ${style.bg} p-2 sm:rounded-xl sm:p-3`}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <div className={`font-display text-base tracking-wider sm:text-lg ${style.text}`}>{style.label}</div>
                  <div className="truncate text-[10px] text-gray-400 sm:text-[11px]">
                    <span className="sm:hidden">vs {TEAM_STYLES[teamResult.targetTeam].label}</span>
                    <span className="hidden sm:inline">Guessed {TEAM_STYLES[teamResult.targetTeam].label}'s words</span>
                  </div>
                </div>
                {won && (
                  <span className="shrink-0 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] tracking-widest text-emerald-300 uppercase sm:text-[10px]">
                    Won
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs sm:mt-3 sm:gap-2">
                <div className="rounded-md border border-white/10 bg-black/20 px-1.5 py-1 sm:rounded-lg sm:px-2.5 sm:py-2">
                  <div className="text-[8px] tracking-widest text-gray-500 uppercase sm:text-[10px]">Exact</div>
                  <div className="font-display text-base text-white sm:text-xl">{teamResult.exactMatches}/4</div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 px-1.5 py-1 sm:rounded-lg sm:px-2.5 sm:py-2">
                  <div className="text-[8px] tracking-widest text-gray-500 uppercase sm:text-[10px]">
                    <span className="sm:hidden">Sim</span>
                    <span className="hidden sm:inline">Similarity</span>
                  </div>
                  <div className="font-display text-base text-white sm:text-xl">
                    {(teamResult.similarityScore * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 sm:mt-3 sm:flex sm:flex-wrap sm:gap-1.5">
                {teamResult.guesses.map((guess, index) => {
                  const displayGuess = sentenceCaseGuess(guess);
                  const score = formatSimilarityScore(teamResult.slotScores[index]);
                  return (
                    <span
                      key={`${team}-${guess}-${index}`}
                      title={`${index + 1}. ${displayGuess} - ${score}`}
                      className="min-w-0 rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[10px] text-gray-200 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[11px]"
                    >
                      <span className="flex min-w-0 items-center justify-between gap-1.5">
                        <span className="min-w-0 truncate">
                          {index + 1}. {displayGuess}
                        </span>
                        <span className="shrink-0 font-display text-[9px] tracking-wider text-gray-400 sm:text-[10px]">
                          {score}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WordReleasePanel({
  myTeam,
  releasedWords,
  releasingTeam,
  onRelease,
}: {
  myTeam?: TeamId;
  releasedWords?: Record<TeamId, boolean>;
  releasingTeam: TeamId | null;
  onRelease: (team: TeamId) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4">
      <div className="mb-2 text-gray-500 text-[9px] tracking-[0.24em] uppercase sm:mb-3 sm:text-[10px] sm:tracking-[0.3em]">
        Word release
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {TEAMS.map((team) => {
          const style = TEAM_STYLES[team];
          const released = releasedWords?.[team] ?? false;
          const canRelease = myTeam === team && !released;
          return (
            <div
              key={team}
              className={`min-w-0 rounded-xl border ${style.border} ${style.bg} px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between gap-2 sm:gap-3`}
            >
              <div className="min-w-0">
                <div className={`font-display text-sm tracking-wider sm:text-base ${style.text}`}>{style.label}</div>
                <div className="text-gray-500 text-[9px] tracking-widest uppercase sm:text-[11px]">
                  {released ? 'Released' : 'Hidden'}
                </div>
              </div>
              {canRelease && (
                <button
                  type="button"
                  onClick={() => onRelease(team)}
                  disabled={releasingTeam === team}
                  className="shrink-0 rounded-lg border border-white/10 bg-surface-raised px-2 py-1.5 text-[10px] font-semibold tracking-wider text-white transition-all hover:bg-surface-hover active:scale-[0.97] disabled:opacity-50 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                >
                  {releasingTeam === team ? 'Releasing...' : 'Release'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
