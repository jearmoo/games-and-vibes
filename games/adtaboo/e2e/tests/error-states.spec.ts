import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, goHome } from '../helpers/lobby';

test.describe('Error States', () => {
  test('start button shows correct disabled reason', async ({ players }) => {
    const [alice, bob, carol, dave] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);
    await joinRoom(dave.page, dave.name, roomCode);

    // With only 1 player per team, button should say "Need 2+ per team"
    await joinTeam(alice.page, 'A');
    await assignToTeam(alice.page, carol.name, 'B');
    await expect(alice.page.getByText('Need 2+ per team')).toBeVisible({ timeout: 5_000 });

    // Fill both teams to 2+ — now should say "Each team needs a taboo master"
    await assignToTeam(alice.page, bob.name, 'A');
    await assignToTeam(alice.page, dave.name, 'B');
    await expect(alice.page.getByText('Each team needs a taboo master')).toBeVisible({ timeout: 5_000 });

    // Set TMs — button should become "Start Game"
    await setTabooMaster(alice.page, alice.name);
    await setTabooMaster(alice.page, carol.name);
    await expect(alice.page.getByText('Start Game')).toBeVisible({ timeout: 5_000 });
  });

  test('join non-existent room shows error', async ({ players }) => {
    const [alice] = players;

    await goHome(alice.page);
    await alice.page.getByTestId('home-name-input').fill('Alice');
    await alice.page.getByTestId('home-join-mode-button').click();
    await alice.page.getByTestId('home-code-input').fill('ZZZZ');
    await alice.page.getByTestId('home-join-button').click();

    await expect(alice.page.getByText(/not found|does not exist|error/i)).toBeVisible({ timeout: 5_000 });
  });
});
