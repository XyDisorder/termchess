# TermChess Roadmap

## v0.2 — Quality of life

Polishing the core multiplayer experience before adding new features.

- **Reconnection on disconnect**: add a session grace period (e.g. 60 seconds). If a player disconnects and reconnects within the window, the server restores their session instead of marking the game abandoned. The opponent sees a "reconnecting…" banner rather than an immediate game-over.
- **Flip board for Black perspective**: the board already supports a `perspective` prop; expose a `/flip` command so players can toggle orientation at will regardless of their color.
- **SAN input support**: accept Standard Algebraic Notation (`Nf3`, `O-O`, `exd5`) in addition to UCI. The server (or a client-side normaliser) converts SAN to UCI before submitting.
- **Draw by 50-move rule / threefold repetition display**: surface these draw claims explicitly in the UI. When chess.js detects them, show which rule triggered the draw in the result screen.
- **PGN save to file**: extend `/pgn` to accept an optional path argument (`/pgn save game.pgn`) that writes the PGN string to disk so players can import it into other tools.

## v0.3 — Features

Expanding what you can do with the game.

- **Local hotseat mode**: pass `--local` to run a game with no server, two players sharing one terminal, taking turns at the keyboard.
- **Game replay from PGN**: load a PGN file and step through moves with arrow keys (`←` / `→`) to review a past game move by move.
- **Clock / time controls**: add a `--time` flag when hosting (`--time 5+3` for 5-minute blitz with 3-second increment). The server tracks per-player time and broadcasts clock updates. A player who runs out of time loses.
- **Spectator mode**: allow additional connections to join a game as observers (`termchess spectate <code>`). Spectators receive all `game_state` broadcasts but cannot send moves.

## v0.4 — Engine

Playing against a computer opponent.

- **Bot interface**: define a `BotAdapter` interface that accepts a `GameSnapshot` and returns a UCI move. Any implementation satisfying this interface can be plugged in.
- **Stockfish integration via child process**: spawn a Stockfish binary as a child process, communicate over UCI protocol via stdin/stdout, surface as a `BotAdapter`.
- **Difficulty levels**: expose Stockfish skill levels (1–20) and search depth as CLI flags. Preset profiles: `--difficulty easy/medium/hard/max`.

## v1.0 — Production

Hardening for real deployment.

- **Persistent sessions (Redis or SQLite)**: serialise `GameSession` state to a store so sessions survive server restarts. Redis for high-throughput deployments; SQLite for single-node simplicity.
- **Authentication (SSH key based, dev-native)**: players authenticate with an SSH key pair. The server reads `~/.ssh/id_ed25519.pub` (or accepts a `--identity` flag) and issues a signed session token. No passwords, no browser OAuth — pure developer ergonomics.
- **Elo rating system**: maintain a per-player Elo rating. After each rated game the server updates both players' ratings using the standard K-factor formula. Ratings are displayed in the info panel during games.
- **Match history**: persist every completed game (PGN + result + ratings snapshot) to the store. Expose a `termchess history` command that lists recent games and a `termchess replay <game-id>` command to replay any of them.
