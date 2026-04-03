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

    // Verify Alice has host badge ("H")
    await expect(alice.page.getByTestId(`lobby-player-${alice.name}`).getByText('H')).toBeVisible();

    // Close Alice's page (simulate disconnect)
    await alice.page.close();

    // Wait for server to detect disconnect and reassign host
    await bob.page.waitForTimeout(3000);

    // Host badge should appear on another player's view
    await expect(bob.page.getByTestId(`lobby-player-${bob.name}`).getByText('H')).toBeVisible({ timeout: 10_000 });
  });
});
