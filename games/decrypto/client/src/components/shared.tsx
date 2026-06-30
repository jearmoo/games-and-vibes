import { useEffect, useRef, useState, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClueContent,
  ClueRecord,
  Code,
  DecryptoGameMode,
  DecryptoPlayerDTO,
  ScoreBoard,
  TeamId,
  ThreePlayerConfig,
  TiebreakerResult,
} from '@games/decrypto-shared';

export const TEAM_STYLES: Record<
  TeamId,
  { label: string; text: string; softText: string; border: string; bg: string; ring: string }
> = {
  red: {
    label: 'Red',
    text: 'text-rose-300',
    softText: 'text-rose-200',
    border: 'border-rose-500/40',
    bg: 'bg-rose-950/30',
    ring: 'ring-rose-400/40',
  },
  blue: {
    label: 'Blue',
    text: 'text-cyan-200',
    softText: 'text-cyan-100',
    border: 'border-cyan-400/40',
    bg: 'bg-cyan-950/30',
    ring: 'ring-cyan-300/40',
  },
};

export function otherTeam(team: TeamId): TeamId {
  return team === 'red' ? 'blue' : 'red';
}

export function isThreePlayerMode(
  gameMode?: DecryptoGameMode,
  threePlayer?: ThreePlayerConfig,
): threePlayer is ThreePlayerConfig {
  return gameMode === 'three-player' && !!threePlayer;
}

export function decryptoRoleLabel(team: TeamId, gameMode?: DecryptoGameMode, threePlayer?: ThreePlayerConfig): string {
  if (!isThreePlayerMode(gameMode, threePlayer)) return TEAM_STYLES[team].label;
  return team === threePlayer.encryptorTeam ? 'Encryptor Team' : 'Interceptor';
}

export function formatCode(code?: Code): string {
  return code ? code.join('-') : '- - -';
}

const compactUpperButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-white/10 bg-surface-raised px-2 py-1 text-[10px] tracking-widest uppercase text-gray-300 transition-all hover:bg-surface-hover active:scale-[0.97]';

const wordBankUpperButtonClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-surface-raised px-2 py-1 text-[10px] tracking-widest uppercase text-gray-300 transition-all hover:bg-surface-hover active:scale-[0.97] sm:min-h-9 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2';

const wordBankIconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-surface-raised transition-all hover:bg-surface-hover active:scale-[0.95] sm:hidden';

const CLUE_BANK_SLOTS = [0, 1, 2, 3];
const CLUE_BANK_SWIPE_THRESHOLD = 56;
const CLUE_BANK_VERTICAL_CANCEL_THRESHOLD = 30;
const CLUE_BANK_HORIZONTAL_DOMINANCE = 1.8;

function CodeSummaryRow({
  label,
  value,
  valueClassName = 'text-gray-200',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
      <span className="text-gray-500 text-[10px] tracking-widest uppercase">{label}</span>
      <span className={`font-display tracking-wider ${valueClassName}`}>{value}</span>
    </div>
  );
}

export function HistoryCodeSummary({
  record,
  compact = false,
  includeIntercept = false,
}: {
  record: ClueRecord;
  compact?: boolean;
  includeIntercept?: boolean;
}) {
  if (compact) {
    return (
      <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] leading-tight">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-gray-500 tracking-widest uppercase">Correct</span>
          <span className="font-display tracking-wider text-white">{formatCode(record.code)}</span>
        </div>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span className="text-gray-500 tracking-widest uppercase">Guessed</span>
          <span
            className={`font-display tracking-wider ${record.decryptCorrect ? 'text-emerald-200' : 'text-rose-200'}`}
          >
            {formatCode(record.decryptGuess)}
          </span>
        </div>
        {includeIntercept && record.interceptGuess && (
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="text-gray-500 tracking-widest uppercase">Intercept</span>
            <span
              className={`font-display tracking-wider ${
                record.interceptCorrect ? 'text-emerald-200' : 'text-gray-300'
              }`}
            >
              {formatCode(record.interceptGuess)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs">
      <CodeSummaryRow label="Correct code" value={formatCode(record.code)} valueClassName="text-white" />
      <CodeSummaryRow
        label="Guessed code"
        value={formatCode(record.decryptGuess)}
        valueClassName={record.decryptCorrect ? 'text-emerald-200' : 'text-rose-200'}
      />
      {record.interceptGuess && (
        <CodeSummaryRow
          label="Intercept guess"
          value={formatCode(record.interceptGuess)}
          valueClassName={record.interceptCorrect ? 'text-emerald-200' : 'text-gray-300'}
        />
      )}
    </div>
  );
}

export function createTextClue(text = ''): ClueContent {
  return { kind: 'text', text };
}

export function clueHasContent(clue: ClueContent): boolean {
  return clue.kind === 'drawing' ? !!clue.dataUrl : !!clue.text.trim();
}

export function clueLabel(clue: ClueContent): string {
  return clue.kind === 'drawing' ? 'Drawing clue' : clue.text;
}

export function clueListLabel(clues: ClueContent[]): string {
  return clues.map(clueLabel).join(' / ');
}

function sentenceCaseGuess(guess: string): string {
  const normalized = guess.trim().toLowerCase();
  if (!normalized) return '';
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function formatSimilarityScore(score?: number): string {
  return `${((score ?? 0) * 100).toFixed(0)}%`;
}

export function possessiveName(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export function HowToPlayPanel({ onClose }: { onClose: () => void }) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play Decrypto"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)] animate-fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">How to play</div>
            <div className="font-display text-2xl tracking-wider text-white">Decrypto</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how to play"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-xl leading-none text-gray-400 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97]"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-gray-300">
          <p>
            Each team has 4 secret keywords. Your team gives clues that point to three of those words in a hidden order.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-[10px] tracking-[0.25em] text-gray-500 uppercase">Round flow</div>
            <p>
              The encryptor sees a 3-number code, gives three clues, then teammates guess the order. From round 2 on,
              the other team also tries to intercept your code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <div className="font-display tracking-wider text-emerald-200">Win</div>
              <p className="mt-1 text-xs text-gray-300">Intercept 2 enemy transmissions.</p>
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
              <div className="font-display tracking-wider text-rose-200">Avoid</div>
              <p className="mt-1 text-xs text-gray-300">2 team miscommunications.</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Round 1 has no intercept. Clues can be typed or drawn, but keep them clear enough for your team and vague
            enough to hide your keywords.
          </p>
          <p className="text-xs text-gray-500">
            With exactly three players split 2v1, the two-player side encrypts for up to 5 rounds while the solo
            Interceptor tries to collect 2 tokens.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeamBadge({ team }: { team: TeamId }) {
  const style = TEAM_STYLES[team];
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-lg border ${style.border} ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center text-gray-300">
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 origin-center transition-transform ${open ? 'rotate-90' : 'rotate-0'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </span>
  );
}

interface ScorePlayerControls {
  currentPlayerId?: string | null;
  onKickPlayer?: (playerId: string) => void;
  showOfflineStatus?: boolean;
}

function PlayerPill({
  player,
  currentPlayerId,
  onKickPlayer,
  showOfflineStatus = false,
}: {
  player: DecryptoPlayerDTO;
  currentPlayerId?: string | null;
  onKickPlayer?: (playerId: string) => void;
  showOfflineStatus?: boolean;
}) {
  const canKick = !!onKickPlayer && player.id !== currentPlayerId;
  const isOffline = showOfflineStatus && !player.connected;
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-white/10 bg-black/15 px-1.5 py-0.5 transition-colors ${
        isOffline ? 'text-gray-500 opacity-60' : 'text-gray-300'
      }`}
    >
      <span className="min-w-0 truncate">{player.name}</span>
      {canKick && (
        <button
          type="button"
          onClick={() => onKickPlayer(player.id)}
          className="-mr-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs leading-none text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
          aria-label={`Kick ${player.name}`}
          title={`Kick ${player.name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

export function ScoreStrip({
  scores,
  players,
  currentPlayerId,
  onKickPlayer,
  showOfflineStatus = false,
  gameMode,
  threePlayer,
  round,
}: {
  scores: ScoreBoard;
  players?: DecryptoPlayerDTO[];
  gameMode?: DecryptoGameMode;
  threePlayer?: ThreePlayerConfig;
  round?: number;
} & ScorePlayerControls) {
  const threePlayerActive = isThreePlayerMode(gameMode, threePlayer);
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {(['red', 'blue'] as TeamId[]).map((team) => {
        const style = TEAM_STYLES[team];
        const teamPlayers = players?.filter((player) => player.team === team) ?? [];
        const roleLabel = decryptoRoleLabel(team, gameMode, threePlayer);
        const isInterceptor = threePlayerActive && team === threePlayer.interceptorTeam;
        return (
          <div key={team} className={`min-w-0 rounded-xl border ${style.border} ${style.bg} px-3 py-2`}>
            <div className={`font-display tracking-wider ${style.text}`}>{style.label}</div>
            {threePlayerActive && (
              <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-gray-500">{roleLabel}</div>
            )}
            {threePlayerActive ? (
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest">
                    {isInterceptor ? 'Tokens' : 'Round'}
                  </span>
                  <span className="font-display text-white text-lg">
                    {isInterceptor ? scores[team].intercepts : Math.min(round ?? 0, threePlayer.maxRounds)}
                  </span>
                  <span className="text-gray-600"> /{isInterceptor ? 2 : threePlayer.maxRounds}</span>
                </div>
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest text-[10px]">Goal</span>
                  <span className="font-display text-white text-lg">{isInterceptor ? '2' : '5'}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest">
                    <span className="sm:hidden">Ints</span>
                    <span className="hidden sm:inline">Intercepts</span>
                  </span>
                  <span className="font-display text-white text-lg">{scores[team].intercepts}</span>
                  <span className="text-gray-600"> /2</span>
                </div>
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest text-[10px]">
                    <span className="sm:hidden">Miscoms</span>
                    <span className="hidden sm:inline">Miscommunications</span>
                  </span>
                  <span className="font-display text-white text-lg">{scores[team].miscommunications}</span>
                  <span className="text-gray-600"> /2</span>
                </div>
              </div>
            )}
            {players && (
              <div className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-gray-300">
                {teamPlayers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {teamPlayers.map((player) => (
                      <PlayerPill
                        key={player.id}
                        player={player}
                        currentPlayerId={currentPlayerId}
                        onKickPlayer={onKickPlayer}
                        showOfflineStatus={showOfflineStatus}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-600">No players</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MobileScoreSummary({
  scores,
  players,
  currentPlayerId,
  onKickPlayer,
  showOfflineStatus = false,
  gameMode,
  threePlayer,
  round,
}: {
  scores: ScoreBoard;
  players: DecryptoPlayerDTO[];
  gameMode?: DecryptoGameMode;
  threePlayer?: ThreePlayerConfig;
  round?: number;
} & ScorePlayerControls) {
  const threePlayerActive = isThreePlayerMode(gameMode, threePlayer);
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['red', 'blue'] as TeamId[]).map((team) => {
        const style = TEAM_STYLES[team];
        const teamPlayers = players.filter((player) => player.team === team);
        const roleLabel = decryptoRoleLabel(team, gameMode, threePlayer);
        const isInterceptor = threePlayerActive && team === threePlayer.interceptorTeam;
        return (
          <div key={team} className={`min-w-0 rounded-xl border ${style.border} ${style.bg} px-3 py-2`}>
            <div className={`font-display tracking-wider ${style.text}`}>{style.label}</div>
            {threePlayerActive && (
              <div className="mt-0.5 truncate text-[9px] uppercase tracking-widest text-gray-500">{roleLabel}</div>
            )}
            {threePlayerActive ? (
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest">
                    {isInterceptor ? 'Tokens' : 'Round'}
                  </span>
                  <span className="font-display text-white text-lg">
                    {isInterceptor ? scores[team].intercepts : Math.min(round ?? 0, threePlayer.maxRounds)}
                  </span>
                  <span className="text-gray-600"> /{isInterceptor ? 2 : threePlayer.maxRounds}</span>
                </div>
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest text-[10px]">Goal</span>
                  <span className="font-display text-white text-lg">{isInterceptor ? '2' : '5'}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest">Ints</span>
                  <span className="font-display text-white text-lg">{scores[team].intercepts}</span>
                  <span className="text-gray-600"> /2</span>
                </div>
                <div>
                  <span className="block text-gray-500 uppercase tracking-widest text-[10px]">Miscoms</span>
                  <span className="font-display text-white text-lg">{scores[team].miscommunications}</span>
                  <span className="text-gray-600"> /2</span>
                </div>
              </div>
            )}
            <div className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-gray-300">
              {teamPlayers.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {teamPlayers.map((player) => (
                    <PlayerPill
                      key={player.id}
                      player={player}
                      currentPlayerId={currentPlayerId}
                      onKickPlayer={onKickPlayer}
                      showOfflineStatus={showOfflineStatus}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-gray-600">No players</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KeywordPanel({
  team,
  keywords,
  wordsHidden,
  setWordsHidden,
  gameMode,
  threePlayer,
}: {
  team?: TeamId;
  keywords?: string[];
  wordsHidden?: boolean;
  setWordsHidden?: Dispatch<SetStateAction<boolean>>;
  gameMode?: DecryptoGameMode;
  threePlayer?: ThreePlayerConfig;
}) {
  const [internalHidden, setInternalHidden] = useState(false);
  const hidden = wordsHidden ?? internalHidden;
  const updateHidden = setWordsHidden ?? setInternalHidden;
  const interceptorWithoutWords = isThreePlayerMode(gameMode, threePlayer) && team === threePlayer.interceptorTeam;

  if (!team || !keywords?.length) {
    return (
      <div className="glass-card rounded-2xl border border-white/10 p-4 text-center">
        <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Private keywords</div>
        <div className="text-gray-400 text-sm">
          {interceptorWithoutWords
            ? 'The Interceptor does not receive keywords in 3-player mode.'
            : 'Spectators do not receive team keywords.'}
        </div>
      </div>
    );
  }

  const style = TEAM_STYLES[team];
  return (
    <div className={`glass-card rounded-2xl border ${style.border} p-3 sm:p-4`}>
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <div className="text-gray-500 text-[9px] tracking-[0.24em] uppercase sm:text-[10px] sm:tracking-[0.3em]">
          Your keywords
        </div>
        <div className="flex items-stretch gap-2">
          <VisibilitySwipeButton
            hidden={hidden}
            onClick={() => updateHidden((value) => !value)}
            hiddenLabel="Show keywords"
            visibleLabel="Hide keywords"
          />
          <TeamBadge team={team} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {keywords.map((word, index) => (
          <div
            key={word}
            className={`min-h-[4.75rem] rounded-xl border ${style.border} ${style.bg} p-2 sm:min-h-[5.5rem] sm:p-3`}
          >
            <div className={`font-display text-base sm:text-2xl ${style.text}`}>{index + 1}</div>
            <div className="mt-1 break-words text-[11px] font-semibold leading-snug text-white sm:mt-2 sm:text-base">
              {hidden ? '••••••' : word}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisibilitySwipeButton({
  hidden,
  onClick,
  hiddenLabel,
  visibleLabel,
}: {
  hidden: boolean;
  onClick: () => void;
  hiddenLabel: string;
  visibleLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hidden ? hiddenLabel : visibleLabel}
      className={`${compactUpperButtonClass} relative h-8 w-14 overflow-hidden px-0 py-0`}
    >
      <span className="sr-only">{hidden ? 'Show' : 'Hide'}</span>
      <span aria-hidden="true" className="relative block h-full w-full overflow-hidden">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out ${
            hidden ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          Hide
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out ${
            hidden ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          Show
        </span>
      </span>
    </button>
  );
}

export function AnimatedLockButton({
  locked,
  onClick,
  disabled = false,
  size = 'large',
  lockedLabel = 'Unlock',
  unlockedLabel = 'Lock',
}: {
  locked: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'medium' | 'large';
  lockedLabel?: string;
  unlockedLabel?: string;
}) {
  const [animating, setAnimating] = useState(false);
  const buttonSize = size === 'large' ? 'h-14 w-14 rounded-2xl' : 'h-8 w-8 rounded-lg';
  const iconSize = size === 'large' ? 'h-8 w-8' : 'h-[18px] w-[18px]';
  const label = locked ? lockedLabel : unlockedLabel;

  useEffect(() => {
    if (!animating) return;
    const timeout = window.setTimeout(() => setAnimating(false), 320);
    return () => window.clearTimeout(timeout);
  }, [animating, locked]);

  const handleClick = () => {
    if (disabled) return;
    setAnimating(true);
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={locked}
      title={label}
      className={`flex ${buttonSize} items-center justify-center border transition-all active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40 ${
        locked
          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.16)]'
          : 'border-white/10 bg-surface-raised text-gray-300 hover:bg-surface-hover hover:text-white'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${iconSize} transition-transform duration-200 ${animating ? 'scale-110' : 'scale-100'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: '20% 100%',
            transform: locked ? 'translateY(0) rotate(0deg)' : 'translateY(-2px) rotate(-28deg)',
            transition: 'transform 260ms ease',
          }}
        >
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
        </g>
        <rect x="5.5" y="10" width="13" height="10" rx="2.25" />
        <path d="M12 14v2.75" />
      </svg>
    </button>
  );
}

function cluesForSlot(history: ClueRecord[], team: TeamId, slotIndex: number) {
  const digit = slotIndex + 1;
  return history.flatMap((record) => {
    if (record.team !== team) return [];
    return record.code.flatMap((codeDigit, clueIndex) =>
      codeDigit === digit
        ? [
            {
              clue: record.clues[clueIndex],
              round: record.round,
              encryptorName: record.encryptorName,
            },
          ]
        : [],
    );
  });
}

export function ClueBank({
  myTeam,
  keywords,
  history,
  finalKeywords,
  compactMobile = false,
  wordsHidden,
  setWordsHidden,
  gameMode,
  threePlayer,
}: {
  myTeam?: TeamId;
  keywords?: string[];
  history: ClueRecord[];
  finalKeywords?: Partial<Record<TeamId, string[]>>;
  compactMobile?: boolean;
  wordsHidden?: boolean;
  setWordsHidden?: Dispatch<SetStateAction<boolean>>;
  gameMode?: DecryptoGameMode;
  threePlayer?: ThreePlayerConfig;
}) {
  const [flipRotation, setFlipRotation] = useState(0);
  const [internalWordsHidden, setInternalWordsHidden] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  if (!myTeam) return null;
  const effectiveWordsHidden = wordsHidden ?? internalWordsHidden;
  const updateWordsHidden = setWordsHidden ?? setInternalWordsHidden;
  const threePlayerActive = isThreePlayerMode(gameMode, threePlayer);

  if (threePlayerActive) {
    const displayTeam = threePlayer.encryptorTeam;
    const isEncryptorSide = myTeam === threePlayer.encryptorTeam;
    return (
      <div className="touch-pan-y">
        <ClueBankFace
          team={displayTeam}
          myTeam={isEncryptorSide ? displayTeam : threePlayer.interceptorTeam}
          keywords={isEncryptorSide ? keywords : undefined}
          history={history}
          finalKeywords={finalKeywords}
          compactMobile={compactMobile}
          mobileExpanded={mobileExpanded}
          setMobileExpanded={setMobileExpanded}
          wordsHidden={isEncryptorSide ? effectiveWordsHidden : false}
          setWordsHidden={updateWordsHidden}
          flipped={false}
          flipCueRotation={0}
          active
          onFlip={() => undefined}
          showFlip={false}
          className=""
        />
      </div>
    );
  }

  const opponentTeam = otherTeam(myTeam);
  const activeSide = ((Math.round(flipRotation / 180) % 2) + 2) % 2;
  const flipped = activeSide === 1;
  const dragRotation = Math.max(-115, Math.min(115, dragX * 0.75));
  const cardRotation = flipRotation + dragRotation;

  const rotateCard = (degrees: number) => {
    setDragX(0);
    setFlipRotation((current) => current + degrees);
  };

  const cancelSwipe = (event: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = null;
    setDragX(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveSwipeTarget(event.target)) return;
    swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    setDragX(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) > CLUE_BANK_VERTICAL_CANCEL_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX) * 0.5) {
      cancelSwipe(event);
      return;
    }
    setDragX(Math.max(-160, Math.min(160, deltaX)));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    swipeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (
      Math.abs(deltaX) >= CLUE_BANK_SWIPE_THRESHOLD &&
      Math.abs(deltaY) <= CLUE_BANK_VERTICAL_CANCEL_THRESHOLD &&
      Math.abs(deltaX) > Math.abs(deltaY) * CLUE_BANK_HORIZONTAL_DOMINANCE
    ) {
      rotateCard(deltaX > 0 ? 180 : -180);
      return;
    }
    setDragX(0);
  };

  return (
    <div
      className="touch-pan-y [perspective:1400px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className={`grid [transform-style:preserve-3d] ${
          dragX ? '' : 'transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]'
        }`}
        style={{ transform: `rotateY(${cardRotation}deg)` }}
      >
        <ClueBankFace
          team={myTeam}
          myTeam={myTeam}
          keywords={keywords}
          history={history}
          finalKeywords={finalKeywords}
          compactMobile={compactMobile}
          mobileExpanded={mobileExpanded}
          setMobileExpanded={setMobileExpanded}
          wordsHidden={effectiveWordsHidden}
          setWordsHidden={updateWordsHidden}
          flipped={flipped}
          flipCueRotation={flipRotation}
          active={!flipped}
          onFlip={() => rotateCard(180)}
          showFlip
          className="[grid-area:1/1] [backface-visibility:hidden]"
        />
        <ClueBankFace
          team={opponentTeam}
          myTeam={myTeam}
          history={history}
          finalKeywords={finalKeywords}
          compactMobile={compactMobile}
          mobileExpanded={mobileExpanded}
          setMobileExpanded={setMobileExpanded}
          wordsHidden={false}
          setWordsHidden={updateWordsHidden}
          flipped={flipped}
          flipCueRotation={flipRotation}
          active={flipped}
          onFlip={() => rotateCard(180)}
          showFlip
          className="[grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)]"
        />
      </div>
    </div>
  );
}

function isInteractiveSwipeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('button, a, input, textarea, select, canvas, [role="button"]');
}

function ClueBankFace({
  team,
  myTeam,
  keywords,
  history,
  finalKeywords,
  compactMobile,
  mobileExpanded,
  setMobileExpanded,
  wordsHidden,
  setWordsHidden,
  flipped,
  flipCueRotation,
  active,
  onFlip,
  showFlip,
  className,
}: {
  team: TeamId;
  myTeam: TeamId;
  keywords?: string[];
  history: ClueRecord[];
  finalKeywords?: Partial<Record<TeamId, string[]>>;
  compactMobile: boolean;
  mobileExpanded: boolean;
  setMobileExpanded: Dispatch<SetStateAction<boolean>>;
  wordsHidden: boolean;
  setWordsHidden: Dispatch<SetStateAction<boolean>>;
  flipped: boolean;
  flipCueRotation: number;
  active: boolean;
  onFlip: () => void;
  showFlip: boolean;
  className: string;
}) {
  const style = TEAM_STYLES[team];
  const front = team === myTeam;
  const shownKeywords = finalKeywords?.[team] ?? (front ? keywords : undefined);
  const title = front ? `${style.label} word bank` : `${style.label} clues`;
  const canHideWords = front && !!shownKeywords?.length;
  const frontFlipCueColor = myTeam === 'red' ? 'bg-rose-300' : 'bg-cyan-200';
  const backFlipCueColor = otherTeam(myTeam) === 'red' ? 'bg-rose-300' : 'bg-cyan-200';
  const visibleFlipCueRotation = front ? flipCueRotation : -flipCueRotation;
  const useCompactMobile = !mobileExpanded;

  return (
    <div
      aria-hidden={!active}
      className={`glass-card rounded-2xl border ${style.border} ${
        useCompactMobile ? 'p-2.5 sm:p-4' : 'p-4'
      } transition-[padding,box-shadow,border-color,background-color] duration-300 ease-out ${
        active ? '' : 'pointer-events-none'
      } ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 transition-[margin,gap] duration-300 ease-out sm:mb-3">
        <div className="min-w-0">
          <div
            className={`font-display tracking-wider ${
              useCompactMobile ? 'text-base sm:text-lg' : 'text-lg'
            } ${style.text} transition-[font-size,line-height] duration-300 ease-out`}
          >
            {title}
          </div>
          <div
            className={`overflow-hidden text-gray-500 transition-[max-height,opacity] duration-300 ease-out sm:block ${
              useCompactMobile ? 'max-h-0 opacity-0 sm:max-h-5 sm:opacity-100' : 'max-h-5 text-[11px] opacity-100'
            } ${compactMobile ? 'sm:text-xs' : 'text-xs'}`}
          >
            {front ? 'Your clues grouped by keyword' : 'Opponent clue history by hidden word slot'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {canHideWords && (
            <VisibilitySwipeButton
              hidden={wordsHidden}
              onClick={() => setWordsHidden((value) => !value)}
              hiddenLabel="Show word bank words"
              visibleLabel="Hide word bank words"
            />
          )}
          <button
            type="button"
            onClick={() => setMobileExpanded((expanded) => !expanded)}
            aria-label={mobileExpanded ? 'Shrink word bank' : 'Enlarge word bank'}
            title={mobileExpanded ? 'Shrink' : 'Enlarge'}
            className={`${wordBankIconButtonClass} ${style.text}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform duration-300 ease-out ${
                mobileExpanded ? 'rotate-180 scale-95' : 'rotate-0 scale-100'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {mobileExpanded ? (
                <>
                  <path d="M8 3v5H3" />
                  <path d="M16 3v5h5" />
                  <path d="M8 21v-5H3" />
                  <path d="M16 21v-5h5" />
                  <path d="M3 8l5-5" />
                  <path d="M21 8l-5-5" />
                  <path d="M3 16l5 5" />
                  <path d="M21 16l-5 5" />
                </>
              ) : (
                <>
                  <path d="M9 3H3v6" />
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M15 21h6v-6" />
                  <path d="M3 3l7 7" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                  <path d="M21 21l-7-7" />
                </>
              )}
            </svg>
          </button>
          {showFlip && (
            <button
              type="button"
              onClick={onFlip}
              aria-pressed={flipped}
              className={`${wordBankUpperButtonClass} ${flipped ? `${style.border} ${style.bg} ${style.text}` : ''}`}
            >
              <span aria-hidden="true" className="relative h-4 w-5 shrink-0 [perspective:120px]">
                <span
                  className="absolute inset-0 rounded-md transition-transform duration-500 [transform-style:preserve-3d]"
                  style={{ transform: `rotateY(${visibleFlipCueRotation}deg)` }}
                >
                  <span className="absolute inset-0 rounded-md border border-white/15 bg-black/25 shadow-sm [backface-visibility:hidden]">
                    <span className={`absolute bottom-1 left-1 top-1 w-1 rounded-full ${frontFlipCueColor}`} />
                  </span>
                  <span className="absolute inset-0 rounded-md border border-white/15 bg-black/25 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <span className={`absolute bottom-1 right-1 top-1 w-1 rounded-full ${backFlipCueColor}`} />
                  </span>
                </span>
              </span>
              <span>Flip</span>
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-columns,gap] duration-300 ease-out ${
          useCompactMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-1 gap-2'
        } sm:grid-cols-2 sm:gap-2`}
      >
        {CLUE_BANK_SLOTS.map((slotIndex) => {
          const slotClues = cluesForSlot(history, team, slotIndex);
          const label =
            canHideWords && wordsHidden
              ? '••••••'
              : (shownKeywords?.[slotIndex] ?? (front ? `${TEAM_STYLES[team].label} #${slotIndex + 1}` : ''));
          return (
            <div
              key={slotIndex}
              className={`rounded-xl border ${style.border} ${style.bg} ${
                useCompactMobile ? 'min-h-[4.75rem] p-1.5 sm:min-h-[7.5rem] sm:p-3' : 'min-h-[7.5rem] p-3'
              } transition-[min-height,padding,transform,background-color] duration-300 ease-out`}
            >
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div
                  className={`font-display ${
                    useCompactMobile ? 'text-base sm:text-xl' : 'text-xl'
                  } ${style.text} transition-[font-size,line-height] duration-300 ease-out`}
                >
                  {slotIndex + 1}
                </div>
                <div
                  className={`tracking-widest text-gray-500 uppercase transition-[font-size,line-height] duration-300 ease-out ${
                    useCompactMobile ? 'text-[8px] sm:text-[10px]' : 'text-[10px]'
                  }`}
                >
                  {slotClues.length}
                  <span className={useCompactMobile ? 'hidden sm:inline' : ''}> clues</span>
                </div>
              </div>
              {label && (
                <div
                  className={`mt-0.5 break-words font-semibold leading-snug text-white sm:mt-1 ${
                    useCompactMobile ? 'text-[11px] sm:text-base' : 'text-base'
                  } transition-[font-size,line-height,margin] duration-300 ease-out`}
                >
                  {label}
                </div>
              )}
              <div
                className={`flex flex-wrap transition-[gap,margin] duration-300 ease-out ${
                  useCompactMobile ? 'mt-1 gap-1 sm:mt-2 sm:gap-1.5' : 'mt-2 gap-1.5'
                }`}
              >
                {slotClues.map((item, index) => (
                  <ClueChip
                    key={`${item.round}-${clueLabel(item.clue)}-${index}`}
                    clue={item.clue}
                    title={`Round ${item.round} by ${item.encryptorName}`}
                    previewTitle={`${possessiveName(item.encryptorName)} round ${item.round} drawing clue`}
                    compactMobile={useCompactMobile}
                  />
                ))}
                {slotClues.length === 0 && (
                  <span
                    className={`text-gray-600 transition-[font-size,line-height] duration-300 ease-out ${
                      useCompactMobile ? 'text-[10px] sm:text-xs' : 'text-xs'
                    }`}
                  >
                    No clues yet
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClueView({
  clue,
  className = '',
  imageClassName = '',
  previewTitle = 'Drawing clue',
}: {
  clue: ClueContent;
  className?: string;
  imageClassName?: string;
  previewTitle?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (clue.kind === 'text') {
    return <div className={`text-white font-semibold break-words ${className}`}>{clue.text}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => clue.dataUrl && setExpanded(true)}
        disabled={!clue.dataUrl}
        className={`block w-full rounded-xl bg-black/30 border border-white/10 p-2 disabled:opacity-40 ${className}`}
      >
        {clue.dataUrl ? (
          <img
            src={clue.dataUrl}
            alt="Drawing clue"
            className={`w-full h-24 object-contain rounded-lg bg-black/25 ${imageClassName}`}
          />
        ) : (
          <span className="text-gray-600 text-xs">No drawing</span>
        )}
      </button>
      {expanded && (
        <DrawingPreviewModal title={previewTitle} dataUrl={clue.dataUrl} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

function DrawingPreviewModal({ title, dataUrl, onClose }: { title: string; dataUrl: string; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="font-display text-xl tracking-wider text-white">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-white/10 bg-surface-raised text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
            aria-label="Close drawing preview"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-5">
            <img
              src={dataUrl}
              alt="Expanded drawing clue"
              className="mx-auto max-h-[72vh] w-full object-contain rounded-xl bg-black/25"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ClueChip({
  clue,
  title,
  previewTitle,
  compactMobile = false,
}: {
  clue: ClueContent;
  title: string;
  previewTitle?: string;
  compactMobile?: boolean;
}) {
  if (clue.kind === 'drawing') {
    return (
      <div
        className={`transition-[width] duration-300 ease-out ${compactMobile ? 'w-12 sm:w-20' : 'w-20'}`}
        title={title}
      >
        <ClueView
          clue={clue}
          className="!p-1"
          imageClassName={compactMobile ? '!h-7 sm:!h-10' : '!h-10'}
          previewTitle={previewTitle ?? title}
        />
      </div>
    );
  }

  return (
    <span
      className={`rounded-lg border border-white/10 bg-black/25 text-gray-200 ${
        compactMobile
          ? 'max-w-full px-1.5 py-0.5 text-[10px] leading-snug sm:px-2 sm:py-1 sm:text-[11px]'
          : 'max-w-full px-2 py-1 text-[11px] leading-snug'
      } transition-[font-size,line-height,padding] duration-300 ease-out`}
      title={title}
    >
      {clue.text}
    </span>
  );
}

export function SignalHistory({
  history,
  tiebreakerHistory = [],
  limit,
  includeIntercept = false,
  sticky = false,
  gameMode,
  threePlayer,
}: {
  history: ClueRecord[];
  tiebreakerHistory?: TiebreakerResult[];
  limit?: number;
  includeIntercept?: boolean;
  sticky?: boolean;
  gameMode?: DecryptoGameMode;
  threePlayer?: ThreePlayerConfig;
}) {
  const recent = history
    .slice()
    .reverse()
    .slice(0, limit ?? history.length);
  const recentTiebreakers = tiebreakerHistory.slice().reverse();

  return (
    <aside className={`glass-card rounded-2xl border border-white/10 p-4 h-fit ${sticky ? 'lg:sticky lg:top-5' : ''}`}>
      <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-3">Signal history</div>
      <div className="space-y-3">
        {recentTiebreakers.map((result, reverseIndex) => (
          <TiebreakerHistoryEntry
            key={`tiebreaker-${recentTiebreakers.length - reverseIndex}`}
            result={result}
            attemptNumber={tiebreakerHistory.length - reverseIndex}
          />
        ))}
        {recent.map((record) => {
          const style = TEAM_STYLES[record.team];
          const outcomes = isThreePlayerMode(gameMode, threePlayer)
            ? [
                ...(record.interceptCorrect ? [{ label: 'INTERCEPT +1', className: 'text-emerald-300' }] : []),
                ...(!record.decryptCorrect ? [{ label: 'MISDECRYPT +1', className: 'text-rose-300' }] : []),
              ]
            : [
                ...(record.interceptCorrect ? [{ label: 'INTERCEPT', className: 'text-emerald-300' }] : []),
                ...(!record.decryptCorrect ? [{ label: 'MISCOMMUNICATION', className: 'text-rose-300' }] : []),
              ];
          return (
            <div
              key={`${record.round}-${record.team}-${record.encryptorId}`}
              className="rounded-xl bg-black/20 border border-white/10 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-xs font-display tracking-wider ${style.text}`}>
                    R{record.round} {style.label}
                  </div>
                  <div className="mt-1 text-gray-300 text-[11px]">{record.encryptorName}</div>
                </div>
                <HistoryCodeSummary record={record} compact includeIntercept={includeIntercept} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {record.clues.map((clue, index) => (
                  <div
                    key={`${record.round}-${record.team}-${index}`}
                    className="rounded-lg bg-black/20 border border-white/10 p-1.5 min-h-14"
                  >
                    <ClueView
                      clue={clue}
                      className="text-xs leading-snug"
                      imageClassName="!h-12"
                      previewTitle={`${possessiveName(record.encryptorName)} round ${record.round} drawing clue`}
                    />
                  </div>
                ))}
              </div>
              {outcomes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] tracking-widest uppercase">
                  {outcomes.map((outcome) => (
                    <span key={outcome.label} className={outcome.className}>
                      {outcome.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {recent.length === 0 && recentTiebreakers.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-8">No revealed clues yet.</div>
        )}
      </div>
    </aside>
  );
}

function TiebreakerHistoryEntry({ result, attemptNumber }: { result: TiebreakerResult; attemptNumber: number }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-display tracking-wider text-white">Tiebreaker {attemptNumber}</div>
          <div className="mt-1 text-gray-400 text-[11px]">Previous keyword guesses</div>
        </div>
        <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-right text-[10px] leading-tight">
          <div className="text-gray-500 tracking-widest uppercase">Result</div>
          <div className="mt-1 font-display tracking-wider text-white">
            {result.winner === 'tie' ? 'Tie' : `${TEAM_STYLES[result.winner].label}`}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {(['red', 'blue'] as TeamId[]).map((team) => {
          const style = TEAM_STYLES[team];
          const teamResult = result.results[team];
          return (
            <div key={team} className={`rounded-lg border ${style.border} ${style.bg} p-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-display text-sm tracking-wider ${style.text}`}>{style.label}</div>
                  <div className="truncate text-[10px] text-gray-400">
                    guessed {TEAM_STYLES[teamResult.targetTeam].label}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[10px] leading-tight">
                  <div>
                    <span className="text-gray-500 uppercase tracking-widest">Exact </span>
                    <span className="font-display text-white">{teamResult.exactMatches}/4</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-gray-500 uppercase tracking-widest">Sim </span>
                    <span className="font-display text-white">{(teamResult.similarityScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {teamResult.guesses.map((guess, index) => {
                  const displayGuess = sentenceCaseGuess(guess);
                  const score = formatSimilarityScore(teamResult.slotScores[index]);
                  return (
                    <span
                      key={`${team}-${guess}-${index}`}
                      className="min-w-0 rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[10px] text-gray-200"
                      title={`${index + 1}. ${displayGuess} - ${score}`}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-1">
                        <span className="min-w-0 truncate">
                          {index + 1}. {displayGuess}
                        </span>
                        <span className="shrink-0 font-display text-[9px] tracking-wider text-gray-400">{score}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CodeDisplay({ code }: { code?: Code }) {
  const digits = code ?? [];
  return (
    <div className="flex justify-center gap-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="code-chip w-16 h-16 rounded-2xl flex items-center justify-center font-display text-3xl text-white"
        >
          {digits[index] ?? '?'}
        </div>
      ))}
    </div>
  );
}
