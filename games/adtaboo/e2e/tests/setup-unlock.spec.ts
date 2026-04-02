import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam, assignToTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn, unlock } from '../helpers/setup';

test.describe('Setup Phase - Unlock and Word Refresh', () => {
  test('TM can unlock after locking in', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 30, wordsPerTurn: 3, maxTabooWords: 5 });

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

    // Alice locks in
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['a1', 'a2', 'a3', 'a4', 'a5']);
    await lockIn(alice.page);

    // Verify locked state
    await expect(alice.page.getByTestId('setup-unconfirm-button')).toBeVisible();
    await expect(alice.page.getByTestId('setup-taboo-input')).toBeDisabled();

    // Unlock
    await unlock(alice.page);

    // Should be able to type again
    await expect(alice.page.getByTestId('setup-taboo-input')).toBeEnabled();

    // Lock back in
    await lockIn(alice.page);
  });

  test('TM can refresh a word card', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 30, wordsPerTurn: 3, maxTabooWords: 5 });

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

    // Wait for words to load (refresh button appears)
    await expect(alice.page.getByText('↻').first()).toBeVisible({ timeout: 10_000 });

    // Click refresh on first word
    await alice.page.getByText('↻').first().click();

    // Wait for the refresh to complete
    await alice.page.waitForTimeout(2000);

    // The refresh button should still be there
    await expect(alice.page.getByText('↻').first()).toBeVisible();
  });
});
