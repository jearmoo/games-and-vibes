import { getRole, type DeckCount, type RoleTeam } from '@games/two-rooms-and-a-boom-shared';

const TEAM_DOT: Record<RoleTeam, string> = {
  blue: 'bg-boom-blue',
  red: 'bg-boom-red',
  grey: 'bg-boom-grey',
};
const TEAM_TEXT: Record<RoleTeam, string> = {
  blue: 'text-boom-blue-glow',
  red: 'text-boom-red-glow',
  grey: 'text-boom-grey-glow',
};
const TEAM_LABEL: Record<RoleTeam, string> = { blue: 'Blue', red: 'Red', grey: 'Grey' };

/**
 * Renders a dealt/previewed deck: one row per card, with copy count, team
 * colour and a short description. Shared by the lobby preview and the in-game
 * "roles in play" view so both stay identical.
 */
export default function RolesInPlay({ composition }: { composition: DeckCount[] }) {
  if (composition.length === 0) {
    return <p className="text-gray-500 text-sm">No cards yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {composition.map(({ roleId, count }) => {
        const role = getRole(roleId);
        if (!role) return null;
        return (
          <li key={roleId} className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${TEAM_DOT[role.team]}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="font-medium text-sm truncate">{role.name}</span>
                {count > 1 && <span className="text-xs text-gray-400">×{count}</span>}
                <span className={`text-[10px] uppercase tracking-wide ${TEAM_TEXT[role.team]}`}>
                  {TEAM_LABEL[role.team]}
                </span>
              </span>
              <span className="block text-[11px] text-gray-500 leading-snug">{role.description}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
