import React from 'react';
import { Box, Text } from 'ink';
import { type PlayerColor, type GameStatus, type MoveHistoryEntry } from '@termchess/protocol';
import { PIECES } from '../utils/piece-symbols.js';

interface InfoPanelProps {
  gameCode: string | null;
  playerColor: PlayerColor | null;
  currentTurn: PlayerColor | null;
  isCheck: boolean;
  status: GameStatus | null;
  moveHistory: readonly MoveHistoryEntry[];
  capturedByWhite: readonly string[];
  capturedByBlack: readonly string[];
  drawOfferedBy: PlayerColor | null;
  connectionStatus: string;
}

function formatMoveHistory(history: readonly MoveHistoryEntry[]): string[] {
  const lines: string[] = [];
  // Show last 12 half-moves = 6 full moves max
  const recentHistory = history.slice(-12);

  // Find the first move number to display
  const startIdx = recentHistory.length > 0 ? (recentHistory[0]?.moveNumber ?? 1) : 1;
  const firstMoveNum = Math.ceil(startIdx / 2);

  let i = 0;
  // If first move in slice is a black move, handle offset
  const firstIsBlack = recentHistory[0] !== undefined && recentHistory[0].moveNumber % 2 === 0;

  if (firstIsBlack && recentHistory.length > 0) {
    const blackEntry = recentHistory[0];
    if (blackEntry) {
      lines.push(`${firstMoveNum}. ...  ${blackEntry.san}`);
      i = 1;
    }
  }

  while (i < recentHistory.length) {
    const white = recentHistory[i];
    const black = recentHistory[i + 1];
    if (!white) break;
    const moveNum = Math.ceil(white.moveNumber / 2);
    const blackStr = black ? black.san : '';
    lines.push(`${moveNum}. ${white.san.padEnd(6)} ${blackStr}`);
    i += 2;
  }

  return lines;
}

function formatCaptured(pieces: readonly string[]): string {
  return pieces
    .map((p) => PIECES[p] ?? p)
    .join(' ');
}

function statusLabel(status: GameStatus | null): { text: string; color: string } | null {
  if (!status) return null;
  switch (status) {
    case 'active': return null;
    case 'waiting_for_opponent': return { text: 'Waiting for opponent...', color: 'yellow' };
    case 'checkmate': return { text: 'Checkmate!', color: 'red' };
    case 'stalemate': return { text: 'Stalemate — Draw', color: 'yellow' };
    case 'draw': return { text: 'Draw', color: 'yellow' };
    case 'resigned': return { text: 'Game resigned', color: 'magenta' };
    case 'abandoned': return { text: 'Game abandoned', color: 'gray' };
    default: return null;
  }
}

export function InfoPanel({
  gameCode,
  playerColor,
  currentTurn,
  isCheck,
  status,
  moveHistory,
  capturedByWhite,
  capturedByBlack,
  drawOfferedBy,
  connectionStatus,
}: InfoPanelProps): React.ReactElement {
  const moveLines = formatMoveHistory(moveHistory);
  const statusInfo = statusLabel(status);

  return (
    <Box flexDirection="column" paddingLeft={2} width={30}>
      {/* Game code */}
      {gameCode && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>Game Code</Text>
          <Text color="cyan" bold>{gameCode}</Text>
        </Box>
      )}

      {/* Player info */}
      {playerColor && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray">
            You: <Text color={playerColor === 'white' ? 'white' : 'gray'} bold>
              {playerColor === 'white' ? '♔ White' : '♚ Black'}
            </Text>
          </Text>
          {currentTurn && (
            <Text color="gray">
              Turn: <Text color={currentTurn === 'white' ? 'white' : 'gray'} bold>
                {currentTurn === 'white' ? 'White' : 'Black'}
                {currentTurn === playerColor ? ' (you)' : ''}
              </Text>
            </Text>
          )}
        </Box>
      )}

      {/* Check indicator */}
      {isCheck && (
        <Box marginBottom={1}>
          <Text color="red" bold>CHECK!</Text>
        </Box>
      )}

      {/* Game status */}
      {statusInfo && (
        <Box marginBottom={1}>
          <Text color={statusInfo.color} bold>{statusInfo.text}</Text>
        </Box>
      )}

      {/* Draw offer */}
      {drawOfferedBy && (
        <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>Draw offered by {drawOfferedBy}</Text>
          <Text color="gray">Type /draw to accept, or make a move to decline</Text>
        </Box>
      )}

      {/* Captured pieces */}
      {capturedByWhite.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>White captured:</Text>
          <Text>{formatCaptured(capturedByWhite)}</Text>
        </Box>
      )}
      {capturedByBlack.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>Black captured:</Text>
          <Text>{formatCaptured(capturedByBlack)}</Text>
        </Box>
      )}

      {/* Move history */}
      {moveLines.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>Moves:</Text>
          {moveLines.map((line, i) => (
            <Text key={i} color="white">{line}</Text>
          ))}
        </Box>
      )}

      {/* Connection status */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {connectionStatus}
        </Text>
      </Box>
    </Box>
  );
}
