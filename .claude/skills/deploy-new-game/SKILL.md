---
name: deploy-new-game
description: Deploy a game that's already built but not yet in production. Creates Dockerfile, docker-compose entry, CI step, cloudflared tunnel config, DNS route, and updates all docs/skill references. Trigger when the user wants to deploy/ship a game to production.
---

# Deploy New Game

This skill deploys an existing game from the monorepo to production. The game code must already exist under `games/<name>/` with working server, client, and (optionally) shared packages.

## Prerequisites

Before using this skill, verify:
1. The game builds: `pnpm --filter @games/<name>-server build && pnpm --filter @games/<name>-client build`
2. The game runs locally: `pnpm run dev:<shortname>`
3. Tests pass: `pnpm -r test`

## Gather Info

Ask the user or determine from the codebase:
- **Game directory name** (under `games/`) — e.g., `odes-for-cave-men`
- **Subdomain** — e.g., `odes.jerpi.org` (may differ from directory name)
- **Port** — check `references/port-registry` below for next available

Read the game's `server/package.json` and `client/package.json` to understand:
- Package names (`@games/<name>-server`, etc.)
- Whether it has a `shared/` package (check for `@games/<name>-shared` dependency)
- Any special build steps (e.g., word file copying in server build script)
- Runtime dependencies that need to be in the production image

## Steps

Execute these in order. Each step references existing deployed games as templates.

### 1. Dockerfile

**Create** `games/<name>/Dockerfile`

Use the appropriate template based on game structure:
- **Has shared package** (like adtaboo, odes-for-cave-men): Use `games/adtaboo/Dockerfile` as template
- **No shared package** (like charades): Use `games/charades/Dockerfile` as template

Key decisions:
- **Build stage package.jsons**: Include every workspace package the game depends on (server-core, client-core, shared, server, client). Check `package.json` files for `workspace:*` dependencies.
- **Build order**: Dependencies first. Typical: `server-core` → `shared` → `server` → `client`. If the game uses `word-providers`, build that before server.
- **Special build artifacts**: If the server build script copies non-TS files (e.g., `cp src/words/*.json dist/words/`), ensure those end up in the production image.
- **Production stage**: Only include packages needed at runtime (not client-core, not client). Client dist goes to `server/public`.
- **GA**: Always include `ARG GA_MEASUREMENT_ID` + `ENV VITE_GA_ID=$GA_MEASUREMENT_ID` before the client build step. The client's `index.html` should already have the gtag snippet (added during game creation per the new-game-checklist).

### 2. Data directory

```bash
mkdir -p games/<name>/data
touch games/<name>/data/.gitkeep
git add -f games/<name>/data/.gitkeep
```

The `data/` pattern in `.gitignore` covers the JSON files; `.gitkeep` must be force-added.

### 3. Docker Compose

**Modify** `docker-compose.yml` — add service entry. Use adtaboo as template for games with state persistence (rooms/metrics), or charades for stateless games.

Stateful game (has RoomManager + MetricsCollector):
```yaml
  <name>:
    build:
      context: .
      dockerfile: games/<name>/Dockerfile
      args:
        GA_MEASUREMENT_ID: ${GA_MEASUREMENT_ID:-}
        GIT_COMMIT: ${GIT_COMMIT:-unknown}
    env_file: .env
    container_name: <container-name>
    restart: unless-stopped
    stop_grace_period: 30s
    ports:
      - "<port>:<port>"
    volumes:
      - ./games/<name>/data:/data
    environment:
      - NODE_ENV=production
      - PORT=<port>
      - LOG_LEVEL=info
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

Stateless game (no persistence):
```yaml
  <name>:
    build:
      context: .
      dockerfile: games/<name>/Dockerfile
      args:
        GA_MEASUREMENT_ID: ${GA_MEASUREMENT_ID:-}
        GIT_COMMIT: ${GIT_COMMIT:-unknown}
    container_name: <container-name>
    restart: unless-stopped
    ports:
      - "<port>:<port>"
    environment:
      - NODE_ENV=production
      - PORT=<port>
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"
```

### 4. CI Workflow

**Modify** `.github/workflows/ci.yml` — add in the `docker` job:

```yaml
      - name: Build <name> image
        run: docker build -f games/<name>/Dockerfile -t <name> .
```

### 5. Deploy Script

**Modify** `scripts/deploy/deploy.py` — add container name to `IMAGES` list.
**Modify** `scripts/deploy/CLAUDE.md` — update the IMAGES reference.

The IMAGES list uses `container_name` values from docker-compose.yml, used by `docker inspect` to check deployed commit SHAs.

### 6. Cloudflared Tunnel

**Modify** `/etc/cloudflared/config.yml` — add ingress rule before catch-all:
```yaml
  - hostname: <subdomain>.jerpi.org
    service: http://localhost:<port>
```

**Run** DNS route:
```bash
cloudflared tunnel route dns eb409462-33a9-4b86-80fe-3530b772d7c9 <subdomain>.jerpi.org
```

**Restart**:
```bash
sudo systemctl restart cloudflared
```

### 7. Landing Page

**Modify** `apps/landing/src/gameRegistry.ts` — set `available: true` for the game entry. If no entry exists, add one with id, name, tagline, url, playerCount, accentColor, accentGlow.

### 8. Update Documentation

Update ALL of these (check each one):

| File | What to update |
|------|---------------|
| `README.md` | Games list, project structure, dev commands, deployment table |
| `CLAUDE.md` | Commands section (dev script), Games section, Deployment ports |
| `scripts/deploy/CLAUDE.md` | IMAGES list reference |
| `.claude/skills/game-dev/references/deployment-checklist.md` | Port registry table |
| `~/.openclaw/skills/games-and-vibes/SKILL.md` | Docker ps filter, deployed commit loop |
| `~/.openclaw/skills/games-and-vibes/reference/games.md` | New game section (container, port, health, metrics, URL, data, Dockerfile) |

### 9. Verify

```bash
# Build the image
docker compose build <service-name>

# Start and check health
docker compose up -d <service-name>
curl -sf http://localhost:<port>/api/health

# Check client loads
curl -sf http://localhost:<port> | head -5

# Run full CI checks
pnpm run typecheck && pnpm run lint && pnpm -r test
```

### 10. Ship

After merging to main, the deploy webhook will automatically rebuild and deploy.

Post-deploy verification:
```bash
# Check container is running
docker ps --filter name=<container-name>

# Check health endpoint through tunnel
curl -sf https://<subdomain>.jerpi.org/api/health
```

`deploy.py` changes (e.g. updating the `IMAGES` list for a new game) do **not** require restarting `games-deploy`. The systemd service runs `listener.py`, which invokes `deploy.py` as a subprocess per request — the new file is read on the next webhook automatically. The two-file split exists specifically so deploy logic can ship without a service restart.

Restart `games-deploy` only if `listener.py` itself was changed:
```bash
sudo systemctl restart games-deploy
```

## Port Registry

| Port | Service | Subdomain |
|------|---------|-----------|
| 3000 | landing | games.jerpi.org |
| 4040 | adtaboo | adtaboo.jerpi.org |
| 4050 | charades | charades.jerpi.org |
| 4060 | odes-for-cave-men | odes.jerpi.org |
| 4070 | yip-yap | yipyap.jerpi.org |

Next available: **4080**

## Tunnel Info

- Tunnel ID: `eb409462-33a9-4b86-80fe-3530b772d7c9`
- Config: `/etc/cloudflared/config.yml`
- Service: `cloudflared` (systemd)
