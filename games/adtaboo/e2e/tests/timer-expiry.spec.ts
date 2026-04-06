import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import { beginCluing, markCorrect, lockInReview } from '../helpers/cluing';

test.describe('Timer Expiry', () => {
  test('turn auto-ends when timer expires', async ({ players }) => {
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
    await addTabooWords(alice.page, ['t1', 't2', 't3', 't4', 't5']);
    await lockIn(alice.page);
    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['u1', 'u2', 'u3', 'u4', 'u5']);
    await lockIn(carol.page);

    // Cluing A — Bob marks 1 correct, then lets timer expire → REVIEW_A
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);
    await markCorrect(bob.page);

    // Timer expires → enters REVIEW_A → Carol (opposing TM) locks in
    await lockInReview(carol.page);

    // Cluing B — Dave's turn
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 20_000 });
    await beginCluing(dave.page);

    // Timer expires → REVIEW_B → Alice locks in → GAME_OVER
    await lockInReview(alice.page);
    await expect(alice.page.getByText(/Complete|Wins!|Tie/)).toBeVisible({ timeout: 20_000 });
  });
});
