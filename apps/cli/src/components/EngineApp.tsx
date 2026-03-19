import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { useEngineGame, type Difficulty } from '../hooks/useEngineGame.js';
import { Board } from './Board.js';
import { InfoPanel } from './InfoPanel.js';
import { MoveInput } from './MoveInput.js';
import { StatusBar } from './StatusBar.js';
import { Spinner } from './Spinner.js';
import { isCommand, parseCommand, parseMoveInput, COMMANDS } from '../utils/move-parser.js';
import { GameStatus, PlayerColor } from '@termchess/protocol';

const HELP_TEXT =
  'Commands: /help | /resign | /pgn | /quit  (no draw offers in engine mode)';

interface StatusMessage {
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface EngineAppProps {
  difficulty: Difficulty;
}

export function EngineApp({ difficulty }: EngineAppProps): React.ReactElement {
  const { exit } = useApp();
  const { phase, makeMove, resign, exportPgn } = useEngineGame(difficulty);

  const [statusMsg, setStatusMsg] = useState<StatusMessage>({
    text: "vs Engine — you play White. Enter a move (e.g. e2e4) or /help.",
    type: 'info',
  });
  const [pgnOutput, setPgnOutput] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const handleInput = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      if (isCommand(trimmed)) {
        const cmd = parseCommand(trimmed);
        switch (cmd) {
          case COMMANDS.HELP:
            setStatusMsg({ text: HELP_TEXT, type: 'info' });
            break;

          case COMMANDS.QUIT:
            exit();
            process.exit(0);
            break;

          case COMMANDS.RESIGN:
            if (phase.phase === 'playing') {
              resign();
              setStatusMsg({ text: 'You resigned.', type: 'warning' });
            } else {
              setStatusMsg({ text: 'Game is already over.', type: 'error' });
            }
            break;

          case COMMANDS.PGN: {
            const pgn = exportPgn();
            setPgnOutput(pgn);
            setStatusMsg({ text: 'PGN exported above.', type: 'success' });
            break;
          }

          case COMMANDS.DRAW:
            setStatusMsg({
              text: 'Draw offers are not available in engine mode.',
              type: 'error',
            });
            break;

          default:
            setStatusMsg({
              text: `Unknown command: ${trimmed}. Type /help for commands.`,
              type: 'error',
            });
        }
        return;
      }

      // Treat as move
      if (phase.phase === 'playing') {
        const uci = parseMoveInput(trimmed);
        if (!uci) {
          setStatusMsg({
            text: `Invalid move: ${trimmed}. Use UCI format (e.g. e2e4).`,
            type: 'error',
          });
          return;
        }
        const result = makeMove(uci);
        if (result.ok) {
          setStatusMsg({ text: `Move played: ${uci} — engine thinking...`, type: 'info' });
        } else {
          setStatusMsg({ text: result.error, type: 'error' });
        }
      } else {
        setStatusMsg({
          text: 'Game is over. Type /pgn to export or /quit to exit.',
          type: 'error',
        });
      }
    },
    [phase, makeMove, resign, exportPgn, exit],
  );

  // ---------------------------------------------------------------------------
  // Loading screen
  // ---------------------------------------------------------------------------

  if (phase.phase === 'loading') {
    return (
      <Box flexDirection="column" paddingY={1} paddingX={2}>
        <Spinner label="Starting Stockfish engine..." />
        <Box marginTop={1}>
          <Text color="gray">
            Make sure stockfish is installed: brew install stockfish (macOS) / apt install stockfish (Linux)
          </Text>
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Error screen
  // ---------------------------------------------------------------------------

  if (phase.phase === 'error') {
    return (
      <Box flexDirection="column" paddingY={1} paddingX={2}>
        <Box borderStyle="double" borderColor="red" paddingX={2} paddingY={1} flexDirection="column">
          <Text color="red" bold>Engine Error</Text>
          <Text color="white">{phase.message}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Press Ctrl+C to exit.</Text>
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Playing / engine_thinking / finished
  // ---------------------------------------------------------------------------

  const snapshot = phase.snapshot;
  const isFinished = phase.phase === 'finished';
  const isEngineThinking = phase.phase === 'engine_thinking';
  const inputDisabled = isFinished || isEngineThinking;

  function buildResultText(): string {
    if (!isFinished) return '';
    const snap = phase.snapshot;
    if (snap.status === GameStatus.Checkmate) {
      return snap.winner === PlayerColor.White
        ? 'Checkmate! You win!'
        : 'Checkmate! Engine wins.';
    }
    if (snap.status === GameStatus.Resigned) {
      return snap.resignedBy === PlayerColor.White
        ? 'You resigned.'
        : 'Engine resigned.';
    }
    if (snap.status === GameStatus.Draw || snap.status === GameStatus.Stalemate) {
      return `Draw! (${snap.drawReason ?? snap.status})`;
    }
    return 'Game over.';
  }

  const difficultyLabel =
    difficulty === 'easy'
      ? 'Easy (Skill 1)'
      : difficulty === 'medium'
      ? 'Medium (Skill 10)'
      : 'Hard (Skill 20)';

  return (
    <Box flexDirection="column">
      {/* PGN output */}
      {pgnOutput && (
        <Box
          borderStyle="single"
          borderColor="green"
          paddingX={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Text color="green" bold>PGN Export:</Text>
          <Text color="white">{pgnOutput}</Text>
        </Box>
      )}

      {/* Game over banner */}
      {isFinished && (
        <Box
          borderStyle="double"
          borderColor="yellow"
          paddingX={2}
          marginBottom={1}
          justifyContent="center"
        >
          <Text color="yellow" bold>
            {buildResultText()}   Type /pgn to export, /quit to exit.
          </Text>
        </Box>
      )}

      {/* Turn indicator */}
      {!isFinished && !isEngineThinking && (
        <Box marginBottom={1}>
          <Text color="gray">Your turn (White): </Text>
          <Text color="white" bold>enter a move</Text>
          {snapshot.isCheck && (
            <Text color="red" bold>{'  CHECK!'}</Text>
          )}
        </Box>
      )}

      {/* Engine thinking indicator */}
      {isEngineThinking && (
        <Box marginBottom={1}>
          <Spinner label={`Engine is thinking...  [${difficultyLabel}]`} />
        </Box>
      )}

      {/* Main layout */}
      <Box flexDirection="row">
        {/* Left: board + input */}
        <Box flexDirection="column">
          <Board
            fen={snapshot.fen}
            lastMove={snapshot.lastMove}
            isCheck={snapshot.isCheck}
            perspective="white"
            selectedSquare={selectedSquare}
            onSelectSquare={(notation) => setSelectedSquare(notation)}
            onClearSelection={() => setSelectedSquare(null)}
            onMove={(uci) => {
              setSelectedSquare(null);
              handleInput(uci);
            }}
            isInteractive={phase.phase === 'playing'}
          />

          {/* Replace MoveInput with spinner when engine is thinking */}
          {isEngineThinking ? (
            <Box paddingX={1} marginTop={1}>
              <Text color="gray">  </Text>
              <Spinner label="Engine is thinking..." />
            </Box>
          ) : (
            <MoveInput
              onSubmit={handleInput}
              disabled={inputDisabled}
              placeholder={
                isFinished
                  ? '/pgn to export, /quit to exit'
                  : "Your turn (White) — enter move (e2e4) or use arrow keys + space"
              }
            />
          )}
        </Box>

        {/* Right: info panel */}
        <InfoPanel
          gameCode={null}
          playerColor={PlayerColor.White}
          currentTurn={snapshot.turn}
          isCheck={snapshot.isCheck}
          status={snapshot.status}
          moveHistory={snapshot.moveHistory}
          capturedByWhite={snapshot.capturedByWhite}
          capturedByBlack={snapshot.capturedByBlack}
          drawOfferedBy={null}
          connectionStatus={`vs Engine — ${difficultyLabel}`}
        />
      </Box>

      <StatusBar message={statusMsg.text} type={statusMsg.type} />
    </Box>
  );
}
