#!/usr/bin/env bash
set -euo pipefail

# Start a game's dev server + client on custom ports.
# Usage: ./scripts/dev-server.sh <game> [client-port]
#
# Examples:
#   ./scripts/dev-server.sh adtaboo 5174
#   ./scripts/dev-server.sh cave 5175
#   ./scripts/dev-server.sh charades
#
# The server gets a free port automatically. The client proxies to it.
# Room/metrics data is stored in /tmp to avoid conflicts with Docker.

GAME="${1:?Usage: $0 <game> [client-port]}"
CLIENT_PORT="${2:-5174}"

# Map short names to directories and env vars
case "$GAME" in
  adtaboo)
    SERVER_DIR="games/adtaboo/server"
    CLIENT_DIR="games/adtaboo/client"
    PORT_ENV_VAR="ADTABOO_SERVER_PORT"
    ;;
  cave|odes)
    SERVER_DIR="games/odes-for-cave-men/server"
    CLIENT_DIR="games/odes-for-cave-men/client"
    PORT_ENV_VAR="CAVE_SERVER_PORT"
    ;;
  charades)
    SERVER_DIR="games/charades/server"
    CLIENT_DIR="games/charades/client"
    PORT_ENV_VAR="CHARADES_SERVER_PORT"
    ;;
  *)
    echo "Unknown game: $GAME"
    echo "Available: adtaboo, cave (odes), charades"
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')

echo "Starting $GAME dev server..."
echo "  Server: port $SERVER_PORT"
echo "  Client: port $CLIENT_PORT (proxying to $SERVER_PORT)"
echo "  Data:   /tmp/${GAME}-rooms.json, /tmp/${GAME}-metrics.json"
echo ""

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $SERVER_PID $CLIENT_PID 2>/dev/null || true
  wait $SERVER_PID $CLIENT_PID 2>/dev/null || true
}
trap cleanup EXIT

# Start server
cd "$ROOT/$SERVER_DIR"
PORT=$SERVER_PORT \
ROOMS_PATH="/tmp/${GAME}-rooms.json" \
METRICS_PATH="/tmp/${GAME}-metrics.json" \
  npx tsx src/index.ts &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  if nc -z localhost "$SERVER_PORT" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

# Start client
cd "$ROOT/$CLIENT_DIR"
export VITE_PORT=$CLIENT_PORT
export "$PORT_ENV_VAR=$SERVER_PORT"
npx vite --port "$CLIENT_PORT" --strictPort &
CLIENT_PID=$!

echo ""
echo "Ready! Open http://localhost:$CLIENT_PORT"
echo "Press Ctrl+C to stop."

wait
