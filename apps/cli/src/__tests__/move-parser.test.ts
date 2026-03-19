import { describe, it, expect } from 'vitest';
import {
  parseMoveInput,
  isCommand,
  parseCommand,
  COMMANDS,
} from '../utils/move-parser.js';

describe('parseMoveInput', () => {
  it('parses e2e4 as UCI', () => {
    expect(parseMoveInput('e2e4')).toBe('e2e4');
  });

  it('parses e7e8q as promotion UCI', () => {
    expect(parseMoveInput('e7e8q')).toBe('e7e8q');
  });

  it('normalizes UCI to lowercase', () => {
    expect(parseMoveInput('E2E4')).toBe('e2e4');
  });

  it('passes through SAN-like input for server validation', () => {
    expect(parseMoveInput('e4')).toBe('e4');
    expect(parseMoveInput('Nf3')).toBe('Nf3');
  });

  it('returns null for empty input', () => {
    expect(parseMoveInput('')).toBeNull();
    expect(parseMoveInput('   ')).toBeNull();
  });

  it('returns null for single character input', () => {
    expect(parseMoveInput('e')).toBeNull();
  });

  it('returns null for commands', () => {
    expect(parseMoveInput('/resign')).toBeNull();
    expect(parseMoveInput('/help')).toBeNull();
  });
});

describe('isCommand', () => {
  it('returns true for /resign', () => {
    expect(isCommand('/resign')).toBe(true);
  });

  it('returns true for /help', () => {
    expect(isCommand('/help')).toBe(true);
  });

  it('returns true for /draw', () => {
    expect(isCommand('/draw')).toBe(true);
  });

  it('returns false for a move', () => {
    expect(isCommand('e2e4')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCommand('')).toBe(false);
  });

  it('returns false for SAN move', () => {
    expect(isCommand('Nf3')).toBe(false);
  });
});

describe('parseCommand', () => {
  it('parses /help', () => {
    expect(parseCommand('/help')).toBe(COMMANDS.HELP);
  });

  it('parses /resign', () => {
    expect(parseCommand('/resign')).toBe(COMMANDS.RESIGN);
  });

  it('parses /draw', () => {
    expect(parseCommand('/draw')).toBe(COMMANDS.DRAW);
  });

  it('parses /pgn', () => {
    expect(parseCommand('/pgn')).toBe(COMMANDS.PGN);
  });

  it('parses /quit', () => {
    expect(parseCommand('/quit')).toBe(COMMANDS.QUIT);
  });

  it('is case insensitive', () => {
    expect(parseCommand('/RESIGN')).toBe(COMMANDS.RESIGN);
    expect(parseCommand('/Help')).toBe(COMMANDS.HELP);
  });

  it('returns null for unknown commands', () => {
    expect(parseCommand('/unknown')).toBeNull();
  });

  it('returns null for non-commands', () => {
    expect(parseCommand('e2e4')).toBeNull();
  });
});
