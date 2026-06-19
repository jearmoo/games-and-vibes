import { useState } from 'react';
import { DecryptoPhase } from '@games/decrypto-shared';
import { useGameStore } from '../store';
import LeaveRoomButton from './LeaveRoomButton';
import { HowToPlayPanel, TEAM_STYLES } from './shared';

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
          onClick={() => canExpand && onDropdownOpenChange?.(!dropdownOpen)}
          aria-expanded={canExpand ? dropdownOpen : undefined}
          disabled={!canExpand}
          className="flex min-w-0 max-w-[calc(100%-6rem)] items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap text-center disabled:cursor-default sm:pointer-events-none sm:cursor-default"
        >
          <span className={`min-w-0 truncate font-semibold ${teamStyle?.text ?? 'text-gray-300'}`}>{name}</span>
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
                dropdownOpen ? 'rotate-180' : ''
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

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-200"
            aria-label="How to play Decrypto"
            title="How to play"
          >
            ?
          </button>
        </div>
      </div>
      {helpOpen && <HowToPlayPanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
