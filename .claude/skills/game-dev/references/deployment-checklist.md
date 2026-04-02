# Deployment Checklist

Follow these steps to ship a new game to production. Each step references the adtaboo setup as a template.

## 1. Dockerfile

**Template**: `games/adtaboo/Dockerfile`
**Create**: `games/<name>/Dockerfile`

Multi-stage build. Build context is always the monorepo root.

### Stage 1: Build

```dockerfile
FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace config first (for Docker layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy ALL package.jsons needed for workspace resolution
COPY packages/server-core/package.json packages/server-core/
COPY packages/client-core/package.json packages/client-core/
COPY games/<name>/shared/package.json games/<name>/shared/
COPY games/<name>/server/package.json games/<name>/server/
COPY games/<name>/client/package.json games/<name>/client/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/<name>/ games/<name>/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/<name>-shared build
RUN pnpm --filter @games/<name>-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/<name>-client build
```

### Stage 2: Production

```dockerfile
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

# Only copy package.jsons needed for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/<name>/shared/package.json games/<name>/shared/
COPY games/<name>/server/package.json games/<name>/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts only
COPY --from=build /app/games/<name>/shared/dist games/<name>/shared/dist
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/<name>/server/dist games/<name>/server/dist
COPY --from=build /app/games/<name>/client/dist games/<name>/server/public

ENV NODE_ENV=production
ENV PORT=<port>
EXPOSE <port>
WORKDIR /app/games/<name>/server
CMD ["node", "dist/index.js"]
```

Key details:
- Client build output goes to `games/<name>/server/public` — Express serves it as static files
- Production stage does NOT include `client-core` or `client/` — only the built assets
- The `GIT_COMMIT` label enables the deploy script to skip rebuilds when already current
- **GA flow**: `GA_MEASUREMENT_ID` build arg → `VITE_GA_ID` env var → Vite substitutes `%VITE_GA_ID%` in `index.html` → gtag script loads conditionally. Set `game_name` in the `gtag('config', ...)` call to distinguish games in Analytics.

## 2. Docker Compose

**File**: `docker-compose.yml`

Add a new service entry:

```yaml
  <name>:
    build:
      context: .
      dockerfile: games/<name>/Dockerfile
      args:
        GA_MEASUREMENT_ID: ${GA_MEASUREMENT_ID:-}
        GIT_COMMIT: ${GIT_COMMIT:-unknown}
    env_file: .env
    container_name: <name>
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

Create the data directory: `mkdir -p games/<name>/data`

## 3. CI Workflow

**File**: `.github/workflows/ci.yml`

Add a Docker build step in the `docker` job:

```yaml
      - name: Build <name> image
        run: docker build -f games/<name>/Dockerfile -t <name> .
```

## 4. Cloudflared Tunnel

Add an ingress rule to the cloudflared config (on the deployment server):

```yaml
- hostname: <name>.jerpi.org
  service: http://localhost:<port>
```

Restart the tunnel after updating config.

## 5. DNS

Add a CNAME record:
- `<name>.jerpi.org` -> tunnel CNAME (same as other subdomains)

## 6. Root Package.json

Add dev script:
```json
"dev:<name>": "concurrently \"pnpm --filter @games/<name>-server dev\" \"pnpm --filter @games/<name>-client dev\""
```

## 7. Environment

Ensure `.env` has `METRICS_TOKEN` set — it's shared across all games for the `/api/metrics` endpoint.

## 8. Verify Deployment

```bash
# Build and start locally
docker compose up --build <name>

# Check health
curl http://localhost:<port>/api/health

# Check the game loads
open http://localhost:<port>

# Deploy to production
git push origin main  # CI runs, then deploy webhook triggers
```

## Port Registry

Keep this updated as games are added:

| Port | Service | Subdomain |
|------|---------|-----------|
| 3000 | landing | games.jerpi.org |
| 4040 | adtaboo | adtaboo.jerpi.org |
| 4050 | charades | charades.jerpi.org |
| 4060 | odes-for-cave-men | odes.jerpi.org |
