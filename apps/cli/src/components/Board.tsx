import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { type PlayerColor } from '@termchess/protocol';
import { parseFenToBoard, type BoardCell } from '../utils/board-renderer.js';
import { PIECES } from '../utils/piece-symbols.js';

interface BoardProps {
  fen: string;
  lastMove: string | null;
  isCheck: boolean;
  perspective: PlayerColor;
  selectedSquare: string | null;          // from-square (owned by parent)
  onSelectSquare: (notation: string) => void;  // parent sets selectedSquare
  onClearSelection: () => void;           // parent clears selectedSquare
  onMove: (uci: string) => void;         // confirmed move (from+to UCI)
  isInteractive: boolean;
}

function getKingSquare(fen: string, color: PlayerColor): string | null {
  const position = fen.split(' ')[0] ?? '';
  const ranks = position.split('/');
  const kingChar = color === 'white' ? 'K' : 'k';

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rankStr = ranks[rankIdx] ?? '';
    let fileIdx = 0;
    for (const ch of rankStr) {
      const num = parseInt(ch, 10);
      if (!isNaN(num)) {
        fileIdx += num;
      } else {
        if (ch === kingChar) {
          const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
          const rank = (8 - rankIdx).toString();
          return `${file}${rank}`;
        }
        fileIdx++;
      }
    }
  }
  return null;
}

/**
 * Convert display-grid coordinates (rowIdx, colIdx) to board notation,
 * taking perspective into account.
 *
 * Display coords: rowIdx 0 = top row of display, colIdx 0 = leftmost column.
 * For white perspective: row 0 = rank 8, col 0 = file a
 * For black perspective: row 0 = rank 1, col 0 = file h
 */
function displayCoordsToNotation(
  rowIdx: number,
  colIdx: number,
  perspective: PlayerColor,
): string {
  let rankIdx: number;
  let fileIdx: number;

  if (perspective === 'white') {
    rankIdx = rowIdx;       // display row 0 → board rankIdx 0 (rank 8)
    fileIdx = colIdx;       // display col 0 → file a (idx 0)
  } else {
    rankIdx = 7 - rowIdx;   // display row 0 → board rankIdx 7 (rank 1)
    fileIdx = 7 - colIdx;   // display col 0 → file h (idx 7)
  }

  const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
  const rank = (8 - rankIdx).toString();
  return `${file}${rank}`;
}

/**
 * Convert board notation to display coordinates for a given perspective.
 */
function notationToDisplayCoords(
  notation: string,
  perspective: PlayerColor,
): { rowIdx: number; colIdx: number } {
  const fileIdx = notation.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(notation[1] ?? '1', 10);
  const rankIdx = 8 - rank;  // rank 8 → rankIdx 0

  if (perspective === 'white') {
    return { rowIdx: rankIdx, colIdx: fileIdx };
  } else {
    return { rowIdx: 7 - rankIdx, colIdx: 7 - fileIdx };
  }
}

type CellBg = string;

function getCellBg(
  cell: BoardCell,
  cursorRowIdx: number,
  cursorColIdx: number,
  displayRowIdx: number,
  displayColIdx: number,
  isCheck: boolean,
  kingSquare: string | null,
  selectedSquare: string | null,
): CellBg {
  const isCursor = displayRowIdx === cursorRowIdx && displayColIdx === cursorColIdx;
  const isSelected = selectedSquare !== null && cell.notation === selectedSquare;
  const isKingInCheck = isCheck && cell.notation === kingSquare;

  if (isCursor) return '#4fc3f7';
  if (isSelected) return '#81d4fa';
  if (isKingInCheck) return '#e53935';
  if (cell.isHighlighted) return '#f9a825';
  if (cell.isLight) return '#eeeed2';  // classic cream
  return '#769656';                    // classic dark green
}

function getCellFg(bg: CellBg): string {
  // Light backgrounds → dark text, dark backgrounds → white text
  if (bg === '#eeeed2' || bg === '#81d4fa' || bg === '#4fc3f7' || bg === '#f9a825') return 'black';
  return 'white';
}

export function Board({
  fen,
  lastMove,
  isCheck,
  perspective,
  selectedSquare,
  onSelectSquare,
  onClearSelection,
  onMove,
  isInteractive,
}: BoardProps): React.ReactElement {
  // Initial cursor position: e2 for white (display row 6, col 4), e7 for black
  const initialCursor = perspective === 'white'
    ? { rowIdx: 6, colIdx: 4 }
    : { rowIdx: 1, colIdx: 3 };

  const [cursor, setCursor] = useState(initialCursor);

  const grid = parseFenToBoard(fen, lastMove);
  const turn = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const kingSquare = isCheck ? getKingSquare(fen, turn) : null;

  // Flip board for black perspective
  const displayGrid = perspective === 'black'
    ? [...grid].reverse().map((row) => [...row].reverse())
    : grid;

  const files = perspective === 'black'
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  useInput(
    (input, key) => {
      if (!isInteractive) return;

      if (key.upArrow) {
        setCursor((prev) => ({ ...prev, rowIdx: Math.max(0, prev.rowIdx - 1) }));
        return;
      }
      if (key.downArrow) {
        setCursor((prev) => ({ ...prev, rowIdx: Math.min(7, prev.rowIdx + 1) }));
        return;
      }
      if (key.leftArrow) {
        setCursor((prev) => ({ ...prev, colIdx: Math.max(0, prev.colIdx - 1) }));
        return;
      }
      if (key.rightArrow) {
        setCursor((prev) => ({ ...prev, colIdx: Math.min(7, prev.colIdx + 1) }));
        return;
      }

      if (key.escape) {
        onClearSelection();
        return;
      }

      if (input === ' ' || key.return) {
        const notation = displayCoordsToNotation(cursor.rowIdx, cursor.colIdx, perspective);
        if (selectedSquare === null) {
          onSelectSquare(notation);
        } else {
          onMove(selectedSquare + notation);
          onClearSelection();
        }
        return;
      }
    },
    { isActive: isInteractive },
  );

  // File label row: 3-char indent + 11 chars per file
  const fileLabel = files.map((f) => `     ${f}     `).join('');

  return (
    <Box justifyContent="center">
      <Box flexDirection="column">
        {/* Top file labels */}
        <Box flexDirection="row">
          <Text>{'   '}</Text>
          <Text color="gray">{fileLabel}</Text>
        </Box>

        {displayGrid.map((row, rowIdx) => {
          const rankNum = perspective === 'black' ? rowIdx + 1 : 8 - rowIdx;
          return (
            <React.Fragment key={rowIdx}>
              {/* Spacer row (top half of each cell) */}
              <Box flexDirection="row">
                <Text>{'   '}</Text>
                {row.map((cell, colIdx) => {
                  const bg = getCellBg(
                    cell,
                    cursor.rowIdx,
                    cursor.colIdx,
                    rowIdx,
                    colIdx,
                    isCheck,
                    kingSquare,
                    selectedSquare,
                  );
                  return (
                    <Text key={colIdx} backgroundColor={bg}>{'           '}</Text>
                  );
                })}
              </Box>

              {/* Piece row (middle of each cell) */}
              <Box flexDirection="row">
                <Text color="gray">{` ${rankNum} `}</Text>
                {row.map((cell, colIdx) => {
                  const bg = getCellBg(
                    cell,
                    cursor.rowIdx,
                    cursor.colIdx,
                    rowIdx,
                    colIdx,
                    isCheck,
                    kingSquare,
                    selectedSquare,
                  );
                  const piece = cell.piece ? (PIECES[cell.piece] ?? cell.piece) : ' ';
                  const fg = getCellFg(bg);
                  return (
                    <Text key={colIdx} backgroundColor={bg} color={fg}>{`     ${piece}     `}</Text>
                  );
                })}
                <Text color="gray">{` ${rankNum}`}</Text>
              </Box>

              {/* Spacer row 2 (bottom of each cell) */}
              <Box flexDirection="row">
                <Text>{'   '}</Text>
                {row.map((cell, colIdx) => {
                  const bg = getCellBg(cell, cursor.rowIdx, cursor.colIdx, rowIdx, colIdx, isCheck, kingSquare, selectedSquare);
                  return <Text key={colIdx} backgroundColor={bg}>{'           '}</Text>;
                })}
              </Box>

              {/* Spacer row 3 (extra height) */}
              <Box flexDirection="row">
                <Text>{'   '}</Text>
                {row.map((cell, colIdx) => {
                  const bg = getCellBg(cell, cursor.rowIdx, cursor.colIdx, rowIdx, colIdx, isCheck, kingSquare, selectedSquare);
                  return <Text key={colIdx} backgroundColor={bg}>{'           '}</Text>;
                })}
              </Box>
            </React.Fragment>
          );
        })}

        {/* Bottom file labels */}
        <Box flexDirection="row">
          <Text>{'   '}</Text>
          <Text color="gray">{fileLabel}</Text>
        </Box>
      </Box>
    </Box>
  );
}
