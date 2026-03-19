import { z } from 'zod';
import { type PlayerColor } from './domain.js';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const PlayerColorSchema = z.enum(['white', 'black']);

const MoveHistoryEntrySchema = z.object({
  san: z.string(),
  uci: z.string(),
  fen: z.string(),
  moveNumber: z.number().int().positive(),
});

const GameStatusSchema = z.enum([
  'waiting_for_opponent',
  'active',
  'checkmate',
  'stalemate',
  'draw',
  'resigned',
  'abandoned',
]);

const DrawReasonSchema = z.enum([
  'agreement',
  'stalemate',
  'insufficient_material',
  'repetition',
  'fifty_moves',
]);

const GameSnapshotSchema = z.object({
  gameId: z.string(),
  gameCode: z.string(),
  fen: z.string(),
  pgn: z.string(),
  status: GameStatusSchema,
  turn: PlayerColorSchema,
  whitePlayerId: z.string().nullable(),
  blackPlayerId: z.string().nullable(),
  moveHistory: z.array(MoveHistoryEntrySchema),
  capturedByWhite: z.array(z.string()),
  capturedByBlack: z.array(z.string()),
  isCheck: z.boolean(),
  lastMove: z.string().nullable(),
  drawOfferedBy: PlayerColorSchema.nullable(),
  drawReason: DrawReasonSchema.nullable(),
  resignedBy: PlayerColorSchema.nullable(),
  winner: PlayerColorSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Client-to-server message schemas
// ---------------------------------------------------------------------------

export const CreateGameMessageSchema = z
  .object({
    type: z.literal('create_game'),
  })
  .strict();

export const JoinGameMessageSchema = z
  .object({
    type: z.literal('join_game'),
    gameCode: z.string().min(1),
  })
  .strict();

export const MakeMoveMessageSchema = z
  .object({
    type: z.literal('make_move'),
    uci: z.string().min(4).max(5),
  })
  .strict();

export const ResignMessageSchema = z
  .object({
    type: z.literal('resign'),
  })
  .strict();

export const OfferDrawMessageSchema = z
  .object({
    type: z.literal('offer_draw'),
  })
  .strict();

export const AcceptDrawMessageSchema = z
  .object({
    type: z.literal('accept_draw'),
  })
  .strict();

export const DeclineDrawMessageSchema = z
  .object({
    type: z.literal('decline_draw'),
  })
  .strict();

export const RequestPgnMessageSchema = z
  .object({
    type: z.literal('request_pgn'),
  })
  .strict();

export const PingMessageSchema = z
  .object({
    type: z.literal('ping'),
  })
  .strict();

// Client message union schema
export const ClientMessageSchema = z.discriminatedUnion('type', [
  CreateGameMessageSchema,
  JoinGameMessageSchema,
  MakeMoveMessageSchema,
  ResignMessageSchema,
  OfferDrawMessageSchema,
  AcceptDrawMessageSchema,
  DeclineDrawMessageSchema,
  RequestPgnMessageSchema,
  PingMessageSchema,
]);

// Client message TypeScript types
export type CreateGameMessage = z.infer<typeof CreateGameMessageSchema>;
export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export type MakeMoveMessage = z.infer<typeof MakeMoveMessageSchema>;
export type ResignMessage = z.infer<typeof ResignMessageSchema>;
export type OfferDrawMessage = z.infer<typeof OfferDrawMessageSchema>;
export type AcceptDrawMessage = z.infer<typeof AcceptDrawMessageSchema>;
export type DeclineDrawMessage = z.infer<typeof DeclineDrawMessageSchema>;
export type RequestPgnMessage = z.infer<typeof RequestPgnMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Server-to-client message schemas
// ---------------------------------------------------------------------------

export const GameCreatedMessageSchema = z
  .object({
    type: z.literal('game_created'),
    gameId: z.string(),
    gameCode: z.string(),
    playerColor: PlayerColorSchema,
    snapshot: GameSnapshotSchema,
  })
  .strict();

export const GameJoinedMessageSchema = z
  .object({
    type: z.literal('game_joined'),
    gameId: z.string(),
    playerColor: PlayerColorSchema,
    snapshot: GameSnapshotSchema,
  })
  .strict();

export const GameStateMessageSchema = z
  .object({
    type: z.literal('game_state'),
    snapshot: GameSnapshotSchema,
  })
  .strict();

export const GameErrorMessageSchema = z
  .object({
    type: z.literal('game_error'),
    code: z.string(),
    message: z.string(),
  })
  .strict();

export const OpponentConnectedMessageSchema = z
  .object({
    type: z.literal('opponent_connected'),
    snapshot: GameSnapshotSchema,
  })
  .strict();

export const OpponentDisconnectedMessageSchema = z
  .object({
    type: z.literal('opponent_disconnected'),
  })
  .strict();

export const DrawOfferedMessageSchema = z
  .object({
    type: z.literal('draw_offered'),
    by: PlayerColorSchema,
  })
  .strict();

export const DrawDeclinedMessageSchema = z
  .object({
    type: z.literal('draw_declined'),
  })
  .strict();

export const GameFinishedMessageSchema = z
  .object({
    type: z.literal('game_finished'),
    snapshot: GameSnapshotSchema,
  })
  .strict();

export const PgnResponseMessageSchema = z
  .object({
    type: z.literal('pgn_response'),
    pgn: z.string(),
  })
  .strict();

export const PongMessageSchema = z
  .object({
    type: z.literal('pong'),
  })
  .strict();

// Server message union schema
export const ServerMessageSchema = z.discriminatedUnion('type', [
  GameCreatedMessageSchema,
  GameJoinedMessageSchema,
  GameStateMessageSchema,
  GameErrorMessageSchema,
  OpponentConnectedMessageSchema,
  OpponentDisconnectedMessageSchema,
  DrawOfferedMessageSchema,
  DrawDeclinedMessageSchema,
  GameFinishedMessageSchema,
  PgnResponseMessageSchema,
  PongMessageSchema,
]);

// Server message TypeScript types
export type GameCreatedMessage = z.infer<typeof GameCreatedMessageSchema>;
export type GameJoinedMessage = z.infer<typeof GameJoinedMessageSchema>;
export type GameStateMessage = z.infer<typeof GameStateMessageSchema>;
export type GameErrorMessage = z.infer<typeof GameErrorMessageSchema>;
export type OpponentConnectedMessage = z.infer<typeof OpponentConnectedMessageSchema>;
export type OpponentDisconnectedMessage = z.infer<typeof OpponentDisconnectedMessageSchema>;
export type DrawOfferedMessage = z.infer<typeof DrawOfferedMessageSchema>;
export type DrawDeclinedMessage = z.infer<typeof DrawDeclinedMessageSchema>;
export type GameFinishedMessage = z.infer<typeof GameFinishedMessageSchema>;
export type PgnResponseMessage = z.infer<typeof PgnResponseMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ---------------------------------------------------------------------------
// Parse functions
// ---------------------------------------------------------------------------

/**
 * Parse an unknown value as a ClientMessage.
 * Throws a ZodError if the value is invalid.
 */
export function parseClientMessage(raw: unknown): ClientMessage {
  return ClientMessageSchema.parse(raw);
}

/**
 * Parse an unknown value as a ServerMessage.
 * Throws a ZodError if the value is invalid.
 */
export function parseServerMessage(raw: unknown): ServerMessage {
  return ServerMessageSchema.parse(raw);
}

/**
 * Safe parse an unknown value as a ClientMessage.
 * Returns a result object instead of throwing.
 */
export function safeParseClientMessage(
  raw: unknown,
): z.SafeParseReturnType<unknown, ClientMessage> {
  return ClientMessageSchema.safeParse(raw);
}

/**
 * Safe parse an unknown value as a ServerMessage.
 * Returns a result object instead of throwing.
 */
export function safeParseServerMessage(
  raw: unknown,
): z.SafeParseReturnType<unknown, ServerMessage> {
  return ServerMessageSchema.safeParse(raw);
}

// Re-export PlayerColor type for convenience of message consumers
export type { PlayerColor };
