import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '@games/client-core';
import type { TeamId, TiebreakerVocabularyMode } from '@games/decrypto-shared';
import { useGameStore } from '../store';
import { AnimatedLockButton, ClueBank, ScoreStrip, SignalHistory, TEAM_STYLES, TeamBadge, otherTeam } from './shared';
import GameHeader from './GameHeader';

const GUESS_SLOTS = [0, 1, 2, 3];
const TIEBREAKER_MAX_GUESS_LENGTH = 18;
const SINGLE_WORD_GUESS = /^[a-z]{3,18}$/;
const MAX_SUGGESTIONS = 8;

function sentenceCaseWord(word: string): string {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return '';
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function rankedSuggestions(prefix: string, vocabulary: string[]): string[] {
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (normalizedPrefix.length < 2) return [];
  return vocabulary
    .filter((word) => word.startsWith(normalizedPrefix))
    .sort((left, right) => {
      if (left === normalizedPrefix && right !== normalizedPrefix) return -1;
      if (right === normalizedPrefix && left !== normalizedPrefix) return 1;
      if (left.length !== right.length) return left.length - right.length;
      return left.localeCompare(right);
    })
    .slice(0, MAX_SUGGESTIONS)
    .map(sentenceCaseWord);
}

export default function TieBreakerScreen() {
  const room = useGameStore((s) => s.room);
  const privateState = useGameStore((s) => s.privateState);
  const playerId = useGameStore((s) => s.playerId);
  const myTeam = privateState?.team;
  const targetTeam = myTeam ? otherTeam(myTeam) : undefined;
  const [guesses, setGuesses] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [focusedSlot, setFocusedSlot] = useState<number | null>(null);
  const [tiebreakerDetailsOpen, setTiebreakerDetailsOpen] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);

  const submitted = !!(myTeam && room?.tiebreaker?.submissions[myTeam]?.submitted);
  const otherSubmitted = !!(targetTeam && room?.tiebreaker?.submissions[targetTeam]?.submitted);
  const canUnlockTiebreaker = submitted && !otherSubmitted;
  const vocabularyMode = room?.tiebreaker?.vocabularyMode ?? room?.settings.tiebreakerVocabularyMode ?? 'english';
  const vocabulary = room?.tiebreaker?.vocabulary ?? [];
  const vocabularySet = useMemo(() => new Set(vocabulary), [vocabulary]);
  const suggestionsBySlot = useMemo(
    () =>
      guesses.map((guess, index) => {
        if (focusedSlot !== index) return [];
        return rankedSuggestions(guess, vocabulary);
      }),
    [focusedSlot, guesses, vocabulary],
  );
  const canSubmit = useMemo(
    () =>
      !!myTeam &&
      vocabulary.length > 0 &&
      guesses.every((guess) => {
        const normalized = guess.trim().toLowerCase();
        return SINGLE_WORD_GUESS.test(normalized) && vocabularySet.has(normalized);
      }) &&
      !submitted &&
      !submitting,
    [guesses, myTeam, submitted, submitting, vocabulary.length, vocabularySet],
  );
  const suggestionListOpen = !submitted && suggestionsBySlot.some((suggestions) => suggestions.length > 0);

  useEffect(() => {
    if (!submitted) setSubmitting(false);
  }, [submitted]);

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading tiebreaker...
      </div>
    );
  }

  const handleSubmit = () => {
    setAttemptedSubmit(true);
    if (!canSubmit) return;
    setSubmitting(true);
    useGameStore.getState().submitTiebreaker(guesses);
    setTimeout(() => setSubmitting(false), 5000);
  };
  const kickTarget = confirmKickId ? room.players.find((player) => player.id === confirmKickId) : undefined;
  const isHost = room.hostId === playerId;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <GameHeader
        roleOverride="Tiebreaker"
        roundLabel=""
        dropdownOpen={tiebreakerDetailsOpen}
        onDropdownOpenChange={setTiebreakerDetailsOpen}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full max-w-5xl mx-auto flex-col gap-4 px-5 pb-5 pt-2 sm:gap-5 sm:pt-4">
          {tiebreakerDetailsOpen && (
            <div className="rounded-lg border border-white/10 bg-black/15 p-2">
              <div className="mb-2 font-display text-base tracking-wider text-white">Sudden decode</div>
              <ScoreStrip
                scores={room.scores}
                players={room.players}
                currentPlayerId={playerId}
                onKickPlayer={isHost ? setConfirmKickId : undefined}
                showOfflineStatus={room.settings.offlineAwareness}
              />
            </div>
          )}

          <div className="relative min-h-20 text-center sm:min-h-24">
            <div className="mx-auto max-w-[calc(100%-2rem)] pt-1 sm:pt-0">
              <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-2">Sudden decode</div>
              <div className="font-display text-4xl tracking-wider text-white">Tiebreaker</div>
              <div className="mt-2 text-sm text-gray-400">
                Guess the opposing team's four keywords from the signal history.
              </div>
            </div>
          </div>

          <SubmissionStrip submissions={room.tiebreaker?.submissions} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_21rem] gap-4">
            <div className={`relative min-w-0 space-y-4 ${suggestionListOpen ? 'z-[70]' : 'z-0'}`}>
              {myTeam && targetTeam ? (
                <TiebreakerForm
                  myTeam={myTeam}
                  targetTeam={targetTeam}
                  guesses={guesses}
                  submitted={submitted}
                  canUnlock={canUnlockTiebreaker}
                  submitting={submitting}
                  canSubmit={canSubmit}
                  attemptedSubmit={attemptedSubmit}
                  focusedSlot={focusedSlot}
                  vocabularyReady={vocabulary.length > 0}
                  vocabularyMode={vocabularyMode}
                  vocabularySet={vocabularySet}
                  suggestionsBySlot={suggestionsBySlot}
                  onChange={(index, value) => {
                    const next = [...guesses];
                    next[index] = value.replace(/[^A-Za-z]/g, '').slice(0, TIEBREAKER_MAX_GUESS_LENGTH);
                    setGuesses(next);
                  }}
                  onFocusSlot={setFocusedSlot}
                  onSubmit={handleSubmit}
                  onUnlock={() => {
                    setSubmitting(false);
                    useGameStore.getState().unlockTiebreaker();
                  }}
                />
              ) : (
                <div className="glass-card rounded-2xl border border-white/10 p-5 text-center text-gray-400">
                  Spectators can watch the tiebreaker resolve.
                </div>
              )}

              <ClueBank
                myTeam={privateState?.team}
                keywords={privateState?.keywords}
                history={room.clueHistory}
                compactMobile
              />
            </div>

            <SignalHistory
              history={room.clueHistory}
              tiebreakerHistory={room.tiebreaker?.history}
              sticky
              includeIntercept
            />
          </div>
        </div>
      </div>
      {confirmKickId && (
        <ConfirmModal
          title={`Kick ${kickTarget?.name ?? 'player'}?`}
          message="They will be removed from the game."
          confirmLabel="Kick"
          cancelLabel="Cancel"
          confirmClass="bg-gradient-to-br from-red-600 to-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.26)] hover:from-red-500 hover:to-red-400"
          onConfirm={() => {
            if (confirmKickId) useGameStore.getState().kickPlayer(confirmKickId);
            setConfirmKickId(null);
          }}
          onCancel={() => setConfirmKickId(null)}
        />
      )}
    </div>
  );
}

function SubmissionStrip({
  submissions,
}: {
  submissions?: Record<TeamId, { submitted: boolean; submittedByName?: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['red', 'blue'] as TeamId[]).map((team) => {
        const style = TEAM_STYLES[team];
        const submission = submissions?.[team];
        return (
          <div
            key={team}
            className={`min-w-0 rounded-xl border ${style.border} ${style.bg} px-3 py-2 flex items-center justify-between gap-3`}
          >
            <div className="min-w-0">
              <div className={`font-display tracking-wider ${style.text}`}>{style.label}</div>
              <div className="truncate text-[11px] text-gray-400">
                {submission?.submitted ? (submission.submittedByName ?? 'Submitted') : 'Choosing words'}
              </div>
            </div>
            <span
              className={`shrink-0 text-[10px] tracking-widest uppercase ${
                submission?.submitted ? 'text-emerald-300' : 'text-gray-500'
              }`}
            >
              {submission?.submitted ? 'Locked' : 'Open'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TiebreakerForm({
  myTeam,
  targetTeam,
  guesses,
  submitted,
  canUnlock,
  submitting,
  canSubmit,
  attemptedSubmit,
  focusedSlot,
  vocabularyReady,
  vocabularyMode,
  vocabularySet,
  suggestionsBySlot,
  onChange,
  onFocusSlot,
  onSubmit,
  onUnlock,
}: {
  myTeam: TeamId;
  targetTeam: TeamId;
  guesses: string[];
  submitted: boolean;
  canUnlock: boolean;
  submitting: boolean;
  canSubmit: boolean;
  attemptedSubmit: boolean;
  focusedSlot: number | null;
  vocabularyReady: boolean;
  vocabularyMode: TiebreakerVocabularyMode;
  vocabularySet: Set<string>;
  suggestionsBySlot: string[][];
  onChange: (index: number, value: string) => void;
  onFocusSlot: (index: number | null) => void;
  onSubmit: () => void;
  onUnlock: () => void;
}) {
  const myStyle = TEAM_STYLES[myTeam];
  const targetStyle = TEAM_STYLES[targetTeam];
  const blurTimerRef = useRef<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const suppressSubmitUntilRef = useRef(0);
  const suggestionListOpen = !submitted && suggestionsBySlot.some((suggestions) => suggestions.length > 0);

  useEffect(
    () => () => {
      if (blurTimerRef.current !== null) window.clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const clearBlurTimer = () => {
    if (blurTimerRef.current === null) return;
    window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = null;
  };

  const focusInput = (slot: number) => {
    window.requestAnimationFrame(() => {
      const input = inputRefs.current[slot];
      if (!input || document.activeElement === input) return;
      input.focus({ preventScroll: true });
    });
  };

  const activateSlot = (slot: number) => {
    if (submitted) return;
    clearBlurTimer();
    onFocusSlot(slot);
    focusInput(slot);
  };

  const handleGuessChange = (slot: number, value: string) => {
    if (submitted) return;
    clearBlurTimer();
    onFocusSlot(slot);
    onChange(slot, value);
  };

  const chooseSuggestion = (slot: number, word: string) => {
    if (submitted) return;
    clearBlurTimer();
    suppressSubmitUntilRef.current = Date.now() + 450;
    onChange(slot, word);
    onFocusSlot(null);
    focusInput(slot);
  };

  const handleSubmitClick = () => {
    if (suggestionListOpen || Date.now() < suppressSubmitUntilRef.current) return;
    onSubmit();
  };

  const handleLockClick = () => {
    if (submitted) {
      if (canUnlock) onUnlock();
      return;
    }
    handleSubmitClick();
  };

  const scheduleDeactivateSlot = () => {
    clearBlurTimer();
    blurTimerRef.current = window.setTimeout(() => {
      onFocusSlot(null);
      blurTimerRef.current = null;
    }, 180);
  };

  return (
    <div
      className={`glass-card relative overflow-visible rounded-xl border ${myStyle.border} p-3 space-y-3 sm:rounded-2xl sm:p-4 sm:space-y-4 ${
        suggestionListOpen ? 'z-[80]' : 'z-10'
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="mb-0.5 text-[9px] tracking-[0.22em] text-gray-500 uppercase sm:mb-1 sm:text-[10px] sm:tracking-[0.3em]">
            Keyword guesses
          </div>
          <div className="truncate font-display text-xl tracking-wider text-white sm:text-2xl">
            {myStyle.label} guesses {targetStyle.label}
          </div>
        </div>
        <div className="shrink-0 text-xs sm:text-sm">
          <TeamBadge team={myTeam} />
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-1.5 transition-opacity sm:gap-2 ${submitted ? 'opacity-55' : ''}`}>
        {GUESS_SLOTS.map((slot) => {
          const guess = guesses[slot].trim().toLowerCase();
          const formatInvalid = guess.length > 0 && !SINGLE_WORD_GUESS.test(guess);
          const unknown = SINGLE_WORD_GUESS.test(guess) && !vocabularySet.has(guess);
          const showFormatError = attemptedSubmit && formatInvalid;
          const showUnknownError = unknown;
          const unknownMessage =
            vocabularyMode === 'word-bank'
              ? 'Word not in the Decrypto word bank.'
              : 'Word not recognized. Try a more common word.';
          const suggestions = !submitted && focusedSlot === slot ? (suggestionsBySlot[slot] ?? []) : [];
          return (
            <div
              key={slot}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                activateSlot(slot);
              }}
              className={`relative overflow-visible rounded-lg border ${targetStyle.border} ${targetStyle.bg} p-2 sm:rounded-xl sm:p-3 ${
                suggestions.length > 0 ? 'z-50' : 'z-0'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:block">
                <span
                  className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 font-display text-base sm:block sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:text-lg ${targetStyle.text}`}
                >
                  {slot + 1}
                </span>
                <div className="relative min-w-0 flex-1 sm:mt-2">
                  <input
                    ref={(element) => {
                      inputRefs.current[slot] = element;
                    }}
                    value={guesses[slot]}
                    onChange={(event) => handleGuessChange(slot, event.target.value)}
                    onPointerDown={() => activateSlot(slot)}
                    onFocus={() => activateSlot(slot)}
                    onBlur={scheduleDeactivateSlot}
                    maxLength={TIEBREAKER_MAX_GUESS_LENGTH}
                    disabled={submitted}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`${targetStyle.label} keyword ${slot + 1}`}
                    className={`game-input w-full rounded-lg px-2 py-1.5 text-base text-white placeholder-gray-600 sm:rounded-xl sm:px-3 sm:py-2 ${
                      showFormatError || showUnknownError ? 'border-red-400/60' : ''
                    }`}
                    placeholder="Enter word"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/15 bg-gray-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
                      {suggestions.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            chooseSuggestion(slot, word);
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            chooseSuggestion(slot, word);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-white/10 active:bg-white/15"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {showUnknownError && (
                <div className="mt-1.5 text-[10px] leading-tight text-red-200 sm:mt-2 sm:text-[11px]">
                  {unknownMessage}
                </div>
              )}
              {showFormatError && (
                <div className="mt-1.5 text-[10px] leading-tight text-red-200 sm:mt-2 sm:text-[11px]">
                  Use 3-18 letters.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-1">
        <AnimatedLockButton
          locked={submitted}
          onClick={handleLockClick}
          disabled={submitted ? !canUnlock : !canSubmit || suggestionListOpen || submitting || !vocabularyReady}
          lockedLabel={canUnlock ? 'Unlock tiebreaker guesses' : 'Tiebreaker guesses locked'}
          unlockedLabel={vocabularyReady ? 'Submit tiebreaker' : 'Loading words'}
        />
      </div>
    </div>
  );
}
