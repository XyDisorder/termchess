/**
 * ws-handler tests
 *
 * We test dispatchMessage directly — the pure business-logic function —
 * rather than wiring up a full @fastify/websocket SocketStream.
 */
import { describe, it, expect, vi } from 'vitest';
import { dispatchMessage } from '../ws-handler.js';
import { SessionManager } from '../session-manager.js';
import { parseClientMessage } from '@termchess/protocol';
import type { PlayerId, GameCode } from '@termchess/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWs() {
  return { send: vi.fn(), close: vi.fn() };
}

function parseSent(ws: ReturnType<typeof mockWs>): unknown[] {
  return ws.send.mock.calls.map((c) => JSON.parse(c[0] as string));
}

function lastMsg(ws: ReturnType<typeof mockWs>): unknown {
  const msgs = parseSent(ws);
  return msgs[msgs.length - 1];
}

/** Register a mock WS, dispatch a message, return the playerId. */
function registerAndDispatch(
  sm: SessionManager,
  ws: ReturnType<typeof mockWs>,
  raw: unknown,
): PlayerId {
  const playerId = sm.registerConnection(ws);
  dispatchMessage(sm, playerId, parseClientMessage(raw));
  return playerId;
}

/** Dispatch another message for an already-registered player. */
function dispatch(sm: SessionManager, playerId: PlayerId, raw: unknown): void {
  dispatchMessage(sm, playerId, parseClientMessage(raw));
}

// Setup a two-player active game; returns sm, player IDs and ws mocks.
function setupActiveGame() {
  const sm = new SessionManager();

  const wsWhite = mockWs();
  const wsBlack = mockWs();

  const p1 = sm.registerConnection(wsWhite);
  dispatch(sm, p1, { type: 'create_game' });

  const createMsg = lastMsg(wsWhite) as { gameCode: string };

  const p2 = sm.registerConnection(wsBlack);
  dispatch(sm, p2, { type: 'join_game', gameCode: createMsg.gameCode });

  // Clear accumulated sends so assertions start clean.
  wsWhite.send.mockClear();
  wsBlack.send.mockClear();

  return { sm, p1, p2, wsWhite, wsBlack };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchMessage: ping', () => {
  it('responds with pong', () => {
    const sm = new SessionManager();
    const ws = mockWs();
    registerAndDispatch(sm, ws, { type: 'ping' });
    expect(lastMsg(ws)).toEqual({ type: 'pong' });
  });
});

describe('dispatchMessage: create_game', () => {
  it('sends game_created with white color', () => {
    const sm = new SessionManager();
    const ws = mockWs();
    registerAndDispatch(sm, ws, { type: 'create_game' });
    const msg = lastMsg(ws) as { type: string; playerColor: string };
    expect(msg.type).toBe('game_created');
    expect(msg.playerColor).toBe('white');
  });

  it('sends game_error ALREADY_IN_GAME if player is already in a game', () => {
    const sm = new SessionManager();
    const ws = mockWs();
    const p = sm.registerConnection(ws);
    dispatch(sm, p, { type: 'create_game' });
    dispatch(sm, p, { type: 'create_game' });
    const msg = lastMsg(ws) as { type: string; code: string };
    expect(msg.type).toBe('game_error');
    expect(msg.code).toBe('ALREADY_IN_GAME');
  });
});

describe('dispatchMessage: join_game', () => {
  it('valid code — joiner receives game_joined, host receives opponent_connected + game_state', () => {
    const sm = new SessionManager();
    const wsHost = mockWs();
    const wsJoiner = mockWs();

    const p1 = sm.registerConnection(wsHost);
    dispatch(sm, p1, { type: 'create_game' });
    const hostCreate = lastMsg(wsHost) as { gameCode: string };
    const gameCode = hostCreate.gameCode;

    const p2 = sm.registerConnection(wsJoiner);
    dispatch(sm, p2, { type: 'join_game', gameCode });

    const joinerMsgs = parseSent(wsJoiner) as Array<{ type: string }>;
    const hostMsgs = parseSent(wsHost) as Array<{ type: string }>;

    expect(joinerMsgs.some((m) => m.type === 'game_joined')).toBe(true);
    expect(joinerMsgs.some((m) => m.type === 'game_state')).toBe(true);
    expect(hostMsgs.some((m) => m.type === 'opponent_connected')).toBe(true);
    expect(hostMsgs.some((m) => m.type === 'game_state')).toBe(true);
  });

  it('bad code — receives game_error with GAME_NOT_FOUND', () => {
    const sm = new SessionManager();
    const ws = mockWs();
    registerAndDispatch(sm, ws, { type: 'join_game', gameCode: 'XXXXXX' });
    const msg = lastMsg(ws) as { type: string; code: string };
    expect(msg.type).toBe('game_error');
    expect(msg.code).toBe('GAME_NOT_FOUND');
  });

  it('already in a game — receives game_error with ALREADY_IN_GAME', () => {
    const sm = new SessionManager();
    const ws = mockWs();
    const p = sm.registerConnection(ws);
    dispatch(sm, p, { type: 'create_game' });
    dispatch(sm, p, { type: 'join_game', gameCode: 'XXXXXX' });
    const msg = lastMsg(ws) as { type: string; code: string };
    expect(msg.type).toBe('game_error');
    expect(msg.code).toBe('ALREADY_IN_GAME');
  });
});

describe('dispatchMessage: make_move', () => {
  it('legal move — both players receive game_state', () => {
    const { sm, p1, wsWhite, wsBlack } = setupActiveGame();
    dispatch(sm, p1, { type: 'make_move', uci: 'e2e4' });

    const whiteMsgs = parseSent(wsWhite) as Array<{ type: string }>;
    const blackMsgs = parseSent(wsBlack) as Array<{ type: string }>;

    expect(whiteMsgs.some((m) => m.type === 'game_state')).toBe(true);
    expect(blackMsgs.some((m) => m.type === 'game_state')).toBe(true);
  });

  it('illegal move — only mover receives game_error', () => {
    const { sm, p1, wsWhite, wsBlack } = setupActiveGame();
    dispatch(sm, p1, { type: 'make_move', uci: 'e2e5' }); // illegal

    const msg = lastMsg(wsWhite) as { type: string; code: string };
    expect(msg.type).toBe('game_error');
    expect(msg.code).toBe('ILLEGAL_MOVE');
    expect(wsBlack.send).not.toHaveBeenCalled();
  });

  it('moving out of turn — mover receives NOT_YOUR_TURN error', () => {
    const { sm, p2, wsBlack } = setupActiveGame();
    dispatch(sm, p2, { type: 'make_move', uci: 'e7e5' });
    const msg = lastMsg(wsBlack) as { type: string; code: string };
    expect(msg.type).toBe('game_error');
    expect(msg.code).toBe('NOT_YOUR_TURN');
  });
});

describe('dispatchMessage: resign', () => {
  it('sends game_finished to both players', () => {
    const { sm, p1, wsWhite, wsBlack } = setupActiveGame();
    dispatch(sm, p1, { type: 'resign' });

    const whiteMsgs = parseSent(wsWhite) as Array<{ type: string }>;
    const blackMsgs = parseSent(wsBlack) as Array<{ type: string }>;

    expect(whiteMsgs.some((m) => m.type === 'game_finished')).toBe(true);
    expect(blackMsgs.some((m) => m.type === 'game_finished')).toBe(true);
  });
});

describe('dispatchMessage: request_pgn', () => {
  it('returns pgn_response to requester only', () => {
    const { sm, p1, wsWhite, wsBlack } = setupActiveGame();
    dispatch(sm, p1, { type: 'request_pgn' });

    const whiteMsgs = parseSent(wsWhite) as Array<{ type: string }>;
    expect(whiteMsgs.some((m) => m.type === 'pgn_response')).toBe(true);
    expect(wsBlack.send).not.toHaveBeenCalled();
  });
});

describe('dispatchMessage: invalid message schema', () => {
  it('parseClientMessage throws ZodError for unknown message type', () => {
    expect(() => parseClientMessage({ type: 'explode' })).toThrow();
  });
});
