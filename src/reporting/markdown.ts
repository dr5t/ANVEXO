import type { InvestigationReport, Finding, Hypothesis, EvidenceRecord } from '../core/types.js';

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br/>').trim();
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function statusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'verified':
    case 'observed':
    case 'supported':
      return `\`${status.toUpperCase()}\``;
    case 'failed':
    case 'contradicted':
      return `**\`${status.toUpperCase()}\`**`;
    case 'active':
    case 'running':
      return `*${status.toUpperCase()}*`;
    default:
      return `\`${status.toUpperCase()}\``;
  }
}

export function formatMarkdownReport(report: InvestigationReport): string {
  const lines: string[] = [];

  lines.push(`# ANVEXO Investigation Report`);
  lines.push('');
  lines.push(`> **Report ID**: \`${report.id}\`  `);
  lines.push(`> **Investigation Objective**: ${report.objective}`);
  lines.push('');

  lines.push('## Executive Summary & Metadata');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Report ID** | \`${report.id}\` |`);
  lines.push(`| **Started At** | \`${report.startedAt instanceof Date ? report.startedAt.toISOString() : String(report.startedAt)}\` |`);
  lines.push(`| **Completed At** | \`${report.completedAt instanceof Date ? report.completedAt.toISOString() : String(report.completedAt)}\` |`);
  lines.push(`| **Total Duration** | ${formatDuration(new Date(report.startedAt), new Date(report.completedAt))} |`);
  lines.push(`| **Repository Path** | \`${escapeTableCell(report.projectMetadata.rootPath)}\` |`);
  lines.push(`| **Project Name** | **${escapeTableCell(report.projectMetadata.name || 'unnamed')}** |`);
  lines.push(`| **Languages** | ${escapeTableCell(report.projectMetadata.languages.join(', ') || 'none detected')} |`);
  lines.push(`| **Frameworks** | ${escapeTableCell(report.projectMetadata.frameworks.join(', ') || 'none')} |`);
  lines.push(`| **Package Manager** | \`${escapeTableCell(report.projectMetadata.packageManager || 'none')}\` |`);
  lines.push(`| **Test Runner** | \`${escapeTableCell(report.projectMetadata.testRunner || 'none')}\` |`);
  lines.push(`| **Version Control** | ${report.projectMetadata.hasGit ? 'Git repository initialized' : 'No Git repository'} |`);
  lines.push(`| **Configuration Files** | ${escapeTableCell(report.projectMetadata.configFiles.join(', ') || 'none')} |`);
  lines.push('');

  lines.push(`## Diagnostic Plan Execution (${report.plan.steps.length} Steps)`);
  lines.push('');
  lines.push('| # | Step Description | Status | Evidence Count | Error Note |');
  lines.push('| :-: | :--- | :-: | :-: | :--- |');
  report.plan.steps.forEach((step, idx) => {
    const errorNote = step.error ? `\`${escapeTableCell(step.error)}\`` : '-';
    lines.push(`| ${idx + 1} | ${escapeTableCell(step.description)} | ${statusBadge(step.status)} | ${step.evidenceIds.length} | ${errorNote} |`);
  });
  lines.push('');

  if (report.findings.length > 0) {
    lines.push(`## Ground-Truth Findings (${report.findings.length})`);
    lines.push('');
    lines.push('| # | Finding Claim | Status | Confidence | Linked Evidence | Details |');
    lines.push('| :-: | :--- | :-: | :-: | :-: | :--- |');
    report.findings.forEach((finding: Finding, idx: number) => {
      const conf = `${Math.round(finding.confidence * 100)}%`;
      const evCount = `${finding.evidenceIds.length} record(s)`;
      const details = finding.details ? escapeTableCell(finding.details.slice(0, 200)) : '-';
      lines.push(`| ${idx + 1} | ${escapeTableCell(finding.claim)} | ${statusBadge(finding.verificationStatus)} | ${conf} | ${evCount} | ${details} |`);
    });
    lines.push('');
  }

  if (report.hypotheses.length > 0) {
    lines.push(`## Evaluated Hypotheses (${report.hypotheses.length})`);
    lines.push('');
    lines.push('| Hypothesis Statement | Status | Supporting Ev | Contradicting Ev |');
    lines.push('| :--- | :-: | :-: | :-: |');
    report.hypotheses.forEach((h: Hypothesis) => {
      lines.push(`| ${escapeTableCell(h.statement)} | ${statusBadge(h.status)} | ${h.supportingEvidenceIds.length} | ${h.contradictingEvidenceIds.length} |`);
    });
    lines.push('');
  }

  if (report.unverifiedClaims.length > 0) {
    lines.push('## Unverified Claims & Inferences');
    lines.push('');
    report.unverifiedClaims.forEach(claim => {
      lines.push(`- ⚠️ ${claim}`);
    });
    lines.push('');
  }

  if (report.proofReport) {
    const pr = report.proofReport;
    lines.push('## Proof Mode Verification');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| :--- | :--- |');
    lines.push(`| **Overall Status** | ${statusBadge(pr.overallStatus)} |`);
    lines.push(`| **Checks Passed** | \`${pr.checksPassedCount} / ${pr.checksAttemptedCount}\` |`);
    lines.push(`| **Failed Checks** | \`${pr.checksFailedCount}\` |`);
    lines.push(`| **Dynamic Executions** | \`${pr.dynamicExecutionsCount}\` |`);
    lines.push(`| **Static Analyses** | \`${pr.staticAnalysesCount}\` |`);
    lines.push(`| **Revision Hash** | \`${pr.revisionHash || 'uncommitted tree'}\` |`);
    lines.push('');

    if (pr.claims.length > 0) {
      lines.push('### Verified Proof Claims');
      lines.push('');
      for (const claim of pr.claims) {
        lines.push(`- **${claim.statement}** (${statusBadge(claim.status)})`);
        for (const chk of claim.checks) {
          const mark = chk.passed ? '✓' : '✗';
          const typeLabel = chk.isExecution ? 'Execution' : 'Static';
          const note = chk.error || chk.description || '';
          lines.push(`  - [${mark}] \`${chk.name}\` (${typeLabel}): ${escapeTableCell(note)}`);
        }
      }
      lines.push('');
    }

    if (pr.suggestedNextSteps.length > 0) {
      lines.push('### Suggested Verification Next Steps');
      lines.push('');
      pr.suggestedNextSteps.forEach(step => lines.push(`1. ${step}`));
      lines.push('');
    }
  }

  if (report.evidence.length > 0) {
    lines.push(`## Evidence Ledger (${report.evidence.length} Records)`);
    lines.push('');
    for (const ev of report.evidence) {
      lines.push(`### \`[${ev.type}]\` ${ev.source} (${ev.verificationStatus})`);
      lines.push(`- **Tool Name**: \`${ev.toolName}\``);
      lines.push(`- **Timestamp**: \`${ev.timestamp instanceof Date ? ev.timestamp.toISOString() : String(ev.timestamp)}\``);
      if (ev.type === 'git_diff' && ev.content) {
        lines.push('');
        lines.push('```diff');
        lines.push(ev.content.slice(0, 3000));
        lines.push('```');
      } else if (ev.content) {
        lines.push('');
        lines.push('```text');
        lines.push(ev.content.slice(0, 1500));
        lines.push('```');
      }
      lines.push('');
    }
  }

  if (report.limitations.length > 0) {
    lines.push('## Disclosed Limitations & Boundary Conditions');
    lines.push('');
    report.limitations.forEach(lim => {
      lines.push(`- ℹ️ ${lim}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*Report synthesized and verified by ANVEXO Autonomous Intelligence Platform*');
  lines.push('');

  return lines.join('\n');
}
