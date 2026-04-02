import type { AdtabooRoom } from './AdtabooRoom.js';
import { GamePhase, type ChallengeSetup, type TeamId } from '@games/adtaboo-shared';

function redactChallenge(challenge: ChallengeSetup): ChallengeSetup {
  return {
    cards: challenge.cards.map((c) => ({ word: '???', result: c.result })),
    tabooWords: [],
    tabooSuggestions: [],
    tabooBuzzes: challenge.tabooBuzzes,
    ready: challenge.ready,
    clueGiverId: challenge.clueGiverId,
  };
}

export function buildGameState(room: AdtabooRoom, playerId: string) {
  if (!room.game) return null;

  const player = room.getPlayer(playerId);
  const playerTeam: TeamId | null = player?.team ?? null;
  const phase = room.game.phase;

  const challenges: Record<string, ChallengeSetup> = {};
  for (const team of ['A', 'B'] as TeamId[]) {
    const challenge = room.game.challenges[team];
    let shouldRedact = false;

    if (phase === GamePhase.PARALLEL_SETUP) {
      // Each team sees the opposing team's challenge (they're setting up taboo words for it)
      // but not their own (they'll clue those words later)
      shouldRedact = playerTeam === team;
    } else if (phase === GamePhase.CLUING_A || phase === GamePhase.CLUING_B) {
      const cluingTeam = phase === GamePhase.CLUING_A ? 'A' : 'B';
      if (team === cluingTeam) {
        // Cluing team's cards: redact for everyone except clue giver's own team
        // (clue giver sees words, teammates see '???' — client handles that distinction)
        shouldRedact = playerTeam !== cluingTeam;
      }
      // Non-cluing team's challenge is visible (taboo words for the taboo master)
    }
    // ROUND_RESULT / GAME_OVER: everything visible

    challenges[team] = shouldRedact ? redactChallenge(challenge) : { ...challenge };
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
