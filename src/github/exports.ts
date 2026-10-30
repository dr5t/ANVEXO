import type { GitHubInvestigationReport } from './types.js';

export function exportReportAsMarkdown(report: GitHubInvestigationReport): string {
  const lines: string[] = [];

  lines.push(`# ANVEXO GitHub Repository Intelligence Report`);
  lines.push('');
  if (report.isMock) {
    lines.push(`> ⚠️ **MOCK MODE SIMULATION**: This report was generated using deterministic simulated repository data for testing and demonstration.`);
    lines.push('');
  }
  lines.push(`- **Repository**: [${report.metadata.fullName}](${report.metadata.htmlUrl})`);
  lines.push(`- **Report ID**: \`${report.id}\``);
  lines.push(`- **Started At**: \`${report.startedAt}\``);
  lines.push(`- **Completed At**: \`${report.completedAt}\` (${(report.durationMs / 1000).toFixed(1)}s)`);
  lines.push(`- **Overall Verdict**: **\`${report.finalConclusion.overallStatus.toUpperCase()}\`**`);
  lines.push('');

  lines.push('---');
  lines.push('## 1. Executive Summary');
  lines.push(report.executiveSummary);
  lines.push('');

  lines.push('---');
  lines.push('## 2. Repository Overview');
  lines.push(`| Attribute | Value |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **Owner / Name** | \`${report.metadata.fullName}\` |`);
  lines.push(`| **Description** | ${report.metadata.description || 'No description provided'} |`);
  lines.push(`| **Primary Language** | ${report.metadata.primaryLanguage || 'Unknown'} |`);
  lines.push(`| **Default Branch** | \`${report.metadata.defaultBranch}\` |`);
  lines.push(`| **Stars / Forks** | ⭐ ${report.metadata.starsCount.toLocaleString()} / 🍴 ${report.metadata.forksCount.toLocaleString()} |`);
  lines.push(`| **Open Issues** | ⚠️ ${report.metadata.openIssuesCount} |`);
  lines.push(`| **License** | ${report.metadata.license ? `\`${report.metadata.license.spdxId || report.metadata.license.name}\`` : 'None detected'} |`);
  lines.push(`| **Created Date** | \`${report.metadata.createdAt}\` |`);
  lines.push(`| **Last Push** | \`${report.metadata.pushedAt}\` |`);
  lines.push('');

  lines.push('---');
  lines.push('## 3. Development Timeline & Milestones');
  if (report.developmentTimeline.length === 0) {
    lines.push('No milestones detected in analyzed range.');
  } else {
    lines.push('| Date | Milestone | Type | Reference |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const m of report.developmentTimeline) {
      const ref = m.commitSha ? `\`${m.commitSha}\`` : m.referenceUrl ? `[Link](${m.referenceUrl})` : '-';
      lines.push(`| \`${m.date.split('T')[0]}\` | **${m.title}**<br/>${m.description} | \`${m.type}\` | ${ref} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('## 4. Contributor Intelligence');
  lines.push(`Identified **${report.contributors.length}** distinct contributor(s) across analyzed commits.`);
  lines.push('');
  for (const c of report.contributors) {
    lines.push(`### ${c.displayName} (${c.githubUsername ? `@${c.githubUsername}` : c.email || 'Author'})`);
    lines.push(`- **Commit Count**: ${c.commitCount} commits`);
    lines.push(`- **Active Range**: \`${c.firstCommitDate.split('T')[0]}\` to \`${c.lastCommitDate.split('T')[0]}\``);
    lines.push(`- **Technical Areas**: ${c.technicalAreas.join(', ')}`);
    lines.push(`- **Top Files Modified**: ${c.topFiles.map(f => `\`${f}\``).join(', ')}`);
    lines.push(`- *Attribution Note*: ${c.attributionNote}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('## 5. Architecture Overview');
  lines.push(report.architectureOverview.summary);
  lines.push('');
  lines.push(`- **Primary Stack**: ${report.architectureOverview.primaryStack}`);
  lines.push(`- **Entry Points**: ${report.architectureOverview.entryPoints.map(e => `\`${e}\``).join(', ')}`);
  lines.push('');
  lines.push('### Directory Topology:');
  for (const d of report.architectureOverview.directories) {
    lines.push(`- \`${d.path}\`: ${d.purpose}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('## 6. Major Features Identified');
  for (const f of report.majorFeatures) {
    lines.push(`- ✅ ${f}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('## 7. Security Findings & Risk Audit');
  if (report.securityFindings.length === 0) {
    lines.push('✅ No critical or high security anti-patterns detected in the analyzed scope.');
  } else {
    lines.push('| Severity | Finding | Category | Affected File | Recommendation |');
    lines.push('| :---: | :--- | :--- | :--- | :--- |');
    for (const sf of report.securityFindings) {
      const sevBadge = sf.severity === 'critical' ? '🔴 **CRITICAL**' : sf.severity === 'high' ? '🟠 **HIGH**' : sf.severity === 'medium' ? '🟡 MEDIUM' : '🔵 INFO';
      lines.push(`| ${sevBadge} | **${sf.title}**<br/>${sf.description} | \`${sf.category}\` | \`${sf.file || '-'}\` | ${sf.recommendation} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('## 8. Test & Verification Health');
  lines.push(`- **Runner**: \`${report.testExecution.runner || 'None detected'}\``);
  lines.push(`- **Status**: **\`${report.testExecution.status.toUpperCase()}\`**`);
  lines.push(`- **Passed**: \`${report.testExecution.passedCount} / ${report.testExecution.totalCount}\``);
  lines.push(`- **Failed**: \`${report.testExecution.failedCount}\``);
  lines.push(`- **Notes**: ${report.testExecution.notes}`);
  if (report.testExecution.failedTestDetails.length > 0) {
    lines.push('');
    lines.push('### Failing Test Cases:');
    for (const ft of report.testExecution.failedTestDetails) {
      lines.push(`- ❌ **${ft.name}** (\`${ft.file || 'unknown'}\`)`);
      if (ft.error) lines.push(`  \`${ft.error}\``);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('## 9. Final Conclusion & 10 Core Answers');
  lines.push(`> **Overall Status**: **\`${report.finalConclusion.overallStatus}\`**  `);
  lines.push(`> **Readiness Verdict**: ${report.finalConclusion.readinessVerdict}`);
  lines.push('');
  const a = report.finalConclusion.answers;
  lines.push(`1. **What does the project do?** ${a.whatProjectDoes}`);
  lines.push(`2. **How is it structured?** ${a.howStructured}`);
  lines.push(`3. **What development history is visible?** ${a.developmentHistoryVisible}`);
  lines.push(`4. **Which contributors changed which parts?** ${a.contributorsAndComponents}`);
  lines.push(`5. **What is working?** ${a.whatIsWorking}`);
  lines.push(`6. **What is failing?** ${a.whatIsFailing}`);
  lines.push(`7. **Which issues have been verified?** ${a.verifiedIssues.length > 0 ? a.verifiedIssues.join('; ') : 'None'}`);
  lines.push(`8. **What needs further investigation?** ${a.needsFurtherInvestigation.join('; ')}`);
  lines.push(`9. **Is the project ready for its stated intended use?** ${a.isReadyForIntendedUse}`);
  lines.push(`10. **What should be fixed first?** ${a.whatToFixFirst.join('; ')}`);
  lines.push('');

  lines.push('---');
  lines.push('## 10. Prioritized Remediation Plan');
  for (const step of report.finalConclusion.prioritizedRemediationPlan) {
    lines.push(`- [${step.priority}] **${step.action}** ${step.targetComponent ? `(\`${step.targetComponent}\`)` : ''}`);
    lines.push(`  *Rationale*: ${step.rationale}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('*Synthesized by ANVEXO Autonomous Repository Intelligence Platform*');
  lines.push('');

  return lines.join('\n');
}

export function exportReportAsJson(report: GitHubInvestigationReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportReportAsHtml(report: GitHubInvestigationReport): string {
  const md = exportReportAsMarkdown(report);
  const title = `ANVEXO Report - ${report.metadata.fullName}`;
  const statusColor = report.finalConclusion.overallStatus.includes('Healthy')
    ? '#46E3B7'
    : report.finalConclusion.overallStatus.includes('Needs')
    ? '#FFD166'
    : '#FF5E5B';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0B0E14;
      --card-bg: #151922;
      --border: #232936;
      --text: #EDEDED;
      --text-muted: #8B949E;
      --accent: #E54D2E;
      --green: #46E3B7;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 40px 20px;
      margin: 0;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #0B0E14;
      background: ${statusColor};
      margin-top: 8px;
    }
    .mock-banner {
      background: rgba(255, 209, 102, 0.15);
      border: 1px solid #FFD166;
      color: #FFD166;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 600;
    }
    pre {
      background: #0B0E14;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #CAD2DE;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: #0E121B;
      color: var(--text-muted);
    }
    a { color: #58A6FF; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0 0 8px 0; color:#fff;">ANVEXO Repository Intelligence Report</h1>
      <div style="color:var(--text-muted);">Repository: <a href="${report.metadata.htmlUrl}" target="_blank">${report.metadata.fullName}</a></div>
      <div class="badge">${report.finalConclusion.overallStatus.toUpperCase()}</div>
    </div>
    ${report.isMock ? '<div class="mock-banner">⚠️ MOCK MODE SIMULATION: This report was generated using deterministic simulated repository data.</div>' : ''}
    <pre>${escapeHtml(md)}</pre>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const exportReportToMarkdown = exportReportAsMarkdown;
export const exportReportToJson = exportReportAsJson;
export const exportReportToHtml = exportReportAsHtml;
