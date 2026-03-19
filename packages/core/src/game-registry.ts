import { customAlphabet } from 'nanoid';
import {
  type GameId,
  type GameCode,
  type PlayerId,
} from '@termchess/protocol';
import { GameSession } from './game-session.js';

// ---------------------------------------------------------------------------
// Game code generation
// ---------------------------------------------------------------------------

/** 6-character uppercase alphanumeric code, easy to type and share. */
const generateCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

/** Generate a nanoid-based unique game ID. */
const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

// ---------------------------------------------------------------------------
// GameRegistry
// ---------------------------------------------------------------------------

export class GameRegistry {
  private readonly byId = new Map<GameId, GameSession>();
  private readonly byCode = new Map<GameCode, GameSession>();
  private readonly byPlayer = new Map<PlayerId, GameSession>();

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  createGame(hostPlayerId: PlayerId): GameSession {
    const gameId = generateId() as GameId;
    const gameCode = this.generateUniqueCode();

    const session = new GameSession(gameId, gameCode, hostPlayerId);

    this.byId.set(gameId, session);
    this.byCode.set(gameCode, session);
    this.byPlayer.set(hostPlayerId, session);

    return session;
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  findByCode(code: GameCode): GameSession | undefined {
    return this.byCode.get(code);
  }

  findById(id: GameId): GameSession | undefined {
    return this.byId.get(id);
  }

  findByPlayer(playerId: PlayerId): GameSession | undefined {
    return this.byPlayer.get(playerId);
  }

  // -------------------------------------------------------------------------
  // Mutate
  // -------------------------------------------------------------------------

  /**
   * Register a player-to-session mapping after they join an existing session.
   * Call this after session.joinGame() succeeds.
   */
  registerPlayer(playerId: PlayerId, session: GameSession): void {
    this.byPlayer.set(playerId, session);
  }

  removeGame(gameId: GameId): void {
    const session = this.byId.get(gameId);
    if (session === undefined) return;

    this.byId.delete(gameId);
    this.byCode.delete(session.gameCode);

    // Remove all player mappings pointing to this session
    for (const [playerId, s] of this.byPlayer.entries()) {
      if (s.gameId === gameId) {
        this.byPlayer.delete(playerId);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Remove sessions whose lastActivityAt is older than ttlMs milliseconds.
   * Returns the number of sessions removed.
   */
  cleanup(ttlMs: number): number {
    const now = Date.now();
    const expiredIds: GameId[] = [];

    for (const [gameId, session] of this.byId.entries()) {
      if (now - session.lastActivityAt > ttlMs) {
        expiredIds.push(gameId);
      }
    }

    for (const gameId of expiredIds) {
      this.removeGame(gameId);
    }

    return expiredIds.length;
  }

  // -------------------------------------------------------------------------
  // Stats (useful for testing and observability)
  // -------------------------------------------------------------------------

  get size(): number {
    return this.byId.size;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private generateUniqueCode(): GameCode {
    let code: GameCode;
    let attempts = 0;
    do {
      code = generateCode() as GameCode;
      attempts++;
      if (attempts > 1000) {
        throw new Error('Unable to generate a unique game code after 1000 attempts.');
      }
    } while (this.byCode.has(code));
    return code;
  }
}
