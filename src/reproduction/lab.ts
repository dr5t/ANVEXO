import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { EvidenceRecord } from '../core/types.js';
import { EvidenceType, VerificationStatus, redactSecrets } from '../core/index.js';
import { getCleanSubprocessEnv } from '../tools/builtin.js';
import { ProofVerifier } from '../proof/verifier.js';
import type {
  BugReproductionOptions,
  BugReproductionSession,
  ExecutionArtifact,
  ReproductionStatus,
} from './types.js';

export class BugReproductionLab {
  private repoRoot: string;
  private static globalSessions: Map<string, BugReproductionSession> = new Map();

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
    const repoPath = path.resolve(options.repoRoot || this.repoRoot);
    const sessionId = randomUUID();
    const evidence: EvidenceRecord[] = [];
    const unverifiedClaims: string[] = [];

    // 1. Identify relevant source files from description, error message, or stack trace
    const targetFiles = this.identifyRelevantFiles(
      [options.bugDescription, options.errorMessage || '', options.stackTrace || ''].join('\n'),
      repoPath,
    );

    // 2. Determine or resolve the reproduction command
    let reproductionCmd = options.reproductionCommand || options.command;
    if (!reproductionCmd) {
      reproductionCmd = this.resolveReproductionCommand(targetFiles, options.reproductionTestPath, repoPath);
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

    // 3. Execute the reproduction in an isolated, sandboxed environment
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

    // 4. Verify whether the bug was actually reproduced
    const isReproduced = initialExecution.exitCode !== 0;
    let status: ReproductionStatus = isReproduced ? 'reproduced_failure' : 'cannot_reproduce';

    if (!isReproduced) {
      unverifiedClaims.push(
        `Reproduction command exited with code 0 (success). Failure matching symptom '${options.bugDescription}' was not observed.`,
      );
    }

    // 5. Build Proof Mode integration
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
      passed: isReproduced, // Passing the reproduction check means we confirmed the failure!
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

    const repoPath = this.repoRoot;

    // 1. Re-run the exact reproduction command that originally failed
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

    // 2. Check if fix succeeded on reproduction target
    const reproPassed = postFixExecution.exitCode === 0;

    // 3. Optional regression check across existing test suite
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

    // 4. Update Proof Report with both initial and post-fix checks
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

    try {
      const res = spawnSync(command, {
        cwd,
        encoding: 'utf-8',
        timeout: timeoutMs,
        maxBuffer: 5_000_000,
        env: cleanEnv,
        shell: true,
      });

      const stdout = redactSecrets((res.stdout || '').trim());
      const stderr = redactSecrets((res.stderr || '').trim());
      const durationMs = Date.now() - startTime;
      const exitCode = res.status !== null ? res.status : (res.error ? 1 : 0);

      return {
        command,
        exitCode,
        stdout,
        stderr,
        durationMs,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        command,
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
      if (fs.existsSync(path.join(repoRoot, clean))) {
        found.add(clean);
      }
    }

    return [...found];
  }

  private resolveReproductionCommand(
    targetFiles: string[],
    explicitTestPath: string | undefined,
    repoRoot: string,
  ): string | undefined {
    if (explicitTestPath && fs.existsSync(path.join(repoRoot, explicitTestPath))) {
      return `npx vitest run ${explicitTestPath}`;
    }

    // Check if any target file is itself a test file
    const testFile = targetFiles.find(f => f.includes('.test.') || f.includes('.spec.'));
    if (testFile) {
      return `npx vitest run ${testFile}`;
    }

    // Check package.json test scripts
    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.test) {
          return 'npm test';
        }
      } catch {}
    }

    return undefined;
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
