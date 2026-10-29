import { describe, it, expect, afterEach } from 'vitest';
import { TerminalManager } from '../../src/terminal/index.js';

describe('TerminalManager', () => {
  let tm: TerminalManager;

  afterEach(() => {
    if (tm) {
      tm.terminateAll();
    }
  });

  it('spawns a real shell process and captures output', async () => {
    tm = new TerminalManager();
    const session = tm.createSession(process.cwd());
    expect(session.id).toBeDefined();
    expect(session.getCwd()).toBe(process.cwd());

    const output = await new Promise<string>((resolve) => {
      let buf = '';
      session.onData((chunk) => {
        buf += chunk;
        if (buf.includes('ANVEXO_TERMINAL_TEST')) {
          resolve(buf);
        }
      });
      session.write('echo ANVEXO_TERMINAL_TEST\n');
    });

    expect(output).toContain('ANVEXO_TERMINAL_TEST');
  });

  it('terminates terminal sessions cleanly', () => {
    tm = new TerminalManager();
    const session = tm.createSession(process.cwd());
    expect(tm.listSessions().length).toBe(1);

    tm.terminate(session.id);
    expect(tm.listSessions().length).toBe(0);
  });
});
