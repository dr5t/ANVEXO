import type { InvestigationReport, Finding } from '../core/index.js';
import { VerificationStatus } from '../core/index.js';

export function formatReport(report: InvestigationReport): string {
  const lines: string[] = [];
  const divider = '='.repeat(72);
  const thinDivider = '-'.repeat(72);

  lines.push(divider);
  lines.push('ANVEXO INVESTIGATION REPORT');
  lines.push(divider);
  lines.push('');

  lines.push(`Report ID:   ${report.id}`);
  lines.push(`Started:     ${report.startedAt.toISOString()}`);
  lines.push(`Completed:   ${report.completedAt.toISOString()}`);
  lines.push(`Duration:    ${formatDuration(report.startedAt, report.completedAt)}`);
  lines.push('');

  lines.push(thinDivider);
  lines.push('OBJECTIVE');
  lines.push(thinDivider);
  lines.push(report.objective);
  lines.push('');

  lines.push(thinDivider);
  lines.push('PROJECT');
  lines.push(thinDivider);
  lines.push(`Path:           ${report.projectMetadata.rootPath}`);
  lines.push(`Name:           ${report.projectMetadata.name}`);
  lines.push(`Languages:      ${report.projectMetadata.languages.join(', ') || 'unknown'}`);
  lines.push(`Frameworks:     ${report.projectMetadata.frameworks.join(', ') || 'none detected'}`);
  lines.push(`Package Manager: ${report.projectMetadata.packageManager || 'unknown'}`);
  lines.push(`Test Runner:    ${report.projectMetadata.testRunner || 'none detected'}`);
  lines.push(`Git:            ${report.projectMetadata.hasGit ? 'yes' : 'no'}`);
  lines.push(`Config Files:   ${report.projectMetadata.configFiles.join(', ')}`);
  lines.push('');

  lines.push(thinDivider);
  lines.push(`INVESTIGATION PLAN (${report.plan.steps.length} steps)`);
  lines.push(thinDivider);
  for (const step of report.plan.steps) {
    const icon = statusIcon(step.status);
    lines.push(`  ${icon} [${step.status.toUpperCase().padEnd(9)}] ${step.description}`);
    if (step.error) {
      lines.push(`    ERROR: ${step.error}`);
    }
  }
  lines.push('');

  lines.push(thinDivider);
  lines.push(`EVIDENCE COLLECTED (${report.evidence.length} records)`);
  lines.push(thinDivider);
  for (const ev of report.evidence) {
    lines.push(`  [${ev.type}] [${ev.verificationStatus}] ${ev.source}`);
    const preview = ev.content.substring(0, 200).replace(/\n/g, ' ');
    if (preview) {
      lines.push(`    ${preview}${ev.content.length > 200 ? '...' : ''}`);
    }
  }
  lines.push('');

  if (report.findings.length > 0) {
    lines.push(thinDivider);
    lines.push('FINDINGS');
    lines.push(thinDivider);
    for (let i = 0; i < report.findings.length; i++) {
      const f = report.findings[i];
      lines.push(`  ${i + 1}. ${f.claim}`);
      lines.push(`     Status: ${f.verificationStatus}`);
      lines.push(`     Confidence: ${(f.confidence * 100).toFixed(0)}%`);
      lines.push(`     Evidence: ${f.evidenceIds.length} record(s)`);
      if (f.details) {
        lines.push(`     Details: ${f.details}`);
      }
      lines.push('');
    }
  }

  if (report.hypotheses.length > 0) {
    lines.push(thinDivider);
    lines.push('HYPOTHESES');
    lines.push(thinDivider);
    for (const h of report.hypotheses) {
      lines.push(`  [${h.status.toUpperCase()}] ${h.statement}`);
      lines.push(`    Supporting evidence: ${h.supportingEvidenceIds.length}`);
      lines.push(`    Contradicting evidence: ${h.contradictingEvidenceIds.length}`);
      lines.push('');
    }
  }

  if (report.unverifiedClaims.length > 0) {
    lines.push(thinDivider);
    lines.push('UNVERIFIED CLAIMS');
    lines.push(thinDivider);
    for (const c of report.unverifiedClaims) {
      lines.push(`  ! ${c}`);
    }
    lines.push('');
  }

  if (report.proofReport) {
    lines.push(thinDivider);
    lines.push('PROOF MODE VERIFICATION');
    lines.push(thinDivider);
    lines.push(`Status:             [${report.proofReport.overallStatus.toUpperCase()}]`);
    lines.push(`Checks:             ${report.proofReport.checksPassedCount} passed / ${report.proofReport.checksAttemptedCount} attempted (${report.proofReport.checksFailedCount} failed)`);
    lines.push(`Executions:         ${report.proofReport.dynamicExecutionsCount} dynamic / ${report.proofReport.staticAnalysesCount} static`);
    lines.push(`Revision Hash:      ${report.proofReport.revisionHash || 'uncommitted working tree'}`);
    for (const claim of report.proofReport.claims) {
      lines.push(`  [${claim.status.toUpperCase()}] ${claim.statement}`);
      for (const check of claim.checks) {
        const marker = check.passed ? '✓' : '✗';
        const kind = check.isExecution ? '(Dynamic Execution)' : '(Static Analysis)';
        lines.push(`    ${marker} ${check.name} ${kind}`);
      }
    }
    if (report.proofReport.suggestedNextSteps.length > 0) {
      lines.push('Suggested Next Verification Steps:');
      for (const step of report.proofReport.suggestedNextSteps) {
        lines.push(`  → ${step}`);
      }
    }
    lines.push('');
  }

  if (report.limitations.length > 0) {
    lines.push(thinDivider);
    lines.push('LIMITATIONS');
    lines.push(thinDivider);
    for (const l of report.limitations) {
      lines.push(`  - ${l}`);
    }
    lines.push('');
  }

  lines.push(divider);
  lines.push('END OF REPORT');
  lines.push(divider);

  return lines.join('\n');
}

export function generateFindings(report: InvestigationReport): Finding[] {
  const findings: Finding[] = [];

  const projectEvidence = report.evidence.filter(e => e.type === 'project_metadata');
  if (projectEvidence.length > 0) {
    findings.push({
      claim: `Project uses ${report.projectMetadata.languages.join(', ')} with ${report.projectMetadata.frameworks.join(', ') || 'no detected framework'}`,
      evidenceIds: projectEvidence.map(e => e.id),
      verificationStatus: VerificationStatus.OBSERVED,
      confidence: 0.95,
      details: 'Detected from project configuration files and file extensions',
    });
  }

  const gitEvidence = report.evidence.filter(e => e.type === 'git_status' || e.type === 'git_log');
  if (gitEvidence.length > 0) {
    const statusEv = gitEvidence.find(e => e.type === 'git_status');
    if (statusEv) {
      const changedFiles = statusEv.metadata.changedFiles as number | undefined;
      if (changedFiles !== undefined && changedFiles > 0) {
        findings.push({
          claim: `Repository has ${changedFiles} uncommitted change(s)`,
          evidenceIds: [statusEv.id],
          verificationStatus: VerificationStatus.OBSERVED,
          confidence: 1.0,
          details: statusEv.content,
        });
      }
    }
  }

  const testEvidence = report.evidence.filter(e => e.type === 'test_result');
  for (const te of testEvidence) {
    const passed = te.content.includes('pass') || te.content.includes('PASS');
    const failed = te.content.includes('fail') || te.content.includes('FAIL') || te.content.includes('Error');
    findings.push({
      claim: failed ? 'Some tests are failing' : passed ? 'All detected tests pass' : 'Test results require manual review',
      evidenceIds: [te.id],
      verificationStatus: failed || passed ? VerificationStatus.OBSERVED : VerificationStatus.UNVERIFIED,
      confidence: failed || passed ? 0.9 : 0.3,
      details: te.content.substring(0, 500),
    });
  }

  const errorEvidence = report.evidence.filter(e => e.type === 'error');
  for (const ee of errorEvidence) {
    findings.push({
      claim: `Tool failure: ${ee.source}`,
      evidenceIds: [ee.id],
      verificationStatus: VerificationStatus.OBSERVED,
      confidence: 1.0,
      details: ee.content,
    });
  }

  return findings;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '[OK]';
    case 'failed': return '[!!]';
    case 'skipped': return '[--]';
    case 'running': return '[..]';
    default: return '[  ]';
  }
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
