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

/** Join a team from the lobby */
export async function joinTeam(page: Page, team: 'A' | 'B') {
  await page.getByTestId(`lobby-join-team-${team.toLowerCase()}`).click();
  await page.waitForTimeout(300);
}

/** Set a player as taboo master */
export async function setTabooMaster(page: Page, playerName: string) {
  await page.getByTestId(`lobby-set-tm-${playerName}`).click();
  await expect(page.getByText('TM').first()).toBeVisible({ timeout: 3_000 });
}

/** Configure game settings (host only) */
export async function configureSettings(
  page: Page,
  opts: { rounds?: number; timerSeconds?: number; wordsPerTurn?: number; maxTabooWords?: number },
) {
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
