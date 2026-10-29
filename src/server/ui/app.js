const DEFAULT_SETTINGS = {
  theme: 'obsidian-slate',
  fontFamily: 'JetBrains Mono',
  fontSize: 12.5,
  lineHeight: 1.55,
  fontWeight: '400',
  tabSize: '2',
  wordWrap: true,
  lineNumbers: true,
  showSidebar: true,
  showBottomDrawer: true,
  sidebarWidth: 340,
  defaultPath: '.',
};

const FONT_MAP = {
  'JetBrains Mono': '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  'IBM Plex Mono': '"IBM Plex Mono", Menlo, Consolas, monospace',
  'Fira Code': '"Fira Code", Menlo, Consolas, monospace',
  'Inter': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'System Monospace': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

const VALID_THEMES = [
  'obsidian-slate',
  'midnight-graphite',
  'nord',
  'solarized-dark',
  'light-studio',
  'high-contrast',
];

const STORAGE_KEY = 'anvexo_ide_settings_v1';

let currentSettings = { ...DEFAULT_SETTINGS };
let currentJobId = null;
let pollTimer = null;
let activeTab = 'report';
let activeDrawerTab = 'telemetry';
let activeActivityView = 'investigation';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const validated = { ...DEFAULT_SETTINGS };

    if (VALID_THEMES.includes(parsed.theme)) {
      validated.theme = parsed.theme;
    }
    if (Object.prototype.hasOwnProperty.call(FONT_MAP, parsed.fontFamily)) {
      validated.fontFamily = parsed.fontFamily;
    }
    if (typeof parsed.fontSize === 'number' && parsed.fontSize >= 11 && parsed.fontSize <= 18) {
      validated.fontSize = parsed.fontSize;
    }
    if (typeof parsed.lineHeight === 'number' && parsed.lineHeight >= 1.2 && parsed.lineHeight <= 2.0) {
      validated.lineHeight = parsed.lineHeight;
    }
    if (['400', '500', '600'].includes(String(parsed.fontWeight))) {
      validated.fontWeight = String(parsed.fontWeight);
    }
    if (['2', '4', '8'].includes(String(parsed.tabSize))) {
      validated.tabSize = String(parsed.tabSize);
    }
    if (typeof parsed.wordWrap === 'boolean') {
      validated.wordWrap = parsed.wordWrap;
    }
    if (typeof parsed.lineNumbers === 'boolean') {
      validated.lineNumbers = parsed.lineNumbers;
    }
    if (typeof parsed.showSidebar === 'boolean') {
      validated.showSidebar = parsed.showSidebar;
    }
    if (typeof parsed.showBottomDrawer === 'boolean') {
      validated.showBottomDrawer = parsed.showBottomDrawer;
    }
    if (typeof parsed.sidebarWidth === 'number' && parsed.sidebarWidth >= 240 && parsed.sidebarWidth <= 650) {
      validated.sidebarWidth = parsed.sidebarWidth;
    }
    if (typeof parsed.defaultPath === 'string' && parsed.defaultPath.trim().length > 0) {
      validated.defaultPath = parsed.defaultPath.trim();
    }
    return validated;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveCurrentSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {}
}

function applySettings(settings) {
  document.documentElement.setAttribute('data-theme', settings.theme);

  const fontCss = FONT_MAP[settings.fontFamily] || FONT_MAP['JetBrains Mono'];
  document.documentElement.style.setProperty('--editor-font', fontCss);
  document.documentElement.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
  document.documentElement.style.setProperty('--editor-line-height', String(settings.lineHeight));
  document.documentElement.style.setProperty('--editor-font-weight', settings.fontWeight);
  document.documentElement.style.setProperty('--editor-tab-size', settings.tabSize);

  const lineNumbers = document.getElementById('codeLineNumbers');
  if (lineNumbers) {
    lineNumbers.classList.toggle('hidden', !settings.lineNumbers);
  }

  const codeEditor = document.getElementById('codeEditor');
  if (codeEditor) {
    codeEditor.classList.toggle('wrap-enabled', settings.wordWrap);
  }

  const leftPane = document.getElementById('paneLeft');
  if (leftPane) {
    leftPane.classList.toggle('collapsed', !settings.showSidebar);
    if (settings.showSidebar && settings.sidebarWidth) {
      leftPane.style.width = `${settings.sidebarWidth}px`;
    }
  }

  const bottomDrawer = document.getElementById('bottomDrawer');
  if (bottomDrawer) {
    bottomDrawer.classList.toggle('hidden', !settings.showBottomDrawer);
  }

  const footerTheme = document.getElementById('footerTheme');
  if (footerTheme) {
    footerTheme.innerText = settings.theme.replace(/-/g, ' ').toUpperCase();
  }

  const footerFont = document.getElementById('footerFont');
  if (footerFont) {
    footerFont.innerText = settings.fontFamily.toUpperCase();
  }

  syncModalControls(settings);
}

function syncModalControls(settings) {
  document.querySelectorAll('.theme-card').forEach(card => {
    const choice = card.getAttribute('data-theme-choice');
    card.classList.toggle('active', choice === settings.theme);
  });

  const fontSelect = document.getElementById('fontFamilySelect');
  if (fontSelect) fontSelect.value = settings.fontFamily;

  const fontSlider = document.getElementById('fontSizeSlider');
  const fontBadge = document.getElementById('fontSizeValue');
  if (fontSlider) fontSlider.value = settings.fontSize;
  if (fontBadge) fontBadge.innerText = `${settings.fontSize}px`;

  const lhSlider = document.getElementById('lineHeightSlider');
  const lhBadge = document.getElementById('lineHeightValue');
  if (lhSlider) lhSlider.value = settings.lineHeight;
  if (lhBadge) lhBadge.innerText = String(settings.lineHeight);

  const weightSelect = document.getElementById('fontWeightSelect');
  if (weightSelect) weightSelect.value = settings.fontWeight;

  const tabSelect = document.getElementById('tabSizeSelect');
  if (tabSelect) tabSelect.value = settings.tabSize;

  const wrapToggle = document.getElementById('wordWrapToggle');
  if (wrapToggle) wrapToggle.checked = settings.wordWrap;

  const numToggle = document.getElementById('lineNumbersToggle');
  if (numToggle) numToggle.checked = settings.lineNumbers;

  const sideToggle = document.getElementById('sidebarToggle');
  if (sideToggle) sideToggle.checked = settings.showSidebar;

  const drawToggle = document.getElementById('drawerToggle');
  if (drawToggle) drawToggle.checked = settings.showBottomDrawer;

  const defaultPathInput = document.getElementById('defaultPathInput');
  if (defaultPathInput) defaultPathInput.value = settings.defaultPath;

  const previewBox = document.getElementById('settingsPreviewBox');
  if (previewBox) {
    previewBox.style.fontFamily = FONT_MAP[settings.fontFamily] || FONT_MAP['JetBrains Mono'];
    previewBox.style.fontSize = `${settings.fontSize}px`;
    previewBox.style.lineHeight = String(settings.lineHeight);
    previewBox.style.fontWeight = settings.fontWeight;
    previewBox.style.tabSize = settings.tabSize;
    previewBox.style.whiteSpace = settings.wordWrap ? 'pre-wrap' : 'pre';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  currentSettings = loadStoredSettings();
  applySettings(currentSettings);

  const pathInput = document.getElementById('pathInput');
  if (pathInput && currentSettings.defaultPath && currentSettings.defaultPath !== '.') {
    pathInput.value = currentSettings.defaultPath;
  }

  initResizer();
  initActivityBar();
  initTabs();
  initDrawer();
  initCommandPresets();
  initEvents();
  initSettingsModal();
  loadInitialProject();
});

function initResizer() {
  const resizer = document.getElementById('paneResizer');
  const leftPane = document.getElementById('paneLeft');
  const container = document.getElementById('workbench');
  let isResizing = false;

  resizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerRect = container.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const minWidth = 260;
    const maxWidth = containerRect.width - 320;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      leftPane.style.width = `${newWidth}px`;
      currentSettings.sidebarWidth = Math.round(newWidth);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveCurrentSettings();
    }
  });
}

function initActivityBar() {
  const buttons = document.querySelectorAll('.activity-btn[data-view]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchActivityView(view);
    });
  });

  const toggleBottom = document.querySelector('.activity-btn[data-action="toggleBottom"]');
  if (toggleBottom) {
    toggleBottom.addEventListener('click', () => {
      const drawer = document.getElementById('bottomDrawer');
      drawer.classList.toggle('collapsed');
    });
  }

  const openSettingsBtn = document.querySelector('.activity-btn[data-action="openSettings"]');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      openSettingsModal();
    });
  }
}

function switchActivityView(viewId) {
  activeActivityView = viewId;
  document.querySelectorAll('.activity-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  document.querySelectorAll('.sidebar-subview').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`sideView${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  if (viewId === 'permissions') {
    fetchPermissionAudit();
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.pane-right .tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });
}

function initDrawer() {
  const drawerTabs = document.querySelectorAll('.drawer-tab-btn');
  drawerTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-dtab');
      activeDrawerTab = target;
      drawerTabs.forEach(b => b.classList.toggle('active', b.getAttribute('data-dtab') === target));
      document.querySelectorAll('.drawer-content').forEach(c => {
        c.classList.toggle('active', c.id === `dtab-${target}`);
      });
      if (target === 'audit') {
        fetchPermissionAudit();
      }
    });
  });

  const closeBtn = document.getElementById('closeDrawerBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('bottomDrawer').classList.toggle('collapsed');
    });
  }
}

function initCommandPresets() {
  const presetButtons = document.querySelectorAll('.cmd-preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      executeCommandPreset(cmd);
    });
  });
}

async function executeCommandPreset(cmd) {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';

  appendTelemetryLog(`[COMMAND] Executing preset: $ ${cmd}`);

  if (cmd === 'scan') {
    await loadProjectInfo(currentPath);
    switchActivityView('explorer');
  } else if (cmd === 'status' || cmd === 'diff') {
    switchTab('diffs');
    fetchGitDiff(currentPath);
  } else if (cmd === 'trace') {
    switchTab('trace');
  } else if (cmd === 'report') {
    switchTab('report');

  } else if (cmd === 'test') {
    document.getElementById('objectiveInput').value = 'Run automated test suite and verify security boundaries';
    triggerInvestigation();
  } else if (cmd === 'rebuild') {
    try {
      const res = await fetch('/api/context/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath }),
      });
      if (res.ok) {
        const data = await res.json();
        appendTelemetryLog(`[CONTEXT] Rebuilt ECHO index: ${Object.keys(data.dependencies || {}).length} dependencies tracked`);
        alert(`ECHO index rebuilt successfully for ${currentPath}`);
      }
    } catch (err) {
      appendTelemetryLog(`[ERROR] Rebuild failed: ${err.message}`);
    }
  }
}

async function fetchGitDiff(repoPath) {
  const container = document.getElementById('diffContentContainer');
  try {
    const res = await fetch(`/api/git/diff?repo=${encodeURIComponent(repoPath)}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.diff || data.diff.trim().length === 0) {
        container.innerHTML = '<div class="empty-state">Working tree clean. Zero diff modifications detected.</div>';
        document.getElementById('diffStatsBadge').innerText = 'CLEAN';
      } else {
        container.innerHTML = '';
        document.getElementById('diffStatsBadge').innerText = 'DIFF DETECTED';
        const card = document.createElement('div');
        card.className = 'diff-card';
        const body = document.createElement('div');
        body.style.padding = '8px';
        body.style.background = 'var(--bg-editor)';
        data.diff.split('\n').forEach(l => {
          const lineDiv = document.createElement('div');
          if (l.startsWith('+') && !l.startsWith('+++')) {
            lineDiv.className = 'diff-line add';
          } else if (l.startsWith('-') && !l.startsWith('---')) {
            lineDiv.className = 'diff-line del';
          } else {
            lineDiv.className = 'diff-line ctx';
          }
          lineDiv.innerText = l;
          body.appendChild(lineDiv);
        });
        card.appendChild(body);
        container.appendChild(card);
      }
    }
  } catch (err) {
    appendTelemetryLog(`[ERROR] Diff fetch failed: ${err.message}`);
  }
}

function initEvents() {
  const runBtn = document.getElementById('runBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const objectiveInput = document.getElementById('objectiveInput');
  const pathInput = document.getElementById('pathInput');
  const scanPathBtn = document.getElementById('scanPathBtn');
  const brandHome = document.getElementById('brandHome');
  const copyReportBtn = document.getElementById('copyReportBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  runBtn.addEventListener('click', triggerInvestigation);
  cancelBtn.addEventListener('click', cancelActiveJob);

  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }

  if (scanPathBtn) {
    scanPathBtn.addEventListener('click', () => {
      loadProjectInfo(pathInput.value.trim());
    });
  }

  if (brandHome) {
    brandHome.addEventListener('click', () => {
      switchActivityView('investigation');
      switchTab('report');
    });
  }

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

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      toggleSettingsModal();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      currentSettings.showSidebar = !currentSettings.showSidebar;
      saveCurrentSettings();
      applySettings(currentSettings);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      currentSettings.showBottomDrawer = !currentSettings.showBottomDrawer;
      saveCurrentSettings();
      applySettings(currentSettings);
      return;
    }
    if (e.key === 'Escape') {
      const modal = document.getElementById('settingsModalOverlay');
      if (modal && modal.classList.contains('open')) {
        closeSettingsModal();
        return;
      }
      const drawer = document.getElementById('bottomDrawer');
      if (drawer && !drawer.classList.contains('collapsed')) {
        drawer.classList.add('collapsed');
      }
    }
  });

  copyReportBtn.addEventListener('click', () => {
    const reportText = document.getElementById('reportText');
    if (reportText && reportText.innerText) {
      navigator.clipboard.writeText(reportText.innerText);
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

  if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', () => {
      document.getElementById('terminalView').innerText = 'Console cleared.';
    });
  }
}

function initSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  const closeBtn = document.getElementById('settingsCloseBtn');
  const searchInput = document.getElementById('settingsSearchInput');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettingsModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSettingsModal();
      }
    });
  }

  const navBtns = document.querySelectorAll('.settings-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      navBtns.forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.settings-category').forEach(panel => {
        panel.classList.toggle('active', panel.id === `cat-${cat}`);
      });
    });
  });

  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const theme = card.getAttribute('data-theme-choice');
      if (theme) {
        currentSettings.theme = theme;
        saveCurrentSettings();
        applySettings(currentSettings);
        appendTelemetryLog(`[SETTINGS] Switched theme to: ${theme}`);
      }
    });
  });

  const fontSelect = document.getElementById('fontFamilySelect');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      currentSettings.fontFamily = fontSelect.value;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const fontSlider = document.getElementById('fontSizeSlider');
  if (fontSlider) {
    fontSlider.addEventListener('input', () => {
      currentSettings.fontSize = parseFloat(fontSlider.value);
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const lhSlider = document.getElementById('lineHeightSlider');
  if (lhSlider) {
    lhSlider.addEventListener('input', () => {
      currentSettings.lineHeight = parseFloat(lhSlider.value);
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const weightSelect = document.getElementById('fontWeightSelect');
  if (weightSelect) {
    weightSelect.addEventListener('change', () => {
      currentSettings.fontWeight = weightSelect.value;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const tabSelect = document.getElementById('tabSizeSelect');
  if (tabSelect) {
    tabSelect.addEventListener('change', () => {
      currentSettings.tabSize = tabSelect.value;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const wrapToggle = document.getElementById('wordWrapToggle');
  if (wrapToggle) {
    wrapToggle.addEventListener('change', () => {
      currentSettings.wordWrap = wrapToggle.checked;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const numToggle = document.getElementById('lineNumbersToggle');
  if (numToggle) {
    numToggle.addEventListener('change', () => {
      currentSettings.lineNumbers = numToggle.checked;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const sideToggle = document.getElementById('sidebarToggle');
  if (sideToggle) {
    sideToggle.addEventListener('change', () => {
      currentSettings.showSidebar = sideToggle.checked;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const drawToggle = document.getElementById('drawerToggle');
  if (drawToggle) {
    drawToggle.addEventListener('change', () => {
      currentSettings.showBottomDrawer = drawToggle.checked;
      saveCurrentSettings();
      applySettings(currentSettings);
    });
  }

  const resetLayoutBtn = document.getElementById('resetLayoutBtn');
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener('click', () => {
      currentSettings.sidebarWidth = 340;
      currentSettings.showSidebar = true;
      currentSettings.showBottomDrawer = true;
      saveCurrentSettings();
      applySettings(currentSettings);
      appendTelemetryLog('[SETTINGS] Reset workspace layout to defaults');
    });
  }

  const defaultPathInput = document.getElementById('defaultPathInput');
  if (defaultPathInput) {
    defaultPathInput.addEventListener('change', () => {
      currentSettings.defaultPath = defaultPathInput.value.trim() || '.';
      saveCurrentSettings();
    });
  }

  const restoreDefaultsBtn = document.getElementById('restoreDefaultsBtn');
  if (restoreDefaultsBtn) {
    restoreDefaultsBtn.addEventListener('click', () => {
      if (confirm('Restore all ANVEXO settings to factory defaults?')) {
        currentSettings = { ...DEFAULT_SETTINGS };
        saveCurrentSettings();
        applySettings(currentSettings);
        appendTelemetryLog('[SETTINGS] Restored all settings to factory defaults');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('.settings-category').forEach(cat => {
        const scope = (cat.getAttribute('data-search-scope') || '') + ' ' + cat.innerText.toLowerCase();
        if (!q || scope.includes(q)) {
          cat.style.display = '';
        } else {
          cat.style.display = 'none';
        }
      });
    });
  }
}

function openSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (overlay) {
    syncModalControls(currentSettings);
    overlay.classList.add('open');
  }
}

function closeSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

function toggleSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (overlay) {
    if (overlay.classList.contains('open')) {
      closeSettingsModal();
    } else {
      openSettingsModal();
    }
  }
}

async function loadInitialProject() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  await loadProjectInfo(currentPath);
}

async function loadProjectInfo(repoPath) {
  appendTelemetryLog(`[DISCOVERY] Discovering project at: ${repoPath}`);
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
      document.getElementById('branchChip').innerText = metadata.hasGit ? 'git: active' : 'git: none';
      populateFileTree(metadata);
      appendTelemetryLog(`[DISCOVERY] Detected: languages=[${metadata.languages.join(', ')}] test=${metadata.testRunner || 'none'}`);
    }
  } catch (err) {
    appendTelemetryLog(`[ERROR] Discovery failed: ${err.message}`);
  }
}

function populateFileTree(metadata) {
  const container = document.getElementById('fileTreeContainer');
  container.innerHTML = '';

  const allFiles = [...new Set([...metadata.configFiles, ...metadata.entryPoints])];
  document.getElementById('fileCountBadge').innerText = `${allFiles.length} FILES`;

  allFiles.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span style="color: var(--status-info);">[file]</span> ${escapeHtml(file)}`;
    item.addEventListener('click', () => {
      document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
      item.classList.add('active');
      viewFile(file);
    });
    container.appendChild(item);
  });
}

async function viewFile(fileName) {
  const repoPath = document.getElementById('pathInput').value.trim();
  const editor = document.getElementById('codeEditor');
  const lineNumbers = document.getElementById('codeLineNumbers');
  const pathTitle = document.getElementById('activeFilePath');
  const sizeBadge = document.getElementById('activeFileSize');

  pathTitle.innerText = fileName;
  editor.innerText = `Loading canonical contents of ${fileName}...`;
  switchTab('code');

  try {
    const res = await fetch(`/api/file?repo=${encodeURIComponent(repoPath)}&path=${encodeURIComponent(fileName)}`);
    if (res.ok) {
      const data = await res.json();
      editor.innerText = data.content;
      sizeBadge.innerText = `${data.size} BYTES`;

      const lineCount = data.content.split('\n').length;
      const numArr = [];
      for (let i = 1; i <= lineCount; i++) {
        numArr.push(i);
      }
      lineNumbers.innerText = numArr.join('\n');
      appendTelemetryLog(`[VIEWER] Loaded canonical file: ${fileName} (${data.size} bytes)`);
    } else {
      const err = await res.json();
      editor.innerText = `Could not display ${fileName}: ${err.error}`;
      lineNumbers.innerText = '1';
    }
  } catch (err) {
    editor.innerText = `Failed to load ${fileName}: ${err.message}`;
    lineNumbers.innerText = '1';
  }
}

async function triggerInvestigation() {
  const pathInput = document.getElementById('pathInput');
  const objectiveInput = document.getElementById('objectiveInput');
  const runBtn = document.getElementById('runBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  const repoPath = pathInput.value.trim();
  const objective = objectiveInput.value.trim() || 'General project investigation and health check';

  if (!repoPath) {
    alert('Please specify a repository path');
    return;
  }

  runBtn.disabled = true;
  cancelBtn.style.display = 'inline-flex';
  statusDot.className = 'status-dot running';
  statusText.innerText = 'RUNNING';

  document.getElementById('timelineContainer').innerHTML = `
    <div class="empty-state">
      <div class="badge">Initializing Investigation DAG Plan...</div>
    </div>
  `;

  appendTelemetryLog(`[INVESTIGATION] Triggered: "${objective}" on ${repoPath}`);

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
      appendTelemetryLog(`[JOB] Job ${currentJobId} created and scheduled`);
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
  document.getElementById('dagStepCounter').innerText = `${steps.length} STEPS`;

  steps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'step-card';

    const badge = document.createElement('span');
    badge.className = `step-badge ${step.status}`;
    badge.innerText = step.status.toUpperCase();

    const content = document.createElement('div');
    content.className = 'step-content';

    const title = document.createElement('div');
    title.className = 'step-title';
    title.innerText = `${idx + 1}. ${step.description}`;

    const tool = document.createElement('div');
    tool.className = 'step-tool';
    tool.innerText = `Tool: ${step.toolName} | Scope: ${step.requiredScope}`;

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
  const statusText = document.getElementById('statusText');
  statusDot.className = 'status-dot completed';
  statusText.innerText = 'COMPLETED';

  appendTelemetryLog(`[JOB] Job ${job.id} completed successfully`);

  if (job.report) {
    renderReport(job.report);
    renderForensicTimeline(job.report);
    renderHypotheses(job.report);
    renderGitDiffs(job.report);
    renderTerminalLogs(job.report);
    fetchPermissionAudit();
  }
}

function onJobFailed(job) {
  resetRunState();
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  statusDot.className = 'status-dot failed';
  statusText.innerText = 'FAILED';

  appendTelemetryLog(`[JOB] Job ${job.id} failed: ${job.error || 'Unknown error'}`);

  const container = document.getElementById('reportContainer');
  container.innerHTML = `
    <div class="report-card">
      <div class="report-card-title" style="color: var(--status-fail);">Investigation Failed</div>
      <div style="font-family: var(--editor-font); font-size: 11px;">${job.error || 'Unknown execution error'}</div>
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
    const statusText = document.getElementById('statusText');
    statusDot.className = 'status-dot failed';
    statusText.innerText = 'CANCELLED';
    appendTelemetryLog(`[JOB] Job ${currentJobId} cancelled by operator`);
  } catch {}
}

function renderReport(report) {
  const container = document.getElementById('reportContainer');
  container.innerHTML = '';

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  exportJsonBtn.setAttribute('data-raw', JSON.stringify(report, null, 2));

  const duration = new Date(report.completedAt) - new Date(report.startedAt);

  const summaryCard = document.createElement('div');
  summaryCard.className = 'report-card';
  summaryCard.innerHTML = `
    <div class="report-card-title">Investigation Summary</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: var(--editor-font); font-size: 11px;">
      <div>Objective: <span style="color: var(--text-primary);">${escapeHtml(report.objective)}</span></div>
      <div>Duration: <span style="color: var(--text-primary);">${duration}ms</span></div>
      <div>Repository: <span style="color: var(--text-primary);">${escapeHtml(report.projectMetadata.rootPath)}</span></div>
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
        <div class="finding-claim">${escapeHtml(finding.claim)}</div>
        <div class="finding-details">Status: [${escapeHtml(finding.verificationStatus.toUpperCase())}] | Confidence: ${(finding.confidence * 100).toFixed(0)}%</div>
        <div class="finding-details">${escapeHtml(finding.details || '')}</div>
      `;
      findingsCard.appendChild(item);
    });

    container.appendChild(findingsCard);
  }

  if (report.limitations && report.limitations.length > 0) {
    const limitCard = document.createElement('div');
    limitCard.className = 'report-card';
    limitCard.innerHTML = `<div class="report-card-title">Limitations &amp; Boundaries</div>`;
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '18px';
    ul.style.fontSize = '11px';
    ul.style.color = 'var(--text-muted)';
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
    <div id="reportText" style="font-family: var(--editor-font); font-size: 11px; white-space: pre-wrap; line-height: 1.5; background: var(--bg-editor); padding: 10px; border-radius: 2px;">${formatReportSimple(report)}</div>
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

function renderForensicTimeline(report) {
  const container = document.getElementById('forensicStreamContainer');
  container.innerHTML = '';
  document.getElementById('traceCountBadge').innerText = `${report.evidence.length} ARTIFACTS`;

  report.evidence.forEach(ev => {
    const node = document.createElement('div');
    node.className = 'timeline-node';

    const header = document.createElement('div');
    header.className = 'timeline-node-header';

    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.style.color = ev.verificationStatus === 'verified' ? 'var(--status-pass)' : 'var(--status-info)';
    tag.innerText = `GROUND TRUTH · ${ev.verificationStatus.toUpperCase()}`;

    const meta = document.createElement('span');
    meta.className = 'badge';
    meta.innerText = `${ev.type} | ${ev.id}`;

    header.appendChild(tag);
    header.appendChild(meta);

    const source = document.createElement('div');
    source.style.fontFamily = 'var(--editor-font)';
    source.style.fontSize = '10.5px';
    source.style.color = 'var(--text-secondary)';
    source.innerText = `Source: ${ev.source}`;

    const body = document.createElement('div');
    body.className = 'timeline-node-body';
    body.innerText = ev.content.length > 500 ? ev.content.substring(0, 500) + '... (truncated)' : ev.content;

    node.appendChild(header);
    node.appendChild(source);
    node.appendChild(body);

    container.appendChild(node);
  });
}

function renderHypotheses(report) {
  const container = document.getElementById('hypothesesContainer');
  container.innerHTML = '';

  if (report.findings.length === 0) {
    container.innerHTML = '<div class="empty-state">No hypotheses generated for this run.</div>';
    return;
  }

  report.findings.forEach((f, idx) => {
    const card = document.createElement('div');
    card.className = 'hypo-card';
    card.innerHTML = `
      <div class="hypo-header">
        <span style="color: var(--accent-orange);">H${idx + 1}: ${escapeHtml(f.verificationStatus.toUpperCase())}</span>
        <span style="color: var(--status-pass);">${(f.confidence * 100).toFixed(0)}% CONFIDENCE</span>
      </div>
      <div class="hypo-title">${escapeHtml(f.claim)}</div>
      <div class="hypo-meta">${escapeHtml(f.details || 'Ground truth validated via test execution.')}</div>
    `;
    container.appendChild(card);
  });
}

function renderGitDiffs(report) {
  const container = document.getElementById('diffContentContainer');
  const gitEvidence = report.evidence.filter(e => e.type === 'git_diff' || e.type === 'git_status');

  if (gitEvidence.length === 0) {
    container.innerHTML = '<div class="empty-state">Working tree clean. Zero diff modifications detected.</div>';
    document.getElementById('diffStatsBadge').innerText = 'CLEAN';
    return;
  }

  container.innerHTML = '';
  document.getElementById('diffStatsBadge').innerText = `${gitEvidence.length} MODS`;

  gitEvidence.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'diff-card';

    const header = document.createElement('div');
    header.className = 'diff-card-header';
    header.innerText = `${ev.source} (${ev.type})`;

    const body = document.createElement('div');
    body.style.padding = '8px';
    body.style.background = 'var(--bg-editor)';

    const lines = ev.content.split('\n');
    lines.forEach(l => {
      const lineDiv = document.createElement('div');
      if (l.startsWith('+') && !l.startsWith('+++')) {
        lineDiv.className = 'diff-line add';
      } else if (l.startsWith('-') && !l.startsWith('---')) {
        lineDiv.className = 'diff-line del';
      } else {
        lineDiv.className = 'diff-line ctx';
      }
      lineDiv.innerText = l;
      body.appendChild(lineDiv);
    });

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
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

async function fetchPermissionAudit() {
  try {
    const res = await fetch('/api/permissions/audit');
    if (res.ok) {
      const logs = await res.json();
      renderAuditLog(logs);
    }
  } catch {}
}

function renderAuditLog(logs) {
  const container = document.getElementById('permissionListContainer');
  const drawerAudit = document.getElementById('auditLogContainer');

  container.innerHTML = '';
  drawerAudit.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-state">No permission events recorded.</div>';
    drawerAudit.innerHTML = '<div class="log-entry">[AUDIT] Zero security violations or denials.</div>';
    return;
  }

  logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.decision === 'deny' ? 'error' : 'pass'}`;
    entry.innerText = `[${log.timestamp}] [${log.decision.toUpperCase()}] scope: ${log.scope} on ${log.resource}`;
    drawerAudit.appendChild(entry);

    const sideItem = document.createElement('div');
    sideItem.className = 'file-item';
    sideItem.innerHTML = `<span style="color: ${log.decision === 'deny' ? 'var(--status-fail)' : 'var(--status-pass)'};">[${escapeHtml(log.decision.toUpperCase())}]</span> ${escapeHtml(log.scope)} (${escapeHtml(log.resource)})`;
    container.appendChild(sideItem);
  });
}

function appendTelemetryLog(msg) {
  const stream = document.getElementById('telemetryStream');
  const time = new Date().toTimeString().split(' ')[0];
  const entry = document.createElement('div');
  entry.className = 'log-entry info';
  entry.innerText = `[${time}] ${msg}`;
  stream.appendChild(entry);
  stream.scrollTop = stream.scrollHeight;
}
