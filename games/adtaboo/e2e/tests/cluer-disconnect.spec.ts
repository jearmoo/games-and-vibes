import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam, assignToTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing } from '../helpers/cluing';

test.describe('Clue-Giver Disconnect Resilience', () => {
  test('timer continues when clue-giver disconnects during cluing', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 10, wordsPerTurn: 3, maxTabooWords: 5 });

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

    // Alice (guesser) should see disconnect banner — turn does NOT auto-end
    await expect(alice.page.getByText('Clue-giver disconnected')).toBeVisible({ timeout: 10_000 });

    // Timer expires naturally → transitions to Team B's turn (not immediate turn-end)
    // Dave should see "Begin Cluing" for Team B after the 10s timer
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 20_000 });
  });
});
