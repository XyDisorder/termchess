import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../session-manager.js';
import type { GameCode } from '@termchess/protocol';

function mockWs() {
  return { send: vi.fn(), close: vi.fn() };
}

describe('SessionManager', () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  afterEach(() => {
    sm.stopCleanup();
  });

  // -------------------------------------------------------------------------
  // Connection management
  // -------------------------------------------------------------------------

  it('registerConnection returns a non-empty player ID', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    expect(typeof playerId).toBe('string');
    expect(playerId.length).toBeGreaterThan(0);
  });

  it('registerConnection stores the connection', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    const conn = sm.getConnection(playerId);
    expect(conn).toBeDefined();
    expect(conn?.playerId).toBe(playerId);
    expect(conn?.ws).toBe(ws);
    expect(conn?.gameId).toBeNull();
  });

  it('removeConnection removes the player', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    sm.removeConnection(playerId);
    expect(sm.getConnection(playerId)).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Game management
  // -------------------------------------------------------------------------

  it('createGame sets gameId on connection and increments registry', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    const session = sm.createGame(playerId);
    expect(session).toBeDefined();
    expect(sm.getConnection(playerId)?.gameId).toBe(session.gameId);
    expect(sm.registrySize).toBe(1);
  });

  it('findGameByCode returns session after createGame', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    const session = sm.createGame(playerId);
    const found = sm.findGameByCode(session.gameCode as GameCode);
    expect(found).toBe(session);
  });

  it('joinGame joins an existing game and registers the second player', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const p1 = sm.registerConnection(ws1);
    const p2 = sm.registerConnection(ws2);
    const session = sm.createGame(p1);
    const joined = sm.joinGame(p2, session.gameCode as GameCode);
    expect(joined.gameId).toBe(session.gameId);
    expect(sm.getConnection(p2)?.gameId).toBe(session.gameId);
    expect(sm.getSessionForPlayer(p2)).toBeDefined();
  });

  it('joinGame throws DomainError on invalid game code', () => {
    const ws = mockWs();
    const p = sm.registerConnection(ws);
    expect(() => sm.joinGame(p, 'BADCODE' as GameCode)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  it('sendJsonToPlayer calls ws.send with the provided payload', () => {
    const ws = mockWs();
    const playerId = sm.registerConnection(ws);
    sm.sendJsonToPlayer(playerId, '{"type":"pong"}');
    expect(ws.send).toHaveBeenCalledOnce();
    expect(ws.send).toHaveBeenCalledWith('{"type":"pong"}');
  });

  it('broadcastJsonToGame sends to all players in the game', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const p1 = sm.registerConnection(ws1);
    const p2 = sm.registerConnection(ws2);
    const session = sm.createGame(p1);
    sm.joinGame(p2, session.gameCode as GameCode);

    sm.broadcastJsonToGame(session.gameId, '{"type":"pong"}');
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it('getOpponent returns the other player ID', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const p1 = sm.registerConnection(ws1);
    const p2 = sm.registerConnection(ws2);
    const session = sm.createGame(p1);
    sm.joinGame(p2, session.gameCode as GameCode);

    expect(sm.getOpponent(p1, session)).toBe(p2);
    expect(sm.getOpponent(p2, session)).toBe(p1);
  });

  it('getOpponent returns null when only one player', () => {
    const ws1 = mockWs();
    const p1 = sm.registerConnection(ws1);
    const session = sm.createGame(p1);
    expect(sm.getOpponent(p1, session)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('startCleanup and stopCleanup round-trip without error', () => {
    sm.startCleanup(100_000);
    sm.stopCleanup();
  });

  it('cleanupRegistry removes stale sessions when ttlMs is negative (always expired)', () => {
    const ws = mockWs();
    const p = sm.registerConnection(ws);
    sm.createGame(p);
    expect(sm.registrySize).toBe(1);

    // Using -1 ensures `now - lastActivityAt > ttlMs` is always true
    const removed = sm.cleanupRegistry(-1);
    expect(removed).toBe(1);
    expect(sm.registrySize).toBe(0);
  });
});
