import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, dragToTeam, dragToUnassigned, expectInLobby } from '../helpers/lobby';

/**
 * Tests real drag-and-drop team assignment via dnd-kit.
 * Verifies that host can drag themselves and other players between teams.
 */
test.describe('Drag and Drop — Team Assignment', () => {
  test('host drags another player from unassigned to a team', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(alice.page, bob.name);

    await dragToTeam(alice.page, bob.name, 'A');

    // Bob should appear inside Team A on both screens
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${bob.name}`)).toBeVisible();
    await expect(bob.page.getByTestId('lobby-team-a').getByText(bob.name)).toBeVisible();
  });

  test('host drags another player between teams', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(alice.page, bob.name);

    // First assign Bob to Team A
    await dragToTeam(alice.page, bob.name, 'A');
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${bob.name}`)).toBeVisible();

    // Now drag Bob from Team A to Team B
    await dragToTeam(alice.page, bob.name, 'B');

    await expect(alice.page.getByTestId('lobby-team-b').getByTestId(`lobby-player-${bob.name}`)).toBeVisible();
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${bob.name}`)).not.toBeVisible();
    await expect(bob.page.getByTestId('lobby-team-b').getByText(bob.name)).toBeVisible();
  });

  test('host drags another player from a team to unassigned', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(alice.page, bob.name);

    // Assign Bob to Team A first
    await dragToTeam(alice.page, bob.name, 'A');
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${bob.name}`)).toBeVisible();

    // Drag Bob back to unassigned
    await dragToUnassigned(alice.page, bob.name);

    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${bob.name}`)).not.toBeVisible();
    // Verify Bob's team is null via store
    const bobTeam = await alice.page.evaluate((name) => {
      const store = (window as any).__store;
      return store.getState().players.find((p: any) => p.name === name)?.team;
    }, bob.name);
    expect(bobTeam).toBeNull();
  });

  test('host drags themselves to a team', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(alice.page, bob.name);

    await dragToTeam(alice.page, alice.name, 'A');

    // Alice should appear in Team A on both screens
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${alice.name}`)).toBeVisible();
    await expect(bob.page.getByTestId('lobby-team-a').getByText(alice.name)).toBeVisible();
  });

  test('host drags themselves between teams', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(alice.page, bob.name);

    // Host to Team A
    await dragToTeam(alice.page, alice.name, 'A');
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${alice.name}`)).toBeVisible();

    // Host from A to B
    await dragToTeam(alice.page, alice.name, 'B');

    await expect(alice.page.getByTestId('lobby-team-b').getByTestId(`lobby-player-${alice.name}`)).toBeVisible();
    await expect(alice.page.getByTestId('lobby-team-a').getByTestId(`lobby-player-${alice.name}`)).not.toBeVisible();
    await expect(bob.page.getByTestId('lobby-team-b').getByText(alice.name)).toBeVisible();
  });

  test('non-host player pills are not draggable', async ({ players }) => {
    const [alice, bob] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await expectInLobby(bob.page, alice.name);

    // Bob's view: player pills should not have cursor-grab
    const alicePill = bob.page.getByTestId(`lobby-player-${alice.name}`);
    await expect(alicePill).toBeVisible();
    const hasGrabCursor = await alicePill.evaluate((el) => el.classList.contains('cursor-grab'));
    expect(hasGrabCursor).toBe(false);

    const bobPill = bob.page.getByTestId(`lobby-player-${bob.name}`);
    const bobHasGrab = await bobPill.evaluate((el) => el.classList.contains('cursor-grab'));
    expect(bobHasGrab).toBe(false);
  });

  test('all players see updated state after multiple drags', async ({ players }) => {
    const [alice, bob, carol, dave] = players;
    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);
    await joinRoom(dave.page, dave.name, roomCode);

    for (const p of [bob, carol, dave]) {
      await expectInLobby(alice.page, p.name);
    }

    // Host assigns everyone via drag
    await dragToTeam(alice.page, alice.name, 'A');
    await dragToTeam(alice.page, bob.name, 'A');
    await dragToTeam(alice.page, carol.name, 'B');
    await dragToTeam(alice.page, dave.name, 'B');

    // Verify on a non-host screen (Dave) — allow extra time for socket propagation in CI
    await expect(dave.page.getByTestId('lobby-team-a').getByText(alice.name)).toBeVisible({ timeout: 10_000 });
    await expect(dave.page.getByTestId('lobby-team-a').getByText(bob.name)).toBeVisible({ timeout: 10_000 });
    await expect(dave.page.getByTestId('lobby-team-b').getByText(carol.name)).toBeVisible({ timeout: 10_000 });
    await expect(dave.page.getByTestId('lobby-team-b').getByText(dave.name)).toBeVisible({ timeout: 10_000 });
  });
});
