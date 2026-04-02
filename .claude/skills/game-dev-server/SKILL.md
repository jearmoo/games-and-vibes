---
name: game-dev-server
description: Use this skill to start a game's dev server on a custom port for local testing, manual testing with Chrome DevTools, or development. Trigger when the user asks to run a game locally, start a dev server, or make a game accessible on a specific port.
---

# Game Dev Server

Start a game's development server (backend + frontend) on custom ports for local testing.

## Quick Start

```bash
# Start adtaboo on port 5174
./scripts/dev-server.sh adtaboo 5174

# Start odes on port 5175
./scripts/dev-server.sh cave 5175

# Start charades (default port 5174)
./scripts/dev-server.sh charades
```

The script automatically:
- Finds a free port for the game server (backend)
- Starts the Vite client on the specified port (frontend)
- Configures the client to proxy Socket.IO to the server
- Uses `/tmp/` for room/metrics data (avoids Docker volume conflicts)
- Cleans up both processes on Ctrl+C

## Manual Setup

If the script doesn't work or you need more control:

```bash
# Terminal 1: Server
cd games/adtaboo/server
PORT=4042 ROOMS_PATH=/tmp/adtaboo-rooms.json METRICS_PATH=/tmp/adtaboo-metrics.json npx tsx src/index.ts

# Terminal 2: Client (proxy to server port)
cd games/adtaboo/client
VITE_PORT=5174 ADTABOO_SERVER_PORT=4042 npx vite --port 5174 --strictPort
```

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `PORT` | Server (`createGameServer`) | Backend listen port |
| `ROOMS_PATH` | Server (`JsonFileStore`) | Room state file path |
| `METRICS_PATH` | Server (`JsonFileStore`) | Metrics file path |
| `VITE_PORT` | Client (Vite) | Frontend dev server port |
| `ADTABOO_SERVER_PORT` | Adtaboo client | Socket.IO proxy target |
| `CAVE_SERVER_PORT` | Odes client | Socket.IO proxy target |
| `CHARADES_SERVER_PORT` | Charades client | Socket.IO proxy target |

## Port Conflicts

The default Docker Compose setup uses ports 4040 (adtaboo), 4050 (charades), 4060 (odes), 5173 (landing). If Docker is running, use different ports for dev servers.

Common free ports: 4042-4049, 5174-5180.

## Testing with Chrome DevTools MCP

After starting the dev server, use the Chrome DevTools MCP tools to navigate to `http://localhost:<port>` and interact with the game. Use isolated browser contexts for multiple players:

```
new_page url=http://localhost:5174 isolatedContext=player1
new_page url=http://localhost:5174 isolatedContext=player2
```
