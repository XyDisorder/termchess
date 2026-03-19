import { describe, it, expect, beforeEach } from 'vitest';
import { createChessEngine, type ChessEngine } from '../chess-engine.js';
import { DomainError, DomainErrorCode } from '../domain-errors.js';
import { type UciMove, type Fen, PlayerColor } from '@termchess/protocol';

function uci(s: string): UciMove {
  return s as UciMove;
}

function fen(s: string): Fen {
  return s as Fen;
}

describe('ChessEngine — basic construction', () => {
  it('starts with the standard initial position', () => {
    const engine = createChessEngine();
    const state = engine.getState();
    expect(state.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(state.turn).toBe(PlayerColor.White);
    expect(state.isCheck).toBe(false);
    expect(state.isCheckmate).toBe(false);
    expect(state.isStalemate).toBe(false);
    expect(state.isDraw).toBe(false);
    expect(state.drawType).toBeNull();
    expect(state.lastMove).toBeNull();
    expect(state.moveHistory).toHaveLength(0);
    expect(state.capturedByWhite).toHaveLength(0);
    expect(state.capturedByBlack).toHaveLength(0);
  });

  it('can be constructed from a FEN string', () => {
    const customFen = fen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    const engine = createChessEngine(customFen);
    const state = engine.getState();
    expect(state.turn).toBe(PlayerColor.Black);
  });
});

describe('ChessEngine — legal moves', () => {
  let engine: ChessEngine;

  beforeEach(() => {
    engine = createChessEngine();
  });

  it('e2e4 is a legal opening move', () => {
    const state = engine.applyMove(uci('e2e4'));
    expect(state.turn).toBe(PlayerColor.Black);
    expect(state.lastMove).toBe('e2e4');
  });

  it('d2d4 is a legal opening move', () => {
    const state = engine.applyMove(uci('d2d4'));
    expect(state.turn).toBe(PlayerColor.Black);
  });

  it('knight move g1f3 is legal', () => {
    const state = engine.applyMove(uci('g1f3'));
    expect(state.lastMove).toBe('g1f3');
  });

  it('move history tracks applied moves', () => {
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('e7e5'));
    engine.applyMove(uci('g1f3'));
    const state = engine.getState();
    expect(state.moveHistory).toHaveLength(3);
    expect(state.moveHistory[0]?.san).toBe('e4');
    expect(state.moveHistory[0]?.uci).toBe('e2e4');
    expect(state.moveHistory[0]?.moveNumber).toBe(1);
    expect(state.moveHistory[1]?.san).toBe('e5');
    expect(state.moveHistory[1]?.moveNumber).toBe(1);
    expect(state.moveHistory[2]?.san).toBe('Nf3');
    expect(state.moveHistory[2]?.moveNumber).toBe(2);
  });

  it('each move history entry contains a valid FEN', () => {
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('e7e5'));
    const state = engine.getState();
    for (const entry of state.moveHistory) {
      // FEN strings have exactly 6 space-separated fields
      expect(entry.fen.split(' ')).toHaveLength(6);
    }
  });

  it('getLegalMoves returns non-empty array at start', () => {
    const moves = engine.getLegalMoves();
    // 20 legal moves from initial position
    expect(moves.length).toBe(20);
  });

  it('getLegalMoves contains standard opening moves', () => {
    const moves = engine.getLegalMoves();
    expect(moves).toContain('e2e4');
    expect(moves).toContain('d2d4');
    expect(moves).toContain('g1f3');
  });
});

describe('ChessEngine — illegal moves throw DomainError', () => {
  let engine: ChessEngine;

  beforeEach(() => {
    engine = createChessEngine();
  });

  it('throws ILLEGAL_MOVE for a piece that cannot move there', () => {
    const err = (() => {
      try {
        engine.applyMove(uci('e2e5'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.IllegalMove);
  });

  it('throws ILLEGAL_MOVE for moving the wrong color piece', () => {
    // Black's turn is not until after white moves
    const err = (() => {
      try {
        engine.applyMove(uci('e7e5')); // black's pawn on white's turn
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.IllegalMove);
  });

  it('throws ILLEGAL_MOVE for malformed UCI (too short)', () => {
    const err = (() => {
      try {
        engine.applyMove(uci('e2'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.IllegalMove);
  });

  it('throws ILLEGAL_MOVE for empty square', () => {
    const err = (() => {
      try {
        engine.applyMove(uci('e4e5')); // e4 is empty
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.IllegalMove);
  });
});

describe('ChessEngine — checkmate detection', () => {
  it('detects scholar\'s mate checkmate', () => {
    const engine = createChessEngine();
    // Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('e7e5'));
    engine.applyMove(uci('f1c4'));
    engine.applyMove(uci('b8c6'));
    engine.applyMove(uci('d1h5'));
    engine.applyMove(uci('g8f6'));
    const state = engine.applyMove(uci('h5f7'));
    expect(state.isCheckmate).toBe(true);
    expect(state.isCheck).toBe(true);
    expect(state.isDraw).toBe(false);
  });

  it('reports empty legal moves after checkmate', () => {
    const engine = createChessEngine();
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('e7e5'));
    engine.applyMove(uci('f1c4'));
    engine.applyMove(uci('b8c6'));
    engine.applyMove(uci('d1h5'));
    engine.applyMove(uci('g8f6'));
    engine.applyMove(uci('h5f7'));
    expect(engine.getLegalMoves()).toHaveLength(0);
  });
});

describe('ChessEngine — stalemate detection', () => {
  it('detects stalemate from known position', () => {
    // Classic stalemate FEN: black to move with no legal moves
    const stalemateFen = fen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    const engine = createChessEngine(stalemateFen);
    const state = engine.getState();
    expect(state.isStalemate).toBe(true);
    expect(state.isCheckmate).toBe(false);
  });
});

describe('ChessEngine — draw detection (insufficient material)', () => {
  it('detects draw by insufficient material (K vs K)', () => {
    // King vs King — always draw
    const kvkFen = fen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const engine = createChessEngine(kvkFen);
    const state = engine.getState();
    expect(state.isDraw).toBe(true);
    expect(state.drawType).toBe('insufficient_material');
  });

  it('detects draw by insufficient material (K+B vs K)', () => {
    const kbvkFen = fen('4k3/8/8/8/8/8/8/4KB2 w - - 0 1');
    const engine = createChessEngine(kbvkFen);
    const state = engine.getState();
    expect(state.isDraw).toBe(true);
    expect(state.drawType).toBe('insufficient_material');
  });
});

describe('ChessEngine — captured pieces tracking', () => {
  it('tracks a captured pawn', () => {
    const engine = createChessEngine();
    // 1.e4 d5 2.exd5 — white captures black's d5 pawn
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('d7d5'));
    const state = engine.applyMove(uci('e4d5'));
    expect(state.capturedByWhite).toContain('p');
    expect(state.capturedByBlack).toHaveLength(0);
  });

  it('tracks captures by both sides', () => {
    const engine = createChessEngine();
    // 1.e4 d5 2.exd5 Qxd5 — white captures d-pawn, black recaptures with queen
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('d7d5'));
    engine.applyMove(uci('e4d5'));
    const state = engine.applyMove(uci('d8d5'));
    // chess.js uses lowercase piece symbols in the `captured` field for both colors
    expect(state.capturedByWhite).toContain('p'); // white captured black's pawn
    expect(state.capturedByBlack).toContain('p'); // black captured white's pawn (lowercase)
    expect(state.capturedByWhite).toHaveLength(1);
    expect(state.capturedByBlack).toHaveLength(1);
  });
});

describe('ChessEngine — FEN and PGN export', () => {
  it('exportFen matches getState().fen', () => {
    const engine = createChessEngine();
    engine.applyMove(uci('e2e4'));
    expect(engine.exportFen()).toBe(engine.getState().fen);
  });

  it('exportPgn returns a non-empty string after moves', () => {
    const engine = createChessEngine();
    engine.applyMove(uci('e2e4'));
    engine.applyMove(uci('e7e5'));
    const pgn = engine.exportPgn();
    expect(pgn).toContain('e4');
    expect(pgn).toContain('e5');
  });

  it('exportPgn returns a string before any moves', () => {
    const engine = createChessEngine();
    // chess.js v1 returns header tags even with no moves played
    const pgn = engine.exportPgn();
    expect(typeof pgn).toBe('string');
    // There should be no move text in it (no "1." etc.)
    expect(pgn).not.toMatch(/\b1\./);
  });
});

describe('ChessEngine — loadFen', () => {
  it('loads a new FEN position', () => {
    const engine = createChessEngine();
    engine.applyMove(uci('e2e4'));

    const newFen = fen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    engine.loadFen(newFen);

    // chess.js normalizes the FEN — the en passant square 'e3' may be dropped
    // if no black pawn is adjacent to capture. Check the key parts instead.
    const exportedFen = engine.exportFen();
    expect(exportedFen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');
    expect(engine.getState().turn).toBe(PlayerColor.Black);
    // lastMove should be cleared after load
    expect(engine.getState().lastMove).toBeNull();
  });
});

describe('ChessEngine — pawn promotion', () => {
  it('accepts promotion move with queen suffix', () => {
    // Position where white pawn is ready to promote
    const promotionFen = fen('8/P7/8/8/8/8/8/4K1k1 w - - 0 1');
    const engine = createChessEngine(promotionFen);
    const state = engine.applyMove(uci('a7a8q'));
    expect(state.lastMove).toBe('a7a8q');
  });
});
