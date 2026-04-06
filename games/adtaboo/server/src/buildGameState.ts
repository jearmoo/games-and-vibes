import type { AdtabooRoom } from './AdtabooRoom.js';
import { GamePhase, type ChallengeSetup, type TeamId } from '@games/adtaboo-shared';

export function buildGameState(room: AdtabooRoom, playerId: string) {
  if (!room.game) return null;

  const player = room.getPlayer(playerId);
  const playerTeam: TeamId | null = player?.team ?? null;
  const phase = room.game.phase;

  const challenges: Record<string, ChallengeSetup> = {};
  for (const team of ['A', 'B'] as TeamId[]) {
    const challenge = room.game.challenges[team];

    if (phase === GamePhase.PARALLEL_SETUP && playerTeam === team) {
      // During setup, each team sees the opposing team's challenge (they set taboo words)
      // but not their own words (they'll clue those later)
      challenges[team] = {
        ...challenge,
        cards: challenge.cards.map((c) => ({ word: '???', result: c.result })),
        tabooWords: [],
        tabooSuggestions: [],
      };
    } else {
      challenges[team] = { ...challenge };
    }
  }

  return {
    phase: room.game.phase,
    round: room.game.round,
    scores: room.game.scores,
    challenges,
    timerEnd: room.game.timerEnd,
    tabooMasters: room.game.tabooMasters,
    turnResults: room.game.turnResults,
    roundHistory: room.getRoundHistory(),
  };
}
