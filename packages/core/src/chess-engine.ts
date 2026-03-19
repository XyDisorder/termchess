import { Chess } from 'chess.js';
import {
  type Fen,
  type Pgn,
  type UciMove,
  type PlayerColor,
  type DrawReason,
  type MoveHistoryEntry,
  PlayerColor as PlayerColorEnum,
  DrawReason as DrawReasonEnum,
} from '@termchess/protocol';
import { DomainError, DomainErrorCode } from './domain-errors.js';

// ---------------------------------------------------------------------------
// Public interfaces — no chess.js types leak past this file
// ---------------------------------------------------------------------------

export interface ChessEngineState {
  readonly fen: Fen;
  readonly turn: PlayerColor;
  readonly isCheck: boolean;
  readonly isCheckmate: boolean;
  readonly isStalemate: boolean;
  readonly isDraw: boolean;
  readonly drawType: DrawReason | null;
  readonly lastMove: UciMove | null;
  readonly moveHistory: readonly MoveHistoryEntry[];
  readonly capturedByWhite: readonly string[];
  readonly capturedByBlack: readonly string[];
}

export interface ChessEngine {
  applyMove(uci: UciMove): ChessEngineState;
  getState(): ChessEngineState;
  loadFen(fen: Fen): void;
  getLegalMoves(): readonly UciMove[];
  exportPgn(): Pgn;
  exportFen(): Fen;
}

// ---------------------------------------------------------------------------
// UCI helpers
// ---------------------------------------------------------------------------

interface ParsedUci {
  from: string;
  to: string;
  promotion: string | undefined;
}

function parseUci(uci: string): ParsedUci {
  // UCI format: e2e4 or e7e8q (with optional promotion piece)
  if (uci.length < 4 || uci.length > 5) {
    throw new DomainError(
      DomainErrorCode.IllegalMove,
      `Invalid UCI move format: "${uci}". Expected 4 or 5 characters.`,
    );
  }
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return { from, to, promotion };
}

function buildUci(from: string, to: string, promotion?: string): UciMove {
  const uci = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
  return uci as UciMove;
}

// ---------------------------------------------------------------------------
// Determine draw type from chess.js state
// ---------------------------------------------------------------------------

function detectDrawType(chess: Chess): DrawReason | null {
  if (!chess.isDraw()) return null;
  if (chess.isStalemate()) return DrawReasonEnum.Stalemate;
  if (chess.isInsufficientMaterial()) return DrawReasonEnum.InsufficientMaterial;
  if (chess.isThreefoldRepetition()) return DrawReasonEnum.Repetition;
  // 50-move rule is the remaining draw type chess.js can detect
  return DrawReasonEnum.FiftyMoves;
}

// ---------------------------------------------------------------------------
// Capture tracking
// ---------------------------------------------------------------------------

/**
 * Returns all pieces captured by each side based on move history.
 * chess.js verbose history includes a `captured` field on capture moves.
 */
function computeCapturedPieces(chess: Chess): {
  capturedByWhite: string[];
  capturedByBlack: string[];
} {
  const history = chess.history({ verbose: true });
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const move of history) {
    if (move.captured !== undefined) {
      // The side that made the move captured a piece from the opponent.
      // move.color is the color of the mover ('w' or 'b').
      if (move.color === 'w') {
        capturedByWhite.push(move.captured);
      } else {
        capturedByBlack.push(move.captured);
      }
    }
  }

  return { capturedByWhite, capturedByBlack };
}

// ---------------------------------------------------------------------------
// Build move history
// ---------------------------------------------------------------------------

function buildMoveHistory(chess: Chess, startingFen: string): MoveHistoryEntry[] {
  const verboseHistory = chess.history({ verbose: true });

  // We need the FEN after each move. We replay from the starting position to
  // collect per-move FENs, since chess.js doesn't expose them directly.
  const scratch = new Chess(startingFen);
  const history: MoveHistoryEntry[] = [];

  for (let i = 0; i < verboseHistory.length; i++) {
    const move = verboseHistory[i];
    if (move === undefined) continue;

    scratch.move(
      move.promotion !== undefined
        ? { from: move.from, to: move.to, promotion: move.promotion }
        : { from: move.from, to: move.to },
    );
    const moveNumber = Math.floor(i / 2) + 1;

    history.push({
      san: move.san,
      uci: buildUci(move.from, move.to, move.promotion),
      fen: scratch.fen() as Fen,
      moveNumber,
    });
  }

  return history;
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

function buildState(chess: Chess, lastMove: UciMove | null, startingFen: string): ChessEngineState {
  const { capturedByWhite, capturedByBlack } = computeCapturedPieces(chess);
  const moveHistory = buildMoveHistory(chess, startingFen);

  return {
    fen: chess.fen() as Fen,
    turn: chess.turn() === 'w' ? PlayerColorEnum.White : PlayerColorEnum.Black,
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    drawType: detectDrawType(chess),
    lastMove,
    moveHistory,
    capturedByWhite,
    capturedByBlack,
  };
}

// ---------------------------------------------------------------------------
// ChessEngineImpl
// ---------------------------------------------------------------------------

class ChessEngineImpl implements ChessEngine {
  private readonly chess: Chess;
  private lastMove: UciMove | null = null;
  private startingFen: string;

  constructor(fen?: Fen) {
    this.chess = fen !== undefined ? new Chess(fen) : new Chess();
    this.startingFen = this.chess.fen();
  }

  applyMove(uci: UciMove): ChessEngineState {
    const parsed = parseUci(uci);

    let result: ReturnType<Chess['move']>;
    try {
      result = this.chess.move(
        parsed.promotion !== undefined
          ? { from: parsed.from, to: parsed.to, promotion: parsed.promotion }
          : { from: parsed.from, to: parsed.to },
      );
    } catch {
      throw new DomainError(
        DomainErrorCode.IllegalMove,
        `Illegal move: "${uci}"`,
      );
    }

    if (result === null) {
      throw new DomainError(
        DomainErrorCode.IllegalMove,
        `Illegal move: "${uci}"`,
      );
    }

    this.lastMove = buildUci(result.from, result.to, result.promotion);
    return buildState(this.chess, this.lastMove, this.startingFen);
  }

  getState(): ChessEngineState {
    return buildState(this.chess, this.lastMove, this.startingFen);
  }

  loadFen(fen: Fen): void {
    // Validate by constructing a new instance — throws if invalid
    const testChess = new Chess(fen);
    // Re-load the existing instance using the validated FEN
    const newStarting = testChess.fen();
    // chess.js v1: load via constructor or use load method
    this.chess.load(newStarting);
    this.startingFen = newStarting;
    this.lastMove = null;
  }

  getLegalMoves(): readonly UciMove[] {
    return this.chess.moves({ verbose: true }).map((m) => buildUci(m.from, m.to, m.promotion));
  }

  exportPgn(): Pgn {
    return this.chess.pgn() as Pgn;
  }

  exportFen(): Fen {
    return this.chess.fen() as Fen;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new ChessEngine starting from the initial position,
 * or from the supplied FEN string.
 */
export function createChessEngine(fen?: Fen): ChessEngine {
  return new ChessEngineImpl(fen);
}
