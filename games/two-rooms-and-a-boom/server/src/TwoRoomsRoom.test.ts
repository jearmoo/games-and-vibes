import { describe, expect, it } from 'vitest';
import { buildDeck, resolveSelection, ROLE_MAP, TwoRoomsPhase } from '@games/two-rooms-and-a-boom-shared';
import { TwoRoomsRoom } from './TwoRoomsRoom.js';

function roomWithPlayers(count: number): TwoRoomsRoom {
  const room = new TwoRoomsRoom('TEST', 'p0');
  for (let i = 0; i < count; i++) {
    room.addPlayer(`p${i}`, `Player ${i}`, `s${i}`);
  }
  return room;
}

function totalCards(room: TwoRoomsRoom): number {
  return room.composition().reduce((n, c) => n + c.count, 0);
}

describe('deck selection', () => {
  it('drops a dependent whose requirement is not selected', () => {
    // Nurse requires Doctor; Decoy requires the Sniper/Target pack.
    expect(resolveSelection(['nurse'])).toEqual([]);
    expect(resolveSelection(['doctor', 'nurse'])).toEqual(['doctor', 'nurse']);
    expect(resolveSelection(['decoy'])).toEqual([]);
    expect(resolveSelection(['sniper_target', 'decoy'])).toEqual(['sniper_target', 'decoy']);
  });

  it('ignores unknown and locked item ids', () => {
    expect(resolveSelection(['president', 'bomber', 'nope'])).toEqual([]);
  });
});

describe('buildDeck', () => {
  it('always includes the locked primary pair', () => {
    const deck = buildDeck({ selectedItemIds: [], playerCount: 6 });
    const ids = deck.composition.map((c) => c.roleId);
    expect(ids).toContain('president');
    expect(ids).toContain('bomber');
  });

  it('auto-fills the remaining slots with balanced team members', () => {
    const deck = buildDeck({ selectedItemIds: [], playerCount: 6 });
    // president + bomber + 4 filler = 6, split evenly (no Gambler, even remainder).
    expect(deck.cardCount).toBe(6);
    expect(deck.blueFill).toBe(2);
    expect(deck.redFill).toBe(2);
    expect(deck.gambler).toBe(0);
    expect(totalEntry(deck, 'blue_team')).toBe(2);
    expect(totalEntry(deck, 'red_team')).toBe(2);
  });

  it('adds a Gambler when the filler slots are odd', () => {
    const deck = buildDeck({ selectedItemIds: [], playerCount: 7 });
    expect(deck.cardCount).toBe(7);
    expect(deck.gambler).toBe(1);
    expect(deck.blueFill).toBe(2);
    expect(deck.redFill).toBe(2);
  });

  it('counts a pack as all of its cards', () => {
    const deck = buildDeck({ selectedItemIds: ['romeo_juliet'], playerCount: 8 });
    const ids = deck.composition.map((c) => c.roleId);
    expect(ids).toContain('romeo');
    expect(ids).toContain('juliet');
    // president, bomber, romeo, juliet + 4 filler = 8.
    expect(deck.fixedCount).toBe(4);
    expect(deck.blueFill + deck.redFill + deck.gambler).toBe(4);
  });

  it('rebalances filler colour to offset a colour-skewed special', () => {
    // Two extra blue cards selected → red filler should be larger.
    const deck = buildDeck({ selectedItemIds: ['werewolf__blue', 'mayor__blue'], playerCount: 8 });
    expect(deck.redFill).toBeGreaterThan(deck.blueFill);
    expect(deck.cardCount).toBe(8);
  });

  it('is invalid when fixed cards exceed the player count', () => {
    const many = ['romeo_juliet', 'rock_paper_scissors', 'ahab_moby'];
    const deck = buildDeck({ selectedItemIds: many, playerCount: 4 });
    expect(deck.valid).toBe(false);
    expect(deck.overBy).toBeGreaterThan(0);
  });
});

describe('TwoRoomsRoom', () => {
  it('starts in the lobby with an empty selection', () => {
    const room = roomWithPlayers(1);
    expect(room.getPhase()).toBe(TwoRoomsPhase.LOBBY);
    expect(room.settings.selectedItemIds).toEqual([]);
  });

  it('deals one valid card to every connected player and records the composition', () => {
    const room = roomWithPlayers(6);
    room.setSelection(['werewolf__red']);
    room.startGame();

    expect(room.getPhase()).toBe(TwoRoomsPhase.REVEAL);
    expect(room.assignedCount()).toBe(6);
    expect(totalCards(room)).toBe(6);

    for (let i = 0; i < 6; i++) {
      const role = room.getRoleFor(`p${i}`);
      expect(role).not.toBeNull();
      expect(ROLE_MAP.has(role!.roleId)).toBe(true);
    }
    const dealt = Array.from({ length: 6 }, (_, i) => room.getRoleFor(`p${i}`)!.roleId);
    expect(dealt).toContain('president');
    expect(dealt).toContain('bomber');
  });

  it('clears a removed player from the assignments', () => {
    const room = roomWithPlayers(2);
    room.startGame();
    expect(room.assignedCount()).toBe(2);
    room.removePlayer('p1');
    expect(room.getRoleFor('p1')).toBeNull();
  });

  it('returns to the lobby and forgets the deal', () => {
    const room = roomWithPlayers(2);
    room.startGame();
    room.resetToLobby();
    expect(room.getPhase()).toBe(TwoRoomsPhase.LOBBY);
    expect(room.composition()).toEqual([]);
  });

  it('survives a serialization round-trip', () => {
    const room = roomWithPlayers(7);
    room.setSelection(['romeo_juliet', 'doctor', 'nurse']);
    room.startGame();

    const restored = TwoRoomsRoom.fromJSON(JSON.parse(JSON.stringify(room.toJSON())));
    expect(restored.getPhase()).toBe(TwoRoomsPhase.REVEAL);
    expect([...restored.settings.selectedItemIds].sort()).toEqual(['doctor', 'nurse', 'romeo_juliet']);
    expect(restored.assignedCount()).toBe(7);
    expect(restored.composition()).toEqual(room.composition());
    for (let i = 0; i < 7; i++) {
      expect(restored.getRoleFor(`p${i}`)?.roleId).toBe(room.getRoleFor(`p${i}`)?.roleId);
    }
  });
});

function totalEntry(deck: ReturnType<typeof buildDeck>, roleId: string): number {
  return deck.composition.find((c) => c.roleId === roleId)?.count ?? 0;
}
