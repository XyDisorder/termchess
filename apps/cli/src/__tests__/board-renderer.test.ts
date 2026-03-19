import { describe, it, expect } from 'vitest';
import { parseFenToBoard, getHighlightedSquares, squareNotation } from '../utils/board-renderer.js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseFenToBoard', () => {
  it('returns an 8x8 grid', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    expect(grid.length).toBe(8);
    for (const row of grid) {
      expect(row.length).toBe(8);
    }
  });

  it('places black rook on a8 (grid[0][0])', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    const cell = grid[0]?.[0];
    expect(cell?.piece).toBe('r');
    expect(cell?.notation).toBe('a8');
    expect(cell?.rank).toBe(8);
    expect(cell?.file).toBe(0);
  });

  it('places black king on e8 (grid[0][4])', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    const cell = grid[0]?.[4];
    expect(cell?.piece).toBe('k');
    expect(cell?.notation).toBe('e8');
  });

  it('places white king on e1 (grid[7][4])', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    const cell = grid[7]?.[4];
    expect(cell?.piece).toBe('K');
    expect(cell?.notation).toBe('e1');
    expect(cell?.rank).toBe(1);
  });

  it('has empty squares on ranks 3-6', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    // Ranks 3-6 correspond to grid rows index 2-5
    for (let rankIdx = 2; rankIdx <= 5; rankIdx++) {
      const row = grid[rankIdx];
      expect(row).toBeDefined();
      if (row) {
        for (const cell of row) {
          expect(cell.piece).toBeNull();
        }
      }
    }
  });

  it('places black pawns on rank 7 (grid[1])', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    const row = grid[1];
    expect(row).toBeDefined();
    if (row) {
      for (const cell of row) {
        expect(cell.piece).toBe('p');
      }
    }
  });

  it('places white pawns on rank 2 (grid[6])', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    const row = grid[6];
    expect(row).toBeDefined();
    if (row) {
      for (const cell of row) {
        expect(cell.piece).toBe('P');
      }
    }
  });

  it('correctly identifies light and dark squares', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    // a8 is rankIdx=0, fileIdx=0 → (0+0)%2=0 → light
    expect(grid[0]?.[0]?.isLight).toBe(true);
    // b8 is rankIdx=0, fileIdx=1 → (0+1)%2=1 → dark
    expect(grid[0]?.[1]?.isLight).toBe(false);
  });

  it('highlights squares from last move', () => {
    const grid = parseFenToBoard(STARTING_FEN, 'e2e4');
    // e2 is rankIdx=6, fileIdx=4
    expect(grid[6]?.[4]?.isHighlighted).toBe(true);
    // e4 is rankIdx=4, fileIdx=4
    expect(grid[4]?.[4]?.isHighlighted).toBe(true);
    // other squares not highlighted
    expect(grid[0]?.[0]?.isHighlighted).toBe(false);
  });

  it('handles no last move — nothing highlighted', () => {
    const grid = parseFenToBoard(STARTING_FEN);
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.isHighlighted).toBe(false);
      }
    }
  });
});

describe('getHighlightedSquares', () => {
  it('returns from and to squares for a valid UCI move', () => {
    const squares = getHighlightedSquares('e2e4');
    expect(squares).toContain('e2');
    expect(squares).toContain('e4');
    expect(squares.length).toBe(2);
  });

  it('returns empty array for null', () => {
    expect(getHighlightedSquares(null)).toEqual([]);
  });

  it('returns empty array for short string', () => {
    expect(getHighlightedSquares('e2')).toEqual([]);
  });

  it('handles promotion moves', () => {
    const squares = getHighlightedSquares('e7e8q');
    expect(squares).toContain('e7');
    expect(squares).toContain('e8');
  });
});

describe('squareNotation', () => {
  it('returns a8 for rankIdx=0, fileIdx=0', () => {
    expect(squareNotation(0, 0)).toBe('a8');
  });

  it('returns h1 for rankIdx=7, fileIdx=7', () => {
    expect(squareNotation(7, 7)).toBe('h1');
  });

  it('returns e4 for rankIdx=4, fileIdx=4', () => {
    expect(squareNotation(4, 4)).toBe('e4');
  });
});
