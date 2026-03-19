export const PIECES: Record<string, string> = {
  // White pieces
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  // Black pieces
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export const PIECE_NAMES: Record<string, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
  k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
};

// Fallback ASCII pieces for terminals that don't support Unicode
export const ASCII_PIECES: Record<string, string> = {
  K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P',
  k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p',
};
