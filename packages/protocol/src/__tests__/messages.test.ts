import { describe, it, expect } from 'vitest';
import {
  parseClientMessage,
  parseServerMessage,
  safeParseClientMessage,
  safeParseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type CreateGameMessage,
  type JoinGameMessage,
  type MakeMoveMessage,
  type GameCreatedMessage,
  type GameStateMessage,
} from '../messages.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validSnapshot = {
  gameId: 'game-123',
  gameCode: 'ABC123',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  status: 'active' as const,
  turn: 'white' as const,
  whitePlayerId: 'player-1',
  blackPlayerId: 'player-2',
  moveHistory: [],
  capturedByWhite: [],
  capturedByBlack: [],
  isCheck: false,
  lastMove: null,
  drawOfferedBy: null,
  drawReason: null,
  resignedBy: null,
  winner: null,
};

// ---------------------------------------------------------------------------
// Client message parsing — valid cases
// ---------------------------------------------------------------------------

describe('parseClientMessage — valid messages', () => {
  it('parses create_game', () => {
    const result = parseClientMessage({ type: 'create_game' });
    expect(result.type).toBe('create_game');
  });

  it('parses join_game with gameCode', () => {
    const result = parseClientMessage({ type: 'join_game', gameCode: 'ABC123' });
    expect(result.type).toBe('join_game');
    if (result.type === 'join_game') {
      expect(result.gameCode).toBe('ABC123');
    }
  });

  it('parses make_move with 4-char uci', () => {
    const result = parseClientMessage({ type: 'make_move', uci: 'e2e4' });
    expect(result.type).toBe('make_move');
    if (result.type === 'make_move') {
      expect(result.uci).toBe('e2e4');
    }
  });

  it('parses make_move with 5-char uci (promotion)', () => {
    const result = parseClientMessage({ type: 'make_move', uci: 'e7e8q' });
    expect(result.type).toBe('make_move');
    if (result.type === 'make_move') {
      expect(result.uci).toBe('e7e8q');
    }
  });

  it('parses resign', () => {
    const result = parseClientMessage({ type: 'resign' });
    expect(result.type).toBe('resign');
  });

  it('parses offer_draw', () => {
    const result = parseClientMessage({ type: 'offer_draw' });
    expect(result.type).toBe('offer_draw');
  });

  it('parses accept_draw', () => {
    const result = parseClientMessage({ type: 'accept_draw' });
    expect(result.type).toBe('accept_draw');
  });

  it('parses decline_draw', () => {
    const result = parseClientMessage({ type: 'decline_draw' });
    expect(result.type).toBe('decline_draw');
  });

  it('parses request_pgn', () => {
    const result = parseClientMessage({ type: 'request_pgn' });
    expect(result.type).toBe('request_pgn');
  });

  it('parses ping', () => {
    const result = parseClientMessage({ type: 'ping' });
    expect(result.type).toBe('ping');
  });
});

// ---------------------------------------------------------------------------
// Client message parsing — invalid cases
// ---------------------------------------------------------------------------

describe('parseClientMessage — invalid messages', () => {
  it('rejects unknown type', () => {
    expect(() => parseClientMessage({ type: 'unknown_type' })).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseClientMessage(null)).toThrow();
  });

  it('rejects undefined', () => {
    expect(() => parseClientMessage(undefined)).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => parseClientMessage({})).toThrow();
  });

  it('rejects join_game without gameCode', () => {
    expect(() => parseClientMessage({ type: 'join_game' })).toThrow();
  });

  it('rejects join_game with empty gameCode', () => {
    expect(() => parseClientMessage({ type: 'join_game', gameCode: '' })).toThrow();
  });

  it('rejects make_move without uci', () => {
    expect(() => parseClientMessage({ type: 'make_move' })).toThrow();
  });

  it('rejects make_move with too-short uci', () => {
    expect(() => parseClientMessage({ type: 'make_move', uci: 'e2' })).toThrow();
  });

  it('rejects make_move with too-long uci', () => {
    expect(() => parseClientMessage({ type: 'make_move', uci: 'e2e4e6' })).toThrow();
  });

  it('rejects create_game with extra fields (strict mode)', () => {
    expect(() => parseClientMessage({ type: 'create_game', extra: 'field' })).toThrow();
  });

  it('rejects a plain string', () => {
    expect(() => parseClientMessage('create_game')).toThrow();
  });

  it('rejects a number', () => {
    expect(() => parseClientMessage(42)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Server message parsing — valid cases
// ---------------------------------------------------------------------------

describe('parseServerMessage — valid messages', () => {
  it('parses game_created', () => {
    const msg = {
      type: 'game_created',
      gameId: 'game-123',
      gameCode: 'ABC123',
      playerColor: 'white',
      snapshot: validSnapshot,
    };
    const result = parseServerMessage(msg);
    expect(result.type).toBe('game_created');
    if (result.type === 'game_created') {
      expect(result.gameId).toBe('game-123');
      expect(result.gameCode).toBe('ABC123');
      expect(result.playerColor).toBe('white');
    }
  });

  it('parses game_joined', () => {
    const msg = {
      type: 'game_joined',
      gameId: 'game-123',
      playerColor: 'black',
      snapshot: validSnapshot,
    };
    const result = parseServerMessage(msg);
    expect(result.type).toBe('game_joined');
    if (result.type === 'game_joined') {
      expect(result.playerColor).toBe('black');
    }
  });

  it('parses game_state', () => {
    const result = parseServerMessage({ type: 'game_state', snapshot: validSnapshot });
    expect(result.type).toBe('game_state');
  });

  it('parses game_error', () => {
    const result = parseServerMessage({
      type: 'game_error',
      code: 'ILLEGAL_MOVE',
      message: 'That move is not legal',
    });
    expect(result.type).toBe('game_error');
    if (result.type === 'game_error') {
      expect(result.code).toBe('ILLEGAL_MOVE');
      expect(result.message).toBe('That move is not legal');
    }
  });

  it('parses opponent_connected', () => {
    const result = parseServerMessage({ type: 'opponent_connected', snapshot: validSnapshot });
    expect(result.type).toBe('opponent_connected');
  });

  it('parses opponent_disconnected', () => {
    const result = parseServerMessage({ type: 'opponent_disconnected' });
    expect(result.type).toBe('opponent_disconnected');
  });

  it('parses draw_offered with white', () => {
    const result = parseServerMessage({ type: 'draw_offered', by: 'white' });
    expect(result.type).toBe('draw_offered');
    if (result.type === 'draw_offered') {
      expect(result.by).toBe('white');
    }
  });

  it('parses draw_offered with black', () => {
    const result = parseServerMessage({ type: 'draw_offered', by: 'black' });
    expect(result.type).toBe('draw_offered');
    if (result.type === 'draw_offered') {
      expect(result.by).toBe('black');
    }
  });

  it('parses draw_declined', () => {
    const result = parseServerMessage({ type: 'draw_declined' });
    expect(result.type).toBe('draw_declined');
  });

  it('parses game_finished with checkmate snapshot', () => {
    const finishedSnapshot = {
      ...validSnapshot,
      status: 'checkmate' as const,
      winner: 'white' as const,
    };
    const result = parseServerMessage({ type: 'game_finished', snapshot: finishedSnapshot });
    expect(result.type).toBe('game_finished');
    if (result.type === 'game_finished') {
      expect(result.snapshot.status).toBe('checkmate');
      expect(result.snapshot.winner).toBe('white');
    }
  });

  it('parses pgn_response', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6';
    const result = parseServerMessage({ type: 'pgn_response', pgn });
    expect(result.type).toBe('pgn_response');
    if (result.type === 'pgn_response') {
      expect(result.pgn).toBe(pgn);
    }
  });

  it('parses pong', () => {
    const result = parseServerMessage({ type: 'pong' });
    expect(result.type).toBe('pong');
  });

  it('parses snapshot with move history entries', () => {
    const snapshotWithHistory = {
      ...validSnapshot,
      moveHistory: [
        {
          san: 'e4',
          uci: 'e2e4',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          moveNumber: 1,
        },
      ],
      capturedByWhite: ['p'],
      capturedByBlack: ['P'],
    };
    const result = parseServerMessage({ type: 'game_state', snapshot: snapshotWithHistory });
    expect(result.type).toBe('game_state');
    if (result.type === 'game_state') {
      expect(result.snapshot.moveHistory).toHaveLength(1);
      expect(result.snapshot.moveHistory[0]?.san).toBe('e4');
    }
  });

  it('parses snapshot with nullable fields set to null', () => {
    const snapshotWithNulls = {
      ...validSnapshot,
      whitePlayerId: null,
      blackPlayerId: null,
      lastMove: null,
      drawOfferedBy: null,
      drawReason: null,
      resignedBy: null,
      winner: null,
    };
    const result = parseServerMessage({ type: 'game_state', snapshot: snapshotWithNulls });
    expect(result.type).toBe('game_state');
    if (result.type === 'game_state') {
      expect(result.snapshot.whitePlayerId).toBeNull();
      expect(result.snapshot.winner).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Server message parsing — invalid cases
// ---------------------------------------------------------------------------

describe('parseServerMessage — invalid messages', () => {
  it('rejects unknown type', () => {
    expect(() => parseServerMessage({ type: 'unknown_server_msg' })).toThrow();
  });

  it('rejects null', () => {
    expect(() => parseServerMessage(null)).toThrow();
  });

  it('rejects game_created without snapshot', () => {
    expect(() =>
      parseServerMessage({
        type: 'game_created',
        gameId: 'game-123',
        gameCode: 'ABC123',
        playerColor: 'white',
      }),
    ).toThrow();
  });

  it('rejects game_created with invalid playerColor', () => {
    expect(() =>
      parseServerMessage({
        type: 'game_created',
        gameId: 'game-123',
        gameCode: 'ABC123',
        playerColor: 'purple',
        snapshot: validSnapshot,
      }),
    ).toThrow();
  });

  it('rejects draw_offered with invalid color', () => {
    expect(() => parseServerMessage({ type: 'draw_offered', by: 'red' })).toThrow();
  });

  it('rejects draw_offered without by field', () => {
    expect(() => parseServerMessage({ type: 'draw_offered' })).toThrow();
  });

  it('rejects game_error without code', () => {
    expect(() => parseServerMessage({ type: 'game_error', message: 'oops' })).toThrow();
  });

  it('rejects game_state with invalid snapshot status', () => {
    expect(() =>
      parseServerMessage({
        type: 'game_state',
        snapshot: { ...validSnapshot, status: 'invalid_status' },
      }),
    ).toThrow();
  });

  it('rejects opponent_disconnected with extra fields (strict mode)', () => {
    expect(() =>
      parseServerMessage({ type: 'opponent_disconnected', extra: 'data' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Type narrowing via discriminated unions
// ---------------------------------------------------------------------------

describe('type narrowing via discriminated union', () => {
  it('can narrow ClientMessage to specific types', () => {
    const msg: ClientMessage = parseClientMessage({ type: 'join_game', gameCode: 'XYZ789' });

    // TypeScript discriminated union narrowing
    if (msg.type === 'join_game') {
      // gameCode is only available after narrowing
      expect(msg.gameCode).toBe('XYZ789');
    } else {
      throw new Error('Expected join_game message');
    }
  });

  it('can narrow ServerMessage to specific types', () => {
    const msg: ServerMessage = parseServerMessage({
      type: 'game_created',
      gameId: 'g1',
      gameCode: 'CODE01',
      playerColor: 'white',
      snapshot: validSnapshot,
    });

    if (msg.type === 'game_created') {
      expect(msg.gameId).toBe('g1');
      expect(msg.playerColor).toBe('white');
    } else {
      throw new Error('Expected game_created message');
    }
  });

  it('exhaustive switch over ClientMessage types compiles correctly', () => {
    const msg: ClientMessage = parseClientMessage({ type: 'ping' });
    let handled = false;

    switch (msg.type) {
      case 'create_game':
      case 'join_game':
      case 'make_move':
      case 'resign':
      case 'offer_draw':
      case 'accept_draw':
      case 'decline_draw':
      case 'request_pgn':
      case 'ping':
        handled = true;
        break;
    }

    expect(handled).toBe(true);
  });

  it('exhaustive switch over ServerMessage types compiles correctly', () => {
    const msg: ServerMessage = parseServerMessage({ type: 'pong' });
    let handled = false;

    switch (msg.type) {
      case 'game_created':
      case 'game_joined':
      case 'game_state':
      case 'game_error':
      case 'opponent_connected':
      case 'opponent_disconnected':
      case 'draw_offered':
      case 'draw_declined':
      case 'game_finished':
      case 'pgn_response':
      case 'pong':
        handled = true;
        break;
    }

    expect(handled).toBe(true);
  });

  it('safeParseClientMessage returns success for valid input', () => {
    const result = safeParseClientMessage({ type: 'ping' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('ping');
    }
  });

  it('safeParseClientMessage returns failure for invalid input', () => {
    const result = safeParseClientMessage({ type: 'bogus' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('safeParseServerMessage returns success for valid input', () => {
    const result = safeParseServerMessage({ type: 'pong' });
    expect(result.success).toBe(true);
  });

  it('safeParseServerMessage returns failure for invalid input', () => {
    const result = safeParseServerMessage(null);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GameSnapshot schema edge cases
// ---------------------------------------------------------------------------

describe('GameSnapshot validation', () => {
  it('accepts all valid GameStatus values', () => {
    const statuses = [
      'waiting_for_opponent',
      'active',
      'checkmate',
      'stalemate',
      'draw',
      'resigned',
      'abandoned',
    ] as const;

    for (const status of statuses) {
      const result = safeParseServerMessage({
        type: 'game_state',
        snapshot: { ...validSnapshot, status },
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid DrawReason values', () => {
    const reasons = [
      'agreement',
      'stalemate',
      'insufficient_material',
      'repetition',
      'fifty_moves',
    ] as const;

    for (const drawReason of reasons) {
      const result = safeParseServerMessage({
        type: 'game_state',
        snapshot: { ...validSnapshot, drawReason },
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid DrawReason', () => {
    const result = safeParseServerMessage({
      type: 'game_state',
      snapshot: { ...validSnapshot, drawReason: 'timeout' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts snapshot with isCheck true', () => {
    const result = safeParseServerMessage({
      type: 'game_state',
      snapshot: { ...validSnapshot, isCheck: true },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'game_state') {
      expect(result.data.snapshot.isCheck).toBe(true);
    }
  });
});
