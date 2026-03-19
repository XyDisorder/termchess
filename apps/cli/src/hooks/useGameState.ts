import { useState, useCallback } from 'react';
import {
  type ServerMessage,
  type ClientMessage,
  type PlayerColor,
  type GameSnapshot,
} from '@termchess/protocol';

export type GamePhase =
  | { phase: 'connecting' }
  | { phase: 'lobby' }
  | { phase: 'waiting'; gameCode: string; playerColor: PlayerColor }
  | { phase: 'playing'; snapshot: GameSnapshot; playerColor: PlayerColor }
  | { phase: 'finished'; snapshot: GameSnapshot; playerColor: PlayerColor }
  | { phase: 'error'; message: string };

interface UseGameStateReturn {
  gamePhase: GamePhase;
  handleServerMessage: (msg: ServerMessage) => void;
  createGame: () => ClientMessage;
  joinGame: (code: string) => ClientMessage;
  makeMove: (uci: string) => ClientMessage;
  resign: () => ClientMessage;
  offerDraw: () => ClientMessage;
  acceptDraw: () => ClientMessage;
  declineDraw: () => ClientMessage;
  requestPgn: () => ClientMessage;
}

// The Zod-parsed snapshot type from ServerMessage uses plain strings, not branded types.
// We cast it to the domain GameSnapshot which uses branded types.
// This is safe because the values are compatible at runtime.
function toSnapshot(raw: unknown): GameSnapshot {
  return raw as GameSnapshot;
}

// Rebuild a snapshot with updated drawOfferedBy.
function withDrawOfferedBy(
  snapshot: GameSnapshot,
  drawOfferedBy: PlayerColor | null,
): GameSnapshot {
  return toSnapshot({ ...snapshot, drawOfferedBy });
}

export function useGameState(): UseGameStateReturn {
  const [gamePhase, setGamePhase] = useState<GamePhase>({ phase: 'connecting' });

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'game_created':
        setGamePhase({
          phase: 'waiting',
          gameCode: msg.gameCode,
          playerColor: msg.playerColor,
        });
        break;

      case 'game_joined':
        setGamePhase({
          phase: 'playing',
          snapshot: toSnapshot(msg.snapshot),
          playerColor: msg.playerColor,
        });
        break;

      case 'opponent_connected': {
        const snapshot = toSnapshot(msg.snapshot);
        setGamePhase((prev) => {
          if (prev.phase === 'waiting') {
            return { phase: 'playing', snapshot, playerColor: prev.playerColor };
          }
          return prev;
        });
        break;
      }

      case 'game_state': {
        const snapshot = toSnapshot(msg.snapshot);
        setGamePhase((prev) => {
          if (prev.phase === 'playing' || prev.phase === 'waiting') {
            return { phase: 'playing', snapshot, playerColor: prev.playerColor };
          }
          return prev;
        });
        break;
      }

      case 'game_finished': {
        const snapshot = toSnapshot(msg.snapshot);
        setGamePhase((prev) => {
          const playerColor: PlayerColor =
            prev.phase === 'playing' || prev.phase === 'waiting' || prev.phase === 'finished'
              ? prev.playerColor
              : 'white';
          return { phase: 'finished', snapshot, playerColor };
        });
        break;
      }

      case 'game_error':
        setGamePhase({ phase: 'error', message: msg.message });
        break;

      case 'draw_offered': {
        const by = msg.by;
        setGamePhase((prev) => {
          if (prev.phase === 'playing') {
            return {
              phase: 'playing',
              snapshot: withDrawOfferedBy(prev.snapshot, by),
              playerColor: prev.playerColor,
            };
          }
          return prev;
        });
        break;
      }

      case 'draw_declined':
        setGamePhase((prev) => {
          if (prev.phase === 'playing') {
            return {
              phase: 'playing',
              snapshot: withDrawOfferedBy(prev.snapshot, null),
              playerColor: prev.playerColor,
            };
          }
          return prev;
        });
        break;

      case 'opponent_disconnected':
        // Keep state; App layer shows a status message
        break;

      case 'pgn_response':
        // Handled at App level
        break;

      case 'pong':
        break;
    }
  }, []);

  const createGame = useCallback((): ClientMessage => ({ type: 'create_game' }), []);

  const joinGame = useCallback((code: string): ClientMessage => ({
    type: 'join_game',
    gameCode: code,
  }), []);

  const makeMove = useCallback((uci: string): ClientMessage => ({
    type: 'make_move',
    uci,
  }), []);

  const resign = useCallback((): ClientMessage => ({ type: 'resign' }), []);
  const offerDraw = useCallback((): ClientMessage => ({ type: 'offer_draw' }), []);
  const acceptDraw = useCallback((): ClientMessage => ({ type: 'accept_draw' }), []);
  const declineDraw = useCallback((): ClientMessage => ({ type: 'decline_draw' }), []);
  const requestPgn = useCallback((): ClientMessage => ({ type: 'request_pgn' }), []);

  return {
    gamePhase,
    handleServerMessage,
    createGame,
    joinGame,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    requestPgn,
  };
}
