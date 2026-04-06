# Disconnect & Reconnect Principles

These principles govern how all games handle connection loss. They apply to both the shared `server-core`/`client-core` infrastructure and game-specific logic.

## Principles

### 1. Disconnects are temporary

A disconnected player can always rejoin by refreshing or reopening the page. Same name + same room = same person (session matched by UUID first, name as fallback). Only an explicit host kick permanently removes a player.

### 2. Don't alarm other players

No grayed-out names, no "offline" labels, no opacity dimming. Disconnects happen constantly on phones (screen lock, app switch, bad wifi). Broadcasting disconnection creates unnecessary anxiety.

**Exception:** A softened role-specific message is shown when someone with an active blocking responsibility is disconnected. For example, "Waiting for Alice..." on the cluing screen — this explains why the game appears paused without dramatizing the disconnection.

### 3. Roles fully preserved on reconnect

Cluer comes back as cluer, Taboo Master comes back as TM, team assignments are preserved, scores and timer state are restored. The reconnecting player should see the game exactly where they left it.

### 4. Timers never pause for disconnects

If a cluer disconnects mid-turn, the timer keeps running. This prevents griefing (disconnect to stall) and keeps the game moving. When the timer expires, the turn ends normally regardless of connection state.

### 5. The game is never stuck

If someone with a blocking role disconnects, a fallback actor can proceed:

- **Host auto-reassignment:** Immediate, to first connected player.
- **Review fallback:** Host can lock in and adjust cards if the reviewer (cluer) is disconnected.
- **Turn start fallback:** Host can start the turn if the cluer is disconnected during the ready phase.
- **TM reassignment (adtaboo):** Auto-reassigned to a connected teammate.

### 6. Only kick triggers role reassignment

Disconnect alone never changes anyone's role — it's assumed temporary. When the host kicks a player who holds a role:

- **Kicked clue-giver:** Slot cleared, team must pick a new one (adtaboo setup). New cluer auto-picked (odes).
- **Kicked Taboo Master (adtaboo):** Reassigned to a connected teammate via `ensureTabooMaster()`.
- **Kicked host:** Reassigned to first connected player.

### 7. Session takeover is clean

If someone rejoins from a new device or tab, the old connection is force-disconnected with a `session:taken-over` event. The old client clears its localStorage session to prevent auto-rejoin loops. No duplicate players ever exist.

---

## Phase x Role Behavior

### Adtaboo

| Phase | Clue-Giver Disconnects | Taboo Master Disconnects | Other Player | Host |
|---|---|---|---|---|
| LOBBY | No game impact | No game impact | No game impact | Auto-reassigned |
| PARALLEL_SETUP | CG slot cleared, team picks new | TM reassigned to teammate | Soft-removed | Auto-reassigned |
| CLUING_A/B | Timer continues, can rejoin | TM reassigned, can buzz if rejoins | Soft-removed | Auto-reassigned |
| REVIEW_A/B | Host can lock in as fallback | Soft-removed | Soft-removed | Auto-reassigned |
| ROUND_RESULT | Soft-removed | Soft-removed | Soft-removed | Auto-reassigned |
| GAME_OVER | No game impact | No game impact | No game impact | Auto-reassigned |

### Odes for Cave Men

| Phase | Cluer Disconnects | Other Player | Host |
|---|---|---|---|
| LOBBY | No game impact | No game impact | Auto-reassigned |
| READY | Host can start turn as fallback | Soft-removed | Auto-reassigned |
| PLAYING | Timer continues, can rejoin | Soft-removed | Auto-reassigned |
| REVIEW | Host can lock in as fallback | Soft-removed | Auto-reassigned |
| ROUND_RESULT | Soft-removed | Soft-removed | Auto-reassigned |
| GAME_OVER | No game impact | No game impact | Auto-reassigned |

### Odes Comp (Pass-the-Phone) Mode

Single-device, no server. State persisted to localStorage via zustand `persist`. Page refresh during a turn resumes the timer with remaining time (or transitions to review if expired).

---

## Implementation Notes

- **Grace period:** No per-player grace period timer. Players remain soft-removed (`connected: false, removed: true`) until they rejoin, the room resets, or the room is cleaned up after 30 minutes of inactivity.
- **Reconnect timeout (client):** 130 seconds. After this, the client clears its session and stops auto-reconnecting. The player can still manually rejoin by navigating to the room URL.
- **Room persistence:** Rooms are saved to disk every 60 seconds. On server restart, all players are restored as `connected: false` and timers are resumed with remaining time.
