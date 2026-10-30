import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { EvidenceRecord } from '../core/types.js';
import { EvidenceType, VerificationStatus } from '../core/types.js';
import type {
  ClaimVerificationState,
  ProofClaim,
  ProofReport,
  VerificationCheck,
  VerificationCheckType,
} from './types.js';

export class ProofVerifier {
  private claims: Map<string, ProofClaim> = new Map();
  private checks: Map<string, VerificationCheck> = new Map();
  private repositoryPath: string;
  private currentRevisionHash: string = '';

  constructor(repositoryPath: string, revisionHash?: string) {
    this.repositoryPath = repositoryPath;
    this.currentRevisionHash = revisionHash || this.resolveRevision(repositoryPath);
  }

  getRevisionHash(): string {
    return this.currentRevisionHash;
  }

  setRevisionHash(hash: string): void {
    this.currentRevisionHash = hash;
  }

  recordClaim(
    paramsOrCategory:
      | {
          statement: string;
          category: ProofClaim['category'];
          rationale?: string;
          unresolvedUncertainties?: string[];
        }
      | ProofClaim['category'],
    statementOrRationale?: string,
    evidenceRefs?: string[],
  ): ProofClaim {
    let statement: string;
    let category: ProofClaim['category'];
    let rationale = '';
    let supportingEvidenceIds: string[] = [];
    let unresolvedUncertainties: string[] = [];

    if (typeof paramsOrCategory === 'object') {
      statement = paramsOrCategory.statement;
      category = paramsOrCategory.category;
      rationale = paramsOrCategory.rationale || '';
      unresolvedUncertainties = paramsOrCategory.unresolvedUncertainties || [];
    } else {
      category = paramsOrCategory;
      statement = statementOrRationale || '';
      supportingEvidenceIds = evidenceRefs || [];
    }

    const claim: ProofClaim = {
      id: randomUUID(),
      statement,
      category,
      status: 'unverified',
      checks: [],
      supportingEvidenceIds,
      refutingEvidenceIds: [],
      revisionHash: this.currentRevisionHash,
      timestamp: new Date(),
      unresolvedUncertainties,
      rationale,
    };
    this.claims.set(claim.id, claim);
    return claim;
  }

  addCheck(claimId: string, checkParams: {
    name: string;
    type: VerificationCheckType;
    description: string;
    attempted: boolean;
    completed: boolean;
    passed: boolean;
    isExecution: boolean;
    durationMs?: number;
    evidenceId?: string;
    error?: string;
    commandExecuted?: string;
    exitCode?: number;
  }): VerificationCheck {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim not found with id: ${claimId}`);
    }

    const check: VerificationCheck = {
      id: randomUUID(),
      name: checkParams.name,
      type: checkParams.type,
      description: checkParams.description,
      attempted: checkParams.attempted,
      completed: checkParams.completed,
      passed: checkParams.passed,
      isExecution: checkParams.isExecution,
      timestamp: new Date(),
      durationMs: checkParams.durationMs,
      evidenceId: checkParams.evidenceId,
      error: checkParams.error,
      commandExecuted: checkParams.commandExecuted,
      exitCode: checkParams.exitCode,
    };

    this.checks.set(check.id, check);
    claim.checks.push(check);

    if (check.evidenceId) {
      if (check.passed) {
        if (!claim.supportingEvidenceIds.includes(check.evidenceId)) {
          claim.supportingEvidenceIds.push(check.evidenceId);
        }
      } else {
        if (!claim.refutingEvidenceIds.includes(check.evidenceId)) {
          claim.refutingEvidenceIds.push(check.evidenceId);
        }
      }
    }

    claim.status = this.evaluateClaimStatus(claim);
    return check;
  }

  attachEvidence(claimId: string, evidenceId: string, isSupporting: boolean = true): void {
    const claim = this.claims.get(claimId);
    if (!claim) return;

    if (isSupporting) {
      if (!claim.supportingEvidenceIds.includes(evidenceId)) {
        claim.supportingEvidenceIds.push(evidenceId);
      }
    } else {
      if (!claim.refutingEvidenceIds.includes(evidenceId)) {
        claim.refutingEvidenceIds.push(evidenceId);
      }
    }
    claim.status = this.evaluateClaimStatus(claim);
  }

  private evaluateClaimStatus(claim: ProofClaim): ClaimVerificationState {
    if (claim.checks.length === 0 && claim.supportingEvidenceIds.length === 0 && claim.refutingEvidenceIds.length === 0) {
      return 'unverified';
    }

    const failedChecks = claim.checks.filter((c) => c.attempted && (!c.passed || (c.exitCode !== undefined && c.exitCode !== 0)));
    if (claim.refutingEvidenceIds.length > 0 || failedChecks.length > 0) {
      const passedChecks = claim.checks.filter((c) => c.completed && c.passed);
      if (passedChecks.length > 0) {
        return 'partially_verified';
      }
      return 'failed';
    }

    const incompleteChecks = claim.checks.filter((c) => c.attempted && !c.completed);
    if (incompleteChecks.length > 0) {
      return 'incomplete';
    }

    if (claim.category === 'test_execution' || claim.category === 'regression_check') {
      const execChecks = claim.checks.filter((c) => c.isExecution && c.completed && c.passed);
      if (execChecks.length === 0) {
        return 'unverified';
      }
    }

    if (claim.category === 'code_modification') {
      const modificationChecks = claim.checks.filter(
        (c) => (c.type === 'git_inspection' || c.type === 'file_check' || c.type === 'artifact_inspection') && c.completed && c.passed,
      );
      if (modificationChecks.length === 0 && claim.supportingEvidenceIds.length === 0) {
        return 'unverified';
      }
    }

    const completedPassed = claim.checks.filter((c) => c.completed && c.passed);
    if (completedPassed.length > 0 && claim.checks.every((c) => c.completed && c.passed)) {
      if (claim.unresolvedUncertainties.length > 0) {
        return 'partially_verified';
      }
      return 'verified';
    }

    if (completedPassed.length > 0) {
      return 'partially_verified';
    }

    return 'unverified';
  }

  ingestEvidenceRecords(evidenceList: EvidenceRecord[]): void {
    for (const record of evidenceList) {
      if (record.type === EvidenceType.TEST_RESULT) {
        const isSuccess = record.verificationStatus === VerificationStatus.VERIFIED ||
          (!record.content.toLowerCase().includes('fail') && !record.content.toLowerCase().includes('error'));
        const exitCode = typeof record.metadata?.exitCode === 'number' ? (record.metadata.exitCode as number) : (isSuccess ? 0 : 1);

        const testClaim = this.recordClaim({
          statement: `Automated test execution: ${record.source}`,
          category: 'test_execution',
          rationale: `Derived from test tool execution: ${record.toolName}`,
        });

        this.addCheck(testClaim.id, {
          name: `Test Run: ${record.toolName}`,
          type: 'dynamic_execution',
          description: `Execution output from ${record.source}`,
          attempted: true,
          completed: true,
          passed: exitCode === 0 && isSuccess,
          isExecution: true,
          evidenceId: record.id,
          commandExecuted: typeof record.metadata?.command === 'string' ? (record.metadata.command as string) : undefined,
          exitCode,
        });
      } else if (record.type === EvidenceType.GIT_DIFF) {
        const hasDiff = record.content.trim().length > 0;
        const diffClaim = this.recordClaim({
          statement: `Working tree modifications: ${record.source}`,
          category: 'code_modification',
          rationale: 'Derived from git diff inspection',
        });

        this.addCheck(diffClaim.id, {
          name: 'Git Diff Inspection',
          type: 'git_inspection',
          description: 'Verified repository code delta',
          attempted: true,
          completed: true,
          passed: hasDiff,
          isExecution: false,
          evidenceId: record.id,
        });
      }
    }
  }

  generateReport(workflowId?: string): ProofReport {
    const claims = [...this.claims.values()];
    let checksAttempted = 0;
    let checksCompleted = 0;
    let checksPassed = 0;
    let checksFailed = 0;
    let dynamicExecutions = 0;
    let staticAnalyses = 0;
    const failedChecks: VerificationCheck[] = [];
    const insufficientEvidenceClaims: string[] = [];
    const suggestedNextSteps: string[] = [];

    for (const claim of claims) {
      if (claim.status === 'unverified' || claim.status === 'incomplete') {
        insufficientEvidenceClaims.push(claim.statement);
        if (claim.category === 'test_execution' || claim.category === 'regression_check') {
          suggestedNextSteps.push(`Execute real regression test suite for: "${claim.statement}"`);
        } else if (claim.category === 'code_modification') {
          suggestedNextSteps.push(`Inspect working tree diff to verify modifications for: "${claim.statement}"`);
        } else {
          suggestedNextSteps.push(`Gather execution evidence or inspect logs for: "${claim.statement}"`);
        }
      }

      for (const check of claim.checks) {
        if (check.attempted) checksAttempted++;
        if (check.completed) checksCompleted++;
        if (check.passed) checksPassed++;
        if (!check.passed || (check.exitCode !== undefined && check.exitCode !== 0)) {
          checksFailed++;
          failedChecks.push(check);
        }
        if (check.isExecution) dynamicExecutions++;
        else staticAnalyses++;
      }
    }

    if (failedChecks.length > 0) {
      for (const fc of failedChecks) {
        suggestedNextSteps.push(`Investigate and rerun failed check: "${fc.name}"${fc.error ? ' (' + fc.error + ')' : ''}`);
      }
    }

    let overallStatus: ClaimVerificationState = 'verified';
    if (claims.length === 0) {
      overallStatus = 'unverified';
    } else if (failedChecks.length > 0) {
      overallStatus = checksPassed > 0 ? 'partially_verified' : 'failed';
    } else if (insufficientEvidenceClaims.length > 0) {
      overallStatus = checksPassed > 0 ? 'partially_verified' : 'unverified';
    }

    const summaryParts: string[] = [
      `Proof Mode verified ${checksPassed}/${checksAttempted} attempted checks across ${claims.length} claims at commit ${this.currentRevisionHash.slice(0, 8) || 'working-tree'}.`,
      `Dynamic code executions: ${dynamicExecutions}. Static/inspection analyses: ${staticAnalyses}.`,
    ];
    if (checksFailed > 0) {
      summaryParts.push(`Identified ${checksFailed} failed verification checks.`);
    }
    if (insufficientEvidenceClaims.length > 0) {
      summaryParts.push(`${insufficientEvidenceClaims.length} claims lack sufficient ground-truth evidence.`);
    }

    return {
      id: randomUUID(),
      workflowId,
      repositoryPath: this.repositoryPath,
      revisionHash: this.currentRevisionHash,
      createdAt: new Date(),
      overallStatus,
      claims,
      checksAttemptedCount: checksAttempted,
      checksCompletedCount: checksCompleted,
      checksPassedCount: checksPassed,
      checksFailedCount: checksFailed,
      dynamicExecutionsCount: dynamicExecutions,
      staticAnalysesCount: staticAnalyses,
      insufficientEvidenceClaims,
      failedChecks,
      suggestedNextSteps: [...new Set(suggestedNextSteps)],
      summary: summaryParts.join(' '),
    };
  }

  formatReport(report: ProofReport): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                          ANVEXO PROOF MODE REPORT                              ');
    lines.push('================================================================================');
    lines.push(`Repository:    ${report.repositoryPath}`);
    lines.push(`Revision Hash: ${report.revisionHash || 'uncommitted working tree'}`);
    lines.push(`Status:        [${report.overallStatus.toUpperCase()}]`);
    lines.push(`Checks:        ${report.checksPassedCount} passed / ${report.checksAttemptedCount} attempted (${report.checksFailedCount} failed)`);
    lines.push(`Executions:    ${report.dynamicExecutionsCount} dynamic / ${report.staticAnalysesCount} static`);
    lines.push(`Generated:     ${report.createdAt.toISOString()}`);
    lines.push('--------------------------------------------------------------------------------');
    lines.push('CLAIMS & VERIFICATION STATUS:');

    if (report.claims.length === 0) {
      lines.push('  No claims registered in this workflow.');
    } else {
      for (const claim of report.claims) {
        const badge = claim.status === 'verified'
          ? '[VERIFIED]'
          : claim.status === 'partially_verified'
          ? '[PARTIAL]'
          : claim.status === 'failed'
          ? '[FAILED]'
          : '[UNVERIFIED]';

        lines.push(`  ${badge.padEnd(14)} ${claim.statement}`);
        if (claim.rationale) {
          lines.push(`    Rationale: ${claim.rationale}`);
        }
        for (const check of claim.checks) {
          const checkStatus = check.passed ? '✓ PASSED' : '✗ FAILED';
          const execType = check.isExecution ? '(Dynamic Execution)' : '(Static/Inspection)';
          lines.push(`      ${checkStatus} ${check.name} ${execType}`);
          if (check.commandExecuted) {
            lines.push(`        Command: ${check.commandExecuted} (exit: ${check.exitCode})`);
          }
          if (check.error) {
            lines.push(`        Error:   ${check.error}`);
          }
        }
        if (claim.unresolvedUncertainties.length > 0) {
          lines.push(`    Uncertainties: ${claim.unresolvedUncertainties.join('; ')}`);
        }
      }
    }

    if (report.failedChecks.length > 0) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('FAILED VERIFICATION CHECKS:');
      for (const fc of report.failedChecks) {
        lines.push(`  - ${fc.name}: ${fc.error || 'Check failed (exit code ' + fc.exitCode + ')'}`);
      }
    }

    if (report.suggestedNextSteps.length > 0) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('SUGGESTED NEXT VERIFICATION STEPS:');
      for (const step of report.suggestedNextSteps) {
        lines.push(`  → ${step}`);
      }
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }

  private resolveRevision(repoRoot: string): string {
    try {
      const res = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 5000,
        shell: false,
      });
      return (res.stdout || '').trim();
    } catch {
      return '';
    }
  }
}
