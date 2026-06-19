import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TeamId, TiebreakerVocabularyMode } from '@games/decrypto-shared';
import { useGameStore, useIsHost, useMyPlayer } from '../store';
import { ClueBank, ScoreStrip, SignalHistory, TEAM_STYLES, TeamBadge, otherTeam } from './shared';

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
  const isHost = useIsHost();
  const me = useMyPlayer();
  const myTeam = privateState?.team;
  const targetTeam = myTeam ? otherTeam(myTeam) : undefined;
  const [guesses, setGuesses] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [focusedSlot, setFocusedSlot] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const submitted = !!(myTeam && room?.tiebreaker?.submissions[myTeam]?.submitted);
  const otherSubmitted = !!(targetTeam && room?.tiebreaker?.submissions[targetTeam]?.submitted);
  const canUnlockTiebreaker = submitted && !otherSubmitted;
  const vocabularyMode = room?.tiebreaker?.vocabularyMode ?? room?.settings.tiebreakerVocabularyMode ?? 'english';
  const hasAnySubmission = !!(
    room?.tiebreaker?.submissions.red.submitted || room?.tiebreaker?.submissions.blue.submitted
  );
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
  const suggestionListOpen = suggestionsBySlot.some((suggestions) => suggestions.length > 0);

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

  return (
    <div className="min-h-full flex flex-col px-5 py-5 gap-5 animate-fade-in overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="relative min-h-28 text-center sm:min-h-24">
        <div className="absolute left-0 top-0 max-w-[7.5rem] text-left sm:max-w-[10rem]">
          <div className="truncate text-[10px] font-medium leading-tight text-gray-300">{me?.name ?? 'Spectator'}</div>
          {isHost && <div className="mt-0.5 text-[8px] tracking-[0.22em] text-fuchsia-300 uppercase">Host</div>}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open tiebreaker settings"
          title="Tiebreaker settings"
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M9.67 4.14a2.36 2.36 0 0 1 4.66 0 2.36 2.36 0 0 0 3.32 1.91 2.36 2.36 0 0 1 2.33 4.03 2.36 2.36 0 0 0 0 3.84 2.36 2.36 0 0 1-2.33 4.03 2.36 2.36 0 0 0-3.32 1.91 2.36 2.36 0 0 1-4.66 0 2.36 2.36 0 0 0-3.32-1.91 2.36 2.36 0 0 1-2.33-4.03 2.36 2.36 0 0 0 0-3.84 2.36 2.36 0 0 1 2.33-4.03 2.36 2.36 0 0 0 3.32-1.91Z"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.65" />
          </svg>
        </button>
        <div className="mx-auto max-w-[calc(100%-1rem)] pt-9 sm:max-w-[calc(100%-3rem)] sm:pt-0">
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-2">Sudden decode</div>
          <div className="font-display text-4xl tracking-wider text-white">Tiebreaker</div>
          <div className="mt-2 text-sm text-gray-400">
            Guess the opposing team's four keywords from the signal history.
          </div>
        </div>
      </div>

      <ScoreStrip scores={room.scores} />
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
              onUnlock={() => useGameStore.getState().unlockTiebreaker()}
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

      {settingsOpen && (
        <VocabularySettingsPanel
          mode={vocabularyMode}
          isHost={isHost}
          locked={hasAnySubmission}
          vocabularySize={vocabulary.length}
          onClose={() => setSettingsOpen(false)}
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

function VocabularySettingsPanel({
  mode,
  isHost,
  locked,
  vocabularySize,
  onClose,
}: {
  mode: TiebreakerVocabularyMode;
  isHost: boolean;
  locked: boolean;
  vocabularySize: number;
  onClose: () => void;
}) {
  const options: Array<{ mode: TiebreakerVocabularyMode; label: string; caption: string }> = [
    { mode: 'english', label: 'All English', caption: 'Common words' },
    { mode: 'word-bank', label: 'Word Bank', caption: 'Decrypto cards' },
  ];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const setMode = (nextMode: TiebreakerVocabularyMode) => {
    if (!isHost || locked || nextMode === mode) return;
    useGameStore.getState().setTiebreakerVocabularyMode(nextMode);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tiebreaker settings"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)] animate-fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Tiebreaker settings</div>
            <div className="font-display text-2xl tracking-wider text-white">Guess pool</div>
            <div className="mt-1 text-sm text-gray-400">
              {mode === 'word-bank' ? 'Limited to Decrypto words' : 'Using common English words'}
              <span className="ml-2 text-gray-500">{vocabularySize.toLocaleString()} words</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tiebreaker settings"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-xl leading-none text-gray-400 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const active = option.mode === mode;
            const interactive = isHost && !locked;
            const optionClass = interactive
              ? active
                ? 'border-white/25 bg-white/12 text-white shadow-inner shadow-white/5'
                : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5 hover:text-gray-200'
              : active
                ? 'pointer-events-none border-white/20 bg-white/10 text-white shadow-inner shadow-white/5'
                : 'pointer-events-none border-white/10 bg-black/20 text-gray-500';
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMode(option.mode)}
                disabled={!interactive}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed ${optionClass}`}
              >
                <div className="font-display text-xs tracking-wider uppercase">{option.label}</div>
                <div className="mt-0.5 text-[10px] text-gray-500">{option.caption}</div>
              </button>
            );
          })}
        </div>

        {!isHost && <div className="mt-3 text-[11px] text-gray-500">Only the host can change this setting.</div>}
        {isHost && locked && (
          <div className="mt-3 text-[11px] text-gray-500">Locked after the first tiebreaker submission.</div>
        )}
      </div>
    </div>,
    document.body,
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
  const suggestionListOpen = suggestionsBySlot.some((suggestions) => suggestions.length > 0);

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
    clearBlurTimer();
    onFocusSlot(slot);
    focusInput(slot);
  };

  const handleGuessChange = (slot: number, value: string) => {
    clearBlurTimer();
    onFocusSlot(slot);
    onChange(slot, value);
  };

  const chooseSuggestion = (slot: number, word: string) => {
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

  const scheduleDeactivateSlot = () => {
    clearBlurTimer();
    blurTimerRef.current = window.setTimeout(() => {
      onFocusSlot(null);
      blurTimerRef.current = null;
    }, 180);
  };

  if (submitted) {
    return (
      <div className={`glass-card rounded-2xl border ${myStyle.border} p-5 text-center`}>
        <div className={`font-display text-2xl tracking-wider ${myStyle.text}`}>Tiebreaker locked</div>
        <div className="mt-2 text-gray-400">Waiting for the other team to submit.</div>
        {canUnlock && (
          <button
            type="button"
            onClick={onUnlock}
            className="mt-4 rounded-xl border border-white/10 bg-surface-raised px-4 py-2 font-display text-xs tracking-wider text-gray-300 uppercase transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            Unlock
          </button>
        )}
      </div>
    );
  }

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

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
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
          const suggestions = focusedSlot === slot ? (suggestionsBySlot[slot] ?? []) : [];
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

      <button
        type="button"
        onClick={handleSubmitClick}
        disabled={!canSubmit || suggestionListOpen}
        className="btn-success w-full rounded-xl py-3 font-display tracking-wider text-white transition-all active:scale-[0.97] disabled:opacity-30 disabled:shadow-none sm:rounded-2xl sm:py-4"
      >
        {submitting ? 'Submitting...' : vocabularyReady ? 'Submit Tiebreaker' : 'Loading Words...'}
      </button>
    </div>
  );
}
