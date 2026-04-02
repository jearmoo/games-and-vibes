import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing, markCorrect } from '../helpers/cluing';

test.describe('Timer Expiry', () => {
  test('turn auto-ends when timer expires', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await configureSettings(alice.page, { rounds: 1, timerSeconds: 10, wordsPerTurn: 3, maxTabooWords: 5 });

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
    await addTabooWords(alice.page, ['t1', 't2', 't3', 't4', 't5']);
    await lockIn(alice.page);
    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['u1', 'u2', 'u3', 'u4', 'u5']);
    await lockIn(carol.page);

    // Cluing A — Bob marks 1 correct, then lets timer expire
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);
    await markCorrect(bob.page);

    // Don't end turn — wait for timer to expire (10s + buffer)
    // After timer expires, should transition to Cluing B
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 20_000 });

    // Dave's turn now — timer expiry worked
    await beginCluing(dave.page);
    // Let timer expire again for game over
    await expect(alice.page.getByText(/Complete|Wins!|Tie/)).toBeVisible({ timeout: 20_000 });
  });
});
