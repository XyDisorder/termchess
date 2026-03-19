import { useState, useCallback } from 'react';
import { GameRegistry, DomainError } from '@termchess/core';
import { type GameSnapshot, type PlayerId, PlayerColor } from '@termchess/protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SoloPhase =
  | { phase: 'playing'; snapshot: GameSnapshot }
  | { phase: 'finished'; snapshot: GameSnapshot };

export interface UseSoloGameReturn {
  phase: SoloPhase;
  currentPlayerLabel: string;
  makeMove: (uci: string) => { ok: true } | { ok: false; error: string };
  resign: () => void;
  offerDraw: () => { ok: true } | { ok: false; error: string };
  acceptDraw: () => void;
  declineDraw: () => void;
  exportPgn: () => string;
}

// ---------------------------------------------------------------------------
// Branded IDs for solo mode
// ---------------------------------------------------------------------------

const WHITE_ID = 'solo-white' as PlayerId;
const BLACK_ID = 'solo-black' as PlayerId;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function createSoloSession() {
  const registry = new GameRegistry();
  const session = registry.createGame(WHITE_ID);
  session.joinGame(BLACK_ID);
  return session;
}

export function useSoloGame(): UseSoloGameReturn {
  // Create the session once on mount; keep it in a ref-like stable ref via
  // lazy state initializer.
  const [session] = useState(() => createSoloSession());
  const [phase, setPhase] = useState<SoloPhase>(() => ({
    phase: 'playing',
    snapshot: session.getSnapshot(),
  }));

  const currentPlayerLabel =
    phase.snapshot.turn === PlayerColor.White ? 'White' : 'Black';

  const makeMove = useCallback(
    (uci: string): { ok: true } | { ok: false; error: string } => {
      try {
        const currentId =
          phase.snapshot.turn === PlayerColor.White ? WHITE_ID : BLACK_ID;
        const snapshot = session.applyMove(currentId, uci as import('@termchess/protocol').UciMove);

        if (session.isFinished()) {
          setPhase({ phase: 'finished', snapshot });
        } else {
          setPhase({ phase: 'playing', snapshot });
        }
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof DomainError ? err.message : 'Illegal move.';
        return { ok: false, error: message };
      }
    },
    [session, phase.snapshot.turn],
  );

  const resign = useCallback((): void => {
    try {
      const currentId =
        phase.snapshot.turn === PlayerColor.White ? WHITE_ID : BLACK_ID;
      const snapshot = session.resign(currentId);
      setPhase({ phase: 'finished', snapshot });
    } catch {
      // Already finished; ignore.
    }
  }, [session, phase.snapshot.turn]);

  const offerDraw = useCallback(():
    | { ok: true }
    | { ok: false; error: string } => {
    // In solo mode: offer then immediately accept as the other side.
    try {
      const currentId =
        phase.snapshot.turn === PlayerColor.White ? WHITE_ID : BLACK_ID;
      session.offerDraw(currentId);
      // Accept immediately as the other player
      const otherId = currentId === WHITE_ID ? BLACK_ID : WHITE_ID;
      const snapshot = session.acceptDraw(otherId);
      setPhase({ phase: 'finished', snapshot });
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof DomainError ? err.message : 'Draw not available.';
      return { ok: false, error: message };
    }
  }, [session, phase.snapshot.turn]);

  // In solo mode, draw is offered-and-accepted atomically above.
  // These two stubs satisfy the interface for completeness.
  const acceptDraw = useCallback((): void => {
    // no-op in solo mode (handled by offerDraw)
  }, []);

  const declineDraw = useCallback((): void => {
    // no-op in solo mode
  }, []);

  const exportPgn = useCallback((): string => {
    return session.exportPgn();
  }, [session]);

  return {
    phase,
    currentPlayerLabel,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    exportPgn,
  };
}
