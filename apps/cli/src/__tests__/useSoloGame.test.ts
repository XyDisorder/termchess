import { describe, it, expect, beforeEach } from 'vitest';
import { GameRegistry, DomainError } from '@termchess/core';
import { type PlayerId, PlayerColor, GameStatus } from '@termchess/protocol';

// ---------------------------------------------------------------------------
// We test the core logic that useSoloGame wraps, without React hooks.
// This mirrors the pattern used in useGameState.test.ts.
// ---------------------------------------------------------------------------

const WHITE_ID = 'solo-white' as PlayerId;
const BLACK_ID = 'solo-black' as PlayerId;

function createSoloSession() {
  const registry = new GameRegistry();
  const session = registry.createGame(WHITE_ID);
  session.joinGame(BLACK_ID);
  return session;
}

describe('useSoloGame logic (via GameSession)', () => {
  it('initial state is playing with white to move', () => {
    const session = createSoloSession();
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe(GameStatus.Active);
    expect(snapshot.turn).toBe(PlayerColor.White);
  });

  it('white can make a legal move; turn switches to black', () => {
    const session = createSoloSession();

    session.applyMove(WHITE_ID, 'e2e4' as import('@termchess/protocol').UciMove);
    const snapshot = session.getSnapshot();

    expect(snapshot.turn).toBe(PlayerColor.Black);
    expect(snapshot.lastMove).toBe('e2e4');
  });

  it('black can make a move after white; turn switches back to white', () => {
    const session = createSoloSession();

    session.applyMove(WHITE_ID, 'e2e4' as import('@termchess/protocol').UciMove);
    session.applyMove(BLACK_ID, 'e7e5' as import('@termchess/protocol').UciMove);
    const snapshot = session.getSnapshot();

    expect(snapshot.turn).toBe(PlayerColor.White);
    expect(snapshot.lastMove).toBe('e7e5');
  });

  it('illegal move throws DomainError', () => {
    const session = createSoloSession();

    expect(() => {
      session.applyMove(WHITE_ID, 'e2e5' as import('@termchess/protocol').UciMove);
    }).toThrow(DomainError);
  });

  it('playing as the wrong color throws DomainError (not your turn)', () => {
    const session = createSoloSession();
    // It's white's turn; black tries to move
    expect(() => {
      session.applyMove(BLACK_ID, 'e7e5' as import('@termchess/protocol').UciMove);
    }).toThrow(DomainError);
  });

  it("Scholar's mate ends game with checkmate status", () => {
    const session = createSoloSession();

    // Scholar's mate sequence
    const moves: Array<[PlayerId, string]> = [
      [WHITE_ID, 'e2e4'],
      [BLACK_ID, 'e7e5'],
      [WHITE_ID, 'f1c4'],
      [BLACK_ID, 'b8c6'],
      [WHITE_ID, 'd1h5'],
      [BLACK_ID, 'a7a6'],
      [WHITE_ID, 'h5f7'],
    ];

    for (const [player, uci] of moves) {
      session.applyMove(player as PlayerId, uci as import('@termchess/protocol').UciMove);
    }

    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe(GameStatus.Checkmate);
    expect(snapshot.winner).toBe(PlayerColor.White);
    expect(session.isFinished()).toBe(true);
  });

  it('resign ends the game immediately', () => {
    const session = createSoloSession();

    // White resigns on move 1
    session.resign(WHITE_ID);

    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe(GameStatus.Resigned);
    expect(snapshot.resignedBy).toBe(PlayerColor.White);
    expect(snapshot.winner).toBe(PlayerColor.Black);
    expect(session.isFinished()).toBe(true);
  });

  it('exportPgn returns a non-empty string after moves', () => {
    const session = createSoloSession();

    session.applyMove(WHITE_ID, 'e2e4' as import('@termchess/protocol').UciMove);
    session.applyMove(BLACK_ID, 'e7e5' as import('@termchess/protocol').UciMove);

    const pgn = session.exportPgn();
    expect(typeof pgn).toBe('string');
    expect(pgn.length).toBeGreaterThan(0);
  });

  it('exportPgn on a fresh game returns a string (possibly empty headers)', () => {
    const session = createSoloSession();
    const pgn = session.exportPgn();
    expect(typeof pgn).toBe('string');
  });

  it('draw by agreement sets status to draw', () => {
    const session = createSoloSession();

    session.applyMove(WHITE_ID, 'e2e4' as import('@termchess/protocol').UciMove);

    // White offers, black accepts
    session.offerDraw(WHITE_ID);
    const snapshot = session.acceptDraw(BLACK_ID);

    expect(snapshot.status).toBe(GameStatus.Draw);
    expect(session.isFinished()).toBe(true);
  });

  it('move history grows with each move', () => {
    const session = createSoloSession();

    session.applyMove(WHITE_ID, 'e2e4' as import('@termchess/protocol').UciMove);
    expect(session.getSnapshot().moveHistory).toHaveLength(1);

    session.applyMove(BLACK_ID, 'e7e5' as import('@termchess/protocol').UciMove);
    expect(session.getSnapshot().moveHistory).toHaveLength(2);
  });
});
