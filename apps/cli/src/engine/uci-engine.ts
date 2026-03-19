import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface EngineOptions {
  executablePath?: string; // default: 'stockfish'
  skillLevel?: number;     // 0-20, default: 10
  movetime?: number;       // ms to think per move, default: 500
}

export class UciEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private buffer = '';
  private resolvers: Array<(line: string) => boolean> = [];

  // Shared fatal-error signal — any error rejects all pending waitForLine promises
  private fatalError: Error | null = null;
  private fatalErrorReject: ((err: Error) => void) | null = null;

  constructor(private readonly options: EngineOptions = {}) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    const executablePath = this.options.executablePath ?? 'stockfish';

    // Race every waitForLine against a fatal-error signal
    const fatalPromise = new Promise<never>((_, reject) => {
      this.fatalErrorReject = reject;
    });

    // Spawn the process
    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(executablePath, [], { stdio: 'pipe' });
    } catch {
      throw new Error(
        'Stockfish not found. Install it with: brew install stockfish (macOS) or apt install stockfish (Linux)',
      );
    }

    this.proc = proc;

    // Process stdout — split buffer into lines, dispatch to resolvers
    proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.resolvers = this.resolvers.filter((resolver) => !resolver(trimmed));
      }
    });

    // Error / exit handlers signal the fatal-error promise
    const onError = (err: NodeJS.ErrnoException): void => {
      const message =
        err.code === 'ENOENT'
          ? 'Stockfish not found. Install it with: brew install stockfish (macOS) or apt install stockfish (Linux)'
          : err.message;
      const wrapped = new Error(message);
      this.fatalErrorReject?.(wrapped);
      // Also reject any pending resolvers
      this.resolvers = [];
    };

    const onExit = (code: number | null): void => {
      if (!this.ready) {
        const err = new Error(`Engine process exited unexpectedly (code ${String(code)})`);
        this.fatalErrorReject?.(err);
      } else {
        this.ready = false;
      }
    };

    proc.on('error', onError);
    proc.on('exit', onExit);

    // Handshake: uci → uciok
    this.sendLine('uci');
    await Promise.race([
      this.waitForLine((l) => l === 'uciok'),
      fatalPromise,
    ]);

    // Set skill level
    const skillLevel = this.options.skillLevel ?? 10;
    this.sendLine(`setoption name Skill Level value ${skillLevel}`);

    // isready → readyok
    this.sendLine('isready');
    await Promise.race([
      this.waitForLine((l) => l === 'readyok'),
      fatalPromise,
    ]);

    this.ready = true;
  }

  setSkillLevel(level: number): void {
    this.sendLine(`setoption name Skill Level value ${level}`);
  }

  async getBestMove(fen: string): Promise<string> {
    if (!this.ready || !this.proc) {
      throw new Error('Engine is not running. Call start() first.');
    }

    const movetime = this.options.movetime ?? 500;

    this.sendLine(`position fen ${fen}`);
    this.sendLine(`go movetime ${movetime}`);

    const timeoutMs = 10_000;

    // Race against the fatal-error promise and a per-call timeout
    const fatalPromise = new Promise<never>((_, reject) => {
      const prev = this.fatalErrorReject;
      this.fatalErrorReject = (err: Error) => {
        prev?.(err);
        reject(err);
      };
    });

    const bestMoveLine = await Promise.race([
      this.waitForLine((l) => l.startsWith('bestmove ')),
      fatalPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Engine timed out waiting for bestmove (>10s)')),
          timeoutMs,
        ),
      ),
    ]);

    // "bestmove e2e4 ponder ..." → "e2e4"
    const parts = bestMoveLine.split(' ');
    const move = parts[1];
    if (!move || move === '(none)') {
      throw new Error(`Engine returned no valid move: ${bestMoveLine}`);
    }
    return move;
  }

  quit(): void {
    if (!this.proc) return;
    try {
      this.sendLine('quit');
    } catch {
      // ignore write errors on quit
    }
    const proc = this.proc;
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
      }
    }, 500);
    this.proc = null;
    this.ready = false;
  }

  get isRunning(): boolean {
    return this.ready && this.proc !== null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private sendLine(line: string): void {
    this.proc?.stdin.write(line + '\n');
  }

  private waitForLine(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      this.resolvers.push((line) => {
        if (predicate(line)) {
          resolve(line);
          return true;
        }
        return false;
      });
    });
  }
}
