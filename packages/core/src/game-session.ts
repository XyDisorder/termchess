import {
  type GameId,
  type GameCode,
  type PlayerId,
  type UciMove,
  type GameSnapshot,
  type Pgn,
  PlayerColor,
  GameStatus,
  DrawReason,
} from '@termchess/protocol';
import { createChessEngine, type ChessEngine, type ChessEngineState } from './chess-engine.js';
import { DomainError, DomainErrorCode } from './domain-errors.js';

// ---------------------------------------------------------------------------
// GameSession
// ---------------------------------------------------------------------------

export class GameSession {
  readonly gameId: GameId;
  readonly gameCode: GameCode;

  private readonly engine: ChessEngine;
  private readonly whitePlayerId: PlayerId;
  private blackPlayerId: PlayerId | null = null;
  private status: (typeof GameStatus)[keyof typeof GameStatus];
  private drawOfferedBy: (typeof PlayerColor)[keyof typeof PlayerColor] | null = null;
  private resignedBy: (typeof PlayerColor)[keyof typeof PlayerColor] | null = null;
  private drawReason: (typeof DrawReason)[keyof typeof DrawReason] | null = null;
  private winner: (typeof PlayerColor)[keyof typeof PlayerColor] | null = null;

  /** Timestamp of the last activity, used for cleanup TTL. */
  lastActivityAt: number;

  constructor(gameId: GameId, gameCode: GameCode, hostPlayerId: PlayerId) {
    this.gameId = gameId;
    this.gameCode = gameCode;
    this.whitePlayerId = hostPlayerId;
    this.engine = createChessEngine();
    this.status = GameStatus.WaitingForOpponent;
    this.lastActivityAt = Date.now();
  }

  // -------------------------------------------------------------------------
  // Join
  // -------------------------------------------------------------------------

  joinGame(playerId: PlayerId): typeof PlayerColor.Black {
    if (this.blackPlayerId !== null) {
      throw new DomainError(DomainErrorCode.GameAlreadyFull, 'This game already has two players.');
    }
    if (playerId === this.whitePlayerId) {
      throw new DomainError(
        DomainErrorCode.PlayerAlreadyInGame,
        'You are already in this game as white.',
      );
    }
    this.blackPlayerId = playerId;
    this.status = GameStatus.Active;
    this.lastActivityAt = Date.now();
    return PlayerColor.Black;
  }

  // -------------------------------------------------------------------------
  // Move
  // -------------------------------------------------------------------------

  applyMove(playerId: PlayerId, uci: UciMove): GameSnapshot {
    this.requireActive();
    const color = this.requirePlayer(playerId);
    this.requireTurn(color);

    const engineState = this.engine.applyMove(uci);
    this.lastActivityAt = Date.now();

    // After the move, check for terminal states
    if (engineState.isCheckmate) {
      this.status = GameStatus.Checkmate;
      this.winner = color;
    } else if (engineState.isStalemate) {
      this.status = GameStatus.Stalemate;
      this.drawReason = DrawReason.Stalemate;
    } else if (engineState.isDraw) {
      this.status = GameStatus.Draw;
      this.drawReason = engineState.drawType;
    }

    // A new move cancels any pending draw offer
    this.drawOfferedBy = null;

    return this.buildSnapshot(engineState);
  }

  // -------------------------------------------------------------------------
  // Resign
  // -------------------------------------------------------------------------

  resign(playerId: PlayerId): GameSnapshot {
    this.requireActive();
    const color = this.requirePlayer(playerId);

    this.resignedBy = color;
    this.winner = color === PlayerColor.White ? PlayerColor.Black : PlayerColor.White;
    this.status = GameStatus.Resigned;
    this.lastActivityAt = Date.now();

    return this.buildSnapshot(this.engine.getState());
  }

  // -------------------------------------------------------------------------
  // Draw offer / accept / decline
  // -------------------------------------------------------------------------

  offerDraw(playerId: PlayerId): GameSnapshot {
    this.requireActive();
    const color = this.requirePlayer(playerId);

    if (this.drawOfferedBy !== null) {
      throw new DomainError(
        DomainErrorCode.DrawAlreadyOffered,
        'A draw has already been offered.',
      );
    }

    this.drawOfferedBy = color;
    this.lastActivityAt = Date.now();
    return this.buildSnapshot(this.engine.getState());
  }

  acceptDraw(playerId: PlayerId): GameSnapshot {
    this.requireActive();
    const color = this.requirePlayer(playerId);

    if (this.drawOfferedBy === null) {
      throw new DomainError(DomainErrorCode.DrawNotOffered, 'No draw has been offered.');
    }
    if (this.drawOfferedBy === color) {
      throw new DomainError(
        DomainErrorCode.DrawNotOffered,
        'You cannot accept your own draw offer.',
      );
    }

    this.status = GameStatus.Draw;
    this.drawReason = DrawReason.Agreement;
    this.drawOfferedBy = null;
    this.lastActivityAt = Date.now();

    return this.buildSnapshot(this.engine.getState());
  }

  declineDraw(playerId: PlayerId): GameSnapshot {
    this.requireActive();
    const color = this.requirePlayer(playerId);

    if (this.drawOfferedBy === null) {
      throw new DomainError(DomainErrorCode.DrawNotOffered, 'No draw has been offered.');
    }
    if (this.drawOfferedBy === color) {
      throw new DomainError(
        DomainErrorCode.DrawNotOffered,
        'You cannot decline your own draw offer.',
      );
    }

    this.drawOfferedBy = null;
    this.lastActivityAt = Date.now();
    return this.buildSnapshot(this.engine.getState());
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getSnapshot(): GameSnapshot {
    return this.buildSnapshot(this.engine.getState());
  }

  isFinished(): boolean {
    return (
      this.status === GameStatus.Checkmate ||
      this.status === GameStatus.Stalemate ||
      this.status === GameStatus.Draw ||
      this.status === GameStatus.Resigned ||
      this.status === GameStatus.Abandoned
    );
  }

  getPlayerColor(playerId: PlayerId): typeof PlayerColor[keyof typeof PlayerColor] {
    return this.requirePlayer(playerId);
  }

  exportPgn(): Pgn {
    return this.engine.exportPgn();
  }

  abandon(): void {
    this.status = GameStatus.Abandoned;
    this.lastActivityAt = Date.now();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private requireActive(): void {
    if (this.status === GameStatus.WaitingForOpponent) {
      throw new DomainError(
        DomainErrorCode.GameNotActive,
        'The game has not started yet — waiting for opponent.',
      );
    }
    if (this.isFinished()) {
      throw new DomainError(DomainErrorCode.GameNotActive, 'The game is already over.');
    }
  }

  private requirePlayer(
    playerId: PlayerId,
  ): typeof PlayerColor[keyof typeof PlayerColor] {
    if (playerId === this.whitePlayerId) return PlayerColor.White;
    if (playerId === this.blackPlayerId) return PlayerColor.Black;
    throw new DomainError(
      DomainErrorCode.NotAPlayer,
      'You are not a participant in this game.',
    );
  }

  private requireTurn(color: typeof PlayerColor[keyof typeof PlayerColor]): void {
    const state = this.engine.getState();
    if (state.turn !== color) {
      throw new DomainError(DomainErrorCode.NotYourTurn, 'It is not your turn.');
    }
  }

  private buildSnapshot(state: ChessEngineState): GameSnapshot {
    return {
      gameId: this.gameId,
      gameCode: this.gameCode,
      fen: state.fen,
      pgn: this.engine.exportPgn(),
      status: this.status,
      turn: state.turn,
      whitePlayerId: this.whitePlayerId,
      blackPlayerId: this.blackPlayerId,
      moveHistory: state.moveHistory,
      capturedByWhite: state.capturedByWhite,
      capturedByBlack: state.capturedByBlack,
      isCheck: state.isCheck,
      lastMove: state.lastMove,
      drawOfferedBy: this.drawOfferedBy,
      drawReason: this.drawReason ?? (state.drawType ?? null),
      resignedBy: this.resignedBy,
      winner: this.winner,
    };
  }
}
