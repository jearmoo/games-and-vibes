#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/jer/games"
LOG_FILE="/home/jer/games/scripts/deploy.log"

log() { echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"; }

cd "$REPO_DIR"

# Capture current commit before pull
BEFORE=$(git rev-parse HEAD)

git pull --ff-only origin main

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  log "No new commits (still at $BEFORE). Skipping rebuild."
  exit 0
fi

log "New commits detected: $BEFORE → $AFTER"
log "Rebuilding and restarting containers..."

docker compose up --build -d

log "Deploy complete."
