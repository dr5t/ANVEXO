let currentJobId = null;
let pollTimer = null;
let activeTab = 'report';

document.addEventListener('DOMContentLoaded', () => {
  initResizer();
  initTabs();
  initEvents();
  loadInitialProject();
});

function initResizer() {
  const resizer = document.getElementById('paneResizer');
  const leftPane = document.getElementById('paneLeft');
  const container = document.getElementById('workbench');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerRect = container.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const minWidth = 280;
    const maxWidth = containerRect.width - 320;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      leftPane.style.width = `${newWidth}px`;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });
}

function initEvents() {
  const runBtn = document.getElementById('runBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const objectiveInput = document.getElementById('objectiveInput');
  const pathInput = document.getElementById('pathInput');
  const copyReportBtn = document.getElementById('copyReportBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');

  runBtn.addEventListener('click', triggerInvestigation);
  cancelBtn.addEventListener('click', cancelActiveJob);

  objectiveInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerInvestigation();
    }
  });

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadProjectInfo(pathInput.value.trim());
    }
  });

  copyReportBtn.addEventListener('click', () => {
    const text = document.getElementById('reportText').innerText;
    if (text) {
      navigator.clipboard.writeText(text);
      copyReportBtn.innerText = 'Copied';
      setTimeout(() => { copyReportBtn.innerText = 'Copy Report'; }, 2000);
    }
  });

  exportJsonBtn.addEventListener('click', () => {
    const raw = exportJsonBtn.getAttribute('data-raw');
    if (raw) {
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anvexo-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
}

async function loadInitialProject() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  await loadProjectInfo(currentPath);
}

async function loadProjectInfo(repoPath) {
  try {
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    });

    if (res.ok) {
      const metadata = await res.json();
      document.getElementById('pathInput').value = metadata.rootPath;
      document.getElementById('footerRepo').innerText = metadata.name;
      document.getElementById('footerStack').innerText = metadata.languages.join(', ') || 'Unknown stack';
      populateFileList(metadata);
    }
  } catch {}
}

function populateFileList(metadata) {
  const sidebar = document.getElementById('fileList');
  sidebar.innerHTML = '';

  const files = [...metadata.configFiles, ...metadata.entryPoints];
  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerText = file;
    item.addEventListener('click', () => {
      document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
      item.classList.add('active');
      viewFile(file);
    });
    sidebar.appendChild(item);
  });
}

async function viewFile(fileName) {
  const repoPath = document.getElementById('pathInput').value.trim();
  const editor = document.getElementById('codeEditor');
  editor.innerText = `Loading ${fileName}...`;
  switchTab('code');

  try {
    const res = await fetch(`/api/file?repo=${encodeURIComponent(repoPath)}&path=${encodeURIComponent(fileName)}`);
    if (res.ok) {
      const data = await res.json();
      editor.innerText = data.content;
    } else {
      const err = await res.json();
      editor.innerText = `Could not display ${fileName}: ${err.error}`;
    }
  } catch (err) {
    editor.innerText = `Failed to load ${fileName}: ${err.message}`;
  }
}

async function triggerInvestigation() {
  const pathInput = document.getElementById('pathInput');
  const objectiveInput = document.getElementById('objectiveInput');
  const runBtn = document.getElementById('runBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusDot = document.getElementById('statusDot');

  const repoPath = pathInput.value.trim();
  const objective = objectiveInput.value.trim() || 'General project investigation and health check';

  if (!repoPath) {
    alert('Please specify a repository path');
    return;
  }

  runBtn.disabled = true;
  cancelBtn.style.display = 'inline-flex';
  statusDot.className = 'status-dot running';
  statusBadge.querySelector('span:last-child').innerText = 'RUNNING';

  document.getElementById('timelineContainer').innerHTML = `
    <div class="empty-state">
      <div class="badge">Initializing Investigation Plan...</div>
    </div>
  `;

  try {
    const res = await fetch('/api/investigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: repoPath,
        objective,
        autoApprove: true,
        skipTests: false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      currentJobId = data.jobId;
      startPolling(currentJobId);
    } else {
      const err = await res.json();
      alert(`Investigation failed to start: ${err.error}`);
      resetRunState();
    }
  } catch (err) {
    alert(`Server connection failure: ${err.message}`);
    resetRunState();
  }
}

function startPolling(jobId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;

      const job = await res.json();

      if (job.report && job.report.plan) {
        renderPlanSteps(job.report.plan.steps);
      }

      if (job.status === 'completed') {
        clearInterval(pollTimer);
        pollTimer = null;
        onJobCompleted(job);
      } else if (job.status === 'failed') {
        clearInterval(pollTimer);
        pollTimer = null;
        onJobFailed(job);
      }
    } catch {}
  }, 1000);
}

function renderPlanSteps(steps) {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';

  steps.forEach(step => {
    const card = document.createElement('div');
    card.className = 'step-card';

    const badge = document.createElement('span');
    badge.className = `step-badge ${step.status}`;
    badge.innerText = step.status.toUpperCase();

    const content = document.createElement('div');
    content.className = 'step-content';

    const title = document.createElement('div');
    title.className = 'step-title';
    title.innerText = step.description;

    const tool = document.createElement('div');
    tool.className = 'step-tool';
    tool.innerText = `Tool: ${step.toolName}`;

    content.appendChild(title);
    content.appendChild(tool);
    card.appendChild(badge);
    card.appendChild(content);

    container.appendChild(card);
  });
}

function onJobCompleted(job) {
  resetRunState();
  const statusDot = document.getElementById('statusDot');
  const statusBadge = document.getElementById('statusBadge');
  statusDot.className = 'status-dot completed';
  statusBadge.querySelector('span:last-child').innerText = 'COMPLETED';

  if (job.report) {
    renderReport(job.report);
    renderTerminalLogs(job.report);
    renderGitView(job.report);
  }
}

function onJobFailed(job) {
  resetRunState();
  const statusDot = document.getElementById('statusDot');
  const statusBadge = document.getElementById('statusBadge');
  statusDot.className = 'status-dot failed';
  statusBadge.querySelector('span:last-child').innerText = 'FAILED';

  const container = document.getElementById('reportContainer');
  container.innerHTML = `
    <div class="report-card">
      <div class="report-card-title" style="color: var(--status-fail);">Investigation Failed</div>
      <div style="font-family: var(--font-mono); font-size: 12px;">${job.error || 'Unknown execution error'}</div>
    </div>
  `;
}

function resetRunState() {
  document.getElementById('runBtn').disabled = false;
  document.getElementById('cancelBtn').style.display = 'none';
}

async function cancelActiveJob() {
  if (!currentJobId) return;
  try {
    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    resetRunState();
    const statusDot = document.getElementById('statusDot');
    const statusBadge = document.getElementById('statusBadge');
    statusDot.className = 'status-dot failed';
    statusBadge.querySelector('span:last-child').innerText = 'CANCELLED';
  } catch {}
}

function renderReport(report) {
  const container = document.getElementById('reportContainer');
  container.innerHTML = '';

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  exportJsonBtn.setAttribute('data-raw', JSON.stringify(report, null, 2));

  const summaryCard = document.createElement('div');
  summaryCard.className = 'report-card';
  summaryCard.innerHTML = `
    <div class="report-card-title">Investigation Summary</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: var(--font-mono); font-size: 11px;">
      <div>Objective: <span style="color: var(--text-primary);">${report.objective}</span></div>
      <div>Duration: <span style="color: var(--text-primary);">${new Date(report.completedAt) - new Date(report.startedAt)}ms</span></div>
      <div>Repository: <span style="color: var(--text-primary);">${report.projectMetadata.rootPath}</span></div>
      <div>Evidence Records: <span style="color: var(--text-primary);">${report.evidence.length}</span></div>
    </div>
  `;
  container.appendChild(summaryCard);

  if (report.findings && report.findings.length > 0) {
    const findingsCard = document.createElement('div');
    findingsCard.className = 'report-card';
    findingsCard.innerHTML = `<div class="report-card-title">Verified Findings (${report.findings.length})</div>`;

    report.findings.forEach(finding => {
      const item = document.createElement('div');
      const statusClass = finding.verificationStatus === 'verified' ? 'pass' : (finding.verificationStatus === 'contradicted' ? 'fail' : 'pending');
      item.className = `finding-item ${statusClass}`;
      item.innerHTML = `
        <div class="finding-claim">${finding.claim}</div>
        <div class="finding-details">Status: [${finding.verificationStatus.toUpperCase()}] | Confidence: ${(finding.confidence * 100).toFixed(0)}%</div>
        <div class="finding-details">${finding.details || ''}</div>
      `;
      findingsCard.appendChild(item);
    });

    container.appendChild(findingsCard);
  }

  if (report.limitations && report.limitations.length > 0) {
    const limitCard = document.createElement('div');
    limitCard.className = 'report-card';
    limitCard.innerHTML = `<div class="report-card-title">Limitations & Boundaries</div>`;
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '18px';
    ul.style.fontSize = '12px';
    report.limitations.forEach(l => {
      const li = document.createElement('li');
      li.innerText = l;
      ul.appendChild(li);
    });
    limitCard.appendChild(ul);
    container.appendChild(limitCard);
  }

  const rawCard = document.createElement('div');
  rawCard.className = 'report-card';
  rawCard.innerHTML = `
    <div class="report-card-title">Formatted Report Text</div>
    <div id="reportText" style="font-family: var(--font-mono); font-size: 11px; white-space: pre-wrap; line-height: 1.5; background: #0A0A0B; padding: 10px; border-radius: 2px;">${formatReportSimple(report)}</div>
  `;
  container.appendChild(rawCard);

  switchTab('report');
}

function formatReportSimple(report) {
  const lines = [];
  lines.push('========================================================================');
  lines.push('ANVEXO INVESTIGATION REPORT');
  lines.push('========================================================================');
  lines.push(`Objective: ${report.objective}`);
  lines.push(`Project:   ${report.projectMetadata.name} (${report.projectMetadata.rootPath})`);
  lines.push(`Duration:  ${new Date(report.completedAt) - new Date(report.startedAt)}ms`);
  lines.push('');
  lines.push('FINDINGS:');
  report.findings.forEach((f, idx) => {
    lines.push(`  ${idx + 1}. [${f.verificationStatus.toUpperCase()}] ${f.claim}`);
    if (f.details) lines.push(`     ${f.details}`);
  });
  lines.push('');
  lines.push('LIMITATIONS:');
  report.limitations.forEach(l => lines.push(`  - ${l}`));
  lines.push('========================================================================');
  return lines.join('\n');
}

function renderTerminalLogs(report) {
  const terminal = document.getElementById('terminalView');
  const lines = [];
  lines.push(`[SYSTEM] Starting ANVEXO Engine v0.1.0 at ${report.startedAt}`);
  lines.push(`[DISCOVERY] Topography: ${report.projectMetadata.name} [${report.projectMetadata.languages.join(', ')}]`);

  report.plan.steps.forEach(step => {
    lines.push(`[STEP] [${step.status.toUpperCase()}] ${step.description} via ${step.toolName}`);
    if (step.error) {
      lines.push(`  [ERROR] ${step.error}`);
    }
  });

  report.evidence.forEach(ev => {
    lines.push(`[EVIDENCE] [${ev.type}] [${ev.verificationStatus}] from ${ev.source}`);
  });

  lines.push(`[SYSTEM] Completed at ${report.completedAt}`);
  terminal.innerText = lines.join('\n');
}

function renderGitView(report) {
  const container = document.getElementById('gitView');
  const gitEvidence = report.evidence.filter(e => e.type.startsWith('git_'));

  if (gitEvidence.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="badge">No Git evidence collected</div></div>`;
    return;
  }

  container.innerHTML = '';
  gitEvidence.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.innerHTML = `
      <div class="report-card-title">${ev.source} (${ev.type})</div>
      <div style="font-family: var(--font-mono); font-size: 11px; white-space: pre-wrap; background: #0A0A0B; padding: 10px; border-radius: 2px;">${ev.content}</div>
    `;
    container.appendChild(card);
  });
}
