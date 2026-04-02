import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam } from '../helpers/lobby';

test.describe('Host Disconnect', () => {
  test.use({ playerCount: 3 });

  test('host badge transfers when host disconnects', async ({ players }) => {
    const [alice, bob, carol] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);

    await joinTeam(alice.page, 'A');
    await assignToTeam(alice.page, bob.name, 'A');
    await assignToTeam(alice.page, carol.name, 'B');

    // Verify Alice has HOST badge
    await expect(alice.page.getByText('HOST')).toBeVisible();

    // Close Alice's page (simulate disconnect)
    await alice.page.close();

    // Wait for server to detect disconnect and reassign host
    await bob.page.waitForTimeout(3000);

    // HOST badge should appear on another player's view
    await expect(bob.page.getByText('HOST')).toBeVisible({ timeout: 10_000 });
  });
});
