# TermChess

**Chess in your terminal. For developers.**

![version](https://img.shields.io/badge/version-1.0.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![pnpm](https://img.shields.io/badge/pnpm-10.32.1-orange)

```
  a b c d e f g h
8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜ 8
7 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟ 7
6 · · · · · · · · 6
5 · · · · · · · · 5
4 · · · · ♙ · · · 4
3 · · · · · · · · 3
2 ♙ ♙ ♙ ♙ · ♙ ♙ ♙ 2
1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖ 1
  a b c d e f g h
```

---

## Features

- **Real-time multiplayer** over WebSockets — one player hosts, the other joins with a 6-character code
- **Full chess rules** via chess.js — legal move validation, check, checkmate, stalemate, draws by insufficient material / repetition / 50-move rule
- **Resign and draw offers** — `/resign` to forfeit, `/draw` to offer or accept a draw
- **Board perspective flip** — the board renders from your color's perspective automatically
- **Last-move and check highlighting** — yellow for the previous move, red for a king in check
- **PGN export** — `/pgn` to view the full game notation in-terminal
- **Strict TypeScript throughout** — branded domain types, Zod-validated WebSocket messages on both sides, no `any`

---

## Requirements

- **Node.js 20+**
- **pnpm 10.32.1** — install with `npm install -g pnpm@10.32.1`

---

## Quick start

### 1. Install dependencies

```bash
git clone https://github.com/your-org/termchess.git
cd termchess
pnpm install
```

### 2. Build everything

```bash
pnpm build
```

This builds packages in dependency order: `protocol` → `core` → `server` → `cli`.

### 3. Start the server

```bash
pnpm server
# or
node apps/server/dist/index.js
```

The server starts on `http://localhost:3001`. WebSocket endpoint: `ws://localhost:3001/ws`. Health check: `http://localhost:3001/health`.

### 4. Host a game

In a new terminal:

```bash
pnpm cli host
# or
TERMCHESS_SERVER=ws://localhost:3001/ws node apps/cli/dist/bin.js host
```

The CLI connects, creates a game, and displays a **6-character game code** (e.g. `ABC123`). Share it with your opponent.

### 5. Join a game

In another terminal (or on another machine pointing at the same server):

```bash
pnpm cli join ABC123
# or
TERMCHESS_SERVER=ws://localhost:3001/ws node apps/cli/dist/bin.js join ABC123
```

Both terminals transition to the game board. White moves first.

---

## Playing a game

### Entering moves

Moves are entered in **UCI format**: origin square followed by destination square.

```
e2e4      # pawn to e4
g1f3      # knight to f3
e1g1      # king-side castle
e7e8q     # pawn promotes to queen
```

Press **Enter** to submit. The server validates the move; illegal moves return an error message without advancing the game.

### Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/resign` | Forfeit the current game |
| `/draw` | Offer a draw (or accept if opponent has offered) |
| `/pgn` | Print the game PGN to the terminal |
| `/quit` | Exit the program |

The move input field shows `opponent's turn...` when it is not your move. Commands still work during the opponent's turn.

---

## Architecture

TermChess is a **pnpm monorepo** with four packages:

```
apps/cli  ──────────────────────►  packages/protocol
apps/server  ──► packages/core  ──► packages/protocol
```

- **`packages/protocol`** — Zod-validated WebSocket message contracts, shared branded types (`GameId`, `PlayerId`, `Fen`, `UciMove`, …), `GameSnapshot` read model
- **`packages/core`** — pure chess domain logic: `GameSession`, `GameRegistry`, `ChessEngine` (chess.js encapsulated behind an interface), `DomainError`
- **`apps/server`** — Fastify + `@fastify/websocket`; `SessionManager` bridges live connections to `GameRegistry`; server is fully authoritative for all game state
- **`apps/cli`** — Ink (React for terminals); `useWebSocket` + `useGameState` hooks drive a `connecting → lobby → waiting → playing → finished` state machine

See [docs/architecture.md](docs/architecture.md) for the full design document including sequence diagrams, state machine, and design decisions.

---

## Development

### Run in development mode (hot reload)

```bash
# Server + CLI in parallel
pnpm dev

# Server only
pnpm dev:server

# CLI only
pnpm dev:cli
```

### Run all tests

```bash
pnpm test
```

### Run tests for a specific package

```bash
pnpm --filter @termchess/core test
pnpm --filter @termchess/server test
pnpm --filter @termchess/cli test
```

### Type-check everything

```bash
pnpm typecheck
```

### Clean build artifacts

```bash
pnpm clean
```

---

## MVP limitations

- **In-memory sessions only** — sessions are lost if the server restarts; no persistence
- **No reconnection** — if a player disconnects, the game is effectively over (the opponent is notified but the session cannot be resumed)
- **No authentication** — any WebSocket connection gets a random player ID; there is no identity verification
- **No time controls** — games are untimed
- **No engine** — human vs human only; no bot opponent
- **Single server** — not designed for horizontal scaling

---

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the full plan.

| Version | Theme | Highlights |
|---|---|---|
| v0.2 | Quality of life | Reconnection, SAN input, PGN save to file |
| v0.3 | Features | Hotseat mode, PGN replay, time controls, spectators |
| v0.4 | Engine | Stockfish integration, difficulty levels |
| v1.0 | Production | Persistent sessions, SSH key auth, Elo ratings, match history |

---

## Contributing

1. Fork the repo and create a feature branch
2. `pnpm install && pnpm build` to verify the setup
3. Make changes, add tests, ensure `pnpm test` and `pnpm typecheck` pass
4. Open a pull request

All packages use strict TypeScript (`strict: true`, no `any`). New code should follow the same conventions.
