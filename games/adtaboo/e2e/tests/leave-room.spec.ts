import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, joinTeam } from '../helpers/lobby';

test.describe('Leave Room', () => {
  test.use({ playerCount: 2 });

  test('leave room with confirmation modal', async ({ players }) => {
    const [alice, bob] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinTeam(alice.page, 'A');
    await joinTeam(bob.page, 'B');

    // Bob clicks "Leave Room"
    await bob.page.getByRole('button', { name: 'Leave Room' }).click();

    // Confirm modal appears
    await expect(bob.page.getByText('Leave Room?')).toBeVisible();

    // Click "Stay" — stays in lobby
    await bob.page.getByRole('button', { name: 'Stay' }).click();
    await expect(bob.page.getByText('Room Code')).toBeVisible();

    // Click "Leave Room" again, confirm "Leave"
    await bob.page.getByRole('button', { name: 'Leave Room' }).click();
    await bob.page.getByRole('button', { name: 'Leave', exact: true }).click();

    // Should return to HomeScreen
    await expect(bob.page.getByText('AD TABOO')).toBeVisible({ timeout: 5_000 });

    // Session should be cleared
    const session = await bob.page.evaluate(() => localStorage.getItem('adtaboo_session'));
    expect(session).toBeNull();
  });
});
