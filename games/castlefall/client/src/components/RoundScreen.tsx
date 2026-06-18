import { useEffect, useRef, useState } from 'react';
import { Timer, Sheet } from '@games/client-core';
import { useGameStore } from '../store';

type ClapStep = 'picking-clapper' | 'picking-outcome';

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [880, 660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // best-effort; ignore audio errors
  }
}

export default function RoundScreen() {
  const publicRound = useGameStore((s) => s.publicRound);
  const privateRound = useGameStore((s) => s.privateRound);
  const players = useGameStore((s) => s.room?.players ?? []);
  const myId = useGameStore((s) => s.playerId);
  const [clapStep, setClapStep] = useState<ClapStep | null>(null);
  const [pickedClapper, setPickedClapper] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wordRevealed, setWordRevealed] = useState(false);

  const responding = publicRound?.responding;
  const respondingKey = responding ? `${responding.clapperId}:${responding.startedAt}` : null;
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close the local picker when a server-side responding state opens.
  useEffect(() => {
    if (responding) {
      setClapStep(null);
      setPickedClapper(null);
    }
  }, [responding]);

  // Play a chime when the response timer hits zero.
  useEffect(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (!responding || responding.timerSeconds <= 0) return;
    const remainingMs = responding.startedAt + responding.timerSeconds * 1000 - Date.now();
    if (remainingMs <= 0) {
      playChime();
      return;
    }
    expiryTimerRef.current = setTimeout(() => {
      playChime();
      expiryTimerRef.current = null;
    }, remainingMs);
    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [respondingKey, responding]);

  if (!publicRound) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading round...
      </div>
    );
  }

  const respondingEndTime =
    responding && responding.timerSeconds > 0 ? responding.startedAt + responding.timerSeconds * 1000 : 0;
  const showRespondingTimer = !!responding && responding.timerSeconds > 0;

  if (!privateRound) {
    return (
      <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Spectating this round</div>
            <div className="font-display text-3xl tracking-wider text-stone-300">WATCHING</div>
          </div>
          {showRespondingTimer && (
            <div className="w-32 shrink-0">
              <Timer endTime={respondingEndTime} duration={responding!.timerSeconds} />
            </div>
          )}
        </div>
        <div className="glass-card rounded-2xl border border-stone-600/40 bg-stone-800/30 p-5 text-center">
          <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">You joined mid round</div>
          <div className="font-display text-lg tracking-wider text-stone-200">
            You'll join the next round when the host starts it.
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">The 18 words</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {publicRound.words.map((word) => (
              <div
                key={word}
                className="px-2 py-3 rounded-xl border bg-surface-raised border-white/5 text-gray-200 text-center text-sm font-medium"
              >
                {word}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full py-3 text-center text-gray-500 text-xs tracking-wider">
          Sit tight while the active teams play it out.
        </div>
      </div>
    );
  }

  const myTeam = privateRound.team;
  const teamColorClass = wordRevealed ? (myTeam === 1 ? 'text-red-400' : 'text-blue-400') : 'text-stone-400';
  const cardBorderClass = wordRevealed
    ? myTeam === 1
      ? 'border-red-500/40'
      : 'border-blue-500/40'
    : 'border-stone-600/40';
  const cardBgClass = wordRevealed
    ? myTeam === 1
      ? 'bg-red-900/30 hover:bg-red-900/40'
      : 'bg-blue-900/30 hover:bg-blue-900/40'
    : 'bg-stone-800/30 hover:bg-stone-800/50';
  const teamHighlightClass =
    myTeam === 1
      ? 'bg-red-900/40 border-red-500/60 text-red-100 shadow-[0_0_20px_rgba(185,28,28,0.4)]'
      : 'bg-blue-900/40 border-blue-500/60 text-blue-100 shadow-[0_0_20px_rgba(37,99,235,0.4)]';

  const inRoundPlayers = players.filter((p) => p.inRound);

  const handleSubmitWrong = () => {
    if (!pickedClapper || submitting) return;
    setSubmitting(true);
    useGameStore.getState().endRound({ losingPlayerId: pickedClapper.id });
    setTimeout(() => setSubmitting(false), 5000);
  };
  const handleSubmitRight = () => {
    if (!pickedClapper || submitting) return;
    setSubmitting(true);
    useGameStore.getState().correctClap({ clappingPlayerId: pickedClapper.id });
    setTimeout(() => setSubmitting(false), 5000);
  };
  const handleResolveGuess = (guessedCorrectly: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    useGameStore.getState().resolveGuess({ guessedCorrectly });
    setTimeout(() => setSubmitting(false), 5000);
  };

  const clapper = responding ? players.find((p) => p.id === responding.clapperId) : undefined;
  const clapperTeam = responding?.clapperTeam;
  const guessingTeam: 1 | 2 | undefined = clapperTeam ? (clapperTeam === 1 ? 2 : 1) : undefined;
  const guessingTeamColor = guessingTeam === 1 ? 'text-red-400' : guessingTeam === 2 ? 'text-blue-400' : '';
  const clapperTeamColor = clapperTeam === 1 ? 'text-red-400' : clapperTeam === 2 ? 'text-blue-400' : '';

  return (
    <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-3xl mx-auto w-full">
      {/* Header: team (revealed when the player taps to show) + response timer if any */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Your team</div>
          <div className={`font-display text-3xl tracking-wider ${teamColorClass}`}>
            {wordRevealed ? `TEAM ${myTeam}` : 'TEAM ???'}
          </div>
        </div>
        {showRespondingTimer && (
          <div className="w-32 shrink-0">
            <Timer endTime={respondingEndTime} duration={responding!.timerSeconds} />
          </div>
        )}
      </div>

      {/* Secret word — tap to show/hide */}
      <button
        type="button"
        onClick={() => setWordRevealed((v) => !v)}
        className={`glass-card rounded-2xl border p-5 text-center w-full active:scale-[0.99] transition-all ${cardBorderClass} ${cardBgClass}`}
      >
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">Your secret word</div>
        {wordRevealed ? (
          <>
            <div className="font-display text-4xl tracking-wider text-white break-words">{privateRound.secretWord}</div>
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mt-2">Tap to hide</div>
          </>
        ) : (
          <div className="font-display text-2xl tracking-[0.3em] text-stone-300">TAP TO SHOW</div>
        )}
      </button>

      {/* Public word grid */}
      <div className="flex-1 min-h-0">
        <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase mb-2">The 18 words</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {publicRound.words.map((word) => {
            const isMine = wordRevealed && word === privateRound.secretWord;
            return (
              <div
                key={word}
                className={`px-2 py-3 rounded-xl border text-center text-sm font-medium transition-all ${
                  isMine ? teamHighlightClass : 'bg-surface-raised border-white/5 text-gray-200'
                }`}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action area */}
      <div className="mt-2">
        {responding && clapper ? (
          <div className="space-y-3 glass-card rounded-2xl border border-castle-gold/40 bg-castle-gold/10 p-4">
            <div className="text-center">
              <div className="text-castle-gold-text text-[10px] tracking-[0.3em] uppercase mb-1">
                {clapper.name} clapped — they were right
              </div>
              <div className={`font-display text-lg tracking-wider ${guessingTeamColor}`}>
                {`TEAM ${guessingTeam}`}
                <span className="text-gray-300"> must now guess the word</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleResolveGuess(false)}
                disabled={submitting}
                className="px-3 py-3 rounded-xl bg-surface-raised border border-white/10 hover:border-castle-gold/60 hover:bg-castle-gold/10 text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                <div className="text-sm">Guessed wrong</div>
                <div className={`text-[10px] tracking-widest mt-1 ${clapperTeamColor}`}>+1 TEAM {clapperTeam}</div>
              </button>
              <button
                onClick={() => handleResolveGuess(true)}
                disabled={submitting}
                className="px-3 py-3 rounded-xl bg-surface-raised border border-white/10 hover:border-castle-gold/60 hover:bg-castle-gold/10 text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                <div className="text-sm">Guessed right</div>
                <div className={`text-[10px] tracking-widest mt-1 ${guessingTeamColor}`}>+1 TEAM {guessingTeam}</div>
              </button>
            </div>
          </div>
        ) : (
          <>
            <Sheet open={clapStep === 'picking-clapper'} onClose={() => setClapStep(null)} title="Who clapped?">
              <div className="grid grid-cols-2 gap-2">
                {inRoundPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPickedClapper({ id: p.id, name: p.name });
                      setClapStep('picking-outcome');
                    }}
                    disabled={submitting}
                    className="px-3 py-3 rounded-xl bg-surface-raised border border-white/10 hover:border-castle-gold/60 hover:bg-castle-gold/10 text-white font-medium text-sm disabled:opacity-50 active:scale-[0.97] transition-all text-left truncate"
                  >
                    {p.name}
                    {p.id === myId && (
                      <span className="ml-1 text-castle-gold-text text-[10px] tracking-widest">(YOU)</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setClapStep(null)}
                className="w-full py-3 mt-2 text-gray-500 hover:text-white text-xs tracking-wider transition-colors"
              >
                Cancel
              </button>
            </Sheet>

            <Sheet
              open={clapStep === 'picking-outcome' && !!pickedClapper}
              onClose={() => {
                setClapStep('picking-clapper');
                setPickedClapper(null);
              }}
              title="Did they guess the word?"
            >
              {pickedClapper && (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="font-display text-2xl tracking-wider text-white break-words">
                      {pickedClapper.name}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSubmitWrong}
                      disabled={submitting}
                      className="px-3 py-3 rounded-xl bg-red-900/30 border border-red-500/40 hover:border-red-500/70 hover:bg-red-900/40 text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      <div className="text-sm">Wrong</div>
                      <div className="text-[10px] tracking-widest text-red-200 mt-1">-1 clapper · +1 other team</div>
                    </button>
                    <button
                      onClick={handleSubmitRight}
                      disabled={submitting}
                      className="px-3 py-3 rounded-xl bg-castle-gold/20 border border-castle-gold/50 hover:border-castle-gold/80 hover:bg-castle-gold/30 text-white font-display tracking-wider disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      <div className="text-sm">Right</div>
                      <div className="text-[10px] tracking-widest text-castle-gold-text mt-1">
                        other team races to guess
                      </div>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setClapStep('picking-clapper');
                      setPickedClapper(null);
                    }}
                    disabled={submitting}
                    className="w-full py-2 text-gray-500 hover:text-white text-xs tracking-wider transition-colors"
                  >
                    Back
                  </button>
                </div>
              )}
            </Sheet>

            {/* Main action button when no sheet is open */}
            {!clapStep && (
              <button
                onClick={() => setClapStep('picking-clapper')}
                className="w-full py-4 rounded-2xl btn-primary text-white font-display text-lg tracking-wider active:scale-[0.97] transition-all"
              >
                Someone Clapped
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
