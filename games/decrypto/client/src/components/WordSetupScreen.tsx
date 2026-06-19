import { useState } from 'react';
import type { TeamId } from '@games/decrypto-shared';
import { useGameStore, useTeamPlayers, type DecryptoPlayerDTO } from '../store';
import { AnimatedLockButton, MobileScoreSummary, TEAM_STYLES, VisibilitySwipeButton } from './shared';
import GameHeader from './GameHeader';

const TEAMS: TeamId[] = ['red', 'blue'];

export default function WordSetupScreen() {
  const room = useGameStore((s) => s.room);
  const privateState = useGameStore((s) => s.privateState);
  const wordLocks = useGameStore((s) => s.room?.wordLocks ?? { red: false, blue: false });
  const redPlayers = useTeamPlayers('red');
  const bluePlayers = useTeamPlayers('blue');
  const [setupDetailsOpen, setSetupDetailsOpen] = useState(false);
  const playersByTeam: Record<TeamId, DecryptoPlayerDTO[]> = {
    red: redPlayers,
    blue: bluePlayers,
  };
  const visibleTeams: TeamId[] = privateState?.team ? [privateState.team] : TEAMS;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <GameHeader
        roleOverride="Word Setup"
        roundLabel=""
        dropdownOpen={setupDetailsOpen}
        onDropdownOpenChange={setSetupDetailsOpen}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5">
          {setupDetailsOpen && room && (
            <div className="sm:hidden">
              <div className="rounded-lg border border-white/10 bg-black/15 p-2">
                <div className="mb-2 font-display text-base tracking-wider text-white">Word setup</div>
                <MobileScoreSummary scores={room.scores} players={room.players} />
              </div>
            </div>
          )}
          <SetupDetailsCard wordLocks={wordLocks} />

          <div className={`grid grid-cols-1 gap-4 ${visibleTeams.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {visibleTeams.map((team) => (
              <TeamWordsCard
                key={team}
                team={team}
                players={playersByTeam[team]}
                mine={privateState?.team === team}
                keywords={privateState?.team === team ? (privateState.keywords ?? []) : []}
                locked={wordLocks[team]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupDetailsCard({
  wordLocks,
}: {
  wordLocks: Record<TeamId, boolean>;
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-4">
      <div>
        <div className="mb-1 text-[10px] tracking-[0.3em] text-gray-500 uppercase">Game started</div>
        <div className="font-display text-3xl tracking-wider text-white">Choose team words</div>
        <div className="mt-1 text-sm text-gray-400">Lock your team's words when you're ready.</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
          {TEAMS.map((team) => (
            <span key={team} className={`rounded-lg border ${TEAM_STYLES[team].border} px-2 py-1`}>
              <span className={TEAM_STYLES[team].text}>{TEAM_STYLES[team].label}</span>
              <span className="text-gray-500"> · </span>
              <span className={wordLocks[team] ? 'text-emerald-300' : 'text-gray-400'}>
                {wordLocks[team] ? 'locked' : 'choosing'}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamWordsCard({
  team,
  players,
  mine,
  keywords,
  locked,
}: {
  team: TeamId;
  players: DecryptoPlayerDTO[];
  mine: boolean;
  keywords: string[];
  locked: boolean;
}) {
  const style = TEAM_STYLES[team];

  return (
    <div className={`glass-card rounded-2xl border ${style.border} p-4 ${mine ? `shadow-lg ${style.ring}` : ''}`}>
      <div className="mb-4">
        <div>
          <div className={`font-display text-xl tracking-wider ${style.text}`}>{style.label} words</div>
          <div className="mt-1 text-gray-500 text-xs">
            {players.map((player) => player.name).join(' · ') || 'No players'}
          </div>
        </div>
      </div>

      {mine ? (
        <>
          <WordControls team={team} keywords={keywords} locked={locked} />
          <div className="mt-4 flex justify-center">
            <AnimatedLockButton
              locked={locked}
              onClick={() => useGameStore.getState().setWordLock({ team, locked: !locked })}
              lockedLabel="Unlock words"
              unlockedLabel="Lock words"
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/15 p-5 text-center text-gray-500 text-sm">
          {locked ? 'Ready' : 'Waiting'}
        </div>
      )}
    </div>
  );
}

function WordControls({ team, keywords, locked }: { team: TeamId; keywords: string[]; locked: boolean }) {
  const style = TEAM_STYLES[team];
  const [hidden, setHidden] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const slots = [0, 1, 2, 3];

  const handleRegenerate = (index: number) => {
    if (locked) return;
    setRegeneratingIndex(index);
    useGameStore.getState().regenerateKeyword({ team, index });
    window.setTimeout(() => setRegeneratingIndex((current) => (current === index ? null : current)), 650);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-gray-400 text-xs tracking-widest uppercase">Your words</div>
        <div className="flex items-center gap-2">
          <VisibilitySwipeButton
            hidden={hidden}
            onClick={() => setHidden((value) => !value)}
            hiddenLabel="Show words"
            visibleLabel="Hide words"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {slots.map((index) => {
          const word = keywords[index] ?? '...';
          return (
            <div key={`${word}-${index}`} className={`rounded-xl border ${style.border} bg-black/15 p-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`font-display text-lg ${style.text}`}>{index + 1}</div>
                <button
                  type="button"
                  onClick={() => handleRegenerate(index)}
                  disabled={locked}
                  aria-label={`Regenerate word ${index + 1}`}
                  title="Regenerate"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-gray-300 transition-all hover:bg-surface-hover hover:text-white active:scale-[0.92] disabled:opacity-30"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 ${regeneratingIndex === index ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 11a8 8 0 0 0-14.7-4.4" />
                    <path d="M5 3v4h4" />
                    <path d="M4 13a8 8 0 0 0 14.7 4.4" />
                    <path d="M19 21v-4h-4" />
                  </svg>
                </button>
              </div>
              <div className="mt-1 text-white font-semibold break-words min-h-[2.5rem]">{hidden ? '••••••' : word}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
