import { describe, it, expect } from 'vitest';
import { GameRegistry } from '../game-registry.js';
import { type PlayerId, type GameId, type GameCode } from '@termchess/protocol';

function player(s: string): PlayerId {
  return s as PlayerId;
}

function gameId(s: string): GameId {
  return s as GameId;
}

function gameCode(s: string): GameCode {
  return s as GameCode;
}

const HOST = player('host-player');
const GUEST = player('guest-player');
const OTHER_HOST = player('other-host');

describe('GameRegistry — createGame', () => {
  it('creates a new session', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    expect(session).toBeDefined();
    expect(session.gameId).toBeTruthy();
    expect(session.gameCode).toBeTruthy();
  });

  it('game code is 6 characters long', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    expect(session.gameCode).toHaveLength(6);
  });

  it('game code is uppercase alphanumeric', () => {
    const registry = new GameRegistry();
    for (let i = 0; i < 20; i++) {
      const session = registry.createGame(player(`host-${i}`));
      expect(session.gameCode).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('each game gets a unique ID', () => {
    const registry = new GameRegistry();
    const s1 = registry.createGame(player('h1'));
    const s2 = registry.createGame(player('h2'));
    const s3 = registry.createGame(player('h3'));
    const ids = new Set([s1.gameId, s2.gameId, s3.gameId]);
    expect(ids.size).toBe(3);
  });

  it('each game gets a unique code', () => {
    const registry = new GameRegistry();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const session = registry.createGame(player(`host-${i}`));
      codes.add(session.gameCode);
    }
    expect(codes.size).toBe(50);
  });

  it('increments registry size', () => {
    const registry = new GameRegistry();
    expect(registry.size).toBe(0);
    registry.createGame(HOST);
    expect(registry.size).toBe(1);
    registry.createGame(OTHER_HOST);
    expect(registry.size).toBe(2);
  });
});

describe('GameRegistry — findByCode', () => {
  it('finds a session by its game code', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    const found = registry.findByCode(session.gameCode);
    expect(found).toBeDefined();
    expect(found?.gameId).toBe(session.gameId);
  });

  it('returns undefined for unknown code', () => {
    const registry = new GameRegistry();
    const found = registry.findByCode(gameCode('XXXXXX'));
    expect(found).toBeUndefined();
  });
});

describe('GameRegistry — findById', () => {
  it('finds a session by its game ID', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    const found = registry.findById(session.gameId);
    expect(found).toBeDefined();
    expect(found?.gameCode).toBe(session.gameCode);
  });

  it('returns undefined for unknown ID', () => {
    const registry = new GameRegistry();
    const found = registry.findById(gameId('nonexistent-id'));
    expect(found).toBeUndefined();
  });
});

describe('GameRegistry — findByPlayer', () => {
  it('finds a session by the host player ID', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    const found = registry.findByPlayer(HOST);
    expect(found).toBeDefined();
    expect(found?.gameId).toBe(session.gameId);
  });

  it('finds a session by the joining player ID after registerPlayer', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    session.joinGame(GUEST);
    registry.registerPlayer(GUEST, session);

    const found = registry.findByPlayer(GUEST);
    expect(found).toBeDefined();
    expect(found?.gameId).toBe(session.gameId);
  });

  it('returns undefined for unknown player', () => {
    const registry = new GameRegistry();
    const found = registry.findByPlayer(player('nobody'));
    expect(found).toBeUndefined();
  });
});

describe('GameRegistry — removeGame', () => {
  it('removes a session by ID', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    registry.removeGame(session.gameId);
    expect(registry.findById(session.gameId)).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('removed session cannot be found by code', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    const code = session.gameCode;
    registry.removeGame(session.gameId);
    expect(registry.findByCode(code)).toBeUndefined();
  });

  it('removed session cannot be found by player', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);
    registry.removeGame(session.gameId);
    expect(registry.findByPlayer(HOST)).toBeUndefined();
  });

  it('removing non-existent game is a no-op', () => {
    const registry = new GameRegistry();
    expect(() => registry.removeGame(gameId('fake-id'))).not.toThrow();
  });

  it('other games remain after one is removed', () => {
    const registry = new GameRegistry();
    const s1 = registry.createGame(player('h1'));
    const s2 = registry.createGame(player('h2'));
    registry.removeGame(s1.gameId);
    expect(registry.findById(s2.gameId)).toBeDefined();
    expect(registry.size).toBe(1);
  });
});

describe('GameRegistry — cleanup', () => {
  it('removes sessions older than ttl', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);

    // Force the lastActivityAt to be old
    session.lastActivityAt = Date.now() - 10_000;

    const removed = registry.cleanup(5_000); // 5 second TTL
    expect(removed).toBe(1);
    expect(registry.size).toBe(0);
    expect(registry.findById(session.gameId)).toBeUndefined();
  });

  it('keeps sessions newer than ttl', () => {
    const registry = new GameRegistry();
    const session = registry.createGame(HOST);

    // Just created, well within TTL
    const removed = registry.cleanup(60_000); // 1 minute TTL
    expect(removed).toBe(0);
    expect(registry.findById(session.gameId)).toBeDefined();
  });

  it('selectively removes old sessions', () => {
    const registry = new GameRegistry();
    const old = registry.createGame(player('old-host'));
    const fresh = registry.createGame(player('new-host'));

    old.lastActivityAt = Date.now() - 20_000; // 20 seconds ago

    const removed = registry.cleanup(10_000); // 10 second TTL
    expect(removed).toBe(1);
    expect(registry.findById(old.gameId)).toBeUndefined();
    expect(registry.findById(fresh.gameId)).toBeDefined();
  });

  it('returns 0 when nothing to clean', () => {
    const registry = new GameRegistry();
    const removed = registry.cleanup(1000);
    expect(removed).toBe(0);
  });

  it('cleans up multiple expired sessions', () => {
    const registry = new GameRegistry();
    for (let i = 0; i < 5; i++) {
      const s = registry.createGame(player(`host-${i}`));
      s.lastActivityAt = Date.now() - 30_000;
    }
    const removed = registry.cleanup(10_000);
    expect(removed).toBe(5);
    expect(registry.size).toBe(0);
  });
});
