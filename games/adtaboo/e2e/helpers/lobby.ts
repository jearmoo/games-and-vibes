import { type Page, expect } from '@playwright/test';

/** Navigate to home and wait for the title to appear */
export async function goHome(page: Page) {
  await page.goto('/');
  await expect(page.getByText('AD TABOO')).toBeVisible();
}

/** Create a new room and return the room code */
export async function createRoom(page: Page, name: string): Promise<string> {
  await goHome(page);
  await page.getByTestId('home-name-input').fill(name);
  await page.getByTestId('home-create-button').click();
  await expect(page.getByText('Room Code')).toBeVisible({ timeout: 10_000 });

  const roomCode = await page.evaluate(() => {
    const session = localStorage.getItem('adtaboo_session');
    return session ? JSON.parse(session).roomCode : null;
  });
  expect(roomCode).toBeTruthy();
  return roomCode!;
}

/** Join an existing room by code */
export async function joinRoom(page: Page, name: string, roomCode: string) {
  await goHome(page);
  await page.getByTestId('home-name-input').fill(name);
  await page.getByTestId('home-join-mode-button').click();
  await page.getByTestId('home-code-input').fill(roomCode);
  await page.getByTestId('home-join-button').click();
  await expect(page.getByText('Room Code')).toBeVisible({ timeout: 10_000 });
}

/** Player self-joins a team (works for both host and non-host) */
export async function joinTeam(page: Page, team: 'A' | 'B') {
  await page.getByTestId(`lobby-join-team-${team.toLowerCase()}`).click();
  await page.waitForTimeout(300);
}

/**
 * Start a pointer drag from a source element. Returns the source center coords.
 * dnd-kit uses PointerSensor (not HTML5 drag), so we dispatch real pointer events.
 */
async function startDrag(page: Page, source: ReturnType<Page['getByTestId']>) {
  const srcBox = (await source.boundingBox())!;
  const srcX = srcBox.x + srcBox.width / 2;
  const srcY = srcBox.y + srcBox.height / 2;

  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  // Move enough to exceed dnd-kit's 8px distance activation constraint
  await page.mouse.move(srcX + 10, srcY + 10, { steps: 3 });
  return { srcX, srcY };
}

/** Complete a drag by moving to the target center and releasing */
async function finishDrag(page: Page, target: ReturnType<Page['getByTestId']>) {
  const tgtBox = (await target.boundingBox())!;
  const tgtX = tgtBox.x + tgtBox.width / 2;
  const tgtY = tgtBox.y + tgtBox.height / 2;

  await page.mouse.move(tgtX, tgtY, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Host drags a player pill to a team drop zone */
export async function dragToTeam(hostPage: Page, playerName: string, team: 'A' | 'B') {
  const pill = hostPage.getByTestId(`lobby-player-${playerName}`);
  await startDrag(hostPage, pill);
  const dropZone = hostPage.getByTestId(`lobby-team-${team.toLowerCase()}`);
  await finishDrag(hostPage, dropZone);
}

/** Host drags a player pill to the unassigned drop zone.
 *  The unassigned section only renders while a drag is active,
 *  so we start the drag first, then locate the drop zone. */
export async function dragToUnassigned(hostPage: Page, playerName: string) {
  const pill = hostPage.getByTestId(`lobby-player-${playerName}`);
  await startDrag(hostPage, pill);
  // Unassigned zone appears once drag is active
  const dropZone = hostPage.getByTestId('lobby-unassigned');
  await expect(dropZone).toBeVisible({ timeout: 2_000 });
  await finishDrag(hostPage, dropZone);
}

/** Host assigns a player to a team via socket (UI uses drag-and-drop) */
export async function assignToTeam(hostPage: Page, playerName: string, team: 'A' | 'B') {
  await hostPage.evaluate(
    ({ team, playerName }) => {
      const socket = (window as any).__socket;
      if (!socket) throw new Error('Socket not found on window');
      const store = (window as any).__store;
      if (!store) throw new Error('Store not found on window');
      const player = store.getState().players.find((p: any) => p.name === playerName);
      if (!player) throw new Error(`Player "${playerName}" not found`);
      socket.emit('team:assign', { team, targetPlayerId: player.id });
    },
    { team, playerName },
  );
  await hostPage.waitForTimeout(300);
}

/** Set a player as taboo master */
export async function setTabooMaster(page: Page, playerName: string) {
  await page.getByTestId(`lobby-set-tm-${playerName}`).click();
  await expect(page.getByText('TM').first()).toBeVisible({ timeout: 3_000 });
}

/** Configure game settings (host only) — opens settings modal, changes values, closes */
export async function configureSettings(
  page: Page,
  opts: { rounds?: number; timerSeconds?: number; wordsPerTurn?: number; maxTabooWords?: number },
) {
  // Open settings modal
  await page.getByTestId('lobby-settings-trigger').click();
  await expect(page.getByTestId('lobby-settings')).toBeVisible({ timeout: 3_000 });

  if (opts.rounds !== undefined) {
    await page.getByTestId('lobby-rounds-select').selectOption(String(opts.rounds));
  }
  if (opts.timerSeconds !== undefined) {
    const timerInput = page.getByTestId('lobby-timer-input');
    await timerInput.fill(String(opts.timerSeconds));
    await timerInput.blur();
  }
  if (opts.wordsPerTurn !== undefined) {
    await page.getByTestId('lobby-words-select').selectOption(String(opts.wordsPerTurn));
  }
  if (opts.maxTabooWords !== undefined) {
    await page.getByTestId('lobby-taboos-select').selectOption(String(opts.maxTabooWords));
  }

  // Close settings modal
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('lobby-settings')).not.toBeVisible({ timeout: 3_000 });
  await page.waitForTimeout(300);
}

/** Click "Start Game" (host only) */
export async function startGame(page: Page) {
  await page.getByTestId('lobby-start-button').click();
  await expect(page.getByText('Team Setup')).toBeVisible({ timeout: 10_000 });
}

/** Wait for all players to see the lobby with a given player name */
export async function expectInLobby(page: Page, playerName: string) {
  await expect(page.getByText(playerName)).toBeVisible({ timeout: 5_000 });
}
