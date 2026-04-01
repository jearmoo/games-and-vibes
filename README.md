# Games & Vibes

A multiplayer party game platform — real-time browser games you play with friends. Built as a pnpm monorepo with shared infrastructure so new games can be added quickly.

## Games

- **[Adversarial Taboo](games/adtaboo/)** — Teams give clues while the opposing team chooses the forbidden words. Live at [adtaboo.jerpi.org](https://adtaboo.jerpi.org).

## Tech Stack

- **Frontend**: React 18 + Vite + Zustand + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm workspaces
- **Deployment**: Docker Compose + Cloudflare Tunnel

## Project Structure

```
packages/
  shared-types/    # Pure TypeScript types shared by client + server
  server-core/     # Room infrastructure: BaseRoom, RoomManager, socket handlers
  client-core/     # React utilities: socket factory, session store, Tailwind preset
  test-utils/      # TestRoom, MockStore, MockSocket for unit tests

games/
  adtaboo/         # Adversarial Taboo (server + client)

apps/
  landing/         # games.jerpi.org hub page
```

## Getting Started

**Prerequisites**: Node.js 18+, pnpm

```bash
pnpm install          # Install all workspace dependencies
pnpm run dev:adtaboo  # Run Adtaboo server (4040) + client (5173)
pnpm run dev:landing  # Run landing page (3000)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm -r build` | Build all packages (shared-types -> server-core -> games -> apps) |
| `pnpm -r test` | Run all tests |
| `pnpm run lint` | ESLint across all packages |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run format` | Auto-format with Prettier |
| `pnpm run format:check` | Check formatting without writing |

## Deployment

Docker Compose at the repo root with per-game containers. Cloudflare Tunnel routes subdomains to localhost ports.

```bash
docker compose up -d --build
```

| Service | Port | URL |
|---------|------|-----|
| Adtaboo | 4040 | adtaboo.jerpi.org |
| Landing | 3000 | games.jerpi.org |

## Environment Variables

Configure via `.env` file (see `.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `METRICS_TOKEN` | Yes | Bearer token for `/api/metrics` endpoint |
| `GA_MEASUREMENT_ID` | No | Google Analytics measurement ID (build-time) |
| `GIT_COMMIT` | No | Git commit hash injected at build time (defaults to `unknown`) |

## Adding a Game

1. Define types in `packages/shared-types/src/<game>.ts`
2. Create `<Game>Room extends BaseRoom` in `games/<game>/server/`
3. Add game-specific socket handlers
4. Build client with Zustand store + phase-based routing in `games/<game>/client/`
5. Add Dockerfile, docker-compose entry, and cloudflared ingress rule
