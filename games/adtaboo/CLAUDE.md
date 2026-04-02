# Adtaboo (Adversarial Taboo)

## Design Principles

### Same name + same room = same person
A player is identified by their name within a room. If a second connection joins with the same name (or matching sessionId), it takes over the existing player slot. The first connection receives `session:taken-over` and is force-disconnected. The first client clears its session to prevent an auto-rejoin loop.

### Session Takeover Flow
1. Device B joins with same name/sessionId as device A
2. Server emits `session:taken-over` to device A's socket
3. Server force-disconnects device A (`socket.disconnect(true)`)
4. Server updates player's socketId to device B
5. Device A clears localStorage session + resets store + shows error
6. Device A does NOT auto-rejoin (session cleared before Socket.IO reconnect fires)

## Connection Architecture

### Grace Period
- **Server**: 120s (`RECONNECT_GRACE_MS` in `connectionHandlers.ts`). After disconnect, player is soft-removed after this timeout.
- **Client**: 130s timeout. If reconnect succeeds after 130s, client proactively resets (server has likely already removed the player).

### Soft-Removal
During an active game, `removePlayer()` sets `connected=false, removed=true` but keeps the player in the room's player map. This preserves game state (scores, team assignments). After the game ends or room resets, soft-removed players are cleaned up.

### Taboo Master Auto-Reassignment
- On disconnect: `ensureTabooMaster(team)` reassigns TM to another connected player.
- On reconnect: `onPlayerReconnect` callback re-evaluates TM (reconnecting player may reclaim the role).
- Fallback: if ALL team members disconnect, `ensureTabooMaster` falls back to any non-removed player (even disconnected) to preserve the slot.

## Game Phases & Disconnection Behavior

| Phase | Clue-giver disconnects | Taboo master disconnects | Other player disconnects |
|---|---|---|---|
| PARALLEL_SETUP | Clue-giver slot cleared, team must pick a new one | TM reassigned | No game effect |
| CLUING_A/B | Turn auto-ends via `handleTurnEnd()` | TM reassigned, new TM can buzz | No game effect |
| ROUND_RESULT | No effect | No effect | No effect |
| GAME_OVER | No effect | No effect | No effect |

### Phase Guard on `endCluing()`
`endCluing()` returns `null` if the phase is not `CLUING_A` or `CLUING_B`. This guards against double-call from concurrent sources (timer expiry, `clue:end-turn` event, clue-giver disconnect). Callers (`handleTurnEnd`) check for `null` and bail.

## Commands

```bash
# Run server + client dev
pnpm run dev:adtaboo

# Tests
cd games/adtaboo/server && npx vitest run

# Single test
cd games/adtaboo/server && npx vitest run src/AdtabooRoom.test.ts
```
