import { describe, expect, it } from 'vitest';
import { DecryptoPhase, type Code, type TeamId } from '@games/decrypto-shared';
import { DecryptoRoom } from './DecryptoRoom.js';
import {
  assertStoredEmbeddingAssetsAvailable,
  getStoredEmbeddingIndex,
  getStoredTargetEmbeddingIndex,
  getStoredTargetEmbeddingInputs,
  getStoredTargetEmbeddingTerms,
  referenceDequantizedTargetCosineByIndex,
  STORED_EMBEDDING_DIMENSIONS,
  STORED_EMBEDDING_METADATA,
  storedEmbeddingInt8Norm,
  storedTargetEmbeddingCosineByIndex,
} from './keywordEmbeddings.generated.js';
import { getTiebreakerVocabulary, isKnownTiebreakerGuess, semanticSimilarityDetails } from './semanticSimilarity.js';
import {
  getCardByDisplayWord,
  getKeywordVocabulary,
  KEYWORD_CARDS,
  KEYWORDS,
  normalizeCardKey,
  pickKeywordSets,
  validateKeywordCards,
} from './wordbank.js';

function addPlayer(room: DecryptoRoom, id: string, name: string, team: TeamId) {
  room.addPlayer(id, name, `socket-${id}`);
  room.assignTeam(id, team);
}

function lockWords(room: DecryptoRoom) {
  expect(room.setWordLock('p1', 'red', true).ok).toBe(true);
  expect(room.setWordLock('p3', 'blue', true).ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.CLUE);
}

function startWordSetupRoom() {
  const room = new DecryptoRoom('TEST', 'p1');
  addPlayer(room, 'p1', 'Rhea', 'red');
  addPlayer(room, 'p2', 'Ravi', 'red');
  addPlayer(room, 'p3', 'Bianca', 'blue');
  addPlayer(room, 'p4', 'Bo', 'blue');

  const result = room.startGame();
  expect(result.ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.WORDS);
  return room;
}

function startReadyRoom() {
  const room = startWordSetupRoom();
  lockWords(room);
  return room;
}

function teammateFor(room: DecryptoRoom, team: TeamId): string {
  const turn = room.roundTurns![team];
  return room.getTeamPlayers(team).find((p) => p.id !== turn.encryptorId)!.id;
}

function wrongCode(code: Code): Code {
  return code.join(',') === '1,2,3' ? [1, 2, 4] : [1, 2, 3];
}

function otherTeam(team: TeamId): TeamId {
  return team === 'red' ? 'blue' : 'red';
}

function storedIndex(term: string): number {
  const index = getStoredEmbeddingIndex(term);
  expect(index).not.toBeUndefined();
  return index!;
}

function storedTargetIndex(term: string): number {
  const index = getStoredTargetEmbeddingIndex(term);
  expect(index).not.toBeUndefined();
  return index!;
}

function targetRankFor(
  guessTerm: string,
  targetTerm: string,
  scorer: (leftIndex: number, rightIndex: number) => number,
): number | undefined {
  const guessIndex = storedIndex(guessTerm);
  const scores = getStoredTargetEmbeddingTerms()
    .map((term) => ({ term, score: scorer(guessIndex, storedTargetIndex(term)) }))
    .sort((a, b) => b.score - a.score);
  const rank = scores.findIndex((entry) => entry.term === targetTerm);
  return rank === -1 ? undefined : rank + 1;
}

function lockBothClueSets(room: DecryptoRoom) {
  expect(room.lockClues(room.roundTurns!.red.encryptorId, ['red one', 'red two', 'red three']).ok).toBe(true);
  expect(room.lockClues(room.roundTurns!.blue.encryptorId, ['blue one', 'blue two', 'blue three']).ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.GUESS);
}

function resolveCurrentRound(room: DecryptoRoom) {
  lockBothClueSets(room);
  if (room.round === 1) {
    expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', room.roundTurns!.red.code).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', room.roundTurns!.blue.code).ok).toBe(true);
  } else {
    for (const team of ['red', 'blue'] as TeamId[]) {
      const code = room.roundTurns![team].code;
      const interceptor = room.getTeamPlayers(otherTeam(team))[0].id;
      expect(room.submitGuess(interceptor, team, 'intercept', wrongCode(code)).ok).toBe(true);
      expect(room.submitGuess(teammateFor(room, team), team, 'decrypt', code).ok).toBe(true);
      if (team === 'red') {
        expect(room.continueFromReveal().ok).toBe(true);
        expect(room.phase).toBe(DecryptoPhase.GUESS);
      }
    }
  }
  expect(room.phase).toBe(DecryptoPhase.REVEAL);
  expect(room.continueFromReveal().ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.CLUE);
}

function advanceToRoundTwo(room: DecryptoRoom) {
  lockBothClueSets(room);
  expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', room.roundTurns!.red.code).ok).toBe(true);
  expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', room.roundTurns!.blue.code).ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.REVEAL);
  expect(room.continueFromReveal().ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.CLUE);
  expect(room.round).toBe(2);
}

function createInterceptionTie(room: DecryptoRoom) {
  room.settings.maxIntercepts = 1;
  advanceToRoundTwo(room);
  lockBothClueSets(room);

  const redCode = room.roundTurns!.red.code;
  const blueInterceptor = room.getTeamPlayers('blue')[0].id;
  expect(room.submitGuess(blueInterceptor, 'red', 'intercept', redCode).ok).toBe(true);
  expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', redCode).ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.REVEAL);
  expect(room.reveal?.gameOver).toBe(false);
  expect(room.reveal?.winner).toBeUndefined();

  expect(room.continueFromReveal().ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.GUESS);

  const blueCode = room.roundTurns!.blue.code;
  const redInterceptor = room.getTeamPlayers('red')[0].id;
  expect(room.submitGuess(redInterceptor, 'blue', 'intercept', blueCode).ok).toBe(true);
  expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', blueCode).ok).toBe(true);
  expect(room.phase).toBe(DecryptoPhase.TIEBREAKER);
}

function createClinchedMiscommunicationWin(room: DecryptoRoom) {
  advanceToRoundTwo(room);
  room.scores.red.miscommunications = 1;
  room.scores.blue.intercepts = 1;
  lockBothClueSets(room);

  const redCode = room.roundTurns!.red.code;
  expect(room.submitGuess('p3', 'red', 'intercept', wrongCode(redCode)).ok).toBe(true);
  expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', wrongCode(redCode)).ok).toBe(true);

  expect(room.phase).toBe(DecryptoPhase.REVEAL);
  expect(room.scores.red.miscommunications).toBe(2);
  expect(room.clinchedOutcome).toMatchObject({
    winner: 'blue',
    reason: 'miscommunications',
    pendingTeam: 'blue',
  });
}

describe('DecryptoRoom', () => {
  it('validates structured keyword cards and keeps display words unique', () => {
    expect(validateKeywordCards()).toEqual([]);
    expect(KEYWORD_CARDS.length).toBe(440);
    expect(KEYWORDS).toEqual(KEYWORD_CARDS.map((card) => card.displayWord));
    expect(new Set(KEYWORD_CARDS.map((card) => normalizeCardKey(card.displayWord))).size).toBe(KEYWORD_CARDS.length);

    for (const card of KEYWORD_CARDS) {
      expect(card.displayWord.trim()).not.toBe('');
      expect(card.category.trim()).not.toBe('');
    }
  });

  it('uses display words directly for target embedding inputs', () => {
    for (const displayWord of ['Sherlock', 'Cleopatra', 'Einstein', 'OpenAI', 'Apple', 'Amazon', 'Bond']) {
      const card = getCardByDisplayWord(displayWord);
      expect(card).toBeDefined();
      expect(card!.displayWord).toBe(displayWord);
    }

    expect(getStoredTargetEmbeddingInputs().sherlock).toBe('Sherlock');
    expect(getStoredTargetEmbeddingInputs().openai).toBe('OpenAI');
  });

  it('keeps card metadata out of gameplay keyword state', () => {
    const room = startWordSetupRoom();

    expect(room.keywords.red).toHaveLength(4);
    expect(room.keywords.red.every((word) => typeof word === 'string')).toBe(true);
    expect(room.keywords.blue.every((word) => getCardByDisplayWord(word)?.displayWord === word)).toBe(true);

    const redPrivate = room.getPrivateStateFor('p1');
    expect(redPrivate.keywords).toEqual(room.keywords.red);
    expect(redPrivate.keywords?.every((word) => typeof word === 'string')).toBe(true);
  });

  it('deals random display-word keyword sets without duplicates', () => {
    const deal = pickKeywordSets();
    const allWords = [...deal.red, ...deal.blue];

    for (const words of [deal.red, deal.blue]) {
      expect(words).toHaveLength(4);
      expect(new Set(words.map(normalizeCardKey)).size).toBe(4);
      expect(words.every((word) => getCardByDisplayWord(word)?.displayWord === word)).toBe(true);
    }
    expect(new Set(allWords.map(normalizeCardKey)).size).toBe(8);
  });

  it('scores tiebreaker semantic guesses with OpenAI guess-to-target embeddings', () => {
    const close = semanticSimilarityDetails('lightning', 'thunder');
    const medium = semanticSimilarityDetails('chef', 'scientist');
    const unrelated = semanticSimilarityDetails('apple', 'volcano');
    const tornadoSynonym = semanticSimilarityDetails('twister', 'Tornado');
    const tornadoUnrelated = semanticSimilarityDetails('apple', 'Tornado');
    const oov = semanticSimilarityDetails('zzzznotaword', 'volcano');
    const displayWordSimilarityExamples = [
      semanticSimilarityDetails('dawn', 'Sunrise'),
      semanticSimilarityDetails('killer', 'Assassin'),
      semanticSimilarityDetails('wizard', 'Witch'),
      semanticSimilarityDetails('twister', 'Tornado'),
      semanticSimilarityDetails('monster', 'Medusa'),
      semanticSimilarityDetails('tile', 'Domino'),
      semanticSimilarityDetails('fall', 'Autumn'),
      semanticSimilarityDetails('triathlon', 'Marathon'),
      semanticSimilarityDetails('master', 'Yoda'),
      semanticSimilarityDetails('dot', 'Pixel'),
      semanticSimilarityDetails('goddess', 'Athena'),
    ];
    const strongNonExactScores = [
      semanticSimilarityDetails('coffee', 'tea'),
      semanticSimilarityDetails('eagle', 'falcon'),
      semanticSimilarityDetails('airport', 'airplane'),
      semanticSimilarityDetails('pillow', 'blanket'),
    ];
    const thunderIndex = storedIndex('thunder');
    const assetStatus = assertStoredEmbeddingAssetsAvailable();

    expect(isKnownTiebreakerGuess('openai')).toBe(true);
    expect(isKnownTiebreakerGuess('mcdonalds')).toBe(true);
    expect(isKnownTiebreakerGuess('teapot')).toBe(true);
    expect(isKnownTiebreakerGuess('zzzznotaword')).toBe(false);
    expect(getTiebreakerVocabulary().length).toBeGreaterThan(25_000);
    expect(assetStatus).toMatchObject({
      terms: getTiebreakerVocabulary().length,
      dimensions: 384,
    });
    expect(assetStatus.vectorBytes).toBe(assetStatus.expectedVectorBytes);
    expect(STORED_EMBEDDING_DIMENSIONS).toBe(384);
    expect(STORED_EMBEDDING_METADATA.provider).toBe('openai');
    expect(STORED_EMBEDDING_METADATA.model).toBe('text-embedding-3-large');
    expect(STORED_EMBEDDING_METADATA.embedding.requestedDimensions).toBe(384);
    expect(STORED_EMBEDDING_METADATA.embedding.dimensionalityReduction).toContain('dimensions parameter');
    expect(STORED_EMBEDDING_METADATA.embedding.runtimeVectorFormat).toContain('no full Float32 matrix');
    expect(STORED_EMBEDDING_METADATA.embedding.runtimeVectorFormat).toContain('guess vectors are stored first');
    expect(storedEmbeddingInt8Norm(thunderIndex)).toBeGreaterThan(0);

    expect(close.method).toBe('stored-embedding');
    expect(close.score).toBeGreaterThan(0.5);
    expect(close.score).toBeLessThan(1);
    if (close.method === 'stored-embedding') {
      expect(close.neighborRank).toBeLessThanOrEqual(20);
    }

    expect(medium.method).toBe('stored-embedding');
    expect(medium.score).toBeGreaterThanOrEqual(0);
    expect(medium.score).toBeLessThan(close.score);

    expect(unrelated.method).toBe('stored-embedding');
    expect(unrelated.score).toBeLessThan(close.score);

    expect(tornadoSynonym.method).toBe('stored-embedding');
    expect(tornadoSynonym.score).toBeGreaterThan(0.5);
    expect(tornadoSynonym.score).toBeLessThan(1);
    expect(tornadoUnrelated.method).toBe('stored-embedding');
    expect(tornadoUnrelated.score).toBeLessThan(tornadoSynonym.score);

    expect(
      displayWordSimilarityExamples.every(
        (details) => details.method === 'stored-embedding' && details.score > unrelated.score,
      ),
    ).toBe(true);
    const displayWordSimilarityAverage =
      displayWordSimilarityExamples.reduce((sum, details) => sum + details.score, 0) /
      displayWordSimilarityExamples.length;
    expect(displayWordSimilarityAverage).toBeGreaterThan(unrelated.score + 0.45);
    expect(displayWordSimilarityAverage).toBeLessThan(1);

    expect(oov).toMatchObject({
      method: 'out-of-vocabulary',
      score: 0,
      missing: ['zzzznotaword'],
    });

    const strongNonExactAverage =
      strongNonExactScores.reduce((sum, details) => sum + details.score, 0) / strongNonExactScores.length;
    expect(strongNonExactScores.every((details) => details.method === 'stored-embedding' && details.score < 1)).toBe(
      true,
    );
    expect(strongNonExactAverage).toBeGreaterThan(0.45);
    expect(strongNonExactAverage).toBeLessThan(1);
  });

  it('keeps int8 dot-product scoring aligned with dequantized normalized scoring', () => {
    const cases = [
      ['lightning', 'thunder'],
      ['asteroid', 'satellite'],
      ['banana', 'volcano'],
      ['rocket', 'satellite'],
    ] as const;

    for (const [guess, target] of cases) {
      const guessIndex = storedIndex(guess);
      const targetIndex = storedTargetIndex(target);
      const quantizedScore = storedTargetEmbeddingCosineByIndex(guessIndex, targetIndex);
      const referenceScore = referenceDequantizedTargetCosineByIndex(guessIndex, targetIndex);

      expect(Math.abs(quantizedScore - referenceScore)).toBeLessThan(0.000001);
      expect(targetRankFor(guess, target, storedTargetEmbeddingCosineByIndex)).toBe(
        targetRankFor(guess, target, referenceDequantizedTargetCosineByIndex),
      );
    }
  });

  it('requires two available players on each team to start word setup', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');

    expect(room.startGame()).toEqual({
      ok: false,
      message: 'Need 2 players on each team.',
    });

    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.startGame().ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.WORDS);
  });

  it('requires online players to start when offline awareness is on', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');

    const redOffline = room.players.get('p2');
    expect(redOffline).toBeDefined();
    redOffline!.connected = false;

    expect(room.canStart()).toBe(false);
    expect(room.startGame()).toEqual({
      ok: false,
      message: 'Need 2 players on each team.',
    });
  });

  it('allows word setup to start with an offline roster member when offline awareness is off', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.setOfflineAwareness('p1', false).ok).toBe(true);

    const redOffline = room.players.get('p2');
    expect(redOffline).toBeDefined();
    redOffline!.connected = false;

    expect(room.canStart()).toBe(true);
    expect(room.startGame().ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.WORDS);
  });

  it('keeps offline roster members in clue-giver rotation when offline awareness is off', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.setOfflineAwareness('p1', false).ok).toBe(true);

    const redOffline = room.players.get('p2');
    expect(redOffline).toBeDefined();
    redOffline!.connected = false;

    expect(room.startGame().ok).toBe(true);
    lockWords(room);
    expect(room.roundTurns?.red.encryptorId).toBe('p1');

    resolveCurrentRound(room);
    expect(room.roundTurns?.red.encryptorId).toBe('p2');
  });

  it('only lets the host change offline awareness in the lobby', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');

    expect(room.setOfflineAwareness('p2', false)).toEqual({
      ok: false,
      message: 'Only the host can change offline awareness.',
    });
    expect(room.setOfflineAwareness('p1', false).ok).toBe(true);
    expect(room.settings.offlineAwareness).toBe(false);

    expect(room.startGame().ok).toBe(true);
    expect(room.setOfflineAwareness('p1', true)).toEqual({
      ok: false,
      message: 'Offline awareness can only be changed in the lobby.',
    });
  });

  it('keeps an offline host as host when returning to lobby with offline awareness off', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.setOfflineAwareness('p1', false).ok).toBe(true);
    expect(room.startGame().ok).toBe(true);

    const host = room.players.get('p1');
    expect(host).toBeDefined();
    host!.connected = false;
    host!.disconnectedAt = Date.now();
    room.phase = DecryptoPhase.GAME_OVER;

    room.resetToLobby();

    expect(room.hostId).toBe('p1');
    expect(room.getPlayer('p1')?.connected).toBe(false);
    expect(room.phase).toBe(DecryptoPhase.LOBBY);
  });

  it('reassigns an offline host when returning to lobby with offline awareness on', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.startGame().ok).toBe(true);

    const host = room.players.get('p1');
    expect(host).toBeDefined();
    host!.connected = false;
    host!.disconnectedAt = Date.now();
    room.phase = DecryptoPhase.GAME_OVER;

    room.resetToLobby();

    expect(room.hostId).not.toBe('p1');
    expect(room.getPlayer(room.hostId)?.connected).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.LOBBY);
  });

  it('chooses a new host when the previous host was removed before returning to lobby', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    expect(room.startGame().ok).toBe(true);

    const host = room.players.get('p1');
    expect(host).toBeDefined();
    host!.connected = false;
    host!.removed = true;
    room.phase = DecryptoPhase.GAME_OVER;

    room.resetToLobby();

    expect(room.hostId).not.toBe('p1');
    expect(room.getPlayer('p1')).toBeUndefined();
    expect(room.getPlayer(room.hostId)?.removed).not.toBe(true);
    expect(room.phase).toBe(DecryptoPhase.LOBBY);
  });

  it('regenerates unlocked team words after start and blocks regeneration after lock', () => {
    const room = startWordSetupRoom();

    const original = room.keywords.red[0];
    expect(room.regenerateKeyword('p1', 'red', 0).ok).toBe(true);
    expect(room.keywords.red[0]).not.toBe(original);

    expect(room.setWordLock('p1', 'red', true).ok).toBe(true);
    expect(room.regenerateKeyword('p1', 'red', 0)).toEqual({
      ok: false,
      message: 'Unlock your team words before regenerating.',
    });
  });

  it('starts a simultaneous clue phase with private keywords and encryptor codes', () => {
    const room = startReadyRoom();
    const turn = room.getPublicTurnState();

    expect(room.phase).toBe(DecryptoPhase.CLUE);
    expect(turn?.round).toBe(1);
    expect(turn?.teams.red.clueLocked).toBe(false);
    expect(turn?.teams.blue.clueLocked).toBe(false);
    expect(turn?.clueTimer).toBeUndefined();

    const redEncryptorPrivate = room.getPrivateStateFor(turn!.teams.red.encryptorId);
    expect(redEncryptorPrivate.team).toBe('red');
    expect(redEncryptorPrivate.keywords).toHaveLength(4);
    expect(redEncryptorPrivate.wordsLocked).toBe(true);
    expect(redEncryptorPrivate.code).toHaveLength(3);

    const redTeammate = teammateFor(room, 'red');
    expect(room.getPrivateStateFor(redTeammate).code).toBeUndefined();
  });

  it('cycles clue givers through every team member before repeating', () => {
    const room = new DecryptoRoom('TEST', 'p1');
    addPlayer(room, 'p1', 'Rhea', 'red');
    addPlayer(room, 'p2', 'Ravi', 'red');
    addPlayer(room, 'p3', 'Bianca', 'blue');
    addPlayer(room, 'p4', 'Bo', 'blue');
    addPlayer(room, 'p5', 'Rina', 'red');
    addPlayer(room, 'p6', 'Bex', 'blue');

    expect(room.startGame().ok).toBe(true);
    lockWords(room);

    const redEncryptors: string[] = [];
    const blueEncryptors: string[] = [];
    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      redEncryptors.push(room.roundTurns!.red.encryptorId);
      blueEncryptors.push(room.roundTurns!.blue.encryptorId);
      if (roundIndex < 2) resolveCurrentRound(room);
    }

    expect(new Set(redEncryptors).size).toBe(3);
    expect(new Set(blueEncryptors).size).toBe(3);
    expect(redEncryptors.every((id) => room.getPlayer(id)?.team === 'red')).toBe(true);
    expect(blueEncryptors.every((id) => room.getPlayer(id)?.team === 'blue')).toBe(true);
  });

  it('starts and cancels the clue timer when a locked encryptor unlocks', () => {
    const room = startReadyRoom();
    const redEncryptor = room.roundTurns!.red.encryptorId;

    expect(room.lockClues(redEncryptor, ['sky', 'river', 'crown']).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.CLUE);
    expect(room.clueTimerStartedAt).toEqual(expect.any(Number));
    expect(room.getPublicTurnState()?.clueTimer?.durationSeconds).toBe(30);

    expect(room.unlockClues(redEncryptor).ok).toBe(true);
    expect(room.clueTimerStartedAt).toBeUndefined();
    expect(room.getPublicTurnState()?.teams.red.clueLocked).toBe(false);
    expect(room.getPublicTurnState()?.clueTimer).toBeUndefined();
  });

  it('accepts drawing clues when locking clue sets', () => {
    const room = startReadyRoom();
    const drawing = { kind: 'drawing', dataUrl: 'data:image/png;base64,AAAA' } as const;

    expect(room.lockClues(room.roundTurns!.red.encryptorId, [drawing, 'river', 'crown']).ok).toBe(true);
    expect(room.lockClues(room.roundTurns!.blue.encryptorId, ['blue one', 'blue two', 'blue three']).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GUESS);
    expect(room.getPublicTurnState()?.teams.red.clues[0]).toEqual(drawing);
  });

  it('resolves round one decryption for both teams in parallel with no interception', () => {
    const room = startReadyRoom();
    lockBothClueSets(room);

    expect(room.getPublicTurnState()?.activeGuessTeam).toBeUndefined();
    expect(room.submitGuess('p3', 'red', 'intercept', [1, 2, 3])).toEqual({
      ok: false,
      message: 'There is no interception attempt in round 1.',
    });

    const redCode = room.roundTurns!.red.code;
    const blueCode = room.roundTurns!.blue.code;
    expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', wrongCode(redCode)).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GUESS);
    expect(room.reveals).toHaveLength(0);

    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', blueCode).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.REVEAL);
    expect(room.reveals).toHaveLength(2);
    expect(room.scores.red.miscommunications).toBe(1);
    expect(room.reveals.find((reveal) => reveal.team === 'red')?.decryptCorrect).toBe(false);
    expect(room.reveals.find((reveal) => reveal.team === 'blue')?.decryptCorrect).toBe(true);
  });

  it('keeps posted guesses private to the posting team', () => {
    const room = startReadyRoom();
    lockBothClueSets(room);

    const redTeammate = teammateFor(room, 'red');
    const redCode = room.roundTurns!.red.code;
    expect(room.postGuessShare(room.roundTurns!.red.encryptorId, 'red', 'decrypt', redCode)).toEqual({
      ok: false,
      message: 'The encryptor cannot post a team guess.',
    });
    expect(room.postGuessShare(redTeammate, 'red', 'decrypt', redCode).ok).toBe(true);

    const redPrivate = room.getPrivateStateFor(redTeammate);
    const bluePrivate = room.getPrivateStateFor(teammateFor(room, 'blue'));
    expect(redPrivate.guessShares).toHaveLength(1);
    expect(redPrivate.guessShares?.[0]).toMatchObject({
      playerId: redTeammate,
      playerTeam: 'red',
      targetTeam: 'red',
      kind: 'decrypt',
      code: redCode,
    });
    expect(bluePrivate.guessShares).toEqual([]);
  });

  it('lets the second team finish the round before ending on an interception', () => {
    const room = startReadyRoom();
    room.settings.maxIntercepts = 1;

    advanceToRoundTwo(room);

    lockBothClueSets(room);
    expect(room.getPublicTurnState()?.activeGuessTeam).toBe('red');

    expect(room.submitGuess('p3', 'red', 'intercept', room.roundTurns!.red.code).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', room.roundTurns!.red.code).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.REVEAL);
    expect(room.reveal?.winner).toBeUndefined();
    expect(room.reveal?.gameOver).toBe(false);
    expect(room.scores.blue.intercepts).toBe(1);

    expect(room.continueFromReveal().ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GUESS);
    expect(room.getPublicTurnState()?.activeGuessTeam).toBe('blue');

    expect(room.submitGuess('p1', 'blue', 'intercept', wrongCode(room.roundTurns!.blue.code)).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', room.roundTurns!.blue.code).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.reveal?.winner).toBe('blue');
    expect(room.reveal?.reason).toBe('interceptions');
    expect(room.getFinalGameState()?.keywords.red).toBeUndefined();
    expect(room.getFinalGameState()?.releasedWords.red).toBe(false);
    expect(room.getPrivateStateFor('p1').keywords).toHaveLength(4);

    expect(room.releaseWords('p3', 'red')).toEqual({
      ok: false,
      message: 'Only members of that team can release its words.',
    });
    expect(room.releaseWords('p1', 'red').ok).toBe(true);
    expect(room.getFinalGameState()?.keywords.red).toHaveLength(4);
    expect(room.getFinalGameState()?.keywords.blue).toBeUndefined();
    expect(room.getFinalGameState()?.releasedWords.red).toBe(true);
  });

  it('allows a team to take a mathematically clinched win instead of forcing the extra turn', () => {
    const room = startReadyRoom();
    createClinchedMiscommunicationWin(room);

    expect(room.continueFromReveal('p1')).toEqual({
      ok: false,
      message: 'Only the clinching team can choose to play the extra turn.',
    });
    expect(room.takeClinchedWin('p1')).toEqual({
      ok: false,
      message: 'Only the clinching team can take the win.',
    });

    expect(room.takeClinchedWin('p3').ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('blue');
    expect(room.getFinalGameState()?.reason).toBe('miscommunications');
  });

  it('lets the clinching team play the remaining turn for fun before ending with the clinched winner', () => {
    const room = startReadyRoom();
    createClinchedMiscommunicationWin(room);

    expect(room.continueFromReveal('p3').ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GUESS);
    expect(room.getPublicTurnState()?.activeGuessTeam).toBe('blue');
    expect(room.clinchedOutcome).toBeUndefined();

    const blueCode = room.roundTurns!.blue.code;
    expect(room.submitGuess('p1', 'blue', 'intercept', wrongCode(blueCode)).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', wrongCode(blueCode)).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('blue');
    expect(room.getFinalGameState()?.reason).toBe('miscommunications');
    expect(room.scores.blue.miscommunications).toBe(1);
  });

  it('uses fewer miscommunications as the tiebreaker when both teams have terminal interceptions', () => {
    const room = startReadyRoom();
    advanceToRoundTwo(room);
    room.scores = {
      red: { intercepts: 1, miscommunications: 1 },
      blue: { intercepts: 1, miscommunications: 0 },
    };
    lockBothClueSets(room);

    const redCode = room.roundTurns!.red.code;
    expect(room.submitGuess('p3', 'red', 'intercept', redCode).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', redCode).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.REVEAL);
    expect(room.clinchedOutcome).toBeUndefined();

    expect(room.continueFromReveal().ok).toBe(true);
    const blueCode = room.roundTurns!.blue.code;
    expect(room.submitGuess('p1', 'blue', 'intercept', blueCode).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', blueCode).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.scores.red).toEqual({ intercepts: 2, miscommunications: 1 });
    expect(room.scores.blue).toEqual({ intercepts: 2, miscommunications: 0 });
    expect(room.getFinalGameState()?.winner).toBe('blue');
    expect(room.getFinalGameState()?.reason).toBe('interceptions');
    expect(room.getPublicTiebreakerState()).toBeNull();
  });

  it('uses more interceptions as the tiebreaker when both teams have terminal miscommunications', () => {
    const room = startReadyRoom();
    advanceToRoundTwo(room);
    room.scores = {
      red: { intercepts: 1, miscommunications: 1 },
      blue: { intercepts: 0, miscommunications: 1 },
    };
    lockBothClueSets(room);

    const redCode = room.roundTurns!.red.code;
    expect(room.submitGuess('p3', 'red', 'intercept', wrongCode(redCode)).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'red'), 'red', 'decrypt', wrongCode(redCode)).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.REVEAL);
    expect(room.clinchedOutcome).toBeUndefined();

    expect(room.continueFromReveal().ok).toBe(true);
    const blueCode = room.roundTurns!.blue.code;
    expect(room.submitGuess('p1', 'blue', 'intercept', wrongCode(blueCode)).ok).toBe(true);
    expect(room.submitGuess(teammateFor(room, 'blue'), 'blue', 'decrypt', wrongCode(blueCode)).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.scores.red).toEqual({ intercepts: 1, miscommunications: 2 });
    expect(room.scores.blue).toEqual({ intercepts: 0, miscommunications: 2 });
    expect(room.getFinalGameState()?.winner).toBe('red');
    expect(room.getFinalGameState()?.reason).toBe('miscommunications');
    expect(room.getPublicTiebreakerState()).toBeNull();
  });

  it('moves to a keyword tiebreaker when both teams reach the terminal score after equal turns', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['machine', 'festival', 'satellite', 'thunder'],
      blue: ['tower', 'jungle', 'river', 'orbit'],
    };

    createInterceptionTie(room);

    expect(room.getFinalGameState()).toBeNull();
    expect(room.getPublicTiebreakerState()?.submissions.red.submitted).toBe(false);
    expect(room.getPublicTiebreakerState()?.vocabulary).toContain('asteroid');

    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'orbit']).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.TIEBREAKER);
    expect(room.getPublicTiebreakerState()?.submissions.red).toMatchObject({
      submitted: true,
      submittedByName: 'Rhea',
    });

    expect(room.submitTiebreaker('p3', ['machine', 'festival', 'banana', 'orange']).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('red');
    expect(room.getFinalGameState()?.reason).toBe('tiebreaker-exact');
    expect(room.getFinalGameState()?.tiebreaker?.results.red.exactMatches).toBe(4);
    expect(room.getFinalGameState()?.tiebreaker?.results.red.similarityScore).toBe(1);
    expect(room.getFinalGameState()?.tiebreaker?.results.blue.exactMatches).toBe(2);
  });

  it('lets the host switch tiebreaker guesses from all English words to the Decrypto word bank', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['OpenAI', 'Jungle', 'Library', 'Thunder'],
      blue: ['Apple', 'Coffee', 'Eagle', 'Robot'],
    };

    createInterceptionTie(room);

    expect(room.getPublicTiebreakerState()?.vocabularyMode).toBe('english');
    expect(room.getPublicTiebreakerState()?.vocabulary).toContain('teapot');
    expect(getKeywordVocabulary()).not.toContain('teapot');

    expect(room.setTiebreakerVocabularyMode('p2', 'word-bank')).toEqual({
      ok: false,
      message: 'Only the host can change the tiebreaker word pool.',
    });
    expect(room.setTiebreakerVocabularyMode('p1', 'word-bank').ok).toBe(true);

    const wordBankState = room.getPublicTiebreakerState();
    expect(wordBankState?.vocabularyMode).toBe('word-bank');
    expect(wordBankState?.vocabulary).toHaveLength(getKeywordVocabulary().length);
    expect(wordBankState?.vocabulary).toContain('openai');
    expect(wordBankState?.vocabulary).not.toContain('teapot');

    expect(room.submitTiebreaker('p1', ['apple', 'coffee', 'eagle', 'teapot'])).toEqual({
      ok: false,
      message: 'Word not in the Decrypto word bank.',
    });
    expect(room.submitTiebreaker('p1', ['apple', 'coffee', 'eagle', 'robot']).ok).toBe(true);
    expect(room.setTiebreakerVocabularyMode('p1', 'english')).toEqual({
      ok: false,
      message: 'Change the tiebreaker word pool before either team submits.',
    });
  });

  it('rejects out-of-vocabulary tiebreaker guesses instead of silently scoring them', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['machine', 'festival', 'satellite', 'thunder'],
      blue: ['tower', 'jungle', 'river', 'orbit'],
    };

    createInterceptionTie(room);

    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'zzzznotaword'])).toEqual({
      ok: false,
      message: 'Word not recognized. Try a more common word.',
    });
    expect(room.getPublicTiebreakerState()?.submissions.red.submitted).toBe(false);
  });

  it('lets a team unlock tiebreaker guesses before the other team submits', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['machine', 'festival', 'satellite', 'thunder'],
      blue: ['tower', 'jungle', 'river', 'orbit'],
    };

    createInterceptionTie(room);

    expect(room.unlockTiebreaker('p1')).toEqual({
      ok: false,
      message: 'Your team has not submitted tiebreaker guesses.',
    });
    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'orbit']).ok).toBe(true);
    expect(room.getPublicTiebreakerState()?.submissions.red.submitted).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.TIEBREAKER);

    expect(room.unlockTiebreaker('p1').ok).toBe(true);
    expect(room.getPublicTiebreakerState()?.submissions.red.submitted).toBe(false);
    expect(room.phase).toBe(DecryptoPhase.TIEBREAKER);

    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'orbit']).ok).toBe(true);
    expect(room.submitTiebreaker('p3', ['machine', 'festival', 'satellite', 'thunder']).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
  });

  it('uses vector similarity when exact tiebreaker matches are tied', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['tower', 'jungle', 'river', 'orbit'],
      blue: ['festival', 'satellite', 'thunder', 'machine'],
    };

    createInterceptionTie(room);

    expect(room.submitTiebreaker('p1', ['festival', 'asteroid', 'lightning', 'engine']).ok).toBe(true);
    expect(room.submitTiebreaker('p3', ['tower', 'banana', 'orange', 'apple']).ok).toBe(true);

    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('red');
    expect(room.getFinalGameState()?.reason).toBe('tiebreaker-similarity');
    expect(room.getFinalGameState()?.tiebreaker?.results.red.exactMatches).toBe(1);
    expect(room.getFinalGameState()?.tiebreaker?.results.blue.exactMatches).toBe(1);
    expect(
      (room.getFinalGameState()?.tiebreaker?.results.red.similarityScore ?? 0) >
        (room.getFinalGameState()?.tiebreaker?.results.blue.similarityScore ?? 0),
    ).toBe(true);
  });

  it('allows both teams to agree to one repeated tiebreaker after a tied game', () => {
    const room = startReadyRoom();
    room.keywords = {
      red: ['machine', 'festival', 'satellite', 'thunder'],
      blue: ['tower', 'jungle', 'river', 'orbit'],
    };

    createInterceptionTie(room);

    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'orbit']).ok).toBe(true);
    expect(room.submitTiebreaker('p3', ['machine', 'festival', 'satellite', 'thunder']).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('tie');
    expect(room.getFinalGameState()?.reason).toBe('tie');
    expect(room.getPublicTiebreakerState()?.repeat).toMatchObject({
      available: true,
      used: false,
      requests: { red: false, blue: false },
    });

    expect(room.requestTiebreakerRepeat('p1').ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getPublicTiebreakerState()?.repeat).toMatchObject({
      available: true,
      used: false,
      requests: { red: true, blue: false },
    });

    expect(room.requestTiebreakerRepeat('p3').ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.TIEBREAKER);
    expect(room.getFinalGameState()).toBeNull();
    expect(room.getPublicTiebreakerState()?.history).toHaveLength(1);
    expect(room.getPublicTiebreakerState()?.history?.[0].results.red.guesses).toEqual([
      'tower',
      'jungle',
      'river',
      'orbit',
    ]);
    expect(room.getPublicTiebreakerState()?.history?.[0].results.blue.guesses).toEqual([
      'machine',
      'festival',
      'satellite',
      'thunder',
    ]);
    expect(room.getPublicTiebreakerState()?.submissions.red.submitted).toBe(false);
    expect(room.getPublicTiebreakerState()?.submissions.blue.submitted).toBe(false);

    expect(room.submitTiebreaker('p1', ['tower', 'jungle', 'river', 'orbit']).ok).toBe(true);
    expect(room.submitTiebreaker('p3', ['machine', 'festival', 'satellite', 'thunder']).ok).toBe(true);
    expect(room.phase).toBe(DecryptoPhase.GAME_OVER);
    expect(room.getFinalGameState()?.winner).toBe('tie');
    expect(room.getPublicTiebreakerState()?.repeat).toMatchObject({
      available: false,
      used: true,
    });
    expect(room.requestTiebreakerRepeat('p1')).toEqual({
      ok: false,
      message: 'The tiebreaker cannot be repeated.',
    });
  });
});
