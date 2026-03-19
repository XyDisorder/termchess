import { ZodError } from 'zod';
import { DomainError, DomainErrorCode } from '@termchess/core';
import {
  parseClientMessage,
  type UciMove,
  type GameCode,
  type GameSnapshot,
  type PlayerId,
  type GameId,
} from '@termchess/protocol';
import type { FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { SessionManager } from './session-manager.js';

function ser(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function snapshotToPlain(s: GameSnapshot): Record<string, unknown> {
  return {
    gameId: s.gameId,
    gameCode: s.gameCode,
    fen: s.fen,
    pgn: s.pgn,
    status: s.status,
    turn: s.turn,
    whitePlayerId: s.whitePlayerId,
    blackPlayerId: s.blackPlayerId,
    moveHistory: [...s.moveHistory],
    capturedByWhite: [...s.capturedByWhite],
    capturedByBlack: [...s.capturedByBlack],
    isCheck: s.isCheck,
    lastMove: s.lastMove,
    drawOfferedBy: s.drawOfferedBy,
    drawReason: s.drawReason,
    resignedBy: s.resignedBy,
    winner: s.winner,
  };
}

function sendPlayer(sm: SessionManager, playerId: PlayerId, obj: Record<string, unknown>): void {
  sm.sendJsonToPlayer(playerId, ser(obj));
}

function broadcast(sm: SessionManager, gameId: GameId, obj: Record<string, unknown>): void {
  sm.broadcastJsonToGame(gameId, ser(obj));
}

function sendError(sm: SessionManager, playerId: PlayerId, code: string, message: string): void {
  sendPlayer(sm, playerId, { type: 'game_error', code, message });
}

function sendErrorRaw(ws: { send: (d: string) => void }, code: string, message: string): void {
  ws.send(ser({ type: 'game_error', code, message }));
}

function friendlyMessage(err: DomainError): string {
  switch (err.code) {
    case DomainErrorCode.GameNotFound:
      return 'Game not found. Check the code and try again.';
    case DomainErrorCode.GameAlreadyFull:
      return 'This game is already full.';
    default:
      return err.message;
  }
}

export function createWsHandler(
  sessionManager: SessionManager,
): (connection: SocketStream, req: FastifyRequest) => void {
  return (connection: SocketStream, _req: FastifyRequest): void => {
    const ws = connection.socket;

    const playerId = sessionManager.registerConnection({
      send: (data: string) => ws.send(data),
      close: () => ws.close(),
    });

    connection.on('data', (rawData: unknown) => {
      let parsed: unknown;

      try {
        const text =
          rawData instanceof Buffer
            ? rawData.toString('utf8')
            : typeof rawData === 'string'
              ? rawData
              : JSON.stringify(rawData);
        parsed = JSON.parse(text);
      } catch {
        sendErrorRaw({ send: (d) => ws.send(d) }, 'PARSE_ERROR', 'Invalid JSON.');
        return;
      }

      let msg: ReturnType<typeof parseClientMessage>;
      try {
        msg = parseClientMessage(parsed);
      } catch (err) {
        if (err instanceof ZodError) {
          sendErrorRaw(
            { send: (d) => ws.send(d) },
            'INVALID_MESSAGE',
            err.errors[0]?.message ?? 'Invalid message.',
          );
        } else {
          sendErrorRaw({ send: (d) => ws.send(d) }, 'INVALID_MESSAGE', 'Invalid message format.');
        }
        return;
      }

      try {
        dispatchMessage(sessionManager, playerId, msg);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        sendError(sessionManager, playerId, 'UNKNOWN_ERROR', message);
      }
    });

    connection.on('close', () => {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session !== undefined && !session.isFinished()) {
        const opponentId = sessionManager.getOpponent(playerId, session);
        if (opponentId !== null) {
          sendPlayer(sessionManager, opponentId, { type: 'opponent_disconnected' });
        }
      }
      sessionManager.removeConnection(playerId);
    });
  };
}

export function dispatchMessage(
  sessionManager: SessionManager,
  playerId: PlayerId,
  msg: ReturnType<typeof parseClientMessage>,
): void {
  switch (msg.type) {
    case 'create_game': {
      const existingSession = sessionManager.getSessionForPlayer(playerId);
      if (existingSession !== undefined) {
        sendError(sessionManager, playerId, 'ALREADY_IN_GAME', 'You are already in a game.');
        return;
      }
      const session = sessionManager.createGame(playerId);
      const snapshot = snapshotToPlain(session.getSnapshot());
      sendPlayer(sessionManager, playerId, {
        type: 'game_created',
        gameId: session.gameId,
        gameCode: session.gameCode,
        playerColor: 'white',
        snapshot,
      });
      break;
    }

    case 'join_game': {
      const existingSession = sessionManager.getSessionForPlayer(playerId);
      if (existingSession !== undefined) {
        sendError(sessionManager, playerId, 'ALREADY_IN_GAME', 'You are already in a game.');
        return;
      }
      let session;
      try {
        session = sessionManager.joinGame(playerId, msg.gameCode as GameCode);
      } catch (err) {
        if (err instanceof DomainError) {
          sendError(sessionManager, playerId, err.code, friendlyMessage(err));
        } else {
          sendError(sessionManager, playerId, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
        }
        return;
      }

      const snapshot = snapshotToPlain(session.getSnapshot());

      sendPlayer(sessionManager, playerId, {
        type: 'game_joined',
        gameId: session.gameId,
        playerColor: 'black',
        snapshot,
      });

      const hostId = sessionManager.getOpponent(playerId, session);
      if (hostId !== null) {
        sendPlayer(sessionManager, hostId, { type: 'opponent_connected', snapshot });
      }

      broadcast(sessionManager, session.gameId, { type: 'game_state', snapshot });
      break;
    }

    case 'make_move': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      let raw;
      try {
        raw = session.applyMove(playerId, msg.uci as UciMove);
      } catch (err) {
        if (err instanceof DomainError) {
          sendError(sessionManager, playerId, err.code, err.message);
        } else {
          sendError(sessionManager, playerId, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
        }
        return;
      }

      const snapshot = snapshotToPlain(raw);
      broadcast(sessionManager, session.gameId, { type: 'game_state', snapshot });

      if (session.isFinished()) {
        broadcast(sessionManager, session.gameId, { type: 'game_finished', snapshot });
      }
      break;
    }

    case 'resign': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      const snapshot = snapshotToPlain(session.resign(playerId));
      broadcast(sessionManager, session.gameId, { type: 'game_finished', snapshot });
      break;
    }

    case 'offer_draw': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      let raw;
      try {
        raw = session.offerDraw(playerId);
      } catch (err) {
        if (err instanceof DomainError) {
          sendError(sessionManager, playerId, err.code, err.message);
        } else {
          sendError(sessionManager, playerId, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
        }
        return;
      }

      const playerColor = session.getPlayerColor(playerId);
      const opponentId = sessionManager.getOpponent(playerId, session);
      if (opponentId !== null) {
        sendPlayer(sessionManager, opponentId, { type: 'draw_offered', by: playerColor });
      }
      const snapshot = snapshotToPlain(raw);
      broadcast(sessionManager, session.gameId, { type: 'game_state', snapshot });
      break;
    }

    case 'accept_draw': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      let raw;
      try {
        raw = session.acceptDraw(playerId);
      } catch (err) {
        if (err instanceof DomainError) {
          sendError(sessionManager, playerId, err.code, err.message);
        } else {
          sendError(sessionManager, playerId, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
        }
        return;
      }
      const snapshot = snapshotToPlain(raw);
      broadcast(sessionManager, session.gameId, { type: 'game_finished', snapshot });
      break;
    }

    case 'decline_draw': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      let raw;
      try {
        raw = session.declineDraw(playerId);
      } catch (err) {
        if (err instanceof DomainError) {
          sendError(sessionManager, playerId, err.code, err.message);
        } else {
          sendError(sessionManager, playerId, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
        }
        return;
      }

      const opponentId = sessionManager.getOpponent(playerId, session);
      if (opponentId !== null) {
        sendPlayer(sessionManager, opponentId, { type: 'draw_declined' });
      }
      const snapshot = snapshotToPlain(raw);
      broadcast(sessionManager, session.gameId, { type: 'game_state', snapshot });
      break;
    }

    case 'request_pgn': {
      const session = sessionManager.getSessionForPlayer(playerId);
      if (session === undefined) {
        sendError(sessionManager, playerId, 'NOT_IN_GAME', 'You are not in a game.');
        return;
      }
      sendPlayer(sessionManager, playerId, { type: 'pgn_response', pgn: session.exportPgn() });
      break;
    }

    case 'ping': {
      sendPlayer(sessionManager, playerId, { type: 'pong' });
      break;
    }

    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
}
