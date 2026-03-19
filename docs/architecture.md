# TermChess Architecture

## Overview

TermChess is a terminal-native multiplayer chess game built as a pnpm monorepo. Players connect over WebSockets: one player hosts a game and shares a 6-character code, the other joins using that code. All game logic runs on the server; the CLI is a pure display and input layer.

```
┌─────────────┐    WebSocket     ┌─────────────────────┐    WebSocket     ┌─────────────┐
│  Host CLI   │◄────────────────►│   Fastify Server    │◄────────────────►│  Guest CLI  │
│ (Ink/React) │                  │  (ws-handler.ts)    │                  │ (Ink/React) │
└─────────────┘                  │  (session-manager)  │                  └─────────────┘
                                 │  (game-registry)    │
                                 │  (game-session)     │
                                 └─────────────────────┘
```

## Package Responsibilities and Boundaries

### Package dependency graph

```
apps/cli  ──────────────────────────►  packages/protocol
apps/server  ──► packages/core  ──►   packages/protocol
```

### `packages/protocol` — shared contract

The only package both `apps/cli` and `apps/server` share. Contains:

- **Branded types**: `GameId`, `PlayerId`, `GameCode`, `Fen`, `Pgn`, `UciMove` — nominal types built on `string` that prevent accidental mixing of identifiers.
- **Domain enums**: `GameStatus`, `PlayerColor`, `DrawReason`.
- **`GameSnapshot`**: the canonical read model sent to clients — a plain serialisable object representing the full visible state of a game.
- **Zod schemas** for every `ClientMessage` and `ServerMessage` variant, plus `parseClientMessage()` / `parseServerMessage()` helpers.

No chess logic lives here. The protocol package is a pure contract definition.

### `packages/core` — chess domain logic

Pure TypeScript with no I/O or transport. Depends only on `packages/protocol` and `chess.js`.

- **`ChessEngine`** (`chess-engine.ts`): thin interface over chess.js. Exposes `applyMove(uci)`, `getState()`, `exportPgn()`. No chess.js types leak beyond this file.
- **`GameSession`** (`game-session.ts`): owns the full lifecycle of a single game. Enforces turn order, validates player identity, detects end conditions (checkmate, stalemate, draw by insufficient material / repetition / 50-move rule), handles resign and draw offer/accept/decline. Builds `GameSnapshot` on demand.
- **`GameRegistry`** (`game-registry.ts`): in-memory store of active sessions. Generates unique 6-character codes (nanoid, uppercase alphanumeric), provides lookups by id / code / player, and exposes a `cleanup(ttlMs)` method for TTL-based eviction.
- **`DomainError` / `DomainErrorCode`**: typed error class used throughout core; caught and mapped to protocol-level error messages in the server layer.

### `apps/server` — multiplayer server

Fastify with `@fastify/websocket`. Depends on `packages/core` and `packages/protocol`.

- **`SessionManager`** (`session-manager.ts`): bridges the pure `GameRegistry` (which knows nothing about WebSockets) with live connections. Maintains a `connections` map (`PlayerId → PlayerConnection`), routes JSON payloads to the right socket(s), and runs periodic cleanup.
- **`ws-handler.ts`**: receives raw WebSocket frames, parses them with `parseClientMessage()`, and dispatches to `SessionManager`. Handles serialisation back to clients. Server is fully authoritative — no game logic in the handler, it delegates entirely to `core`.
- **`server.ts`**: wires Fastify, the WebSocket plugin, the health endpoint, and starts the cleanup timer.

### `apps/cli` — terminal client

Ink (React for terminals). Depends only on `packages/protocol`.

- **`useWebSocket`** hook: manages the WebSocket lifecycle (`connecting`, `connected`, `disconnected`, `error`), exposes `send()` and `lastMessage`.
- **`useGameState`** hook: implements the client-side state machine and message builders.
- **`App.tsx`**: root orchestrator. Reads phase and renders the appropriate screen; routes user text input to commands or moves.
- **`Board.tsx`**: FEN-based board renderer. Supports white/black perspective flip, last-move highlighting (yellow), and check highlighting (red).
- **`InfoPanel.tsx`**, **`MoveInput.tsx`**, **`StatusBar.tsx`**: supporting UI components.

## WebSocket Message Flow

### Full game sequence

```
Host CLI          Server              Guest CLI
    |                |                    |
    |--create_game-->|                    |
    |<-game_created--|                    |
    |  (waiting)     |                    |
    |                |<---join_game-------|
    |                |----game_joined---->|
    |<-opponent_connected                 |
    |<-game_state----|----game_state----->|
    |  (both playing)|                    |
    |--make_move---->|                    |
    |                |----game_state----->|
    |<-game_state----|                    |
    |     ...        |        ...         |
    |--resign------->|                    |
    |<-game_finished-|---game_finished--->|
```

### Draw offer sequence

```
White CLI         Server              Black CLI
    |                |                    |
    |--offer_draw--->|                    |
    |<-game_state----|----draw_offered--->|
    |                |<---accept_draw-----|
    |<-game_finished-|---game_finished--->|
```

### Message types

**Client → Server**

| Type | Payload | Description |
|---|---|---|
| `create_game` | — | Host a new game |
| `join_game` | `gameCode` | Join by 6-char code |
| `make_move` | `uci` | UCI move string (e.g. `e2e4`, `e7e8q`) |
| `resign` | — | Forfeit the game |
| `offer_draw` | — | Propose a draw |
| `accept_draw` | — | Accept opponent's draw offer |
| `decline_draw` | — | Decline opponent's draw offer |
| `request_pgn` | — | Request full PGN export |
| `ping` | — | Keep-alive |

**Server → Client**

| Type | Payload | Description |
|---|---|---|
| `game_created` | `gameId`, `gameCode`, `playerColor`, `snapshot` | Sent to host after creation |
| `game_joined` | `gameId`, `playerColor`, `snapshot` | Sent to joining player |
| `opponent_connected` | `snapshot` | Sent to host when guest joins |
| `game_state` | `snapshot` | Broadcast after any move or state change |
| `game_finished` | `snapshot` | Broadcast when game ends |
| `game_error` | `code`, `message` | Error response to the requesting player |
| `opponent_disconnected` | — | Sent to remaining player on disconnect |
| `draw_offered` | `by` | Forwarded to opponent |
| `draw_declined` | — | Forwarded to offering player |
| `pgn_response` | `pgn` | PGN string, sent only to requester |
| `pong` | — | Keep-alive response |

## Game Session Lifecycle

### State machine

```
                  ┌─────────────────────┐
                  │  WaitingForOpponent  │◄── create_game
                  └──────────┬──────────┘
                             │ join_game
                             ▼
                       ┌──────────┐
                       │  Active  │
                       └────┬─────┘
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
      ┌──────────┐   ┌───────────┐   ┌───────────┐
      │Checkmate │   │ Stalemate │   │   Draw    │
      └──────────┘   └───────────┘   └───────────┘
           ▲                                 ▲
           │                                 │
      ┌──────────┐                    ┌──────────────┐
      │ Resigned │                    │  Agreement   │
      └──────────┘                    └──────────────┘
                     ┌───────────┐
                     │ Abandoned │◄── TTL expiry
                     └───────────┘
```

### Draw reasons

A `Draw` status can arise from:
- `agreement` — both players accepted a draw offer
- `stalemate` — no legal moves, king not in check
- `insufficient_material` — neither side has mating material
- `repetition` — threefold repetition (detected by chess.js)
- `fifty_moves` — 50-move rule (detected by chess.js)

## In-Memory Session Management and Cleanup

Sessions are stored entirely in RAM with no external dependencies.

**`GameRegistry`** maintains three `Map` structures:
- `byId: Map<GameId, GameSession>` — primary store
- `byCode: Map<GameCode, GameSession>` — for join lookups
- `byPlayer: Map<PlayerId, GameSession>` — for per-player routing

**`SessionManager`** adds a fourth:
- `connections: Map<PlayerId, PlayerConnection>` — live WebSocket handles

**TTL cleanup**: `SessionManager.startCleanup(intervalMs = 300_000)` runs every 5 minutes and evicts sessions whose `lastActivityAt` is older than 10 minutes (two intervals). The timer is unref'd so it does not prevent Node.js from exiting cleanly in tests.

`lastActivityAt` is updated on every mutation: join, move, resign, draw action, abandon.

## Key Design Decisions and Trade-offs

### Server is authoritative

The CLI never validates moves locally. Input is sent to the server as-is; the server's `GameSession` validates through chess.js and returns either a new `GameSnapshot` or a `game_error`. This keeps the client simple and prevents desync, at the cost of slightly higher latency per move (acceptable for a human-speed game over a local or low-latency network).

### chess.js encapsulation

Only `packages/core/src/chess-engine.ts` imports chess.js. The `ChessEngine` interface exposes `applyMove`, `getState`, and `exportPgn` — nothing chess.js-specific leaks out. This makes it straightforward to swap the engine (e.g. for a WASM Stockfish wrapper) without touching any other code.

### Zod on both sides

The server parses every incoming frame with `parseClientMessage()`. The CLI parses every incoming frame with `parseServerMessage()`. Invalid messages are rejected at the boundary with a structured error; they never reach business logic. This eliminates an entire class of runtime crashes from protocol drift.

### Branded types

`GameId`, `PlayerId`, `GameCode`, `UciMove`, etc. are string intersections with a phantom brand. TypeScript treats them as distinct types at compile time, catching accidental misuse (e.g. passing a `GameCode` where a `GameId` is expected) without any runtime overhead.

### No `any`

`tsconfig.base.json` enables `strict: true` across all packages. The codebase contains no `any` escapes.

### Plain-object serialisation

`ws-handler.ts` builds plain `Record<string, unknown>` objects and calls `JSON.stringify` rather than constructing typed `ServerMessage` values. This sidesteps a readonly-array incompatibility between `GameSnapshot` (which uses `readonly string[]` for captured pieces and `readonly MoveHistoryEntry[]` for move history) and the mutable-array Zod-inferred types, without sacrificing runtime correctness.

## MVP Limitations and What Would Change in Production

| Limitation | MVP behaviour | Production approach |
|---|---|---|
| Session storage | In-memory, lost on restart | Redis or SQLite with session serialisation |
| No reconnection | Disconnect = permanent loss | Grace period: hold session for N seconds, allow reconnect by `gameId` + `playerId` |
| No authentication | Any connection gets a random `PlayerId` | SSH key auth (developer-native), or token-based auth |
| Single server | No horizontal scaling | Sticky sessions + Redis pub/sub for cross-node broadcast |
| No time controls | Untimed games only | Server-side clock per player, `clock_update` message type |
| No engine | Human vs human only | UCI engine adapter + child process Stockfish |
| No rating | No Elo or match history | Persistent player table with Elo calculation after each rated game |
| PGN stays in memory | `/pgn` prints to terminal | `/pgn save <file>` writes to disk; server stores game archive |
