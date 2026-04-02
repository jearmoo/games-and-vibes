import { test, expect } from '../fixtures/game';
import { createRoom, joinRoom, assignToTeam, joinTeam, setTabooMaster, goHome } from '../helpers/lobby';

test.describe('Error States', () => {
  test.use({ playerCount: 3 });

  test('start button shows correct disabled reason', async ({ players }) => {
    const [alice, bob, carol] = players;

    const roomCode = await createRoom(alice.page, alice.name);
    await joinRoom(bob.page, bob.name, roomCode);
    await joinRoom(carol.page, carol.name, roomCode);

    await joinTeam(alice.page, 'A');
    await assignToTeam(alice.page, bob.name, 'A');
    await assignToTeam(alice.page, carol.name, 'B');

    // Without taboo masters set, button should say "Each team needs a taboo master"
    await expect(alice.page.getByText('Each team needs a taboo master')).toBeVisible({ timeout: 5_000 });

    // Set TMs — now it should say "Need 2+ per team" (Carol alone on B)
    await setTabooMaster(alice.page, alice.name);
    await setTabooMaster(alice.page, carol.name);

    await expect(alice.page.getByText('Need 2+ per team')).toBeVisible({ timeout: 5_000 });
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
