import type { Player, PlayerDTO, TeamId, RoomSettings, RoomDTO } from '@games/shared-types';

export abstract class BaseRoom {
  code: string;
  hostId: string;
  players: Map<string, Player> = new Map();
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

  addPlayer(id: string, name: string, socketId: string): Player {
    const player: Player = { id, name, team: null, socketId, connected: true };
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

  getActivePlayers(): Player[] {
    return Array.from(this.players.values()).filter((p) => !p.removed);
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getPlayerByName(name: string): Player | undefined {
    return Array.from(this.players.values()).find((p) => p.name === name);
  }

  getTeamPlayers(team: TeamId): Player[] {
    return Array.from(this.players.values()).filter((p) => p.team === team && p.connected);
  }

  getOpposingTeam(team: TeamId): TeamId {
    return team === 'A' ? 'B' : 'A';
  }

  playerDTOs(): PlayerDTO[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
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
        team: p.team,
        connected: p.connected,
        disconnectedAt: p.disconnectedAt,
        removed: p.removed,
      })),
      ...this.serializeGameState(),
    };
  }

  restorePlayers(data: { players?: Array<{ id: string; name: string; team: 'A' | 'B' | null; removed?: boolean }> }) {
    for (const p of data.players ?? []) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        team: p.team,
        socketId: '',
        connected: false,
        disconnectedAt: Date.now(),
        removed: p.removed ?? false,
      });
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

  /** Clean up timers */
  abstract clearTimer(): void;
}
