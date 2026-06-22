import { BaseRoom } from '@games/server-core';
import {
  buildDeck,
  resolveSelection,
  TwoRoomsPhase,
  type BuiltDeck,
  type DeckCount,
  type PrivateRole,
  type TwoRoomsGameState,
  type TwoRoomsPlayer,
  type TwoRoomsPlayerDTO,
  type TwoRoomsRoomDTO,
  type TwoRoomsSettings,
} from '@games/two-rooms-and-a-boom-shared';

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class TwoRoomsRoom extends BaseRoom<TwoRoomsPlayer> {
  declare settings: TwoRoomsSettings;
  game: TwoRoomsGameState | null = null;

  constructor(code: string, hostId: string) {
    super(code, hostId, { selectedItemIds: [] });
  }

  // --- Abstract method implementations ---

  protected onPlayerRemoved(playerId: string): void {
    if (this.game) {
      delete this.game.assignments[playerId];
    }
  }

  isGameActive(): boolean {
    return this.game?.phase === TwoRoomsPhase.REVEAL;
  }

  getPhase(): TwoRoomsPhase {
    return this.game?.phase ?? TwoRoomsPhase.LOBBY;
  }

  serializeGameState(): object {
    return { game: this.game };
  }

  resetToLobby(): void {
    this.game = null;
    this.touch();
  }

  // --- Game methods ---

  /** Replace the selected deck items (host only; sanitized by the handler). */
  setSelection(selectedItemIds: string[]): void {
    this.settings.selectedItemIds = resolveSelection(selectedItemIds);
    this.touch();
  }

  /** Connected, non-removed players — the ones a deal applies to. */
  dealablePlayers(): TwoRoomsPlayer[] {
    return this.getActivePlayers().filter((p) => p.connected);
  }

  /** Resolve the current selection into a full deck for the live player count. */
  currentDeck(): BuiltDeck {
    return buildDeck({
      selectedItemIds: this.settings.selectedItemIds,
      playerCount: this.dealablePlayers().length,
    });
  }

  /** Expand a deck composition (card + copies) into a flat list of card ids. */
  private flatten(composition: DeckCount[]): string[] {
    const cards: string[] = [];
    for (const { roleId, count } of composition) {
      for (let i = 0; i < count; i++) cards.push(roleId);
    }
    return cards;
  }

  /** Shuffle the built deck and assign one card to each dealable player. */
  startGame(): void {
    const players = this.dealablePlayers();
    const built = this.currentDeck();
    const deck = shuffle(this.flatten(built.composition));
    const assignments: Record<string, string> = {};
    players.forEach((player, index) => {
      assignments[player.id] = deck[index];
    });
    this.game = { phase: TwoRoomsPhase.REVEAL, assignments, composition: built.composition };
    this.touch();
  }

  getRoleFor(playerId: string): PrivateRole | null {
    const roleId = this.game?.assignments[playerId];
    return roleId ? { roleId } : null;
  }

  assignedCount(): number {
    return this.game ? Object.keys(this.game.assignments).length : 0;
  }

  composition(): DeckCount[] {
    return this.game?.composition ?? [];
  }

  // --- Serialization ---

  override playerDTOs(): TwoRoomsPlayerDTO[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      hasRole: !!this.game?.assignments[p.id],
    }));
  }

  override toDTO(): TwoRoomsRoomDTO {
    return {
      ...super.toDTO(),
      players: this.playerDTOs(),
      settings: this.settings,
      phase: this.getPhase(),
      assignedCount: this.assignedCount(),
      composition: this.composition(),
    };
  }

  static fromJSON(data: {
    code: string;
    hostId: string;
    lastActivity?: number;
    settings?: Partial<TwoRoomsSettings>;
    game?: TwoRoomsGameState | null;
    players?: Array<{ id: string; name: string; removed?: boolean; removedReason?: 'left' | 'kicked' }>;
  }): TwoRoomsRoom {
    const room = new TwoRoomsRoom(data.code, data.hostId);
    room.restorePlayers(data);
    room.settings = { selectedItemIds: data.settings?.selectedItemIds ?? [] };
    room.lastActivity = data.lastActivity ?? Date.now();
    room.game = data.game ?? null;
    return room;
  }
}
