import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { AnvexoError } from '../core/types.js';

export interface TerminalSessionInfo {
  id: string;
  name: string;
  cwd: string;
  pid?: number;
  running: boolean;
  exitCode?: number | null;
  startedAt: Date;
}

export class TerminalSession extends EventEmitter {
  readonly id: string;
  readonly name: string;
  cwd: string;
  private process?: ChildProcess;
  private outputBuffer: string[] = [];
  private maxBufferLines = 2000;
  private running = false;
  private exitCode: number | null = null;
  private startedAt = new Date();

  constructor(id: string, name: string, cwd: string) {
    super();
    this.id = id;
    this.name = name;
    this.cwd = cwd;
  }

  getInfo(): TerminalSessionInfo {
    return {
      id: this.id,
      name: this.name,
      cwd: this.cwd,
      pid: this.process?.pid,
      running: this.running,
      exitCode: this.exitCode,
      startedAt: this.startedAt,
    };
  }

  getBuffer(): string {
    return this.outputBuffer.join('');
  }

  clearBuffer(): void {
    this.outputBuffer = [];
  }

  executeCommand(command: string, args: string[] = []): void {
    if (this.running && this.process) {
      throw new AnvexoError(
        `Session ${this.id} already has a running process (PID ${this.process.pid})`,
        'TERMINAL_BUSY',
        true,
      );
    }

    this.exitCode = null;
    this.running = true;

    const child = spawn(command, args, {
      cwd: this.cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process = child;

    const append = (data: string) => {
      this.outputBuffer.push(data);
      if (this.outputBuffer.length > this.maxBufferLines) {
        this.outputBuffer.shift();
      }
      this.emit('data', data);
    };

    child.stdout?.on('data', (d: Buffer) => append(d.toString('utf-8')));
    child.stderr?.on('data', (d: Buffer) => append(d.toString('utf-8')));

    child.on('error', (err) => {
      append(`\nProcess error: ${err.message}\n`);
      this.running = false;
      this.exitCode = 1;
      this.emit('exit', 1);
    });

    child.on('close', (code) => {
      this.running = false;
      this.exitCode = code;
      this.emit('exit', code);
    });
  }

  writeInput(input: string): void {
    if (this.running && this.process?.stdin?.writable) {
      this.process.stdin.write(input);
    }
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    if (this.running && this.process) {
      try {
        return this.process.kill(signal);
      } catch {
        return false;
      }
    }
    return false;
  }
}

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();

  createSession(name = 'terminal', cwd = process.cwd()): TerminalSession {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const session = new TerminalSession(id, name, cwd);
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.getInfo());
  }

  closeSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      session.kill('SIGTERM');
      this.sessions.delete(id);
      return true;
    }
    return false;
  }
}
