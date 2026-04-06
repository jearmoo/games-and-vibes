import type { BasePlayer, BasePlayerDTO, RoomSettings, RoomDTO } from './types.js';

export abstract class BaseRoom<P extends BasePlayer = BasePlayer> {
  code: string;
  hostId: string;
  players: Map<string, P> = new Map();
  settings: RoomSettings;
  lastActivity: number = Date.now();

  constructor(code: string, hostId: string, defaultSettings: RoomSettings) {
    this.code = code;
    this.hostId = hostId;
    this.settings = defaultSettings;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  addPlayer(id: string, name: string, socketId: string): P {
    const player = { id, name, socketId, connected: true } as P;
    this.players.set(id, player);
    this.touch();
    return player;
  }

  removePlayer(id: string): void {
    const gameActive = this.isGameActive();
    const player = this.players.get(id);
    if (player && gameActive) {
      player.connected = false;
      player.removed = true;
    } else {
      this.players.delete(id);
    }
    this.onPlayerRemoved(id);
    this.touch();
  }

  /** Permanently remove a player (host kick). During active game, soft-removes and triggers onPlayerRemoved. */
  kickPlayer(id: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    if (this.isGameActive()) {
      player.connected = false;
      player.removed = true;
    } else {
      this.players.delete(id);
    }
    this.onPlayerRemoved(id);
    this.touch();
    return true;
  }

  getActivePlayers(): P[] {
    return Array.from(this.players.values()).filter((p) => !p.removed);
  }

  getPlayer(id: string): P | undefined {
    return this.players.get(id);
  }

  getPlayerByName(name: string): P | undefined {
    return Array.from(this.players.values()).find((p) => p.name === name);
  }

  playerDTOs(): BasePlayerDTO[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
    }));
  }

  toDTO(): RoomDTO {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.playerDTOs(),
      settings: { ...this.settings },
      phase: this.getPhase(),
    };
  }

  toJSON(): object {
    return {
      code: this.code,
      hostId: this.hostId,
      lastActivity: this.lastActivity,
      settings: this.settings,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        disconnectedAt: p.disconnectedAt,
        removed: p.removed,
      })),
      ...this.serializeGameState(),
    };
  }

  restorePlayers(data: { players?: Array<{ id: string; name: string; removed?: boolean; [key: string]: unknown }> }) {
    for (const p of data.players ?? []) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        socketId: '',
        connected: false,
        disconnectedAt: Date.now(),
        removed: p.removed ?? false,
      } as P);
    }
  }

  /** Override to clear game-specific role assignments on player removal */
  protected abstract onPlayerRemoved(playerId: string): void;

  /** Whether a game is actively in progress (not lobby/game-over) */
  abstract isGameActive(): boolean;

  /** Current phase string for DTO */
  abstract getPhase(): string | null;

  /** Serialize game-specific state for JSON persistence */
  abstract serializeGameState(): object;

  /** Clear game state and return to lobby */
  abstract resetToLobby(): void;

  /** Clean up timers. Override if the game uses timers. */
  clearTimer(): void {}
}
