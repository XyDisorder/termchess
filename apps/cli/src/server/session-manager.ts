import { GameRegistry, GameSession, DomainError, DomainErrorCode } from '@termchess/core';
import type { GameCode, PlayerId, GameId } from '@termchess/protocol';
import type { PlayerConnection } from './types.js';

export class SessionManager {
  private readonly registry = new GameRegistry();
  private readonly connections = new Map<PlayerId, PlayerConnection>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  registerConnection(ws: { send: (data: string) => void; close: () => void }): PlayerId {
    const playerId = crypto.randomUUID() as PlayerId;
    const connection: PlayerConnection = {
      playerId,
      ws,
      gameId: null,
      connectedAt: new Date(),
    };
    this.connections.set(playerId, connection);
    return playerId;
  }

  removeConnection(playerId: PlayerId): void {
    this.connections.delete(playerId);
  }

  getConnection(playerId: PlayerId): PlayerConnection | undefined {
    return this.connections.get(playerId);
  }

  createGame(playerId: PlayerId): GameSession {
    const session = this.registry.createGame(playerId);
    const conn = this.connections.get(playerId);
    if (conn !== undefined) {
      conn.gameId = session.gameId;
    }
    return session;
  }

  joinGame(playerId: PlayerId, gameCode: GameCode): GameSession {
    const session = this.registry.findByCode(gameCode);
    if (session === undefined) {
      throw new DomainError(DomainErrorCode.GameNotFound, 'Game not found.');
    }
    session.joinGame(playerId);
    this.registry.registerPlayer(playerId, session);
    const conn = this.connections.get(playerId);
    if (conn !== undefined) {
      conn.gameId = session.gameId;
    }
    return session;
  }

  getSessionForPlayer(playerId: PlayerId): GameSession | undefined {
    return this.registry.findByPlayer(playerId);
  }

  sendJsonToPlayer(playerId: PlayerId, payload: string): void {
    const conn = this.connections.get(playerId);
    conn?.ws.send(payload);
  }

  broadcastJsonToGame(gameId: GameId, payload: string): void {
    for (const conn of this.connections.values()) {
      if (conn.gameId === gameId) {
        conn.ws.send(payload);
      }
    }
  }

  getOpponent(playerId: PlayerId, session: GameSession): PlayerId | null {
    for (const conn of this.connections.values()) {
      if (conn.playerId !== playerId && conn.gameId === session.gameId) {
        return conn.playerId;
      }
    }
    return null;
  }

  startCleanup(intervalMs = 300_000): void {
    if (this.cleanupTimer !== null) return;
    this.cleanupTimer = setInterval(() => {
      this.registry.cleanup(intervalMs * 2);
    }, intervalMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  get registrySize(): number {
    return this.registry.size;
  }

  findGameByCode(code: GameCode): GameSession | undefined {
    return this.registry.findByCode(code);
  }

  cleanupRegistry(ttlMs: number): number {
    return this.registry.cleanup(ttlMs);
  }
}
