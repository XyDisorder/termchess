import React from 'react';
import { Box, Text } from 'ink';
import { type PlayerColor } from '@termchess/protocol';
import { parseFenToBoard, type BoardCell } from '../utils/board-renderer.js';
import { PIECES } from '../utils/piece-symbols.js';

interface BoardProps {
  fen: string;
  lastMove: string | null;
  isCheck: boolean;
  perspective: PlayerColor; // 'white' | 'black' — flip board for black
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

function getCellColors(
  cell: BoardCell,
  isKingInCheck: boolean,
): { bg: string; fg: string } {
  if (isKingInCheck) {
    return { bg: 'redBright', fg: cell.piece && 'KQRBNP'.includes(cell.piece) ? 'white' : 'black' };
  }
  if (cell.isHighlighted) {
    return { bg: 'yellow', fg: 'black' };
  }
  if (cell.isLight) {
    return { bg: 'white', fg: 'black' };
  }
  return { bg: 'gray', fg: 'white' };
}

function CellComponent({
  cell,
  isKingInCheck,
}: {
  cell: BoardCell;
  isKingInCheck: boolean;
}): React.ReactElement {
  const { bg, fg } = getCellColors(cell, isKingInCheck);
  const symbol = cell.piece ? (PIECES[cell.piece] ?? cell.piece) : ' ';

  return (
    <Text backgroundColor={bg} color={fg}>
      {symbol}{' '}
    </Text>
  );
}

export function Board({ fen, lastMove, isCheck, perspective }: BoardProps): React.ReactElement {
  const grid = parseFenToBoard(fen, lastMove);
  const turn = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const kingSquare = isCheck ? getKingSquare(fen, turn) : null;

  // Flip board for black perspective
  const displayGrid = perspective === 'black' ? [...grid].reverse().map((row) => [...row].reverse()) : grid;

  const files = perspective === 'black'
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const fileLabel = '  ' + files.join(' ');

  return (
    <Box flexDirection="column">
      <Text color="gray">{fileLabel}</Text>
      {displayGrid.map((row, rowIdx) => {
        const rankNum = perspective === 'black' ? rowIdx + 1 : 8 - rowIdx;
        return (
          <Box key={rowIdx} flexDirection="row">
            <Text color="gray">{rankNum} </Text>
            {row.map((cell, colIdx) => {
              const isKingInCheck = isCheck && cell.notation === kingSquare;
              return (
                <CellComponent key={colIdx} cell={cell} isKingInCheck={isKingInCheck} />
              );
            })}
            <Text color="gray"> {rankNum}</Text>
          </Box>
        );
      })}
      <Text color="gray">{fileLabel}</Text>
    </Box>
  );
}
