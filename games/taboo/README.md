# Adversarial Taboo

A real-time multiplayer party game where teams take turns giving clues while the opposing team sets the forbidden words. Unlike classic Taboo where taboo words come on printed cards, in Adversarial Taboo the opposing team *chooses* which words are forbidden — making every round a strategic battle.

## How to Play

1. **Create a room** and share the link or 4-letter code with friends
2. **Split into two teams** (2+ players each) and assign a **Taboo Master** per team
3. Each round has a **parallel setup** phase where both teams work simultaneously:
   - Each Taboo Master sees the 5 words the opposing team will clue
   - They set up to 20 taboo words the opposing clue-giver can't say
   - They also pick their own team's clue-giver
   - Both TMs lock in when ready
4. Teams then clue in order (Team A, then Team B):
   - The clue-giver describes all 5 words (in any order) without saying the taboo words
   - Teammates guess based on the clues
   - The opposing Taboo Master buzzes when taboo words are spoken
   - The clue-giver can end their turn early if they're stuck
5. After both teams clue, the round ends and scores are shown
6. The game repeats for the configured number of rounds

### Scoring

- **+3** per word correctly guessed
- **-1** per taboo violation (buzz)
- **0** for words not guessed before time runs out

### In-Game Features

- **Help button** (?) — Available on every screen, explains the game and roles
- **Round history** (clock icon) — Review completed rounds: words clued, taboo words, buzzes, and score breakdowns per team
- **Reconnection** — Players who disconnect can rejoin with the same name; game state is fully restored
- **Host & TM resilience** — Both host and Taboo Master are immediately reassigned if a player disconnects
- **Taboo Master reassignment** — Can be changed mid-game via the expandable roster in the score bar

## Configuration

Game settings are configurable by the host in the lobby:

| Setting | Default | Range |
|---------|---------|-------|
| Rounds | 3 | 1-5 |
| Timer (seconds) | 60 | 10-600 |
| Words per turn | 5 | 1-10 |
| Max taboo words | 20 | 5-30 |

## Development

```bash
# From the repo root
pnpm run dev:taboo    # Run server (4040) + client (5173) concurrently

# Run tests
cd games/taboo/server && npx vitest run

# Run a single test file
cd games/taboo/server && npx vitest run src/TabooRoom.test.ts
```

The client proxies Socket.IO connections to the server via Vite's dev proxy.

## Project Structure

```
taboo/
├── server/
│   └── src/
│       ├── index.ts          # Express + Socket.IO entry point
│       ├── TabooRoom.ts      # Game state machine (extends BaseRoom)
│       ├── TabooRoom.test.ts # Unit tests
│       ├── handlers.ts       # Socket.IO game handler orchestrator
│       └── words/            # Word provider (randomwordgenerator.com)
├── client/
│   └── src/
│       ├── App.tsx           # Phase-based screen routing
│       ├── store.ts          # Zustand game store
│       ├── socket.ts         # Socket.IO client
│       └── components/
│           ├── HomeScreen.tsx
│           ├── LobbyScreen.tsx
│           ├── ParallelSetupScreen.tsx
│           ├── ClueGiverScreen.tsx
│           ├── GuesserScreen.tsx
│           ├── TabooWatcherScreen.tsx
│           ├── ScoringScreen.tsx
│           ├── GameOverScreen.tsx
│           └── ...
└── data/                     # Runtime persistence (gitignored)
```

Shared infrastructure (BaseRoom, RoomManager, socket handlers, client utilities) lives in `packages/` — see the [root README](../../README.md).
