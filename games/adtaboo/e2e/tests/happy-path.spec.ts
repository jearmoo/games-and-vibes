import { test, expect, type Player } from '../fixtures/game';
import {
  createRoom,
  joinRoom,
  joinTeam,
  assignToTeam,
  setTabooMaster,
  configureSettings,
  startGame,
} from '../helpers/lobby';
import { pickClueGiver, addTabooWords, lockIn } from '../helpers/setup';
import {
  beginCluing,
  markCorrect,
  endTurn,
  waitForGameOver,
  nextRound,
  buzzTaboo,
  lockInReview,
} from '../helpers/cluing';

/**
 * Full 2-round happy-path game with 4 players:
 *   Alice (Host, TM-A) + Bob (Team A clue-giver)
 *   Carol (TM-B) + Dave (Team B clue-giver)
 */
test.describe('Happy Path - Full Game', () => {
  test('complete 2-round game', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    // --- 1.1 Alice creates room ---
    const roomCode = await createRoom(alice.page, alice.name);

    // --- 1.2 Configure settings ---
    await configureSettings(alice.page, {
      rounds: 2,
      timerSeconds: 15,
      wordsPerTurn: 3,
      maxTabooWords: 5,
    });

    // --- 1.3 Others join ---
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);
    await joinRoom(dave.page, dave.name, roomCode);

    // Verify all 4 appear in Alice's lobby
    for (const p of [alice, bob, carol, dave]) {
      await expect(alice.page.getByText(p.name).first()).toBeVisible();
    }

    // --- 1.4 Assign teams (host self-joins, assigns others) ---
    await joinTeam(alice.page, 'A');
    await assignToTeam(alice.page, bob.name, 'A');
    await assignToTeam(alice.page, carol.name, 'B');
    await assignToTeam(alice.page, dave.name, 'B');

    // --- 1.5 Set taboo masters ---
    await setTabooMaster(alice.page, alice.name);
    await setTabooMaster(alice.page, carol.name);

    // --- 1.6 Verify non-host view ---
    await expect(bob.page.getByText('Waiting for host to start the game')).toBeVisible();
    await expect(bob.page.getByTestId('lobby-settings-trigger')).not.toBeVisible();

    // --- 1.7 Start game ---
    await startGame(alice.page);

    // All players should see setup screen
    for (const p of [alice, bob, carol, dave]) {
      await expect(p.page.getByText('Setup').first()).toBeVisible({ timeout: 10_000 });
    }

    // --- 1.8 Parallel Setup ---
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['forbidden1', 'forbidden2', 'forbidden3', 'forbidden4', 'forbidden5']);
    await lockIn(alice.page);

    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['banned1', 'banned2', 'banned3', 'banned4', 'banned5']);
    await lockIn(carol.page);

    // --- 1.9 Cluing A (Team A's turn - Bob clues) ---
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });

    // Alice (guesser) should see waiting text
    await expect(alice.page.getByText(/Waiting for .+ to begin|Listen and guess/)).toBeVisible({ timeout: 10_000 });

    await beginCluing(bob.page);

    // Bob marks 2 of 3 correct
    await markCorrect(bob.page);
    await markCorrect(bob.page);

    // Carol (TM-B) buzzes a taboo word from the ones her team set
    await expect(carol.page.getByText('Taboo Words (tap to buzz)')).toBeVisible({ timeout: 5_000 });
    await buzzTaboo(carol.page, 'banned1');

    // Bob ends turn early → enters REVIEW_A
    await endTurn(bob.page);

    // --- 1.9b Review A (Carol, opposing TM, locks in) ---
    await lockInReview(carol.page);

    // --- 1.10 Cluing B (Team B's turn - Dave clues) ---
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(dave.page);

    // Dave marks all 3 correct → auto-ends cluing → enters REVIEW_B
    await markCorrect(dave.page);
    await markCorrect(dave.page);
    await markCorrect(dave.page);

    // --- 1.10b Review B (Alice, opposing TM, locks in) ---
    await lockInReview(alice.page);

    // --- 1.11 Round Result ---
    for (const p of [alice, bob, carol, dave]) {
      await expect(p.page.getByText('Round 1 Complete')).toBeVisible({ timeout: 15_000 });
    }

    await expect(alice.page.getByTestId('scoring-next-round-button')).toBeVisible();
    await expect(bob.page.getByText('Waiting for host to continue...')).toBeVisible();

    // --- 1.12 Round 2 ---
    await nextRound(alice.page);

    for (const p of [alice, bob, carol, dave]) {
      await expect(p.page.getByText('Setup').first()).toBeVisible({ timeout: 10_000 });
    }

    // Setup round 2
    await pickClueGiver(alice.page, bob.name);
    await addTabooWords(alice.page, ['taboo1', 'taboo2', 'taboo3', 'taboo4', 'taboo5']);
    await lockIn(alice.page);

    await pickClueGiver(carol.page, dave.name);
    await addTabooWords(carol.page, ['nope1', 'nope2', 'nope3', 'nope4', 'nope5']);
    await lockIn(carol.page);

    // Cluing A round 2 — Bob marks 1 correct, ends early → REVIEW_A
    await expect(bob.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(bob.page);
    await markCorrect(bob.page);
    await endTurn(bob.page);
    await lockInReview(carol.page);

    // Cluing B round 2 — Dave marks 2 correct, let timer expire (15s) → REVIEW_B
    await expect(dave.page.getByTestId('clue-begin-button')).toBeVisible({ timeout: 15_000 });
    await beginCluing(dave.page);
    await markCorrect(dave.page);
    await markCorrect(dave.page);
    // Timer expires → REVIEW_B → Alice locks in → GAME_OVER
    await lockInReview(alice.page);

    // --- 1.13 Game Over ---
    for (const p of [alice, bob, carol, dave]) {
      await waitForGameOver(p.page);
    }

    await expect(alice.page.getByText(/Wins!|Tie/)).toBeVisible();

    // Host sees "Play Again"
    await expect(alice.page.getByTestId('game-over-play-again-button')).toBeVisible();
    // Non-host sees "Waiting for host..."
    await expect(bob.page.getByText('Waiting for host...')).toBeVisible();

    // All see "Leave Room"
    for (const p of [alice, bob, carol, dave]) {
      await expect(p.page.getByRole('button', { name: 'Leave Room' })).toBeVisible();
    }
  });
});
