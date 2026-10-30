import { describe, it, expect, beforeEach } from 'vitest';
import { ProofVerifier } from '../../src/proof/verifier.js';
import type { ProofClaim, VerificationCheck } from '../../src/proof/types.js';
import { EvidenceType, VerificationStatus } from '../../src/core/types.js';

describe('ProofVerifier', () => {
  let verifier: ProofVerifier;

  beforeEach(() => {
    verifier = new ProofVerifier(process.cwd(), 'commit-abc-123');
  });

  it('initializes with repository path and revision hash', () => {
    expect(verifier.getRevisionHash()).toBe('commit-abc-123');
    verifier.setRevisionHash('commit-xyz-789');
    expect(verifier.getRevisionHash()).toBe('commit-xyz-789');
  });

  it('records claims with unverified default status', () => {
    const claim = verifier.recordClaim({
      statement: 'Auth token validation handles expired JWT',
      category: 'root_cause',
      rationale: 'Identified expiration check logic',
    });

    expect(claim.id).toBeDefined();
    expect(claim.statement).toBe('Auth token validation handles expired JWT');
    expect(claim.category).toBe('root_cause');
    expect(claim.status).toBe('unverified');
    expect(claim.revisionHash).toBe('commit-abc-123');
  });

  it('distinguishes static analysis from dynamic execution', () => {
    const claim = verifier.recordClaim({
      statement: 'Code review confirmed diff',
      category: 'code_modification',
    });

    const staticCheck = verifier.addCheck(claim.id, {
      name: 'Diff Static Check',
      type: 'static_analysis',
      description: 'Inspected file diff',
      attempted: true,
      completed: true,
      passed: true,
      isExecution: false,
    });

    expect(staticCheck.isExecution).toBe(false);

    const execCheck = verifier.addCheck(claim.id, {
      name: 'Vitest Execution',
      type: 'dynamic_execution',
      description: 'Executed test runner',
      attempted: true,
      completed: true,
      passed: true,
      isExecution: true,
      commandExecuted: 'npm test',
      exitCode: 0,
    });

    expect(execCheck.isExecution).toBe(true);
    expect(execCheck.commandExecuted).toBe('npm test');

    const report = verifier.generateReport();
    expect(report.dynamicExecutionsCount).toBe(1);
    expect(report.staticAnalysesCount).toBe(1);
  });

  it('evaluates test_execution claim as unverified if no dynamic execution check passed', () => {
    const claim = verifier.recordClaim({
      statement: 'Authentication unit tests pass',
      category: 'test_execution',
    });

    verifier.addCheck(claim.id, {
      name: 'Source inspection',
      type: 'static_analysis',
      description: 'Looked at test file',
      attempted: true,
      completed: true,
      passed: true,
      isExecution: false,
    });

    expect(claim.status).toBe('unverified');
  });

  it('evaluates claim as verified when dynamic execution check passes', () => {
    const claim = verifier.recordClaim({
      statement: 'Authentication test suite passed',
      category: 'test_execution',
    });

    verifier.addCheck(claim.id, {
      name: 'Vitest Run',
      type: 'dynamic_execution',
      description: 'Executed test runner',
      attempted: true,
      completed: true,
      passed: true,
      isExecution: true,
      commandExecuted: 'npx vitest run tests/auth.test.ts',
      exitCode: 0,
    });

    expect(claim.status).toBe('verified');
  });

  it('demotes verified claim to partially_verified if unresolved uncertainties exist', () => {
    const claim = verifier.recordClaim({
      statement: 'Session token renewal verified',
      category: 'test_execution',
      unresolvedUncertainties: ['Redis cluster failover was not simulated'],
    });

    verifier.addCheck(claim.id, {
      name: 'Unit test',
      type: 'dynamic_execution',
      description: 'Local token test',
      attempted: true,
      completed: true,
      passed: true,
      isExecution: true,
      exitCode: 0,
    });

    expect(claim.status).toBe('partially_verified');
  });

  it('marks claim as failed when execution check fails or exits non-zero', () => {
    const claim = verifier.recordClaim({
      statement: 'Regression test passes',
      category: 'regression_check',
    });

    verifier.addCheck(claim.id, {
      name: 'Regression run',
      type: 'dynamic_execution',
      description: 'Executed test',
      attempted: true,
      completed: true,
      passed: false,
      isExecution: true,
      exitCode: 1,
      error: 'AssertionError: expected true to be false',
    });

    expect(claim.status).toBe('failed');
  });

  it('ingests evidence records from tool execution', () => {
    verifier.ingestEvidenceRecords([
      {
        id: 'ev-test-1',
        type: EvidenceType.TEST_RESULT,
        source: 'vitest',
        content: 'Tests: 12 passed, 0 failed',
        timestamp: new Date(),
        toolName: 'run_command',
        verificationStatus: VerificationStatus.VERIFIED,
        linkedHypothesisIds: [],
        metadata: { command: 'npm test', exitCode: 0 },
      },
      {
        id: 'ev-diff-1',
        type: EvidenceType.GIT_DIFF,
        source: 'git_diff',
        content: '+ const fix = true;',
        timestamp: new Date(),
        toolName: 'git_diff',
        verificationStatus: VerificationStatus.OBSERVED,
        linkedHypothesisIds: [],
        metadata: {},
      },
    ]);

    const report = verifier.generateReport('workflow-1');
    expect(report.claims.length).toBe(2);
    expect(report.checksPassedCount).toBe(2);
    expect(report.overallStatus).toBe('verified');
  });

  it('formats human readable report with badges and next steps', () => {
    const claim = verifier.recordClaim({
      statement: 'Bug fixed in auth controller',
      category: 'regression_check',
    });

    verifier.addCheck(claim.id, {
      name: 'Vitest Runner',
      type: 'dynamic_execution',
      description: 'Run tests',
      attempted: true,
      completed: false,
      passed: false,
      isExecution: true,
      error: 'Timeout',
    });

    const report = verifier.generateReport();
    const formatted = verifier.formatReport(report);

    expect(formatted).toContain('ANVEXO PROOF MODE REPORT');
    expect(formatted).toContain('commit-abc-123');
    expect(formatted).toContain('SUGGESTED NEXT VERIFICATION STEPS');
  });
});
