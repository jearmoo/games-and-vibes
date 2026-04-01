# scripts/deploy

Webhook-triggered deploy system for the games monorepo. Runs as `games-deploy` systemd service.

## Key Constraints

- **Python stdlib only** — no pip packages, runs on bare system Python 3.13+
- **Single file** — `deploy.py` is both the HTTP listener (port 9877) and the deploy executor
- **No auth needed** — n8n webhook workflow handles authentication upstream
- **IMAGES list** — `["games-adtaboo", "games-landing"]` must match container names in `docker-compose.yml`
- **Commit-targeted deploys** — every request must include `?ref=<sha>`. The script deploys exactly that commit (via `git checkout`), not HEAD.

## Deploy Ordering

- Uses `git merge-base --is-ancestor` to compare commits against what's currently deployed
- Skips deployment if the target commit is older than or equal to the deployed commit
- Concurrent requests are queued (202), not rejected (no more 409). Only the newest queued SHA is kept.
- After each deploy cycle, the queue is drained so the server converges to the latest validated commit.

## Log Rotation

`RotatingFileHandler` on `deploy.log`: 5 MB max, 3 backups (~20 MB total cap).

## After Changes

```bash
sudo systemctl restart games-deploy
systemctl status games-deploy
```

## Testing Locally

```bash
# Run directly
python3 scripts/deploy/deploy.py

# Trigger in another terminal (ref is required)
curl -X POST "http://localhost:9877?ref=$(git rev-parse HEAD)"

# Check logs
tail -f scripts/deploy/deploy.log
```
