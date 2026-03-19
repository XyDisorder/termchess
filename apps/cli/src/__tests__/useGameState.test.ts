import { describe, it, expect } from 'vitest';
import { type GamePhase } from '../hooks/useGameState.js';
import { type ServerMessage, type Fen, type UciMove } from '@termchess/protocol';

// Build a minimal snapshot object compatible with Zod-parsed ServerMessage fields.
// We use plain strings (not branded) since the Zod schema produces plain string types.
function makeRawSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gameId: 'game-1',
    gameCode: 'ABC123',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    status: 'active',
    turn: 'white',
    whitePlayerId: null,
    blackPlayerId: null,
    moveHistory: [],
    capturedByWhite: [],
    capturedByBlack: [],
    isCheck: false,
    lastMove: null,
    drawOfferedBy: null,
    drawReason: null,
    resignedBy: null,
    winner: null,
    ...overrides,
  };
}

// Simulate the handleServerMessage state machine logic without React hooks.
function createGameStateLogic() {
  let phase: GamePhase = { phase: 'connecting' };

  function handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'game_created':
        phase = {
          phase: 'waiting',
          gameCode: msg.gameCode,
          playerColor: msg.playerColor,
        };
        break;

      case 'game_joined':
        // Cast to GamePhase-compatible shape via the same toSnapshot cast used in the hook
        phase = {
          phase: 'playing',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshot: msg.snapshot as any,
          playerColor: msg.playerColor,
        };
        break;

      case 'opponent_connected':
        if (phase.phase === 'waiting') {
          phase = {
            phase: 'playing',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            snapshot: msg.snapshot as any,
            playerColor: phase.playerColor,
          };
        }
        break;

      case 'game_state':
        if (phase.phase === 'playing') {
          phase = {
            phase: 'playing',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            snapshot: msg.snapshot as any,
            playerColor: phase.playerColor,
          };
        } else if (phase.phase === 'waiting') {
          phase = {
            phase: 'playing',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            snapshot: msg.snapshot as any,
            playerColor: phase.playerColor,
          };
        }
        break;

      case 'game_finished': {
        const playerColor =
          phase.phase === 'playing' || phase.phase === 'waiting' || phase.phase === 'finished'
            ? phase.playerColor
            : ('white' as const);
        phase = {
          phase: 'finished',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshot: msg.snapshot as any,
          playerColor,
        };
        break;
      }

      case 'game_error':
        phase = { phase: 'error', message: msg.message };
        break;
    }
  }

  return { getPhase: () => phase, handleServerMessage };
}

describe('useGameState logic', () => {
  it('initial state is connecting', () => {
    const { getPhase } = createGameStateLogic();
    expect(getPhase().phase).toBe('connecting');
  });

  it('game_created transitions to waiting', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();
    const msg = {
      type: 'game_created',
      gameId: 'game-1',
      gameCode: 'ABC123',
      playerColor: 'white',
      snapshot: makeRawSnapshot(),
    } as unknown as ServerMessage;

    handleServerMessage(msg);
    const p = getPhase();
    expect(p.phase).toBe('waiting');
    if (p.phase === 'waiting') {
      expect(p.gameCode).toBe('ABC123');
      expect(p.playerColor).toBe('white');
    }
  });

  it('game_joined transitions to playing', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();
    const msg = {
      type: 'game_joined',
      gameId: 'game-1',
      playerColor: 'black',
      snapshot: makeRawSnapshot({ status: 'active' }),
    } as unknown as ServerMessage;

    handleServerMessage(msg);
    const p = getPhase();
    expect(p.phase).toBe('playing');
    if (p.phase === 'playing') {
      expect(p.playerColor).toBe('black');
    }
  });

  it('game_state message updates snapshot when playing', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();

    handleServerMessage({
      type: 'game_joined',
      gameId: 'game-1',
      playerColor: 'white',
      snapshot: makeRawSnapshot(),
    } as unknown as ServerMessage);

    const updatedSnapshot = makeRawSnapshot({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' as Fen,
      turn: 'black',
      lastMove: 'e2e4' as UciMove,
    });

    handleServerMessage({
      type: 'game_state',
      snapshot: updatedSnapshot,
    } as unknown as ServerMessage);

    const p = getPhase();
    expect(p.phase).toBe('playing');
    if (p.phase === 'playing') {
      expect(p.snapshot.turn).toBe('black');
      expect(p.snapshot.lastMove).toBe('e2e4');
    }
  });

  it('game_finished transitions to finished', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();

    handleServerMessage({
      type: 'game_joined',
      gameId: 'game-1',
      playerColor: 'white',
      snapshot: makeRawSnapshot(),
    } as unknown as ServerMessage);

    handleServerMessage({
      type: 'game_finished',
      snapshot: makeRawSnapshot({ status: 'checkmate', winner: 'white' }),
    } as unknown as ServerMessage);

    const p = getPhase();
    expect(p.phase).toBe('finished');
    if (p.phase === 'finished') {
      expect(p.snapshot.status).toBe('checkmate');
      expect(p.snapshot.winner).toBe('white');
    }
  });

  it('game_error transitions to error phase', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();

    handleServerMessage({
      type: 'game_error',
      code: 'INVALID_MOVE',
      message: 'Invalid move: e2e5',
    } as unknown as ServerMessage);

    const p = getPhase();
    expect(p.phase).toBe('error');
    if (p.phase === 'error') {
      expect(p.message).toBe('Invalid move: e2e5');
    }
  });

  it('opponent_connected while waiting transitions to playing', () => {
    const { getPhase, handleServerMessage } = createGameStateLogic();

    handleServerMessage({
      type: 'game_created',
      gameId: 'game-1',
      gameCode: 'XYZ789',
      playerColor: 'white',
      snapshot: makeRawSnapshot(),
    } as unknown as ServerMessage);

    expect(getPhase().phase).toBe('waiting');

    handleServerMessage({
      type: 'opponent_connected',
      snapshot: makeRawSnapshot({ status: 'active' }),
    } as unknown as ServerMessage);

    expect(getPhase().phase).toBe('playing');
  });
});
