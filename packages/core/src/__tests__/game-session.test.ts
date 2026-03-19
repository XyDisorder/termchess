import { describe, it, expect, beforeEach } from 'vitest';
import { GameSession } from '../game-session.js';
import { DomainError, DomainErrorCode } from '../domain-errors.js';
import { type GameId, type GameCode, type PlayerId, type UciMove, GameStatus, PlayerColor } from '@termchess/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function id(s: string): GameId {
  return s as GameId;
}
function code(s: string): GameCode {
  return s as GameCode;
}
function player(s: string): PlayerId {
  return s as PlayerId;
}
function uci(s: string): UciMove {
  return s as UciMove;
}

const HOST = player('player-white');
const GUEST = player('player-black');
const STRANGER = player('player-stranger');

function makeActiveSession(): GameSession {
  const session = new GameSession(id('g1'), code('CODE01'), HOST);
  session.joinGame(GUEST);
  return session;
}

// ---------------------------------------------------------------------------
// Construction and joining
// ---------------------------------------------------------------------------

describe('GameSession — construction', () => {
  it('starts in WaitingForOpponent status', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    expect(session.getSnapshot().status).toBe(GameStatus.WaitingForOpponent);
  });

  it('host is assigned white', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    // Can't use getPlayerColor before opponent joins, but snapshot shows white player ID
    expect(session.getSnapshot().whitePlayerId).toBe(HOST);
  });

  it('blackPlayerId is null before join', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    expect(session.getSnapshot().blackPlayerId).toBeNull();
  });

  it('exposes gameId and gameCode', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    expect(session.gameId).toBe('g1');
    expect(session.gameCode).toBe('CODE01');
  });
});

describe('GameSession — joining', () => {
  it('second player joins and gets black', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    const color = session.joinGame(GUEST);
    expect(color).toBe(PlayerColor.Black);
  });

  it('game becomes Active after joining', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    session.joinGame(GUEST);
    expect(session.getSnapshot().status).toBe(GameStatus.Active);
  });

  it('blackPlayerId is set after join', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    session.joinGame(GUEST);
    expect(session.getSnapshot().blackPlayerId).toBe(GUEST);
  });

  it('third player cannot join — game is full', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.joinGame(STRANGER);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.GameAlreadyFull);
  });

  it('host cannot join their own game', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    const err = (() => {
      try {
        session.joinGame(HOST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.PlayerAlreadyInGame);
  });
});

// ---------------------------------------------------------------------------
// Move validation
// ---------------------------------------------------------------------------

describe('GameSession — moves', () => {
  it('white can make a legal opening move', () => {
    const session = makeActiveSession();
    const snapshot = session.applyMove(HOST, uci('e2e4'));
    expect(snapshot.status).toBe(GameStatus.Active);
    expect(snapshot.turn).toBe(PlayerColor.Black);
    expect(snapshot.lastMove).toBe('e2e4');
    expect(snapshot.moveHistory).toHaveLength(1);
  });

  it('move before game starts throws GameNotActive', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    const err = (() => {
      try {
        session.applyMove(HOST, uci('e2e4'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.GameNotActive);
  });

  it('wrong player move throws NotYourTurn', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.applyMove(GUEST, uci('e7e5')); // black tries to go first
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.NotYourTurn);
  });

  it('illegal move throws IllegalMove', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.applyMove(HOST, uci('e2e5'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.IllegalMove);
  });

  it('stranger move throws NotAPlayer', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.applyMove(STRANGER, uci('e2e4'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.NotAPlayer);
  });

  it('alternating moves succeed correctly', () => {
    const session = makeActiveSession();
    session.applyMove(HOST, uci('e2e4'));
    session.applyMove(GUEST, uci('e7e5'));
    const snapshot = session.applyMove(HOST, uci('g1f3'));
    expect(snapshot.moveHistory).toHaveLength(3);
    expect(snapshot.turn).toBe(PlayerColor.Black);
  });

  it('making a move cancels the pending draw offer', () => {
    const session = makeActiveSession();
    // White moves first
    session.applyMove(HOST, uci('e2e4'));
    // Black offers a draw (it is now black's turn)
    session.offerDraw(GUEST);
    expect(session.getSnapshot().drawOfferedBy).toBe(PlayerColor.Black);
    // Black makes a move instead of waiting — this cancels the draw offer
    session.applyMove(GUEST, uci('e7e5'));
    expect(session.getSnapshot().drawOfferedBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scholar's mate — checkmate
// ---------------------------------------------------------------------------

describe('GameSession — checkmate', () => {
  it('scholar\'s mate ends the game with checkmate', () => {
    const session = makeActiveSession();
    session.applyMove(HOST, uci('e2e4'));
    session.applyMove(GUEST, uci('e7e5'));
    session.applyMove(HOST, uci('f1c4'));
    session.applyMove(GUEST, uci('b8c6'));
    session.applyMove(HOST, uci('d1h5'));
    session.applyMove(GUEST, uci('g8f6'));
    const snapshot = session.applyMove(HOST, uci('h5f7'));

    expect(snapshot.status).toBe(GameStatus.Checkmate);
    expect(snapshot.winner).toBe(PlayerColor.White);
    expect(session.isFinished()).toBe(true);
  });

  it('move after checkmate throws GameNotActive', () => {
    const session = makeActiveSession();
    session.applyMove(HOST, uci('e2e4'));
    session.applyMove(GUEST, uci('e7e5'));
    session.applyMove(HOST, uci('f1c4'));
    session.applyMove(GUEST, uci('b8c6'));
    session.applyMove(HOST, uci('d1h5'));
    session.applyMove(GUEST, uci('g8f6'));
    session.applyMove(HOST, uci('h5f7'));

    const err = (() => {
      try {
        session.applyMove(GUEST, uci('e8e7'));
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.GameNotActive);
  });
});

// ---------------------------------------------------------------------------
// Resignation
// ---------------------------------------------------------------------------

describe('GameSession — resignation', () => {
  it('white resigns, black wins', () => {
    const session = makeActiveSession();
    const snapshot = session.resign(HOST);
    expect(snapshot.status).toBe(GameStatus.Resigned);
    expect(snapshot.resignedBy).toBe(PlayerColor.White);
    expect(snapshot.winner).toBe(PlayerColor.Black);
    expect(session.isFinished()).toBe(true);
  });

  it('black resigns, white wins', () => {
    const session = makeActiveSession();
    session.applyMove(HOST, uci('e2e4'));
    const snapshot = session.resign(GUEST);
    expect(snapshot.status).toBe(GameStatus.Resigned);
    expect(snapshot.resignedBy).toBe(PlayerColor.Black);
    expect(snapshot.winner).toBe(PlayerColor.White);
  });

  it('stranger cannot resign', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.resign(STRANGER);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.NotAPlayer);
  });

  it('cannot resign before game starts', () => {
    const session = new GameSession(id('g1'), code('CODE01'), HOST);
    const err = (() => {
      try {
        session.resign(HOST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.GameNotActive);
  });
});

// ---------------------------------------------------------------------------
// Draw offer / accept
// ---------------------------------------------------------------------------

describe('GameSession — draw offer / accept', () => {
  it('white offers draw, snapshot shows drawOfferedBy white', () => {
    const session = makeActiveSession();
    const snapshot = session.offerDraw(HOST);
    expect(snapshot.drawOfferedBy).toBe(PlayerColor.White);
    expect(snapshot.status).toBe(GameStatus.Active);
  });

  it('black accepts draw, game ends as draw by agreement', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const snapshot = session.acceptDraw(GUEST);
    expect(snapshot.status).toBe(GameStatus.Draw);
    expect(snapshot.drawReason).toBe('agreement');
    expect(session.isFinished()).toBe(true);
  });

  it('white accepts draw from black', () => {
    const session = makeActiveSession();
    session.offerDraw(GUEST);
    const snapshot = session.acceptDraw(HOST);
    expect(snapshot.status).toBe(GameStatus.Draw);
    expect(snapshot.drawReason).toBe('agreement');
  });
});

// ---------------------------------------------------------------------------
// Draw offer / decline
// ---------------------------------------------------------------------------

describe('GameSession — draw offer / decline', () => {
  it('black declines draw offer, game continues', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const snapshot = session.declineDraw(GUEST);
    expect(snapshot.status).toBe(GameStatus.Active);
    expect(snapshot.drawOfferedBy).toBeNull();
  });

  it('declining when no offer was made throws DrawNotOffered', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.declineDraw(GUEST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawNotOffered);
  });

  it('accepting when no offer was made throws DrawNotOffered', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.acceptDraw(GUEST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawNotOffered);
  });

  it('cannot accept your own draw offer', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const err = (() => {
      try {
        session.acceptDraw(HOST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawNotOffered);
  });

  it('cannot decline your own draw offer', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const err = (() => {
      try {
        session.declineDraw(HOST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawNotOffered);
  });
});

// ---------------------------------------------------------------------------
// Double draw offer
// ---------------------------------------------------------------------------

describe('GameSession — double draw offer', () => {
  it('offering draw when one is already pending throws DrawAlreadyOffered', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const err = (() => {
      try {
        session.offerDraw(GUEST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawAlreadyOffered);
  });

  it('offering draw twice from same player throws DrawAlreadyOffered', () => {
    const session = makeActiveSession();
    session.offerDraw(HOST);
    const err = (() => {
      try {
        session.offerDraw(HOST);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.DrawAlreadyOffered);
  });
});

// ---------------------------------------------------------------------------
// Abandon
// ---------------------------------------------------------------------------

describe('GameSession — abandon', () => {
  it('abandoned game is finished', () => {
    const session = makeActiveSession();
    session.abandon();
    expect(session.getSnapshot().status).toBe(GameStatus.Abandoned);
    expect(session.isFinished()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPlayerColor
// ---------------------------------------------------------------------------

describe('GameSession — getPlayerColor', () => {
  it('returns white for host', () => {
    const session = makeActiveSession();
    expect(session.getPlayerColor(HOST)).toBe(PlayerColor.White);
  });

  it('returns black for guest', () => {
    const session = makeActiveSession();
    expect(session.getPlayerColor(GUEST)).toBe(PlayerColor.Black);
  });

  it('throws NotAPlayer for stranger', () => {
    const session = makeActiveSession();
    const err = (() => {
      try {
        session.getPlayerColor(STRANGER);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(DomainErrorCode.NotAPlayer);
  });
});

// ---------------------------------------------------------------------------
// PGN export
// ---------------------------------------------------------------------------

describe('GameSession — exportPgn', () => {
  it('returns pgn after moves', () => {
    const session = makeActiveSession();
    session.applyMove(HOST, uci('e2e4'));
    session.applyMove(GUEST, uci('e7e5'));
    const pgn = session.exportPgn();
    expect(pgn).toContain('e4');
    expect(pgn).toContain('e5');
  });
});
