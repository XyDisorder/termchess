# TermChess

**Chess in your terminal.** No browser, no account, no nonsense — just open a tab and play.


![Capture de l'interface TermChess](../img/Capture%20d%E2%80%99e%CC%81cran%202026-03-19%20a%CC%80%2022.46.18.png)


## Features

- **vs Stockfish** — play against the engine at easy / medium / hard
- **vs a friend** — host a game and share a 6-character code; works on local network or over the internet via tunnel
- **Interactive board** — navigate with arrow keys and Space, or type moves in UCI / SAN notation
- **Full game flow** — draw offers, resign, check/checkmate detection, stalemate, PGN export
- Classic green & cream board colors, highlighted last move, red king on check

## Requirements

- Node.js ≥ 20

For engine mode, Stockfish must be installed separately:

```bash
# macOS
brew install stockfish

# Ubuntu / Debian
sudo apt install stockfish
```

## Install

```bash
npm install -g termchess
```

## Usage

### Interactive menu (recommended)

```bash
termchess
```

Launches a menu where you pick your mode with arrow keys.

---

### vs Stockfish engine

```bash
termchess engine           # medium difficulty (default)
termchess engine easy
termchess engine medium
termchess engine hard
```

You play White. The engine responds instantly. Skill levels map to Stockfish skill 1 / 10 / 20.

---

### Multiplayer — host a game

```bash
termchess host
```

Starts an embedded server and waits for an opponent. You'll see two invite codes:

```
╭──────────────────────────────────────────────────╮
│  Share one of these invite codes:                │
│                                                  │
│  Local network:  ABC123@ws://192.168.1.10:3001/ws│
│  Internet:       ABC123@wss://xyz.loca.lt/ws     │
╰──────────────────────────────────────────────────╯

  Opponent runs: termchess → Join → paste the code above
```

The **Internet** link works across any network via an automatic tunnel — no port forwarding needed.

---

### Multiplayer — join a game

```bash
termchess join ABC123@wss://xyz.loca.lt/ws   # from anywhere on the internet
termchess join ABC123@ws://192.168.1.10:3001/ws  # local network
termchess join ABC123   # if you run your own server (see TERMCHESS_SERVER)
```

---

## Moving pieces

Two ways to move:

| Method | How |
|--------|-----|
| **Keyboard** | Arrow keys to move the cursor, `Space` or `Enter` to select a piece, then navigate to destination and `Space`/`Enter` again |
| **Type** | Type the move in UCI format (`e2e4`, `e7e8q` for promotion) or SAN (`Nf3`, `O-O`) |

---

## In-game commands

| Command | Action |
|---------|--------|
| `/help` | Show available commands |
| `/resign` | Resign the game |
| `/draw` | Offer a draw (or accept an incoming draw offer) |
| `/pgn` | Export the game in PGN format |
| `/quit` | Exit |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMCHESS_SERVER` | `ws://localhost:3001/ws` | WebSocket URL used by `join` when no `@url` is in the code |

---

## License

MIT
