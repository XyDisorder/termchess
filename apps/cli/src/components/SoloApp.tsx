import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { useSoloGame } from '../hooks/useSoloGame.js';
import { Board } from './Board.js';
import { InfoPanel } from './InfoPanel.js';
import { MoveInput } from './MoveInput.js';
import { StatusBar } from './StatusBar.js';
import { isCommand, parseCommand, parseMoveInput, COMMANDS } from '../utils/move-parser.js';
import { GameStatus, PlayerColor } from '@termchess/protocol';

const HELP_TEXT =
  'Commands: /help | /resign | /draw (agree draw) | /pgn | /quit';

interface StatusMessage {
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export function SoloApp(): React.ReactElement {
  const { exit } = useApp();
  const {
    phase,
    currentPlayerLabel,
    makeMove,
    resign,
    offerDraw,
    exportPgn,
  } = useSoloGame();

  const [statusMsg, setStatusMsg] = useState<StatusMessage>({
    text: "Solo game started. White's turn. Enter move (e.g. e2e4) or /help.",
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
              setStatusMsg({
                text: `${currentPlayerLabel} resigned.`,
                type: 'warning',
              });
            } else {
              setStatusMsg({ text: 'Game is already over.', type: 'error' });
            }
            break;

          case COMMANDS.DRAW:
            if (phase.phase === 'playing') {
              const result = offerDraw();
              if (result.ok) {
                setStatusMsg({ text: 'Draw by agreement.', type: 'success' });
              } else {
                setStatusMsg({ text: result.error, type: 'error' });
              }
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
          setStatusMsg({
            text: `Move played: ${uci}`,
            type: 'info',
          });
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
    [phase, currentPlayerLabel, makeMove, resign, offerDraw, exportPgn, exit],
  );

  const snapshot = phase.snapshot;
  const isFinished = phase.phase === 'finished';

  // Build result line shown after game ends
  function buildResultText(): string {
    if (!isFinished) return '';
    const snap = phase.snapshot;
    if (snap.status === GameStatus.Checkmate) {
      return `Checkmate! ${snap.winner === PlayerColor.White ? 'White' : 'Black'} wins!`;
    }
    if (snap.status === GameStatus.Resigned) {
      return `${snap.resignedBy === PlayerColor.White ? 'White' : 'Black'} resigned.`;
    }
    if (snap.status === GameStatus.Draw || snap.status === GameStatus.Stalemate) {
      return `Draw! (${snap.drawReason ?? snap.status})`;
    }
    return 'Game over.';
  }

  const inputDisabled = isFinished;
  const turnColor = snapshot.turn === PlayerColor.White ? 'white' : ('blackBright' as const);

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
          <Text color="green" bold>
            PGN Export:
          </Text>
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

      {/* Turn indicator (only while playing) */}
      {!isFinished && (
        <Box marginBottom={1}>
          <Text color="gray">Current turn: </Text>
          <Text color={turnColor} bold>
            {currentPlayerLabel}
          </Text>
          {snapshot.isCheck && (
            <Text color="red" bold>
              {'  CHECK!'}
            </Text>
          )}
        </Box>
      )}

      {/* Main layout: Board + InfoPanel */}
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
          <MoveInput
            onSubmit={handleInput}
            disabled={inputDisabled}
            placeholder={
              isFinished
                ? '/pgn to export, /quit to exit'
                : `${currentPlayerLabel}'s turn — enter move (e2e4) or use arrow keys + space`
            }
          />
        </Box>

        {/* Right: info panel */}
        <InfoPanel
          gameCode={null}
          playerColor={null}
          currentTurn={snapshot.turn}
          isCheck={snapshot.isCheck}
          status={snapshot.status}
          moveHistory={snapshot.moveHistory}
          capturedByWhite={snapshot.capturedByWhite}
          capturedByBlack={snapshot.capturedByBlack}
          drawOfferedBy={null}
          connectionStatus="Solo game"
        />
      </Box>

      <StatusBar message={statusMsg.text} type={statusMsg.type} />
    </Box>
  );
}
