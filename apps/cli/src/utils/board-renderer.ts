export interface BoardCell {
  piece: string | null;   // 'K', 'p', etc. or null
  isLight: boolean;       // light square?
  isHighlighted: boolean; // last move or selected
  rank: number;           // 1-8
  file: number;           // 0-7 (a=0)
  notation: string;       // 'a1', 'e4', etc.
}

export type BoardGrid = BoardCell[][];  // 8x8, [rank][file], rank 0 = rank 8 (top)

/**
 * Get notation string for a rank index (0=rank8) and file index (0=a).
 */
export function squareNotation(rankIdx: number, fileIdx: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
  const rank = (8 - rankIdx).toString();
  return `${file}${rank}`;
}

/**
 * Returns squares involved in the last move in notation form.
 */
export function getHighlightedSquares(uciMove: string | null): readonly string[] {
  if (!uciMove || uciMove.length < 4) return [];
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  return [from, to];
}

/**
 * Parse a FEN position string into an 8x8 board grid.
 * Board is always shown from White's perspective: rank 8 at top (index 0), rank 1 at bottom (index 7).
 */
export function parseFenToBoard(fen: string, lastMove?: string | null): BoardGrid {
  const highlighted = getHighlightedSquares(lastMove ?? null);

  // FEN position is just the first space-separated field
  const position = fen.split(' ')[0] ?? '';
  const ranks = position.split('/');

  const grid: BoardGrid = [];

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const row: BoardCell[] = [];
    const rankStr = ranks[rankIdx] ?? '';
    let fileIdx = 0;

    for (const ch of rankStr) {
      const num = parseInt(ch, 10);
      if (!isNaN(num)) {
        // Empty squares
        for (let i = 0; i < num; i++) {
          const notation = squareNotation(rankIdx, fileIdx);
          const isLight = (rankIdx + fileIdx) % 2 === 0;
          row.push({
            piece: null,
            isLight,
            isHighlighted: highlighted.includes(notation),
            rank: 8 - rankIdx,
            file: fileIdx,
            notation,
          });
          fileIdx++;
        }
      } else {
        const notation = squareNotation(rankIdx, fileIdx);
        const isLight = (rankIdx + fileIdx) % 2 === 0;
        row.push({
          piece: ch,
          isLight,
          isHighlighted: highlighted.includes(notation),
          rank: 8 - rankIdx,
          file: fileIdx,
          notation,
        });
        fileIdx++;
      }
    }

    // Pad remaining files if needed
    while (row.length < 8) {
      const notation = squareNotation(rankIdx, fileIdx);
      const isLight = (rankIdx + fileIdx) % 2 === 0;
      row.push({
        piece: null,
        isLight,
        isHighlighted: false,
        rank: 8 - rankIdx,
        file: fileIdx,
        notation,
      });
      fileIdx++;
    }

    grid.push(row);
  }

  return grid;
}
