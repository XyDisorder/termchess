/**
 * Unit tests for UciEngine.
 * child_process.spawn is mocked so stockfish does not need to be installed.
 *
 * Strategy: we intercept `proc.stdin.write` calls to capture lines sent to the
 * engine, and we trigger `proc.stdout` data events to simulate the engine
 * responding. Because UciEngine uses a resolver queue (promise-based), we emit
 * stdout data with `setImmediate` so the Promise chain can advance.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Shared mutable holder – the mock factory captures this reference by closure
// ---------------------------------------------------------------------------

const holder: { proc: ReturnType<typeof makeMockProc> | null } = { proc: null };

function makeMockProc() {
  const written: string[] = [];
  const stdout = new EventEmitter();
  const proc = Object.assign(new EventEmitter(), {
    stdout,
    stdin: {
      write(data: string) {
        written.push(data);
        // After the engine writes a command, simulate engine reply via setImmediate
        // so the resolver queue has a chance to be populated first.
      },
    },
    killed: false,
    kill() {
      this.killed = true;
    },
    _written: written,
  });
  return proc;
}

vi.mock('node:child_process', () => ({
  spawn(_cmd: string, _args: string[], _opts: unknown) {
    return holder.proc!;
  },
}));

// Dynamic import AFTER mock is registered
const { UciEngine } = await import('../engine/uci-engine.js');

// ---------------------------------------------------------------------------
// Helper: emit lines from engine stdout via setImmediate
// ---------------------------------------------------------------------------

function reply(lines: string[]): void {
  setImmediate(() => {
    if (!holder.proc) return;
    holder.proc.stdout.emit('data', Buffer.from(lines.join('\n') + '\n'));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UciEngine', () => {
  beforeEach(() => {
    holder.proc = makeMockProc();
  });

  // -------------------------------------------------------------------------

  it('isRunning is false before start()', () => {
    const engine = new UciEngine();
    expect(engine.isRunning).toBe(false);
  });

  // -------------------------------------------------------------------------

  it('start() sends uci / setoption / isready and waits for uciok + readyok', async () => {
    const engine = new UciEngine({ skillLevel: 7, movetime: 200 });

    // We need to reply after start() begins waiting.
    // start() first waits for 'uciok', then 'readyok'.
    // We schedule chained replies using setImmediate inside write interception.
    let uciSent = false;
    let readySent = false;
    const proc = holder.proc!;

    const origWrite = proc.stdin.write.bind(proc.stdin);
    proc.stdin.write = (data: string) => {
      origWrite(data);
      if (data === 'uci\n' && !uciSent) {
        uciSent = true;
        setImmediate(() => {
          proc.stdout.emit('data', Buffer.from('Stockfish 16\nuciok\n'));
        });
      }
      if (data === 'isready\n' && !readySent) {
        readySent = true;
        setImmediate(() => {
          proc.stdout.emit('data', Buffer.from('readyok\n'));
        });
      }
    };

    await engine.start();

    const written = proc._written;
    expect(written).toContain('uci\n');
    expect(written).toContain('isready\n');
    expect(written.some((c) => c.includes('Skill Level') && c.includes('7'))).toBe(true);
    expect(engine.isRunning).toBe(true);
  });

  // -------------------------------------------------------------------------

  it('getBestMove() sends position + go and returns parsed move', async () => {
    const engine = new UciEngine({ movetime: 150 });
    const proc = holder.proc!;

    // Wire auto-replies for startup
    let uciSent = false;
    let readySent = false;
    let goSent = false;
    const origWrite = proc.stdin.write.bind(proc.stdin);
    proc.stdin.write = (data: string) => {
      origWrite(data);
      if (data === 'uci\n' && !uciSent) {
        uciSent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('uciok\n')));
      }
      if (data === 'isready\n' && !readySent) {
        readySent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('readyok\n')));
      }
      if (data.startsWith('go movetime') && !goSent) {
        goSent = true;
        setImmediate(() =>
          proc.stdout.emit('data', Buffer.from('info depth 1\nbestmove e7e5 ponder e2e4\n')),
        );
      }
    };

    await engine.start();

    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const move = await engine.getBestMove(fen);

    expect(move).toBe('e7e5');
    const written = proc._written;
    expect(written.some((c) => c.startsWith('position fen '))).toBe(true);
    expect(written.some((c) => c.startsWith('go movetime '))).toBe(true);
  });

  // -------------------------------------------------------------------------

  it('getBestMove() handles promotion move (e7e8q)', async () => {
    const engine = new UciEngine({ movetime: 100 });
    const proc = holder.proc!;

    let uciSent = false;
    let readySent = false;
    let goSent = false;
    const origWrite = proc.stdin.write.bind(proc.stdin);
    proc.stdin.write = (data: string) => {
      origWrite(data);
      if (data === 'uci\n' && !uciSent) {
        uciSent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('uciok\n')));
      }
      if (data === 'isready\n' && !readySent) {
        readySent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('readyok\n')));
      }
      if (data.startsWith('go movetime') && !goSent) {
        goSent = true;
        setImmediate(() =>
          proc.stdout.emit('data', Buffer.from('bestmove e7e8q\n')),
        );
      }
    };

    await engine.start();
    const move = await engine.getBestMove('some fen string');
    expect(move).toBe('e7e8q');
  });

  // -------------------------------------------------------------------------

  it('start() throws a helpful error when ENOENT', async () => {
    const engine = new UciEngine({ executablePath: '/nonexistent/stockfish' });
    const proc = holder.proc!;

    // Emit ENOENT error on next tick (before we've had a chance to wait for uciok)
    setImmediate(() => {
      const err = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
      proc.emit('error', err);
    });

    await expect(engine.start()).rejects.toThrow(/Stockfish not found/);
  });

  // -------------------------------------------------------------------------

  it('quit() sends quit command and marks engine not running', async () => {
    const engine = new UciEngine();
    const proc = holder.proc!;

    let uciSent = false;
    let readySent = false;
    const origWrite = proc.stdin.write.bind(proc.stdin);
    proc.stdin.write = (data: string) => {
      origWrite(data);
      if (data === 'uci\n' && !uciSent) {
        uciSent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('uciok\n')));
      }
      if (data === 'isready\n' && !readySent) {
        readySent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('readyok\n')));
      }
    };

    await engine.start();
    expect(engine.isRunning).toBe(true);

    engine.quit();

    expect(proc._written).toContain('quit\n');
    expect(engine.isRunning).toBe(false);
  });

  // -------------------------------------------------------------------------

  it('setSkillLevel() sends setoption command', async () => {
    const engine = new UciEngine();
    const proc = holder.proc!;

    let uciSent = false;
    let readySent = false;
    const origWrite = proc.stdin.write.bind(proc.stdin);
    proc.stdin.write = (data: string) => {
      origWrite(data);
      if (data === 'uci\n' && !uciSent) {
        uciSent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('uciok\n')));
      }
      if (data === 'isready\n' && !readySent) {
        readySent = true;
        setImmediate(() => proc.stdout.emit('data', Buffer.from('readyok\n')));
      }
    };

    await engine.start();
    engine.setSkillLevel(15);

    expect(proc._written.some((c) => c.includes('Skill Level') && c.includes('15'))).toBe(true);
  });
});
