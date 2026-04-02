import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing, markCorrect, undoCorrect, endTurn, buzzTaboo, undoBuzz } from '../helpers/cluing';

test.describe('Undo Mechanics', () => {
  test('undo correct and undo buzz', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 60, wordsPerTurn: 3, maxTabooWords: 5 });

    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);
    await joinRoom(dave.page, dave.name, roomCode);

    await joinTeam(alice.page, 'A');
    await assignToTeam(alice.page, bob.name, 'A');
    await assignToTeam(alice.page, carol.name, 'B');
    await assignToTeam(alice.page, dave.name, 'B');

    await setTabooMaster(alice.page, alice.name);
    await setTabooMaster(alice.page, carol.name);
    await startGame(alice.page);

    // Setup
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['word1', 'word2', 'word3', 'word4', 'word5']);
    await lockIn(alice.page);
    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['nope1', 'nope2', 'nope3', 'nope4', 'nope5']);
    await lockIn(carol.page);

    // Begin cluing A
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);

    // Bob marks first card correct
    await markCorrect(bob.page);

    // Verify "Undo" button appears
    await expect(bob.page.getByRole('button', { name: 'Undo' }).first()).toBeVisible();

    // Bob undoes it
    await undoCorrect(bob.page);

    // Should have 3 "Got It!" buttons again (all pending)
    await expect(bob.page.getByRole('button', { name: 'Got It!' })).toHaveCount(3);

    // Carol (TM-B) buzzes a taboo word (the ones her team set for team A)
    await expect(carol.page.getByText('Taboo Words (tap to buzz)')).toBeVisible({ timeout: 5_000 });
    await buzzTaboo(carol.page, 'nope1');

    // Verify buzz indicator appears (×1)
    await expect(carol.page.getByText('×1')).toBeVisible({ timeout: 3_000 });

    // Carol undoes the buzz
    await undoBuzz(carol.page, 'nope1');

    // ×1 should disappear
    await expect(carol.page.getByText('×1')).not.toBeVisible();

    await endTurn(bob.page);
  });
});
