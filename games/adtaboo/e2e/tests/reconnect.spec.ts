import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, configureSettings, startGame } from '../helpers/lobby';

test.describe('Reconnection', () => {
  test('player reconnects within grace period and sees game state', async ({ players }) => {
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

    // Carol starts setup but then disconnects
    await expect(carol.page.getByText('Setup').first()).toBeVisible({ timeout: 10_000 });

    // Save Carol's session before disconnecting
    const carolSession = await carol.page.evaluate(() => localStorage.getItem('adtaboo_session'));
    expect(carolSession).toBeTruthy();

    // Close Carol's page
    await carol.page.close();

    // Wait briefly
    await alice.page.waitForTimeout(3000);

    // Reopen Carol in same context (shares localStorage with session)
    const newPage = await carol.context.newPage();
    await newPage.goto(`/${roomCode}`);

    // Should auto-reconnect and see the setup screen
    await expect(newPage.getByText('Setup').first()).toBeVisible({ timeout: 15_000 });
    await expect(newPage.getByText(/R1|Round 1/)).toBeVisible();
  });
});
