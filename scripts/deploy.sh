#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/jer/games"
LOG_FILE="/home/jer/games/scripts/deploy.log"
IMAGES=("games-adtaboo" "games-landing")

log() { echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"; }

cd "$REPO_DIR"

git pull --ff-only origin main

export GIT_COMMIT
GIT_COMMIT=$(git rev-parse HEAD)

# Check if all images are already built from the current commit
NEEDS_BUILD=false
for IMG in "${IMAGES[@]}"; do
  BUILT=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMG" 2>/dev/null || echo "")
  if [ "$BUILT" != "$GIT_COMMIT" ]; then
    NEEDS_BUILD=true
    break
  fi
done

if [ "$NEEDS_BUILD" = false ]; then
  log "All containers already at $GIT_COMMIT. Skipping rebuild."
  exit 0
fi

log "Rebuilding for commit $GIT_COMMIT..."
docker compose up --build -d

log "Deploy complete."
