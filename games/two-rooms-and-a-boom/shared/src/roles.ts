/**
 * Two Rooms and a Boom — character catalog + deck builder.
 *
 * The real game is a set of UNIQUE cards: you never hold two Presidents or two
 * Werewolves. The only duplicated cards are the generic Blue Team / Red Team
 * members (and one Gambler for odd player counts). So the deck model here is:
 *
 *   - Named cards are SINGLETONS, chosen via on/off "deck items".
 *   - Matched cards are PACKS that are added/removed together (Romeo + Juliet,
 *     Rock/Paper/Scissors, the alternate primary pairs, …).
 *   - Some items REQUIRE another (Nurse needs Doctor, Decoy needs the Sniper
 *     pack, …) and are dropped if their requirement is not selected.
 *   - President + Bomber are LOCKED — always in the deck, never selectable off.
 *   - Blue Team / Red Team / Gambler are FILLER: never picked by hand, they are
 *     computed to top the deck up to the player count, balanced by color, with a
 *     Gambler added when the remaining slots are odd.
 *
 * This app only ever *displays* a player's card; it runs none of the game
 * logic. Allegiance (card color) is therefore the most important attribute.
 */

export type RoleTeam = 'red' | 'blue' | 'grey';

export interface Role {
  id: string;
  name: string;
  team: RoleTeam;
  description: string;
  /** Primary characters the game is built around (President, Bomber, …). */
  primary?: boolean;
  /** Always in the deck; never selectable off (President + Bomber). */
  required?: boolean;
  /** Generic team members / Gambler — added automatically, not hand-picked. */
  filler?: boolean;
}

/** A selectable unit in the lobby: one card, a pack of cards, or a locked primary. */
export interface DeckItem {
  id: string;
  label: string;
  blurb: string;
  /** The card(s) this item contributes. */
  roleIds: string[];
  kind: 'single' | 'pack' | 'locked';
  /** For singles: the card's team (for the colour dot). */
  team?: RoleTeam;
  /** Another deck-item id that must also be selected, or this item is dropped. */
  requires?: string;
}

export interface DeckGroup {
  id: string;
  name: string;
  blurb: string;
  itemIds: string[];
}

/** One line of a built deck: a card and how many copies are in play. */
export interface DeckEntry {
  roleId: string;
  count: number;
}

export interface BuiltDeck {
  /** All cards in play (named singletons + computed filler), display-sorted. */
  composition: DeckEntry[];
  /** Total cards in the deck (equals playerCount when valid). */
  cardCount: number;
  /** Named/primary cards selected (everything except filler). */
  fixedCount: number;
  blueFill: number;
  redFill: number;
  gambler: number;
  /** False when the chosen cards already exceed the player count. */
  valid: boolean;
  /** How many cards over the player count the selection is (0 when valid). */
  overBy: number;
}

export const REQUIRED_CARD_IDS = ['president', 'bomber'] as const;
export const FILLER_CARD_IDS = { blueTeam: 'blue_team', redTeam: 'red_team', gambler: 'gambler' } as const;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// --- Authoring ---------------------------------------------------------------

interface CardDef {
  name: string;
  team: RoleTeam;
  description: string;
  primary?: boolean;
  required?: boolean;
}

type ItemDef =
  | { kind: 'locked'; card: CardDef }
  | { kind: 'single'; card: CardDef; requires?: string }
  | { kind: 'pack'; id: string; label: string; blurb: string; cards: CardDef[]; requires?: string }
  | { kind: 'dual'; name: string; description: string };

interface GroupDef {
  id: string;
  name: string;
  blurb: string;
  items: ItemDef[];
}

const b = (name: string, description: string, extra: Partial<CardDef> = {}): CardDef => ({
  name,
  team: 'blue',
  description,
  ...extra,
});
const r = (name: string, description: string, extra: Partial<CardDef> = {}): CardDef => ({
  name,
  team: 'red',
  description,
  ...extra,
});
const g = (name: string, description: string): CardDef => ({ name, team: 'grey', description });

const GROUP_DEFS: GroupDef[] = [
  {
    id: 'primaries',
    name: 'Primary Pair · always in play',
    blurb: 'Every game is built around the President and the Bomber. They can never be removed from the deck.',
    items: [
      {
        kind: 'locked',
        card: b('President', "Blue wins if the President does NOT gain the 'dead' condition.", {
          primary: true,
          required: true,
        }),
      },
      {
        kind: 'locked',
        card: r('Bomber', "Everyone in the Bomber's room gains 'dead' at game end; Red wins if the President dies.", {
          primary: true,
          required: true,
        }),
      },
    ],
  },
  {
    id: 'alt-primaries',
    name: 'Alternate Primary Packs',
    blurb: 'Optional extra primary pairs. Each pack is added as a unit and unlocks its own support cards below.',
    items: [
      {
        kind: 'pack',
        id: 'king_dragon',
        label: 'King & Dragon',
        blurb: "Blue's King wins by avoiding 'toast'; Red's Dragon toasts its whole room.",
        cards: [
          b('King', "Alternate primary. Blue wins if the King does NOT gain the 'toast' condition.", { primary: true }),
          r('Dragon', "Alternate primary. Everyone in the Dragon's room gains 'toast' at game end.", { primary: true }),
        ],
      },
      {
        kind: 'pack',
        id: 'blue_drone_red_fist',
        label: 'Blue Drone & Red Fist',
        blurb: 'A primary pair whose fate hinges on staying apart.',
        cards: [
          b('Blue Drone', 'Alternate primary. Blue wins if the Blue Drone ends with the Red Fist.', { primary: true }),
          r('Red Fist', 'Alternate primary. Red wins if the Red Fist is NOT with the Blue Drone at game end.', {
            primary: true,
          }),
        ],
      },
    ],
  },
  {
    id: 'core-support',
    name: 'President & Bomber Support',
    blurb: 'Cards that hang off the standard primary pair (always available).',
    items: [
      {
        kind: 'single',
        card: b("President's Daughter", 'Backup President; becomes President if the President leaves.'),
      },
      { kind: 'single', card: b('Doctor', 'The President must card share with you, or Blue loses.') },
      { kind: 'single', card: b('Nurse', 'Backup Doctor.'), requires: 'doctor' },
      { kind: 'single', card: r('Engineer', 'The Bomber must card share with you, or Red loses.') },
      { kind: 'single', card: r('Tinkerer', 'Backup Engineer.'), requires: 'engineer' },
      { kind: 'single', card: r('Dr. Boom', 'If you card share with the President, the game ends and Red wins.') },
      { kind: 'single', card: b('Tuesday Knight', 'If you card share with the Bomber, the game ends and Blue wins.') },
      {
        kind: 'single',
        card: b('Firefighter', "Card sharing with the President gives them the 'fireproof' condition."),
      },
      { kind: 'single', card: b('Pyrotech', "Card sharing with the Bomber spreads the 'firebomb' condition.") },
    ],
  },
  {
    id: 'alt-support',
    name: 'Alternate-Primary Support',
    blurb: 'Only available once the matching alternate primary pack is in the deck.',
    items: [
      { kind: 'single', card: b('Fat Princess', 'Backup King.'), requires: 'king_dragon' },
      {
        kind: 'single',
        card: b('Alchemist', 'The King must card share with you, or Blue loses.'),
        requires: 'king_dragon',
      },
      { kind: 'single', card: b('Apprentice', 'Backup Alchemist.'), requires: 'alchemist' },
      {
        kind: 'single',
        card: r('Dragon Egg', 'Backup Dragon; activates if the Dragon is toasted early.'),
        requires: 'king_dragon',
      },
      {
        kind: 'single',
        card: r('Eggineer', 'The Dragon must card share with you, or Red loses.'),
        requires: 'king_dragon',
      },
      { kind: 'single', card: r('Fanatic', 'Backup Eggineer.'), requires: 'eggineer' },
      { kind: 'single', card: r('Red Foot', 'Backup Red Fist.'), requires: 'blue_drone_red_fist' },
      { kind: 'single', card: b('Blue Firecracker', 'Backup Blue Drone.'), requires: 'blue_drone_red_fist' },
    ],
  },
  {
    id: 'instant-win',
    name: 'Instant-Win Pairs',
    blurb: 'Mutual pairs: card sharing with your counterpart ends the game on the spot.',
    items: [
      {
        kind: 'pack',
        id: 'marshal_fugitive',
        label: 'Marshal & Fugitive',
        blurb: 'Marshal + Fugitive share → instant win for that finder.',
        cards: [
          b('Marshal', 'If you card share with the Fugitive, the game ends and Blue wins.'),
          r('Fugitive', 'If you card share with the One-Armed Man, the game ends and Red wins.'),
        ],
      },
      {
        kind: 'pack',
        id: 'one_armed_man_witness',
        label: 'One-Armed Man & Witness',
        blurb: 'One-Armed Man + Witness share → instant win for that finder.',
        cards: [
          b('One-Armed Man', 'If you card share with the Witness, the game ends and Blue wins.'),
          r('Witness', 'If you card share with the Marshal, the game ends and Red wins.'),
        ],
      },
    ],
  },
  {
    id: 'specials',
    name: 'Special Characters · Red & Blue',
    blurb: 'Each special is printed in both colours. Add the blue copy, the red copy, or both.',
    items: [
      {
        kind: 'dual',
        name: 'Agent',
        description: 'Once per round, privately reveal to force a player to card share with you.',
      },
      { kind: 'dual', name: 'Alien', description: 'You must keep the card of anyone who card shares with you.' },
      {
        kind: 'dual',
        name: 'Ambassador',
        description: 'Publicly revealed and immune; move freely between rooms but never vote.',
      },
      {
        kind: 'dual',
        name: 'Angel',
        description: "Begin with the 'honest' condition: you must always tell the truth.",
      },
      { kind: 'dual', name: 'Blind', description: "Begin with the 'blind' condition: keep your eyes closed." },
      { kind: 'dual', name: 'Body Snatcher', description: 'Anyone who card shares with you must give you their card.' },
      {
        kind: 'dual',
        name: 'Bouncer',
        description: "If your room is larger, privately reveal and tell a player 'get out!'",
      },
      {
        kind: 'dual',
        name: 'Bully',
        description: 'When someone agrees to color share, force a private reveal instead.',
      },
      {
        kind: 'dual',
        name: 'Centipede',
        description: "Card-sharers gain 'attached'; if separated they become 'torn'.",
      },
      {
        kind: 'dual',
        name: 'Cleaner',
        description: 'Remove all acquired conditions from anyone who card shares with you.',
      },
      { kind: 'dual', name: 'Clown', description: 'Do your best to smile at all times.' },
      { kind: 'dual', name: 'Conspirator', description: "Opposite-team card-sharers gain the 'traitor' condition." },
      { kind: 'dual', name: 'Coy Boy', description: "Begin 'coy': you may only color share." },
      { kind: 'dual', name: 'Criminal', description: "Card-sharers gain the 'shy' condition." },
      { kind: 'dual', name: 'Dealer', description: "Card-sharers gain the 'foolish' condition." },
      {
        kind: 'dual',
        name: 'Enforcer',
        description: 'Once per round, force two players to card share with each other.',
      },
      { kind: 'dual', name: 'Enlisted', description: 'Publicly reveal to become a hostage; your card stays revealed.' },
      { kind: 'dual', name: 'Hunter', description: 'Take the card of anyone who tries a card-share power on you.' },
      {
        kind: 'dual',
        name: 'Hypnotist',
        description: "Card-sharers gain 'hypnotized' and act as a character you suggest.",
      },
      {
        kind: 'dual',
        name: 'Identity Thief',
        description: 'Trade cards with sharers and assume their powers and allegiance.',
      },
      { kind: 'dual', name: 'Immunologist', description: "Begin 'immune' to all powers and conditions." },
      { kind: 'dual', name: 'Informer', description: 'You must take opposing cards when offered; affects tie-breaks.' },
      {
        kind: 'dual',
        name: 'Interrogator',
        description: 'Once per round, ask a player one yes/no question they must answer.',
      },
      { kind: 'dual', name: 'Kangaroo', description: 'Publicly reveal to swap rooms with a player in the other room.' },
      { kind: 'dual', name: 'Loyalist', description: "Immune to 'traitor' and you remove it from card-sharers." },
      {
        kind: 'dual',
        name: 'Mad Scientist',
        description: 'Once per game, force two players to trade character cards.',
      },
      { kind: 'dual', name: 'Mayor', description: 'When you publicly reveal, your vote counts as two.' },
      { kind: 'dual', name: 'Medic', description: 'Remove all conditions from anyone who card shares with you.' },
      { kind: 'dual', name: 'Mime', description: 'Do your best to make no noise.' },
      { kind: 'dual', name: 'Mummy', description: "Card-sharers gain the 'cursed' condition and cannot speak." },
      { kind: 'dual', name: 'Negotiator', description: "Begin 'savvy': you may only card share." },
      {
        kind: 'dual',
        name: 'Ninja',
        description: 'Publicly reveal to remove yourself and another player from the game.',
      },
      { kind: 'dual', name: 'Paparazzo', description: 'Intrude on private conversations and peek at cards.' },
      { kind: 'dual', name: 'Paranoid', description: "Begin 'paranoid': you may card share only once per game." },
      { kind: 'dual', name: 'Piper', description: "Card-sharers gain 'piped' and lose if separated from you." },
      { kind: 'dual', name: 'Pirate', description: "Publicly reveal to give a player the 'blasted' condition." },
      { kind: 'dual', name: 'Professor', description: "Card-sharers gain 'savvy' and may only card share." },
      {
        kind: 'dual',
        name: 'Psychologist',
        description: "Cure 'shy', 'coy' and 'paranoid' from anyone who card shares with you.",
      },
      { kind: 'dual', name: 'Rageaholic', description: 'As leader between rounds, count to ten to win on your own.' },
      { kind: 'dual', name: 'Rat', description: 'Publicly reveal to switch rooms with immunity, then return.' },
      { kind: 'dual', name: 'Secret Police', description: 'You win if you catch a player gameplaying between rounds.' },
      { kind: 'dual', name: 'Security', description: 'Publicly reveal to tackle a player and stop them leaving.' },
      { kind: 'dual', name: 'Seer', description: "View all cards during setup, but begin with the 'shy' condition." },
      { kind: 'dual', name: 'Shy Guy', description: "Begin 'shy': you cannot reveal your card at all." },
      { kind: 'dual', name: 'Spy', description: "You belong to one team but your card shows the other team's color." },
      { kind: 'dual', name: 'Tentaclese', description: 'If your room is smaller, grab a player from the other room.' },
      { kind: 'dual', name: 'Thug', description: "Card-sharers gain the 'coy' condition." },
      { kind: 'dual', name: 'Time Lord', description: "Publicly reveal and announce 'Time is up!' to end a round." },
      { kind: 'dual', name: 'Trader', description: 'Once per round, trade your card for the buried card.' },
      { kind: 'dual', name: 'Usurper', description: "Publicly reveal to automatically become the room's leader." },
      { kind: 'dual', name: 'Vampire', description: "Opposite-color card-sharers gain 'seduced' and obey you." },
      { kind: 'dual', name: 'Voyeur', description: 'You may look at the buried card at any time.' },
      {
        kind: 'dual',
        name: 'Werewolf',
        description: "Card or color sharers gain 'bitten' and must answer the alpha wolf.",
      },
      {
        kind: 'dual',
        name: 'Xenohunter',
        description: 'Remove a Blue Team player from play after they publicly reveal.',
      },
      {
        kind: 'dual',
        name: 'Xenomorph',
        description: "The first Blue Team sharer gains 'impregnated' and holds your card.",
      },
    ],
  },
  {
    id: 'team-specials',
    name: 'Other Team Characters',
    blurb: 'Single-colour specials that bend the rules for their side.',
    items: [
      { kind: 'single', card: b('Capitalist', 'Players who card share with you must trade for a Blue Team card.') },
      { kind: 'single', card: b('Eris', "Once per game, privately reveal to two players to make them 'in hate'.") },
      { kind: 'single', card: r('Cupid', "Once per game, privately reveal to two players to make them 'in love'.") },
      { kind: 'single', card: r('Socialist', 'Card-sharers must switch to a Red Team card before the next round.') },
      { kind: 'single', card: r('Demon', "Begin with the 'liar' condition: you must always lie verbally.") },
      { kind: 'single', card: r('Exhibitionist', "Begin 'flashing': you may only publicly reveal.") },
      { kind: 'single', card: r('Fool', "Begin 'foolish': you cannot refuse a card or color share.") },
      { kind: 'single', card: r('Gargoyle', "Publicly reveal and say 'Stone' to avoid being sent out of a room.") },
      { kind: 'single', card: r('Gorgon', "Card-sharers gain 'stoned' and cannot vote.") },
    ],
  },
  {
    id: 'grey-packs',
    name: 'Grey · Paired Packs',
    blurb: 'Neutral cards whose goals reference each other, so they enter the deck together.',
    items: [
      {
        kind: 'pack',
        id: 'romeo_juliet',
        label: 'Romeo & Juliet',
        blurb: 'Each wins by ending with the other and the Bomber.',
        cards: [
          g('Romeo', 'You win if you end with Juliet and the Bomber.'),
          g('Juliet', 'You win if you end with Romeo and the Bomber.'),
        ],
      },
      {
        kind: 'pack',
        id: 'rock_paper_scissors',
        label: 'Rock, Paper & Scissors',
        blurb: 'A three-way chase; each wins against one and loses to the other.',
        cards: [
          g('Rock', 'You win if you end with the Scissors but not the Paper.'),
          g('Paper', 'You win if you end with the Rock but not the Scissors.'),
          g('Scissors', 'You win if you end with the Paper but not the Rock.'),
        ],
      },
      {
        kind: 'pack',
        id: 'ahab_moby',
        label: 'Ahab & Moby',
        blurb: 'Each wins if the other dies and they survive.',
        cards: [
          g('Ahab', "You win if Moby gains the 'dead' condition and you do not."),
          g('Moby', "You win if Ahab gains the 'dead' condition and you do not."),
        ],
      },
      {
        kind: 'pack',
        id: 'butler_maid',
        label: 'Butler & Maid',
        blurb: 'Both win by ending in the President’s room together.',
        cards: [
          g('Butler', 'You win if you end with the Maid and the President.'),
          g('Maid', 'You win if you end with the Butler and the President.'),
        ],
      },
      {
        kind: 'pack',
        id: 'mistress_wife',
        label: 'Mistress & Wife',
        blurb: 'Rivals for the President; each wins without the other present.',
        cards: [
          g('Mistress', 'You win if you end with the President but without the Wife.'),
          g('Wife', 'You win if you end with the President but without the Mistress.'),
        ],
      },
      {
        kind: 'pack',
        id: 'sniper_target',
        label: 'Sniper & Target',
        blurb: 'The Sniper calls a shot; the Target hopes to be missed.',
        cards: [
          g('Sniper', 'Announce who you shoot; you win if you hit the correct target.'),
          g('Target', 'You win if the Sniper does not shoot you in the last round.'),
        ],
      },
      {
        kind: 'pack',
        id: 'frotteur_prude',
        label: 'Frotteur & Prude',
        blurb: 'The Frotteur must touch everyone; the Prude tries to catch them.',
        cards: [
          g('Frotteur', 'You must touch every player; you lose if the Prude grabs your wrist.'),
          g('Prude', "You win if you grab one of the Frotteur's wrists by game end."),
        ],
      },
      {
        kind: 'single',
        card: g('Decoy', 'You win if the Sniper shoots you at the end of the last round.'),
        requires: 'sniper_target',
      },
    ],
  },
  {
    id: 'grey-singles',
    name: 'Grey · Independent Goals',
    blurb: 'Neutral characters chasing their own private objective.',
    items: [
      { kind: 'single', card: g('Hero', 'You win if you end with the President and the Bomber; both teams lose.') },
      {
        kind: 'single',
        card: g('Villain', 'You win if you end with the President but opposite the Bomber; both teams lose.'),
      },
      { kind: 'single', card: g('Survivor', 'You win if you are NOT in the same room as the Bomber at game end.') },
      { kind: 'single', card: g('Victim', 'You win if you are in the same room as the Bomber at game end.') },
      { kind: 'single', card: g('Clone', 'You win if the first player you share with wins all of their objectives.') },
      { kind: 'single', card: g('Robot', 'You win if the first player you share with fails their objectives.') },
      { kind: 'single', card: g('Agoraphobe', 'You win if you are never sent to a different room by anyone.') },
      { kind: 'single', card: g('Anarchist', 'You win if your vote helped usurp a leader in a majority of rounds.') },
      { kind: 'single', card: g('Born Leader', "You win if you are a room's leader at the end of the game.") },
      {
        kind: 'single',
        card: g('Changer', 'Before the game ends, swap your card for a random card from the Fun Deck.'),
      },
      {
        kind: 'single',
        card: g('Cult Leader', "Spread the 'cultist' condition by sharing; cultists lose if you die."),
      },
      { kind: 'single', card: g('Father', "Reveal to two 'children'; you win if both end in the President's room.") },
      { kind: 'single', card: g('Grey Team', 'You must swap for a Red or Blue card before the final round ends.') },
      {
        kind: 'single',
        card: g('Hot Potato', 'You swap cards with anyone who shares with you; you lose at game end.'),
      },
      { kind: 'single', card: g('Illuminati', 'If anyone card shares with you, you win and everyone else loses.') },
      { kind: 'single', card: g('Intern', 'You win if you end in the same room as the President.') },
      { kind: 'single', card: g('Judge', 'You must take offered cards; break ties by the colors you collected.') },
      { kind: 'single', card: g('Mastermind', 'You win if you correctly announce the color of every player.') },
      { kind: 'single', card: g('Mi6', 'You win if you card share with both the Bomber and the President.') },
      { kind: 'single', card: g('Minion', 'You win if a leader is never usurped in your room.') },
      { kind: 'single', card: g('Mother', 'Pick two children; you win unless both die (unless one is the Bomber).') },
      {
        kind: 'single',
        card: g('Nuclear Tyrant', "Begin 'foolish'. You win if neither the President nor Bomber shares with you."),
      },
      {
        kind: 'single',
        card: g('Private Investigator', 'You win if you correctly announce the identity of the buried card.'),
      },
      { kind: 'single', card: g('Queen', "You win if the President gains the 'dead' condition and you do not.") },
      { kind: 'single', card: g('Rival', 'You win if you are NOT in the same room as the President at game end.') },
      { kind: 'single', card: g('Telepath', 'You win if you correctly predict the hostage entering your room.') },
      { kind: 'single', card: g('Traveler', 'You win if you change rooms as a hostage in a majority of rounds.') },
    ],
  },
];

/** Filler cards — never selectable, only auto-added by the deck builder. */
const FILLER_CARDS: CardDef[] = [
  b('Blue Team', "A loyal Blue Team member. You win if the President does not gain the 'dead' condition."),
  r('Red Team', "A loyal Red Team member. You win if the President gains the 'dead' condition."),
  g('Gambler', 'Before the reveal, announce which team you think won. You win if correct.'),
];

// --- Build the catalog -------------------------------------------------------

function buildCatalog(): { roles: Role[]; items: DeckItem[]; groups: DeckGroup[] } {
  const roleMap = new Map<string, Role>();
  const items: DeckItem[] = [];
  const groups: DeckGroup[] = [];

  const addCard = (c: CardDef): string => {
    const id = slug(c.name);
    if (!roleMap.has(id)) {
      roleMap.set(id, {
        id,
        name: c.name,
        team: c.team,
        description: c.description,
        primary: c.primary,
        required: c.required,
      });
    }
    return id;
  };

  for (const group of GROUP_DEFS) {
    const itemIds: string[] = [];
    for (const def of group.items) {
      if (def.kind === 'dual') {
        const base = slug(def.name);
        for (const team of ['blue', 'red'] as const) {
          const id = `${base}__${team}`;
          roleMap.set(id, { id, name: def.name, team, description: def.description });
          items.push({ id, label: def.name, blurb: def.description, roleIds: [id], kind: 'single', team });
          itemIds.push(id);
        }
      } else if (def.kind === 'pack') {
        const roleIds = def.cards.map(addCard);
        items.push({ id: def.id, label: def.label, blurb: def.blurb, roleIds, kind: 'pack', requires: def.requires });
        itemIds.push(def.id);
      } else {
        const id = addCard(def.card);
        const kind = def.kind === 'locked' ? 'locked' : 'single';
        items.push({
          id,
          label: def.card.name,
          blurb: def.card.description,
          roleIds: [id],
          kind,
          team: def.card.team,
          requires: def.kind === 'single' ? def.requires : undefined,
        });
        itemIds.push(id);
      }
    }
    groups.push({ id: group.id, name: group.name, blurb: group.blurb, itemIds });
  }

  for (const c of FILLER_CARDS) {
    const id = slug(c.name);
    roleMap.set(id, { id, name: c.name, team: c.team, description: c.description, filler: true });
  }

  return { roles: [...roleMap.values()], items, groups };
}

const catalog = buildCatalog();

export const ROLES: Role[] = catalog.roles;
export const ROLE_MAP: Map<string, Role> = new Map(ROLES.map((r) => [r.id, r]));
export const DECK_ITEMS: DeckItem[] = catalog.items;
export const DECK_ITEM_MAP: Map<string, DeckItem> = new Map(DECK_ITEMS.map((i) => [i.id, i]));
export const DECK_GROUPS: DeckGroup[] = catalog.groups;

export function getRole(id: string): Role | undefined {
  return ROLE_MAP.get(id);
}

// --- Deck building -----------------------------------------------------------

/** Drop unknown / locked ids, dedupe, and remove items whose requirement is absent. */
export function resolveSelection(selectedItemIds: string[]): string[] {
  const set = new Set(
    selectedItemIds.filter((id) => {
      const item = DECK_ITEM_MAP.get(id);
      return item && item.kind !== 'locked';
    }),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...set]) {
      const req = DECK_ITEM_MAP.get(id)?.requires;
      if (req && !set.has(req)) {
        set.delete(id);
        changed = true;
      }
    }
  }
  // Stable, catalog-ordered output.
  return DECK_ITEMS.filter((i) => set.has(i.id)).map((i) => i.id);
}

const FILLER_RANK: Record<string, number> = { blue_team: 1, red_team: 2, gambler: 3 };
const TEAM_RANK: Record<RoleTeam, number> = { blue: 0, red: 1, grey: 2 };

function sortComposition(entries: Map<string, number>): DeckEntry[] {
  return [...entries.entries()]
    .map(([roleId, count]) => ({ roleId, count }))
    .sort((a, b) => {
      const ra = ROLE_MAP.get(a.roleId);
      const rb = ROLE_MAP.get(b.roleId);
      const rank = (role?: Role, id?: string) =>
        role?.required ? 0 : role?.filler ? 10 + (FILLER_RANK[id ?? ''] ?? 9) : 5 + (role ? TEAM_RANK[role.team] : 9);
      const diff = rank(ra, a.roleId) - rank(rb, b.roleId);
      if (diff !== 0) return diff;
      return (ra?.name ?? '').localeCompare(rb?.name ?? '');
    });
}

/**
 * Resolve a selection into the full deck for `playerCount` players: the chosen
 * cards plus auto-balanced Blue/Red Team filler and a Gambler for odd parity.
 */
export function buildDeck({
  selectedItemIds,
  playerCount,
}: {
  selectedItemIds: string[];
  playerCount: number;
}): BuiltDeck {
  const ids = resolveSelection(selectedItemIds);

  const cardIds = new Set<string>(REQUIRED_CARD_IDS);
  for (const id of ids) {
    for (const roleId of DECK_ITEM_MAP.get(id)!.roleIds) cardIds.add(roleId);
  }
  const cards = [...cardIds];

  let blueSel = 0;
  let redSel = 0;
  for (const id of cards) {
    const team = ROLE_MAP.get(id)?.team;
    if (team === 'blue') blueSel++;
    else if (team === 'red') redSel++;
  }

  const fixedCount = cards.length;
  const remaining = playerCount - fixedCount;
  const entries = new Map<string, number>();
  for (const id of cards) entries.set(id, 1);

  let blueFill = 0;
  let redFill = 0;
  let gambler = 0;

  if (remaining > 0) {
    const imbalance = redSel - blueSel; // > 0 ⇒ need more blue filler
    // A Gambler absorbs the odd slot so the team filler can split evenly.
    gambler = (((remaining - imbalance) % 2) + 2) % 2 === 0 ? 0 : 1;
    const fill = remaining - gambler;
    blueFill = (fill + imbalance) / 2;
    redFill = (fill - imbalance) / 2;
    // Specials can skew colour past what filler can fix; clamp (sum stays = fill).
    if (blueFill < 0) {
      blueFill = 0;
      redFill = fill;
    } else if (redFill < 0) {
      redFill = 0;
      blueFill = fill;
    }
    if (blueFill > 0) entries.set(FILLER_CARD_IDS.blueTeam, blueFill);
    if (redFill > 0) entries.set(FILLER_CARD_IDS.redTeam, redFill);
    if (gambler > 0) entries.set(FILLER_CARD_IDS.gambler, gambler);
  }

  const valid = remaining >= 0;
  return {
    composition: sortComposition(entries),
    cardCount: valid ? playerCount : fixedCount,
    fixedCount,
    blueFill,
    redFill,
    gambler,
    valid,
    overBy: valid ? 0 : -remaining,
  };
}
