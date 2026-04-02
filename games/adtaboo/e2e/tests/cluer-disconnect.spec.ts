import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing } from '../helpers/cluing';

test.describe('Clue-Giver Disconnect', () => {
  test('turn auto-ends when clue-giver disconnects during cluing', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 60, wordsPerTurn: 3, maxTabooWords: 5 });

    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);
    await joinRoom(dave.page, dave.name, roomCode);

    await joinTeam(alice.page, 'A');
    await joinTeam(bob.page, 'A');
    await joinTeam(carol.page, 'B');
    await joinTeam(dave.page, 'B');

    await setTabooMaster(alice.page, alice.name);
    await setTabooMaster(carol.page, carol.name);
    await startGame(alice.page);

    // Setup
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['d1', 'd2', 'd3', 'd4', 'd5']);
    await lockIn(alice.page);
    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['e1', 'e2', 'e3', 'e4', 'e5']);
    await lockIn(carol.page);

    // Bob begins cluing
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);

    // Close Bob's page (disconnect during active cluing)
    await bob.page.close();

    // Turn should auto-end → Dave should see "Begin Cluing" for Team B's turn
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
  });
});
