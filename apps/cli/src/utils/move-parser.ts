// Parse user input into UCI format if possible
// Input: "e2e4", "e7e8q" (promotion), etc.
// Returns: parsed UCI string, or the original input for the server to validate
export function parseMoveInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Commands are not moves
  if (isCommand(trimmed)) return null;

  // UCI format: e2e4, e7e8q (4-5 chars, file+rank+file+rank+optional promotion)
  // Accept uppercase input and normalize to lowercase.
  const lower = trimmed.toLowerCase();
  const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  if (uciPattern.test(lower)) {
    return lower;
  }

  // SAN-like input (e.g. "e4", "Nf3") — pass through to server for validation
  // Must not be empty and not start with /
  if (trimmed.length >= 2 && !trimmed.startsWith('/')) {
    return trimmed;
  }

  return null;
}

// Returns true if input looks like a slash command
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

// Supported commands
export const COMMANDS = {
  HELP: '/help',
  RESIGN: '/resign',
  DRAW: '/draw',
  PGN: '/pgn',
  QUIT: '/quit',
} as const;
export type Command = (typeof COMMANDS)[keyof typeof COMMANDS];

export function parseCommand(input: string): Command | null {
  const trimmed = input.trim().toLowerCase();
  const values = Object.values(COMMANDS) as Command[];
  const match = values.find((cmd) => trimmed === cmd);
  return match ?? null;
}
