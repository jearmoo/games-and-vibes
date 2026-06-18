import { useState } from 'react';
import type { TeamId } from '@games/decrypto-shared';
import { useGameStore, useTeamPlayers, type DecryptoPlayerDTO } from '../store';
import { TEAM_STYLES, TeamBadge } from './shared';

const TEAMS: TeamId[] = ['red', 'blue'];

export default function WordSetupScreen() {
  const privateState = useGameStore((s) => s.privateState);
  const wordLocks = useGameStore((s) => s.room?.wordLocks ?? { red: false, blue: false });
  const redPlayers = useTeamPlayers('red');
  const bluePlayers = useTeamPlayers('blue');
  const playersByTeam: Record<TeamId, DecryptoPlayerDTO[]> = {
    red: redPlayers,
    blue: bluePlayers,
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 animate-fade-in overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="glass-card rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Game started</div>
            <div className="font-display text-3xl tracking-wider text-white">Choose team words</div>
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
          <div className="flex gap-2">
            <TeamBadge team="red" />
            <TeamBadge team="blue" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TEAMS.map((team) => (
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
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className={`font-display text-xl tracking-wider ${style.text}`}>{style.label} words</div>
          <div className="mt-1 text-gray-500 text-xs">
            {players.map((player) => player.name).join(' · ') || 'No players'}
          </div>
        </div>
        <div
          className={`rounded-lg border px-2 py-1 text-[10px] tracking-widest uppercase ${
            locked
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-black/20 text-gray-400'
          }`}
        >
          {locked ? 'Locked' : 'Choosing'}
        </div>
      </div>

      {mine ? (
        <WordControls team={team} keywords={keywords} locked={locked} />
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
  const slots = [0, 1, 2, 3];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-gray-400 text-xs tracking-widest uppercase">Your words</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHidden((value) => !value)}
            className="px-3 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-gray-300 text-xs font-semibold tracking-wider transition-all active:scale-[0.97]"
          >
            {hidden ? 'Show' : 'Hide'}
          </button>
          <button
            type="button"
            onClick={() => useGameStore.getState().setWordLock({ team, locked: !locked })}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold tracking-wider transition-all active:scale-[0.97] ${
              locked
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-surface-raised hover:bg-surface-hover border-white/10 text-white'
            }`}
          >
            {locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {slots.map((index) => {
          const word = keywords[index] ?? '...';
          return (
            <div key={`${word}-${index}`} className={`rounded-xl border ${style.border} bg-black/15 p-3`}>
              <div className={`font-display text-lg ${style.text}`}>{index + 1}</div>
              <div className="mt-1 text-white font-semibold break-words min-h-[2.5rem]">{hidden ? '••••••' : word}</div>
              <button
                type="button"
                onClick={() => useGameStore.getState().regenerateKeyword({ team, index })}
                disabled={locked}
                className="mt-3 w-full py-2 rounded-lg bg-surface-raised hover:bg-surface-hover border border-white/10 text-gray-300 text-[11px] tracking-widest uppercase disabled:opacity-30"
              >
                Regenerate
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
