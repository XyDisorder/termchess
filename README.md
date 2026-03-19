<div align="center">

<!-- Replace with a real screenshot or GIF of the board in action -->
<img src="docs/screenshots/demo.gif" alt="TermChess demo" width="700" />

<br />

```
  ████████╗███████╗██████╗ ███╗   ███╗ ██████╗██╗  ██╗███████╗███████╗███████╗
     ██╔══╝██╔════╝██╔══██╗████╗ ████║██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝
     ██║   █████╗  ██████╔╝██╔████╔██║██║     ███████║█████╗  ███████╗███████╗
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║     ██╔══██║██╔══╝  ╚════██║╚════██║
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╗██║  ██║███████╗███████║███████║
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
```

**Chess in your terminal. No browser. No server to manage. Just play.**

<br />

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.32.1-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4?style=flat-square)](CONTRIBUTING.md)

</div>

---

## What is this?

TermChess is a fully-featured chess client that runs in your terminal. Pick a mode and start playing — no accounts, no browser, no setup beyond `pnpm install`.

| Mode | Description |
|---|---|
| **Solo** | Two players share one terminal. Pass-and-play. |
| **vs Engine** | Play against Stockfish. Three difficulty levels. |
| **Multiplayer** | Host a game and share an invite code. Works over local network or internet — the server starts automatically inside the CLI. |

---

## Install

**Requirements:** Node.js 20+, pnpm

```bash
git clone https://github.com/your-org/termchess.git
cd termchess
pnpm install && pnpm build
```

Then run:

```bash
node apps/cli/dist/bin.js
```

Or add an alias to your shell:

```bash
alias termchess="node /path/to/termchess/apps/cli/dist/bin.js"
```

---

## Modes

### Interactive menu

<div align="center">
<img src="docs/screenshots/menu.png" alt="Main menu" width="600" />
</div>

Just run `termchess` with no arguments. Navigate with arrow keys, press Enter.

```bash
termchess
```

---

### Solo — two players, one terminal

<div align="center">
<img src="docs/screenshots/solo.png" alt="Solo mode — two players sharing a terminal" width="600" />
</div>

Both players take turns on the same machine. The board flips perspective automatically.

```bash
termchess solo
```

---

### vs Engine — play against Stockfish

<div align="center">
<img src="docs/screenshots/engine.png" alt="Playing against the engine" width="600" />
</div>

Three difficulty levels: `easy`, `medium` (default), `hard`.

```bash
termchess engine           # medium
termchess engine easy
termchess engine hard
```

> Requires [Stockfish](https://stockfishchess.org/download/) to be installed and available on `$PATH`.

---

### Multiplayer — play over the internet or local network

<div align="center">
<img src="docs/screenshots/multiplayer-host.png" alt="Hosting a game — invite codes shown" width="600" />
</div>

The host starts a game. TermChess automatically spins up a WebSocket server and generates two invite codes — one for local network, one for internet (via an automatic tunnel, no account needed).

**Host:**
```bash
termchess
# → Multiplayer — Host a game
```

You'll see:

```
╭──────────────────────────────────────────────────────────╮
│  Share one of these invite codes:                        │
│                                                          │
│  Local network:  ABC123@ws://192.123.1.42:3001/ws        │
│  Internet:       ABC123@wss://hungry-cat.loca.lt/ws      │
│                                                          │
│  Opponent runs: termchess → Join → paste the code above  │
╰──────────────────────────────────────────────────────────╯
```

**Join (from anywhere):**
```bash
termchess
# → Multiplayer — Join a game
# → paste the invite code: ABC123@wss://hungry-cat.loca.lt/ws
```

<div align="center">
<img src="docs/screenshots/multiplayer-game.png" alt="Multiplayer game in progress" width="600" />
</div>

> **No port forwarding required.** The internet invite code tunnels through [localtunnel](https://github.com/localtunnel/localtunnel) automatically. For a permanent server, deploy `apps/server` anywhere and set `TERMCHESS_SERVER=ws://your-host:3001/ws`.

---

## Playing

### Entering moves

Moves use **UCI format**: origin square + destination square.

```
e2e4      → pawn to e4
g1f3      → knight to f3
e1g1      → kingside castle
e7e8q     → pawn promotes to queen
```

You can also use the **arrow keys + Space** to navigate the board and select squares visually.

### Commands

| Command | Description |
|---|---|
| `/resign` | Forfeit the game |
| `/draw` | Offer a draw (or accept the opponent's offer) |
| `/pgn` | Print game notation in the terminal |
| `/help` | Show all commands |
| `/quit` | Exit |

---

## Architecture

```
apps/cli  ──────────────────────►  packages/protocol
apps/server  ──► packages/core  ──► packages/protocol
```

| Package | Role |
|---|---|
| `packages/protocol` | Zod-validated WebSocket contracts. Shared branded types: `GameId`, `PlayerId`, `Fen`, `UciMove`, `GameSnapshot`. No chess logic. |
| `packages/core` | Pure chess domain. `ChessEngine` wraps chess.js (no leakage). `GameSession` handles the full lifecycle. `GameRegistry` stores active sessions. |
| `apps/server` | Fastify + `@fastify/websocket`. `SessionManager` bridges live WS connections to `GameRegistry`. Server is fully authoritative — the CLI never validates moves locally. |
| `apps/cli` | Ink (React for terminals). `useWebSocket` + `useGameState` drive a `connecting → lobby → waiting → playing → finished` state machine. When hosting, the server runs embedded inside the CLI process. |

See [docs/architecture.md](docs/architecture.md) for sequence diagrams and full design notes.

---

## Development

```bash
# Run server + CLI in parallel with hot reload
pnpm dev

# Run all tests
pnpm test

# Type-check everything
pnpm typecheck

# Build everything
pnpm build
```

---

## Roadmap

| Version | Theme | Highlights |
|---|---|---|
| v0.2 | Quality of life | Reconnection, SAN input, PGN save to file |
| v0.3 | Features | PGN replay, time controls, spectator mode |
| v1.0 | Production | Persistent sessions, Elo ratings, match history |

See [docs/roadmap.md](docs/roadmap.md) for the full plan.

---

## Contributing

1. Fork + feature branch
2. `pnpm install && pnpm build`
3. `pnpm test && pnpm typecheck` must pass
4. Open a PR

Strict TypeScript throughout — no `any`, branded domain types, Zod on all external boundaries.

---

<div align="center">
<sub>Built with <a href="https://github.com/vadimdemedes/ink">Ink</a>, <a href="https://github.com/jhlywa/chess.js">chess.js</a>, <a href="https://fastify.dev">Fastify</a>, and too much coffee.</sub>
</div>
