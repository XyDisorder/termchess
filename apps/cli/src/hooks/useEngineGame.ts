import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRegistry, DomainError } from '@termchess/core';
import { type GameSnapshot, type PlayerId, type UciMove } from '@termchess/protocol';
import { UciEngine, type EngineOptions } from '../engine/uci-engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_OPTIONS: Record<Difficulty, EngineOptions> = {
  easy:   { skillLevel: 1,  movetime: 200 },
  medium: { skillLevel: 10, movetime: 500 },
  hard:   { skillLevel: 20, movetime: 2000 },
};

export type EnginePhase =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; snapshot: GameSnapshot }
  | { phase: 'engine_thinking'; snapshot: GameSnapshot }
  | { phase: 'finished'; snapshot: GameSnapshot };

export interface UseEngineGameReturn {
  phase: EnginePhase;
  makeMove: (uci: string) => { ok: true } | { ok: false; error: string };
  resign: () => void;
  exportPgn: () => string;
}

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

const WHITE_ID = 'engine-white' as PlayerId;
const BLACK_ID = 'engine-black' as PlayerId;

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

function createEngineSession() {
  const registry = new GameRegistry();
  const session = registry.createGame(WHITE_ID);
  session.joinGame(BLACK_ID);
  return session;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEngineGame(difficulty: Difficulty): UseEngineGameReturn {
  // Stable session — created once
  const [session] = useState(() => createEngineSession());

  // Engine instance lives in a ref to avoid triggering re-renders
  const engineRef = useRef<UciEngine | null>(null);

  const [phase, setPhase] = useState<EnginePhase>({ phase: 'loading' });

  // Track whether the component is still mounted to avoid setting state after unmount
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Start engine on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    const engine = new UciEngine(DIFFICULTY_OPTIONS[difficulty]);
    engineRef.current = engine;

    engine
      .start()
      .then(() => {
        if (!mountedRef.current) return;
        setPhase({ phase: 'playing', snapshot: session.getSnapshot() });
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to start engine.';
        setPhase({ phase: 'error', message });
      });

    return () => {
      mountedRef.current = false;
      engineRef.current?.quit();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // ---------------------------------------------------------------------------
  // makeMove — player (White) submits a move
  // ---------------------------------------------------------------------------

  const makeMove = useCallback(
    (uci: string): { ok: true } | { ok: false; error: string } => {
      if (phase.phase !== 'playing') {
        return { ok: false, error: 'Not in playing state.' };
      }

      let snapshot: GameSnapshot;
      try {
        snapshot = session.applyMove(WHITE_ID, uci as UciMove);
      } catch (err) {
        const message =
          err instanceof DomainError ? err.message : 'Illegal move.';
        return { ok: false, error: message };
      }

      if (session.isFinished()) {
        setPhase({ phase: 'finished', snapshot });
        return { ok: true };
      }

      // Transition to engine_thinking — snapshot is captured in closure
      setPhase({ phase: 'engine_thinking', snapshot });

      const currentFen = snapshot.fen;
      const engine = engineRef.current;

      if (!engine) {
        setPhase({ phase: 'error', message: 'Engine is not available.' });
        return { ok: true };
      }

      // Async: let engine compute and play its move
      engine
        .getBestMove(currentFen)
        .then((bestMove) => {
          if (!mountedRef.current) return;
          let engineSnapshot: GameSnapshot;
          try {
            engineSnapshot = session.applyMove(BLACK_ID, bestMove as UciMove);
          } catch (err) {
            // Engine returned an illegal move — shouldn't happen with a real engine
            const message =
              err instanceof DomainError
                ? err.message
                : `Engine move error: ${String(err)}`;
            setPhase({ phase: 'error', message });
            return;
          }

          if (!mountedRef.current) return;

          if (session.isFinished()) {
            setPhase({ phase: 'finished', snapshot: engineSnapshot });
          } else {
            setPhase({ phase: 'playing', snapshot: engineSnapshot });
          }
        })
        .catch((err: unknown) => {
          if (!mountedRef.current) return;
          const message =
            err instanceof Error ? err.message : 'Engine error.';
          setPhase({ phase: 'error', message });
        });

      return { ok: true };
    },
    [phase, session],
  );

  // ---------------------------------------------------------------------------
  // resign
  // ---------------------------------------------------------------------------

  const resign = useCallback((): void => {
    try {
      const snapshot = session.resign(WHITE_ID);
      setPhase({ phase: 'finished', snapshot });
    } catch {
      // Game already over; ignore.
    }
  }, [session]);

  // ---------------------------------------------------------------------------
  // exportPgn
  // ---------------------------------------------------------------------------

  const exportPgn = useCallback((): string => {
    return session.exportPgn();
  }, [session]);

  return { phase, makeMove, resign, exportPgn };
}
