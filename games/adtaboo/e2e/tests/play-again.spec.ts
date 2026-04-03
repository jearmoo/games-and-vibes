import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing, endTurn, waitForGameOver, playAgain } from '../helpers/cluing';

test.describe('Play Again', () => {
  test('play again returns to lobby with teams preserved', async ({ players }) => {
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

    // Quick game — setup and clue through both turns
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['x1', 'x2', 'x3', 'x4', 'x5']);
    await lockIn(alice.page);
    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['y1', 'y2', 'y3', 'y4', 'y5']);
    await lockIn(carol.page);

    // Team A clues
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);
    await endTurn(bob.page);

    // Team B clues
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(dave.page);
    await endTurn(dave.page);

    // Game over (1 round game) — may go through scoring screen first
    await waitForGameOver(alice.page);

    // Alice clicks Play Again
    await playAgain(alice.page);

    // All should return to lobby
    for (const p of [alice, bob, carol, dave]) {
      await expect(p.page.getByText('Copy link')).toBeVisible({ timeout: 10_000 });
    }

    // Teams should be preserved
    await expect(alice.page.getByText(bob.name).first()).toBeVisible();
    await expect(alice.page.getByText(carol.name).first()).toBeVisible();
  });
});
