import type { AdtabooRoom } from './AdtabooRoom.js';

export function buildGameState(room: AdtabooRoom) {
  if (!room.game) return null;
  return {
    phase: room.game.phase,
    round: room.game.round,
    scores: room.game.scores,
    challenges: {
      A: { ...room.game.challenges.A },
      B: { ...room.game.challenges.B },
    },
    timerEnd: room.game.timerEnd,
    tabooMasters: room.game.tabooMasters,
    turnResults: room.game.turnResults,
    roundHistory: room.getRoundHistory(),
  };
}
