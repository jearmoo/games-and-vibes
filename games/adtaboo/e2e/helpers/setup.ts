import { type Page, expect } from '@playwright/test';

/** Wait for the parallel setup screen */
export async function waitForSetup(page: Page) {
  await expect(page.getByText('Team Setup')).toBeVisible({ timeout: 10_000 });
}

/** Pick a clue-giver by clicking their name button (TM only) */
export async function pickClueGiver(page: Page, playerName: string) {
  await page.getByTestId(`setup-pick-clue-giver-${playerName}`).click();
  await page.waitForTimeout(300);
}

/** Add taboo words one by one */
export async function addTabooWords(page: Page, words: string[]) {
  for (const word of words) {
    await page.getByTestId('setup-taboo-input').fill(word);
    await page.getByTestId('setup-taboo-add-button').click();
    await page.waitForTimeout(100);
  }
}

/** Click "Lock In" (TM only) */
export async function lockIn(page: Page) {
  await page.getByTestId('setup-confirm-button').click();
  await expect(page.getByTestId('setup-unconfirm-button')).toBeVisible({ timeout: 5_000 });
}

/** Click "Locked In — Tap to Unlock" (TM only) */
export async function unlock(page: Page) {
  await page.getByTestId('setup-unconfirm-button').click();
  await expect(page.getByTestId('setup-confirm-button')).toBeVisible({ timeout: 5_000 });
}

/** Wait for taboo word suggestions to reach a count */
export async function waitForTabooCount(page: Page, count: number, max: number) {
  await expect(page.getByText(`${count}/${max} taboo words`)).toBeVisible({ timeout: 5_000 });
}

/** Complete setup for one TM: pick clue-giver, add taboo words, lock in */
export async function completeSetup(page: Page, clueGiverName: string, tabooWords: string[]) {
  await waitForSetup(page);
  await pickClueGiver(page, clueGiverName);
  await addTabooWords(page, tabooWords);
  await lockIn(page);
}
