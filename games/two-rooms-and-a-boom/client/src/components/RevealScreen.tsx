import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getRole, type RoleTeam } from '@games/two-rooms-and-a-boom-shared';
import { useGameStore, useIsHost } from '../store';
import RolesInPlay from './RolesInPlay';

type View = 'full' | 'color' | 'hidden';

const TEAM_LABEL: Record<RoleTeam, string> = { blue: 'Blue Team', red: 'Red Team', grey: 'Grey' };
const TEAM_GRADIENT: Record<RoleTeam, string> = {
  blue: 'from-blue-500 to-blue-900',
  red: 'from-red-500 to-red-900',
  grey: 'from-gray-400 to-gray-700',
};

export default function RevealScreen() {
  const room = useGameStore((s) => s.room)!;
  const myRole = useGameStore((s) => s.myRole);
  const isHost = useIsHost();
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  const composition = useGameStore((s) => s.composition);
  const role = myRole ? getRole(myRole.roleId) : undefined;
  const [view, setView] = useState<View>('full');
  const [showRoles, setShowRoles] = useState(false);

  // Reset to the full card whenever a fresh card is dealt.
  useEffect(() => {
    setView('full');
  }, [myRole?.roleId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-4 sm:p-6 max-w-md mx-auto flex flex-col"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Room {room.code}</div>
          <div className="text-white/50 text-sm">{room.assignedCount} cards dealt</div>
        </div>
        <button className="btn-ghost" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {!role ? (
          <div className="glass-card p-8 text-center max-w-sm">
            <h2 className="font-display text-2xl mb-2">No card this round</h2>
            <p className="text-white/60">You joined after the deal. Watch this round, then play the next one.</p>
          </div>
        ) : (
          <>
            <RoleCard
              team={role.team}
              name={role.name}
              description={role.description}
              primary={role.primary}
              view={view}
            />

            <div className="mt-6 w-full max-w-sm space-y-3">
              {view === 'full' && (
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn-ghost" onClick={() => setView('color')}>
                    Hide role
                  </button>
                  <button className="btn-ghost" onClick={() => setView('hidden')}>
                    Hide all
                  </button>
                </div>
              )}
              {view === 'color' && (
                <div className="grid grid-cols-2 gap-3">
                  <button className="btn-primary" onClick={() => setView('full')}>
                    Show role
                  </button>
                  <button className="btn-ghost" onClick={() => setView('hidden')}>
                    Hide all
                  </button>
                </div>
              )}
              {view === 'hidden' && (
                <button className="btn-primary w-full" onClick={() => setView('full')}>
                  Show card
                </button>
              )}
              <p className="text-center text-xs text-white/40">
                Show only your color, or your full card. Hide all keeps it secret.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Roles in play — everyone can review the full deck and what each card does. */}
      <div className="mt-6">
        <button className="btn-ghost w-full" onClick={() => setShowRoles((v) => !v)}>
          {showRoles ? 'Hide roles in play' : `Roles in play (${room.assignedCount})`}
        </button>
        <AnimatePresence initial={false}>
          {showRoles && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="glass-card rounded-2xl p-4 mt-3 max-h-[50vh] overflow-y-auto no-scrollbar">
                <p className="text-[11px] text-gray-500 mb-3">
                  Every card dealt this game, and what it does. It does not show who holds what.
                </p>
                <RolesInPlay composition={composition} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isHost && (
        <button className="btn-ghost w-full mt-3" onClick={returnToLobby}>
          End game · back to lobby
        </button>
      )}
    </motion.div>
  );
}

function RoleCard({
  team,
  name,
  description,
  primary,
  view,
}: {
  team: RoleTeam;
  name: string;
  description: string;
  primary?: boolean;
  view: View;
}) {
  if (view === 'hidden') {
    return (
      <div className="aspect-[3/4] w-64 rounded-3xl border-2 border-white/10 bg-white/5 backdrop-blur flex items-center justify-center">
        <span className="font-display text-2xl text-white/30">HIDDEN</span>
      </div>
    );
  }

  const colorOnly = view === 'color';

  return (
    <motion.div
      key={view}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`aspect-[3/4] w-64 rounded-3xl bg-gradient-to-br ${TEAM_GRADIENT[team]} shadow-2xl border-2 border-white/20 p-5 flex flex-col`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/90">{TEAM_LABEL[team]}</span>
        {primary && <span className="text-xs font-bold text-white/90">★ PRIMARY</span>}
      </div>

      {colorOnly ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-display text-5xl text-white/40">{TEAM_LABEL[team]}</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center text-center">
          <h2 className="font-display text-3xl leading-tight mb-3 text-white drop-shadow">{name}</h2>
          <p className="text-sm text-white/90 leading-snug">{description}</p>
        </div>
      )}

      <div className="text-center text-[10px] uppercase tracking-widest text-white/50">Two Rooms and a Boom</div>
    </motion.div>
  );
}
