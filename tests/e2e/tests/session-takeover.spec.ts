import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam } from '../helpers/lobby';

test.describe('Session Takeover', () => {
  test.use({ playerCount: 3 });

  test('new connection with same name takes over session', async ({ players, browser }) => {
    const [alice, bob, carol] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);

    await joinTeam(alice.page, 'A');
    await joinTeam(bob.page, 'A');
    await joinTeam(carol.page, 'B');

    // Open a new context as "Bob" (same name) to trigger takeover
    const newContext = await browser.newContext();
    const newBobPage = await newContext.newPage();
    await joinRoom(newBobPage, 'Bob', roomCode);

    // Original Bob should see the kicked screen
    await expect(bob.page.getByRole('heading', { name: 'Disconnected' })).toBeVisible({ timeout: 10_000 });
    await expect(bob.page.getByText('Someone else joined with your name')).toBeVisible();

    // Original Bob's session should be cleared
    const session = await bob.page.evaluate(() => localStorage.getItem('adtaboo_session'));
    expect(session).toBeNull();

    // New Bob should be in the lobby
    await expect(newBobPage.getByText('Room Code')).toBeVisible();

    // "Back to Home" button is visible
    await expect(bob.page.getByTestId('kicked-back-button')).toBeVisible();

    await newContext.close();
  });
});
