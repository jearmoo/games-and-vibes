import { BaseRoom } from '@games/server-core';

/**
 * Minimal concrete BaseRoom for testing. Implements all abstract methods trivially.
 * Toggle `gameActive` and `phase` to control behavior in tests.
 */
export class TestRoom extends BaseRoom {
  gameActive = false;
  phase: string | null = null;
  removedPlayerIds: string[] = [];
  timerCleared = false;

  constructor(code = 'TEST', hostId = 'host1') {
    super(code, hostId, { rounds: 3, timerSeconds: 60 });
  }

  protected onPlayerRemoved(playerId: string): void {
    this.removedPlayerIds.push(playerId);
  }

  isGameActive(): boolean {
    return this.gameActive;
  }

  getPhase(): string | null {
    return this.phase;
  }

  serializeGameState(): object {
    return { gameActive: this.gameActive, phase: this.phase };
  }

  resetToLobby(): void {
    this.gameActive = false;
    this.phase = null;
    for (const [id, player] of this.players) {
      if (player.removed) this.players.delete(id);
    }
  }

  clearTimer(): void {
    this.timerCleared = true;
  }

  static fromJSON(data: any): TestRoom {
    const room = new TestRoom(data.code, data.hostId);
    room.lastActivity = data.lastActivity ?? Date.now();
    room.settings = { ...room.settings, ...data.settings };
    room.gameActive = data.gameActive ?? false;
    room.phase = data.phase ?? null;
    room.restorePlayers(data);
    return room;
  }
}
