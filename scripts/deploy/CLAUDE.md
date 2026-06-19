# scripts/deploy

Webhook-triggered deploy system for the games monorepo. Runs as `games-deploy` systemd service.

## Architecture

Two files, split so deploy logic can be updated without restarting the service:

- **`listener.py`** — Long-running HTTP server (port 9877). Handles request parsing, queue management, and subprocess-invokes `deploy.py`. Rarely changes. This is what systemd runs.
- **`deploy.py`** — Deploy executor. Called as `python3 deploy.py <sha>`. Re-read from disk each invocation, so updates via `git checkout` take effect automatically on the next deploy.

## Key Constraints

- **Python stdlib only** — no pip packages, runs on bare system Python 3.13+
- **No auth needed** — n8n webhook workflow handles authentication upstream
- **IMAGES list** — `["adversarial-taboo", "charades", "odes-for-cave-men", "yip-yap", "two-rooms-and-a-boom", "games-landing"]` in `deploy.py`, must match `container_name` values in `docker-compose.yml`
- **Commit-targeted deploys** — every request must include `?ref=<sha>`. The script deploys exactly that commit (via `git fetch && git reset --hard`), not HEAD. Reset rather than checkout so dirty working-tree edits on the deploy host can neither block a deploy nor silently smuggle themselves into the build.

## Deploy Ordering

- `deploy.py` uses `git merge-base --is-ancestor` to compare commits against what's currently deployed
- Skips deployment if the target commit is older than or equal to the deployed commit
- Concurrent requests are queued (202) by the listener. Only the newest queued SHA is kept.
- After each deploy cycle, the queue is drained so the server converges to the latest validated commit.

## Log Rotation

Both files log to `deploy.log`. `RotatingFileHandler`: 5 MB max, 3 backups (~20 MB total cap).

## After Changes

- **`deploy.py` changed**: No action needed. Next deploy invocation uses the updated file automatically.
- **`listener.py` changed** (rare): Restart the service:
  ```bash
  sudo systemctl restart games-deploy
  systemctl status games-deploy
  ```

## Testing Locally

```bash
# Test executor standalone
python3 scripts/deploy/deploy.py $(git rev-parse HEAD)

# Run listener directly
python3 scripts/deploy/listener.py

# Trigger in another terminal (ref is required)
curl -X POST "http://localhost:9877?ref=$(git rev-parse HEAD)"

# Check logs
tail -f scripts/deploy/deploy.log
```
