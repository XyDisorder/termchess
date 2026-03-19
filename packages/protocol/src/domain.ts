// Branded types for type-safe identifiers
export type GameId = string & { readonly __brand: 'GameId' };
export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type GameCode = string & { readonly __brand: 'GameCode' };
export type Fen = string & { readonly __brand: 'Fen' };
export type Pgn = string & { readonly __brand: 'Pgn' };
export type UciMove = string & { readonly __brand: 'UciMove' };

export const PlayerColor = {
  White: 'white',
  Black: 'black',
} as const;
export type PlayerColor = (typeof PlayerColor)[keyof typeof PlayerColor];

export const GameStatus = {
  WaitingForOpponent: 'waiting_for_opponent',
  Active: 'active',
  Checkmate: 'checkmate',
  Stalemate: 'stalemate',
  Draw: 'draw',
  Resigned: 'resigned',
  Abandoned: 'abandoned',
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export const DrawReason = {
  Agreement: 'agreement',
  Stalemate: 'stalemate',
  InsufficientMaterial: 'insufficient_material',
  Repetition: 'repetition',
  FiftyMoves: 'fifty_moves',
} as const;
export type DrawReason = (typeof DrawReason)[keyof typeof DrawReason];

export interface MoveHistoryEntry {
  readonly san: string;
  readonly uci: UciMove;
  readonly fen: Fen;
  readonly moveNumber: number;
}

export interface GameSnapshot {
  readonly gameId: GameId;
  readonly gameCode: GameCode;
  readonly fen: Fen;
  readonly pgn: Pgn;
  readonly status: GameStatus;
  readonly turn: PlayerColor;
  readonly whitePlayerId: PlayerId | null;
  readonly blackPlayerId: PlayerId | null;
  readonly moveHistory: readonly MoveHistoryEntry[];
  readonly capturedByWhite: readonly string[];
  readonly capturedByBlack: readonly string[];
  readonly isCheck: boolean;
  readonly lastMove: UciMove | null;
  readonly drawOfferedBy: PlayerColor | null;
  readonly drawReason: DrawReason | null;
  readonly resignedBy: PlayerColor | null;
  readonly winner: PlayerColor | null;
}
