import { test as base, type BrowserContext, type Page } from '@playwright/test';

export interface Player {
  context: BrowserContext;
  page: Page;
  name: string;
}

/**
 * Custom Playwright fixture that provides N isolated player browser contexts.
 * Each player gets their own localStorage (separate session), simulating
 * separate devices in a multiplayer game.
 */
export const test = base.extend<{
  players: Player[];
  playerCount: number;
}>({
  playerCount: 4,

  players: async ({ browser, playerCount }, use) => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
    const players: Player[] = [];

    for (let i = 0; i < playerCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      players.push({ context, page, name: names[i] });
    }

    await use(players);

    for (const p of players) {
      await p.context.close();
    }
  },
});

export { expect } from '@playwright/test';
