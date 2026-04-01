# Deploy Scripts

Webhook-triggered deployment for the games monorepo. A Python HTTP server listens for POST requests and pulls/rebuilds Docker containers when the git commit changes.

## How It Works

1. Push to `main` triggers GitHub Actions CI
2. CI calls an n8n webhook workflow (handles auth)
3. n8n forwards the request to `localhost:9877`
4. `deploy.py` pulls latest code, checks if Docker images need rebuilding, and runs `docker compose up --build -d` if so

### Smart Rebuild

Images are tagged with the git commit via Docker labels (`org.opencontainers.image.revision`). If all images already match the current commit, the rebuild is skipped.

## Systemd Service

```bash
# Service name
sudo systemctl status games-deploy
sudo systemctl restart games-deploy

# View live logs (systemd journal)
journalctl -u games-deploy -f
```

## Log Files

Logs are written to `deploy.log` in this directory with automatic rotation:
- **Max size**: 5 MB per file
- **Backups**: 3 rotated files (`deploy.log.1`, `.2`, `.3`)
- **Total cap**: ~20 MB

All subprocess output (git pull, docker inspect, docker compose) is captured in the log.

## Manual Trigger

```bash
curl -X POST http://localhost:9877
```

## Files

| File | Purpose |
|------|---------|
| `deploy.py` | Webhook listener + deploy executor (single file) |
| `deploy.log` | Rotating deployment log |
| `CLAUDE.md` | Instructions for Claude Code |
