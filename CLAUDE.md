# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

Use **pnpm** (v10.32.1). Do not use npm or yarn.

## Commands

```bash
# Install all dependencies
pnpm install

# Build everything (in dependency order)
pnpm build

# Run server + CLI in parallel (development)
pnpm dev

# Run only the server (development, with hot reload)
pnpm dev:server

# Run only the CLI (development)
pnpm dev:cli

# Run all tests across all packages
pnpm test

# Run tests in a specific package
pnpm --filter @termchess/core test
pnpm --filter @termchess/server test
pnpm --filter @termchess/cli test

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Host a game
TERMCHESS_SERVER=ws://localhost:3001/ws node apps/cli/dist/bin.js host

# Join a game
TERMCHESS_SERVER=ws://localhost:3001/ws node apps/cli/dist/bin.js join ABC123
```

## Architecture

TermChess is a **pnpm monorepo** with four packages:

### Package dependency graph
```
apps/cli  ──────────────────────►  packages/protocol
apps/server  ──► packages/core  ──► packages/protocol
```

### `packages/protocol`
Shared WebSocket contracts. All message types as Zod schemas + discriminated unions. `ClientMessage` / `ServerMessage`. `parseClientMessage()` / `parseServerMessage()` for safe parsing. No chess logic here — pure contract.

### `packages/core`
Pure chess domain logic. No I/O, no transport.
- `ChessEngine` — thin abstraction over chess.js (no chess.js types leak out)
- `GameSession` — full game lifecycle (join, move, resign, draw offer/accept/decline, end detection)
- `GameRegistry` — in-memory store of active sessions, 6-char game codes via nanoid, TTL cleanup
- `DomainError` — typed domain errors with `DomainErrorCode`

### `apps/server`
Fastify + `@fastify/websocket` multiplayer server.
- `SessionManager` — bridges `GameRegistry` with live WebSocket connections
- `ws-handler.ts` — routes `ClientMessage` dispatch to `SessionManager` actions; server is authoritative for all game state
- Sessions are in-memory; cleaned up after 5 minutes of inactivity

### `apps/cli`
Ink (React for terminals) chess client.
- `useWebSocket` hook — manages WS lifecycle
- `useGameState` hook — state machine: `connecting → lobby → waiting → playing → finished → error`
- `App.tsx` — root orchestrator, routes all user input and server messages
- `Board.tsx` — FEN-based board rendering with colored squares, last-move highlight, check highlight
- Commands: `/help`, `/resign`, `/draw`, `/pgn`, `/quit`
- Move input: UCI format (`e2e4`, `e7e8q`) or SAN passthrough

## Key design decisions

- **Server is authoritative**: the CLI never validates moves locally; all validation happens server-side via `packages/core`
- **chess.js is encapsulated**: only `packages/core/src/chess-engine.ts` imports chess.js; all other code uses the `ChessEngine` interface
- **Zod everywhere**: all WebSocket messages are parsed with Zod schemas on both sides
- **No `any`**: strict TypeScript throughout; branded types for domain primitives (`GameId`, `PlayerId`, `Fen`, `UciMove`, etc.)

## Environment variables

- `PORT` — server port (default: 3001)
- `HOST` — server bind address (default: 0.0.0.0)
- `TERMCHESS_SERVER` — WebSocket URL for CLI (default: ws://localhost:3001/ws)
