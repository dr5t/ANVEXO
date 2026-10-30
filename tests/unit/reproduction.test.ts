import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BugReproductionLab } from '../../src/reproduction/lab.js';

describe('BugReproductionLab', () => {
  let lab: BugReproductionLab;
  const repoRoot = process.cwd();

  beforeEach(() => {
    lab = new BugReproductionLab(repoRoot);
  });

  it('observes and records reproduced failure when command exits non-zero', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Simulated command failure',
      reproductionCommand: 'node -e "process.exit(1)"',
    });

    expect(session.isReproduced).toBe(true);
    expect(session.status).toBe('reproduced_failure');
    expect(session.initialExecution).toBeDefined();
    expect(session.initialExecution?.exitCode).toBe(1);
    expect(session.proofReport).toBeDefined();
  });

  it('reports cannot_reproduce when command exits zero', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Non-reproducible symptom',
      reproductionCommand: 'node -e "process.exit(0)"',
    });

    expect(session.isReproduced).toBe(false);
    expect(session.status).toBe('cannot_reproduce');
    expect(session.unverifiedClaims.length).toBeGreaterThan(0);
  });

  it('handles missing reproduction command or test gracefully', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'No test exists for mysterious bug xyz',
    });

    expect(session.isReproduced).toBe(false);
    expect(session.status).toBe('cannot_reproduce');
  });

  it('rejects reproduction test paths that escape the repository root', async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-repro-boundary-'));
    const repoRoot = path.join(temporaryDirectory, 'repo');
    const outsideTest = path.join(temporaryDirectory, 'outside.test.ts');
    fs.mkdirSync(repoRoot);
    fs.writeFileSync(outsideTest, 'export {};');
    const outsidePaths = [
      path.relative(repoRoot, outsideTest),
      outsideTest,
      path.relative(repoRoot, outsideTest).replace(/\//g, '\\'),
      path.join('tests', '..', 'tests', 'unit', 'autonomy.test.ts'),
      path.win32.join('Z:\\', 'outside.test.ts'),
      '\\\\server\\share\\outside.test.ts',
    ];

    try {
      try {
        fs.symlinkSync(temporaryDirectory, path.join(repoRoot, 'linked'), 'junction');
        outsidePaths.push(path.join('linked', 'outside.test.ts'));
      } catch {}

      for (const reproductionTestPath of outsidePaths) {
        const session = await lab.runReproduction({
          repoRoot,
          bugDescription: 'Outside test path rejection',
          reproductionTestPath,
        });

        expect(session.status).toBe('reproduction_failed');
        expect(session.isReproduced).toBe(false);
        expect(session.initialExecution).toBeUndefined();
      }
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('continues to accept a nested reproduction test path', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Nested autonomy unit test',
      reproductionTestPath: path.join('tests', 'unit', 'autonomy.test.ts'),
      timeoutMs: 10000,
    });

    expect(session.status).not.toBe('reproduction_failed');
    expect(session.reproductionCommand).toContain('tests');
    expect(session.initialExecution).toBeDefined();
  });

  it('rejects shell syntax before executing a reproduction command', async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-repro-command-'));
    const markerPath = path.join(temporaryDirectory, 'marker');
    const command = `node -e "process.exit(0)" && node -e "require('node:fs').writeFileSync(process.argv[1], 'executed')" "${markerPath}"`;

    try {
      const session = await lab.runReproduction({
        repoRoot,
        bugDescription: 'Chained reproduction command rejection',
        reproductionCommand: command,
      });

      expect(session.status).toBe('reproduction_failed');
      expect(session.isReproduced).toBe(false);
      expect(session.initialExecution).toBeUndefined();
      expect(session.evidence).toHaveLength(0);
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('identifies relevant target files from stack traces', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Null pointer in authentication',
      stackTrace: 'Error at authenticateUser (/src/core/types.ts:12:3)\n  at /src/server/router.ts:40:1',
      reproductionCommand: 'node -e "process.exit(1)"',
    });

    expect(session.targetFiles).toContain('src/core/types.ts');
    expect(session.targetFiles).toContain('src/server/router.ts');
  });

  it('verifies fix when post-fix command succeeds', async () => {
    const initialSession = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Failing calculation',
      reproductionCommand: 'node -e "process.exit(1)"',
    });

    expect(initialSession.isReproduced).toBe(true);

    initialSession.reproductionCommand = 'node -e "process.exit(0)"';
    const verifiedSession = await lab.verifyFix(initialSession, 'node -e "process.exit(0)"');

    expect(verifiedSession.isFixed).toBe(true);
    expect(verifiedSession.status).toBe('verified_fixed');
    expect(verifiedSession.postFixExecution?.exitCode).toBe(0);
    expect(verifiedSession.proofReport?.overallStatus).toBe('verified');
  });

  it('fails fix verification when post-fix execution fails', async () => {
    const initialSession = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Failing calculation',
      reproductionCommand: 'node -e "process.exit(1)"',
    });

    const verifiedSession = await lab.verifyFix(initialSession);

    expect(verifiedSession.isFixed).toBe(false);
    expect(verifiedSession.status).toBe('fix_unverified');
  });

  it('refuses to verify fix if bug was never reproduced', async () => {
    const initialSession = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Benign behavior',
      reproductionCommand: 'node -e "process.exit(0)"',
    });

    const verifiedSession = await lab.verifyFix(initialSession);
    expect(verifiedSession.status).toBe('fix_unverified');
    expect(verifiedSession.unverifiedClaims.some(c => c.includes('never confirmed'))).toBe(true);
  });

  it('redacts sensitive environment variables and outputs in execution sandbox', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Secret leak test',
      reproductionCommand: 'node -e "console.log(\'token: ghp_123456789012345678901234567890123456\'); process.exit(1);"',
    });

    expect(session.initialExecution?.stdout).toContain('[REDACTED');
    expect(session.initialExecution?.stdout).not.toContain('ghp_123456789012345678901234567890123456');
  });

  it('formats comprehensive report with before and after outputs', async () => {
    const session = await lab.runReproduction({
      repoRoot,
      bugDescription: 'Crashing database pool',
      reproductionCommand: 'node -e "console.error(\'Connection pool timeout\'); process.exit(2);"',
    });

    const report = lab.formatReport(session);
    expect(report).toContain('ANVEXO BUG REPRODUCTION LAB REPORT');
    expect(report).toContain('Crashing database pool');
    expect(report).toContain('Connection pool timeout');
  });
});
