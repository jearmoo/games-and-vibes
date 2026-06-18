import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TeamId, TiebreakerVocabularyMode } from '@games/decrypto-shared';
import { useGameStore, useIsHost } from '../store';
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
  const myTeam = privateState?.team;
  const targetTeam = myTeam ? otherTeam(myTeam) : undefined;
  const [guesses, setGuesses] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [focusedSlot, setFocusedSlot] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const submitted = !!(myTeam && room?.tiebreaker?.submissions[myTeam]?.submitted);
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
      <div className="relative min-h-24 text-center">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open tiebreaker settings"
          title="Tiebreaker settings"
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-lg text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
        >
          ⚙
        </button>
        <div className="mx-auto max-w-[calc(100%-3rem)]">
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
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMode(option.mode)}
                disabled={!isHost || locked}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  active
                    ? 'border-white/25 bg-white/12 text-white shadow-inner shadow-white/5'
                    : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5 hover:text-gray-200'
                } disabled:cursor-not-allowed disabled:hover:bg-black/20 disabled:hover:text-gray-400`}
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
}: {
  myTeam: TeamId;
  targetTeam: TeamId;
  guesses: string[];
  submitted: boolean;
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
}) {
  const myStyle = TEAM_STYLES[myTeam];
  const targetStyle = TEAM_STYLES[targetTeam];
  const blurTimerRef = useRef<number | null>(null);
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

  const activateSlot = (slot: number) => {
    clearBlurTimer();
    onFocusSlot(slot);
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
      </div>
    );
  }

  return (
    <div
      className={`glass-card relative overflow-visible rounded-2xl border ${myStyle.border} p-4 space-y-4 ${
        suggestionListOpen ? 'z-[80]' : 'z-10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Keyword guesses</div>
          <div className="font-display text-2xl tracking-wider text-white">
            {myStyle.label} guesses {targetStyle.label}
          </div>
        </div>
        <TeamBadge team={myTeam} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              className={`relative overflow-visible rounded-xl border ${targetStyle.border} ${targetStyle.bg} p-3 ${
                suggestions.length > 0 ? 'z-50' : 'z-0'
              }`}
            >
              <span className={`font-display text-lg ${targetStyle.text}`}>{slot + 1}</span>
              <div className="relative mt-2">
                <input
                  value={guesses[slot]}
                  onChange={(event) => onChange(slot, event.target.value)}
                  onPointerDown={() => activateSlot(slot)}
                  onFocus={() => activateSlot(slot)}
                  onBlur={scheduleDeactivateSlot}
                  maxLength={TIEBREAKER_MAX_GUESS_LENGTH}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`${targetStyle.label} keyword ${slot + 1}`}
                  className={`game-input w-full rounded-xl px-3 py-2 text-white placeholder-gray-600 ${
                    showFormatError || showUnknownError ? 'border-red-400/60' : ''
                  }`}
                  placeholder={vocabularyMode === 'word-bank' ? 'word bank word' : 'one word'}
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/15 bg-gray-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    {suggestions.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          clearBlurTimer();
                          onChange(slot, word);
                          onFocusSlot(null);
                        }}
                        onClick={() => {
                          clearBlurTimer();
                          onChange(slot, word);
                          onFocusSlot(null);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-white/10 active:bg-white/15"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {showUnknownError && <div className="mt-2 text-[11px] text-red-200">{unknownMessage}</div>}
              {showFormatError && <div className="mt-2 text-[11px] text-red-200">Use 3-18 letters.</div>}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="btn-success w-full py-4 rounded-2xl text-white font-display tracking-wider disabled:opacity-30 disabled:shadow-none active:scale-[0.97] transition-all"
      >
        {submitting ? 'Submitting...' : vocabularyReady ? 'Submit Tiebreaker' : 'Loading Words...'}
      </button>
    </div>
  );
}
