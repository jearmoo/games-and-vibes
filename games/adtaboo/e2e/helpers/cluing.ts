import { type Page, expect } from '@playwright/test';

/** Wait for the cluing phase to start (any role) */
export async function waitForCluing(page: Page) {
  await expect(page.getByText(/Turn/i).first()).toBeVisible({ timeout: 15_000 });
}

/** Click "Begin Cluing" (clue-giver only, before timer starts) */
export async function beginCluing(page: Page) {
  await page.getByTestId('clue-begin-button').click();
  // Wait for word cards to appear (timer has started)
  await expect(page.getByText('Describe these words')).toBeVisible({ timeout: 5_000 });
}

/** Mark a word card as correct by index (clue-giver only).
 *  Uses the first visible "Got It!" button (cards shift up as they're marked). */
export async function markCorrect(page: Page) {
  await page.getByRole('button', { name: 'Got It!' }).first().click();
  await page.waitForTimeout(300);
}

/** Undo the first correct marking (clue-giver only) */
export async function undoCorrect(page: Page) {
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.waitForTimeout(300);
}

/** Click "End Turn" (clue-giver only) */
export async function endTurn(page: Page) {
  await page.getByTestId('clue-end-turn-button').click();
}

/** Buzz a taboo word by name (taboo master only) */
export async function buzzTaboo(page: Page, word: string) {
  await page.getByTestId(`taboo-buzz-${word}`).click();
  await page.waitForTimeout(300);
}

/** Undo a taboo buzz by word name (taboo master only) */
export async function undoBuzz(page: Page, word: string) {
  await page.getByTestId(`taboo-undo-buzz-${word}`).click();
  await page.waitForTimeout(300);
}

/** Wait for scoring/round result screen */
export async function waitForScoring(page: Page) {
  await expect(
    page.getByText('Complete').or(page.getByText('Game Over')),
  ).toBeVisible({ timeout: 15_000 });
}

/** Wait for game over screen */
export async function waitForGameOver(page: Page) {
  await expect(page.getByText(/Wins!|Tie/)).toBeVisible({ timeout: 60_000 });
}

/** Click "Next Round" (host only) */
export async function nextRound(page: Page) {
  await page.getByTestId('scoring-next-round-button').click();
}

/** Click "Play Again" */
export async function playAgain(page: Page) {
  // Could be on scoring screen or game over screen
  const scoringBtn = page.getByTestId('scoring-play-again-button');
  const gameOverBtn = page.getByTestId('game-over-play-again-button');
  if (await scoringBtn.isVisible()) {
    await scoringBtn.click();
  } else {
    await gameOverBtn.click();
  }
}
