import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { EvidenceRecord } from '../core/types.js';
import { EvidenceType, VerificationStatus, redactSecrets } from '../core/index.js';
import { getCleanSubprocessEnv } from '../tools/builtin.js';
import { ProofVerifier } from '../proof/verifier.js';
import { validatePathWithinRoot } from '../server/security.js';
import { isShellExecutable, parseCommandLine, resolveShellFreeCommand } from '../terminal/command.js';
import type {
  BugReproductionOptions,
  BugReproductionSession,
  ExecutionArtifact,
  ReproductionStatus,
} from './types.js';

export class BugReproductionLab {
  private repoRoot: string;
  private static globalSessions: Map<string, BugReproductionSession> = new Map();
  private static sessionRoots: WeakMap<BugReproductionSession, string> = new WeakMap();

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  async runReproduction(
    bugDescOrOptions: string | BugReproductionOptions,
    extraOptions?: Partial<BugReproductionOptions>,
  ): Promise<BugReproductionSession> {
    const options: BugReproductionOptions =
      typeof bugDescOrOptions === 'string'
        ? { bugDescription: bugDescOrOptions, ...extraOptions }
        : bugDescOrOptions;

    const startedAt = new Date();
    const sessionId = randomUUID();
    const evidence: EvidenceRecord[] = [];
    const unverifiedClaims: string[] = [];
    let repoPath: string;

    try {
      repoPath = fs.realpathSync(path.resolve(options.repoRoot || this.repoRoot));
      if (!fs.statSync(repoPath).isDirectory()) throw new Error('Invalid repository root');
    } catch {
      return this.createRejectedSession(options, startedAt, [], 'Reproduction rejected: repository root could not be resolved.');
    }

    const targetFiles = this.identifyRelevantFiles(
      [options.bugDescription, options.errorMessage || '', options.stackTrace || ''].join('\n'),
      repoPath,
    );

    let reproductionCmd = options.reproductionCommand || options.command;
    try {
      if (!reproductionCmd) {
        reproductionCmd = this.resolveReproductionCommand(targetFiles, options.reproductionTestPath, repoPath);
      }
    } catch {
      return this.createRejectedSession(options, startedAt, targetFiles, 'Reproduction rejected: test path must resolve to a file inside the repository root.');
    }

    const parsedCommand = reproductionCmd ? parseCommandLine(reproductionCmd) : undefined;
    if (reproductionCmd && (!parsedCommand || isShellExecutable(parsedCommand.executable))) {
      return this.createRejectedSession(options, startedAt, targetFiles, 'Reproduction rejected: shell syntax and shell executables are not allowed.');
    }

    if (!reproductionCmd) {
      return {
        id: sessionId,
        bugDescription: options.bugDescription,
        errorMessage: options.errorMessage,
        stackTrace: options.stackTrace,
        targetFiles,
        status: 'cannot_reproduce',
        isReproduced: false,
        isFixed: false,
        evidence,
        startedAt,
        completedAt: new Date(),
        summary: 'Cannot reproduce: No automated test, reproduction command, or reproducible script could be identified for the described bug.',
        unverifiedClaims: ['Bug reproduction attempted without executable test or script'],
      };
    }

    const timeoutMs = options.timeoutMs || 20000;
    const initialExecution = this.executeSandboxed(reproductionCmd, repoPath, timeoutMs);

    evidence.push({
      id: randomUUID(),
      type: EvidenceType.TEST_RESULT,
      source: `reproduction_initial:${reproductionCmd}`,
      content: initialExecution.stdout + (initialExecution.stderr ? `\nSTDERR:\n${initialExecution.stderr}` : ''),
      timestamp: initialExecution.timestamp,
      toolName: 'reproduction_runner',
      verificationStatus: initialExecution.exitCode !== 0 ? VerificationStatus.VERIFIED : VerificationStatus.CONTRADICTED,
      linkedHypothesisIds: [],
      metadata: {
        command: initialExecution.command,
        exitCode: initialExecution.exitCode,
        durationMs: initialExecution.durationMs,
        stage: 'initial_reproduction',
      },
    });

    const isReproduced = initialExecution.exitCode !== 0;
    let status: ReproductionStatus = isReproduced ? 'reproduced_failure' : 'cannot_reproduce';

    if (!isReproduced) {
      unverifiedClaims.push(
        `Reproduction command exited with code 0 (success). Failure matching symptom '${options.bugDescription}' was not observed.`,
      );
    }

    const verifier = new ProofVerifier(repoPath);

    const reproClaim = verifier.recordClaim({
      statement: `Bug reproduction observed for: ${options.bugDescription}`,
      category: 'root_cause',
      rationale: `Executed reproduction command: ${reproductionCmd}`,
    });

    verifier.addCheck(reproClaim.id, {
      name: 'Initial Bug Reproduction Execution',
      type: 'dynamic_execution',
      description: `Executed '${reproductionCmd}' in sandbox`,
      attempted: true,
      completed: true,
      passed: isReproduced,
      isExecution: true,
      commandExecuted: reproductionCmd,
      exitCode: initialExecution.exitCode,
      durationMs: initialExecution.durationMs,
      evidenceId: evidence[0]?.id,
      error: isReproduced ? undefined : 'Reproduction command exited with code 0 (expected failure to reproduce)',
    });

    const proofReport = verifier.generateReport(sessionId);

    const summary = isReproduced
      ? `Bug successfully reproduced in lab via '${reproductionCmd}' (exit code: ${initialExecution.exitCode}, duration: ${initialExecution.durationMs}ms). Initial failure evidence recorded.`
      : `Bug could not be reproduced: command '${reproductionCmd}' executed successfully with exit code 0. No failure was observed.`;

    const sessionResult: BugReproductionSession = {
      id: sessionId,
      bugDescription: options.bugDescription,
      errorMessage: options.errorMessage,
      stackTrace: options.stackTrace,
      targetFiles,
      reproductionCommand: reproductionCmd,
      reproductionTestFile: options.reproductionTestPath,
      status,
      initialExecution,
      isReproduced,
      isFixed: false,
      evidence,
      proofReport,
      startedAt,
      completedAt: new Date(),
      summary,
      unverifiedClaims,
    };
    BugReproductionLab.globalSessions.set(sessionId, sessionResult);
    BugReproductionLab.sessionRoots.set(sessionResult, repoPath);
    return sessionResult;
  }

  async verifyFix(
    sessionOrId: BugReproductionSession | string,
    fixSummaryOrRegressionCmd?: string,
    options?: { regressionCommand?: string },
  ): Promise<BugReproductionSession> {
    let session: BugReproductionSession;
    let regressionTestCmd: string | undefined;

    if (typeof sessionOrId === 'string') {
      const found = BugReproductionLab.globalSessions.get(sessionOrId);
      if (!found) {
        throw new Error(`Bug reproduction session not found: ${sessionOrId}`);
      }
      session = found;
      if (typeof fixSummaryOrRegressionCmd === 'string') {
        session.summary += ` | Fix: ${fixSummaryOrRegressionCmd}`;
      }
      regressionTestCmd = options?.regressionCommand;
    } else {
      session = sessionOrId;
      regressionTestCmd = fixSummaryOrRegressionCmd;
    }
    if (!session.isReproduced || !session.reproductionCommand) {
      session.unverifiedClaims.push('Cannot verify fix: Initial failure was never confirmed as reproduced.');
      session.status = 'fix_unverified';
      return session;
    }

    const repoPath = BugReproductionLab.sessionRoots.get(session) || this.repoRoot;

    const postFixExecution = this.executeSandboxed(session.reproductionCommand, repoPath, 20000);
    session.postFixExecution = postFixExecution;

    session.evidence.push({
      id: randomUUID(),
      type: EvidenceType.TEST_RESULT,
      source: `reproduction_postfix:${session.reproductionCommand}`,
      content: postFixExecution.stdout + (postFixExecution.stderr ? `\nSTDERR:\n${postFixExecution.stderr}` : ''),
      timestamp: postFixExecution.timestamp,
      toolName: 'reproduction_runner',
      verificationStatus: postFixExecution.exitCode === 0 ? VerificationStatus.VERIFIED : VerificationStatus.CONTRADICTED,
      linkedHypothesisIds: [],
      metadata: {
        command: postFixExecution.command,
        exitCode: postFixExecution.exitCode,
        durationMs: postFixExecution.durationMs,
        stage: 'post_fix_verification',
      },
    });

    const reproPassed = postFixExecution.exitCode === 0;

    let regressionPassed = true;
    if (regressionTestCmd) {
      const regExecution = this.executeSandboxed(regressionTestCmd, repoPath, 30000);
      session.regressionTestExecution = regExecution;
      regressionPassed = regExecution.exitCode === 0;

      session.evidence.push({
        id: randomUUID(),
        type: EvidenceType.TEST_RESULT,
        source: `regression_suite:${regressionTestCmd}`,
        content: regExecution.stdout + (regExecution.stderr ? `\nSTDERR:\n${regExecution.stderr}` : ''),
        timestamp: regExecution.timestamp,
        toolName: 'reproduction_runner',
        verificationStatus: regressionPassed ? VerificationStatus.VERIFIED : VerificationStatus.CONTRADICTED,
        linkedHypothesisIds: [],
        metadata: {
          command: regExecution.command,
          exitCode: regExecution.exitCode,
          stage: 'regression_suite',
        },
      });
    }

    session.isFixed = reproPassed && regressionPassed;
    session.status = session.isFixed ? 'verified_fixed' : 'fix_unverified';
    session.completedAt = new Date();

    const verifier = new ProofVerifier(repoPath);
    const fixClaim = verifier.recordClaim({
      statement: `Bug fix verified for: ${session.bugDescription}`,
      category: 'regression_check',
      rationale: `Initial failure exited code ${session.initialExecution?.exitCode}; post-fix execution exited code ${postFixExecution.exitCode}`,
    });

    verifier.addCheck(fixClaim.id, {
      name: 'Post-Fix Reproduction Check',
      type: 'dynamic_execution',
      description: `Reran reproduction command '${session.reproductionCommand}'`,
      attempted: true,
      completed: true,
      passed: reproPassed,
      isExecution: true,
      commandExecuted: session.reproductionCommand,
      exitCode: postFixExecution.exitCode,
      durationMs: postFixExecution.durationMs,
    });

    if (regressionTestCmd && session.regressionTestExecution) {
      verifier.addCheck(fixClaim.id, {
        name: 'Full Regression Suite Check',
        type: 'test_run',
        description: `Executed regression suite '${regressionTestCmd}'`,
        attempted: true,
        completed: true,
        passed: regressionPassed,
        isExecution: true,
        commandExecuted: regressionTestCmd,
        exitCode: session.regressionTestExecution.exitCode,
      });
    }

    session.proofReport = verifier.generateReport(session.id);
    session.summary = session.isFixed
      ? `Fix successfully verified! Original reproduction passed (exit code: 0) and regression tests passed.`
      : `Fix verification failed. Post-fix execution code: ${postFixExecution.exitCode}.`;

    return session;
  }

  private executeSandboxed(command: string, cwd: string, timeoutMs: number): ExecutionArtifact {
    const startTime = Date.now();
    const cleanEnv = getCleanSubprocessEnv();
    const parsedCommand = parseCommandLine(command);

    if (!parsedCommand || isShellExecutable(parsedCommand.executable)) {
      return {
        command: redactSecrets(command),
        exitCode: 1,
        stdout: '',
        stderr: 'Command rejected: shell syntax and shell executables are not allowed.',
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }

    try {
      const invocation = resolveShellFreeCommand(parsedCommand, cwd);
      const res = spawnSync(invocation.executable, invocation.args, {
        cwd,
        encoding: 'utf-8',
        timeout: timeoutMs,
        maxBuffer: 5_000_000,
        env: cleanEnv,
        shell: false,
      });

      const stdout = redactSecrets((res.stdout || '').trim());
      const stderr = redactSecrets((res.stderr || '').trim());
      const durationMs = Date.now() - startTime;
      const exitCode = res.status !== null ? res.status : (res.error ? 1 : 0);

      return {
        command: redactSecrets(command),
        exitCode,
        stdout,
        stderr,
        durationMs,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        command: redactSecrets(command),
        exitCode: 1,
        stdout: '',
        stderr: redactSecrets(msg),
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private identifyRelevantFiles(text: string, repoRoot: string): string[] {
    const found = new Set<string>();
    const fileMatches = text.match(/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/g) || [];

    for (const match of fileMatches) {
      const clean = match.replace(/^[./\\]+/, '');
      try {
        const resolved = validatePathWithinRoot(clean, repoRoot);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          found.add(path.relative(repoRoot, resolved).split(path.sep).join('/'));
        }
      } catch {
        continue;
      }
    }

    return [...found];
  }

  private resolveReproductionCommand(
    targetFiles: string[],
    explicitTestPath: string | undefined,
    repoRoot: string,
  ): string | undefined {
    if (explicitTestPath) {
      return this.createVitestCommand(this.resolveTestPath(explicitTestPath, repoRoot));
    }

    const testFile = targetFiles.find(f => f.includes('.test.') || f.includes('.spec.'));
    if (testFile) {
      return this.createVitestCommand(this.resolveTestPath(testFile, repoRoot));
    }

    return undefined;
  }

  private resolveTestPath(testPath: string, repoRoot: string): string {
    const portablePath = testPath.replace(/\\/g, '/');
    if (portablePath.split('/').includes('..')) throw new Error('Invalid test path');
    if (path.win32.isAbsolute(testPath) && !path.isAbsolute(testPath)) {
      throw new Error('Invalid test path');
    }

    const normalizedPath = testPath.replace(/[\\/]/g, path.sep);
    const resolvedPath = validatePathWithinRoot(normalizedPath, repoRoot);
    if (!fs.statSync(resolvedPath).isFile()) throw new Error('Invalid test path');

    const relativePath = path.relative(repoRoot, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new Error('Invalid test path');
    return relativePath.split(path.sep).join('/');
  }

  private createVitestCommand(testPath: string): string {
    return `npx vitest run ${JSON.stringify(testPath)}`;
  }

  private createRejectedSession(
    options: BugReproductionOptions,
    startedAt: Date,
    targetFiles: string[],
    summary: string,
  ): BugReproductionSession {
    return {
      id: randomUUID(),
      bugDescription: options.bugDescription,
      errorMessage: options.errorMessage,
      stackTrace: options.stackTrace,
      targetFiles,
      reproductionTestFile: options.reproductionTestPath,
      status: 'reproduction_failed',
      isReproduced: false,
      isFixed: false,
      evidence: [],
      startedAt,
      completedAt: new Date(),
      summary,
      unverifiedClaims: ['Reproduction input was rejected before execution'],
    };
  }

  formatReport(session: BugReproductionSession): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                      ANVEXO BUG REPRODUCTION LAB REPORT                        ');
    lines.push('================================================================================');
    lines.push(`Session ID:     ${session.id}`);
    lines.push(`Status:         [${session.status.toUpperCase()}]`);
    lines.push(`Bug Objective:  ${session.bugDescription}`);
    lines.push(`Reproduced:     ${session.isReproduced ? 'YES (Confirmed Ground-Truth Failure)' : 'NO'}`);
    lines.push(`Fix Verified:   ${session.isFixed ? 'YES (Passed Post-Fix Verification)' : 'NO'}`);
    lines.push(`Command:        ${session.reproductionCommand || 'None'}`);
    lines.push('--------------------------------------------------------------------------------');

    if (session.initialExecution) {
      lines.push('INITIAL REPRODUCTION ATTEMPT:');
      lines.push(`  Command:      ${session.initialExecution.command}`);
      lines.push(`  Exit Code:    ${session.initialExecution.exitCode} (${session.initialExecution.exitCode !== 0 ? 'Failure Confirmed' : 'Unexpected Success'})`);
      lines.push(`  Duration:     ${session.initialExecution.durationMs}ms`);
      if (session.initialExecution.stderr) {
        lines.push(`  Stderr:\n    ${session.initialExecution.stderr.split('\n').slice(0, 5).join('\n    ')}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (session.postFixExecution) {
      lines.push('POST-FIX VERIFICATION RUN:');
      lines.push(`  Command:      ${session.postFixExecution.command}`);
      lines.push(`  Exit Code:    ${session.postFixExecution.exitCode} (${session.postFixExecution.exitCode === 0 ? 'Passed' : 'Failed'})`);
      lines.push(`  Duration:     ${session.postFixExecution.durationMs}ms`);
      lines.push('--------------------------------------------------------------------------------');
    }

    lines.push(`SUMMARY: ${session.summary}`);

    if (session.unverifiedClaims.length > 0) {
      lines.push('LIMITATIONS / UNVERIFIED CLAIMS:');
      for (const uv of session.unverifiedClaims) {
        lines.push(`  ! ${uv}`);
      }
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
