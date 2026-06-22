import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DecryptoPhase } from '@games/decrypto-shared';
import type { TiebreakerVocabularyMode } from '@games/decrypto-shared';
import { useGameStore } from '../store';
import LeaveRoomButton from './LeaveRoomButton';
import { HowToPlayPanel, TEAM_STYLES } from './shared';

const VOCABULARY_OPTIONS: Array<{ mode: TiebreakerVocabularyMode; label: string; caption: string }> = [
  { mode: 'english', label: 'All English', caption: 'Common words' },
  { mode: 'word-bank', label: 'Word Bank', caption: 'Decrypto cards' },
];

interface GameHeaderProps {
  roundLabel?: string;
  roleOverride?: string;
  dropdownOpen?: boolean;
  onDropdownOpenChange?: (open: boolean) => void;
}

export default function GameHeader({
  roundLabel,
  roleOverride,
  dropdownOpen = false,
  onDropdownOpenChange,
}: GameHeaderProps) {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const playerName = useGameStore((s) => s.playerName);
  const privateState = useGameStore((s) => s.privateState);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const me = room?.players.find((player) => player.id === playerId);
  const team = privateState?.team ?? me?.team;
  const teamStyle = team ? TEAM_STYLES[team] : undefined;
  const turn = room?.turn;
  const myTeamTurn = team && turn ? turn.teams[team] : undefined;
  const role =
    roleOverride ??
    (team && playerId && myTeamTurn ? (myTeamTurn.encryptorId === playerId ? 'Encryptor' : 'Decoder') : 'Spectator');
  const name = me?.name || playerName || 'Spectator';
  const detailLabel = roundLabel ?? (turn ? `R${turn.round}` : room?.phase === DecryptoPhase.WORDS ? 'Setup' : '');
  const canExpand = !!onDropdownOpenChange;
  const effectiveDropdownOpen = canExpand ? dropdownOpen : false;
  const setDropdownOpen = (open: boolean) => {
    onDropdownOpenChange?.(open);
  };
  const isHost = !!room && !!playerId && room.hostId === playerId;

  return (
    <div className="shrink-0 border-b border-white/5 bg-surface/92 backdrop-blur-xl">
      <div className="relative flex min-h-12 items-center justify-center px-12 py-2 text-sm">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <LeaveRoomButton
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-rose-300"
            title="Leave room"
            ariaLabel="Leave room"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </LeaveRoomButton>
        </div>

        <button
          type="button"
          onClick={() => canExpand && setDropdownOpen(!effectiveDropdownOpen)}
          aria-expanded={canExpand ? effectiveDropdownOpen : undefined}
          disabled={!canExpand}
          className="flex min-w-0 max-w-[calc(100%-8.5rem)] items-center justify-center gap-1.5 whitespace-nowrap text-center disabled:cursor-default"
        >
          <span className="relative flex min-w-0 items-center">
            {isHost && (
              <span
                aria-label="Host"
                className="absolute -top-3 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center text-amber-300 drop-shadow-[0_1px_4px_rgba(251,191,36,0.45)]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="M4 9.5 8.5 13 12 6l3.5 7L20 9.5 18.5 18h-13L4 9.5Z" />
                </svg>
              </span>
            )}
            <span className={`min-w-0 truncate font-semibold ${teamStyle?.text ?? 'text-gray-300'}`}>{name}</span>
          </span>
          <span className="text-gray-500">&middot;</span>
          <span className={`shrink-0 font-medium ${teamStyle?.text ?? 'text-white'}`}>{role}</span>
          {detailLabel && (
            <>
              <span className="text-gray-500">&middot;</span>
              <span className="shrink-0 font-medium text-gray-300">{detailLabel}</span>
            </>
          )}
          {canExpand && (
            <svg
              className={`h-2.5 w-2.5 shrink-0 text-gray-600 transition-transform sm:hidden ${
                effectiveDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setHelpOpen(false);
              setSettingsOpen(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-200"
            aria-label="Game settings"
            title="Game settings"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
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
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              setHelpOpen(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-200"
            aria-label="How to play Decrypto"
            title="How to play"
          >
            ?
          </button>
        </div>
      </div>
      {helpOpen && <HowToPlayPanel onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <GameSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function GameSettingsPanel({ onClose }: { onClose: () => void }) {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const enabled = room?.settings.offlineAwareness ?? true;
  const isHost = !!room && !!playerId && room.hostId === playerId;
  const tiebreaker = room?.tiebreaker;
  const showTiebreakerSettings = room?.phase === DecryptoPhase.TIEBREAKER && !!tiebreaker;
  const vocabularyMode = tiebreaker?.vocabularyMode ?? room?.settings.tiebreakerVocabularyMode ?? 'english';
  const vocabularySize = tiebreaker?.vocabulary?.length ?? 0;
  const vocabularyLocked = !!(tiebreaker?.submissions.red.submitted || tiebreaker?.submissions.blue.submitted);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const toggleOfflineAwareness = () => {
    if (!isHost) return;
    useGameStore.getState().setOfflineAwareness(!enabled);
  };

  const setVocabularyMode = (nextMode: TiebreakerVocabularyMode) => {
    if (!isHost || vocabularyLocked || nextMode === vocabularyMode) return;
    useGameStore.getState().setTiebreakerVocabularyMode(nextMode);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game settings"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)] animate-fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-gray-500">Game settings</div>
            <div className="font-display text-2xl tracking-wider text-white">Room controls</div>
            <div className="mt-1 text-sm text-gray-400">
              {enabled ? 'Offline status is visible' : 'Offline status is hidden'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game settings"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-xl leading-none text-gray-400 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-gray-300">Offline awareness</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-500">
                  {enabled
                    ? 'Show offline players and require enough online teammates.'
                    : 'Hide offline status and keep reconnects more casual.'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={!isHost}
                onClick={toggleOfflineAwareness}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition-all active:scale-[0.97] ${
                  enabled
                    ? 'border-cyan-300/40 bg-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                    : 'border-white/10 bg-surface-raised'
                } ${isHost ? 'cursor-pointer hover:bg-surface-hover' : 'cursor-not-allowed opacity-60'}`}
              >
                <span
                  className={`absolute left-px top-px h-7 w-7 rounded-full transition-transform duration-200 ${
                    enabled ? 'translate-x-6 bg-cyan-200' : 'translate-x-0 bg-gray-500'
                  }`}
                />
              </button>
            </div>
          </div>

          {showTiebreakerSettings && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3">
                <div className="text-xs uppercase tracking-widest text-gray-300">Tiebreaker guess pool</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-500">
                  {vocabularyMode === 'word-bank' ? 'Limited to Decrypto words' : 'Using common English words'}
                  <span className="ml-2">{vocabularySize.toLocaleString()} words</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {VOCABULARY_OPTIONS.map((option) => {
                  const active = option.mode === vocabularyMode;
                  const interactive = isHost && !vocabularyLocked;
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
                      onClick={() => setVocabularyMode(option.mode)}
                      disabled={!interactive}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed ${optionClass}`}
                    >
                      <div className="font-display text-xs uppercase tracking-wider">{option.label}</div>
                      <div className="mt-0.5 text-[10px] text-gray-500">{option.caption}</div>
                    </button>
                  );
                })}
              </div>
              {isHost && vocabularyLocked && (
                <div className="mt-3 text-[11px] text-gray-500">Locked after the first tiebreaker submission.</div>
              )}
            </div>
          )}
        </div>

        {!isHost && <div className="mt-3 text-[11px] text-gray-500">Only the host can change this setting.</div>}
      </div>
    </div>,
    document.body,
  );
}
