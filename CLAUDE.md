# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

Use **pnpm** (v10.32.1). Do not use npm or yarn.

```bash
pnpm install          # install dependencies
pnpm -r <script>      # run a script across all workspaces
pnpm --filter <pkg> <script>  # run a script in a specific workspace
```

## Architecture

This is a **pnpm monorepo** for a terminal chess application, structured as:

- `apps/cli/` — terminal/CLI chess client
- `apps/server/` — server component
- `packages/core/` — shared chess logic
- `packages/protocol/` — shared types and protocol definitions

The `packages/` directory contains internal libraries consumed by `apps/`. The `protocol` package is intended for types shared between client and server.

## TypeScript

A shared `tsconfig.base.json` at the root is intended to be extended by each workspace package.
