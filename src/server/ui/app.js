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
  'graphite',
  'midnight',
  'light',
  'solarized-dark',
  'solarized-light',
  'midnight-graphite',
  'nord',
  'light-studio',
  'high-contrast',
];

const STORAGE_KEY = 'anvexo_ide_settings_v1';

let currentSettings = { ...DEFAULT_SETTINGS };
let currentJobId = null;
let pollTimer = null;
let activeTab = 'github';
let activeDrawerTab = 'telemetry';
let activeActivityView = 'explorer';

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
  initGitHubPlatform();
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
  if (tabId === 'memory') {
    fetchMemoryRecords();
  } else if (tabId === 'proof' && !window.hasLoadedProof) {
    runProofVerification();
  }
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

  if (cmd === 'github') {
    switchTab('github');
    return;
  }

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
  } else if (cmd === 'proof') {
    switchTab('proof');
    runProofVerification();
  } else if (cmd === 'impact') {
    switchTab('impact');
    runImpactSimulation();
  } else if (cmd === 'reproduce') {
    switchTab('reproduce');
  } else if (cmd === 'memory') {
    switchTab('memory');
    fetchMemoryRecords();
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
      const copyIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('copy', { size: 'sm' }) : '';
      const checkIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('check', { size: 'sm' }) : '';
      copyReportBtn.innerHTML = `${checkIcon} Copied`;
      setTimeout(() => {
        copyReportBtn.innerHTML = `${copyIcon} Copy Report`;
      }, 2000);
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

  initAutonomyControls();
  initProofControls();
  initImpactControls();
  initReproControls();
  initMemoryControls();
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

  const memSelect = document.getElementById('memoryModeSelect');
  if (memSelect) {
    memSelect.addEventListener('change', async () => {
      try {
        const res = await fetch('/api/context/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: memSelect.value }),
        });
        const data = await res.json();
        appendTelemetryLog(`[MEMORY] Mode updated: ${data.mode || memSelect.value}`);
      } catch (err) {
        appendTelemetryLog(`[MEMORY] Error updating mode: ${err.message}`);
      }
    });
  }

  const rebuildBtn = document.getElementById('btnRebuildContext');
  if (rebuildBtn) {
    rebuildBtn.addEventListener('click', async () => {
      const pathInput = document.getElementById('pathInput');
      const p = (pathInput && pathInput.value.trim()) || '.';
      rebuildBtn.disabled = true;
      const spinIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('spinner', { size: 'sm', className: 'anvexo-icon-spin' }) : '';
      const refreshIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('refresh', { size: 'sm' }) : '';
      rebuildBtn.innerHTML = `${spinIcon} Rebuilding...`;
      try {
        const res = await fetch('/api/context/rebuild', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p }),
        });
        appendTelemetryLog(`[CONTEXT] Rebuilt ECHO index for ${p}`);
        await refreshMemoryStats();
      } catch (err) {
        appendTelemetryLog(`[CONTEXT] Rebuild failed: ${err.message}`);
      } finally {
        rebuildBtn.disabled = false;
        rebuildBtn.innerHTML = `${refreshIcon} Rebuild Index`;
      }
    });
  }

  const clearBtn = document.getElementById('btnClearMemory');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Clear all stored architectural context and investigation memory for this repository?')) return;
      const pathInput = document.getElementById('pathInput');
      const p = (pathInput && pathInput.value.trim()) || '.';
      clearBtn.disabled = true;
      const spinIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('spinner', { size: 'sm', className: 'anvexo-icon-spin' }) : '';
      const trashIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('trash', { size: 'sm' }) : '';
      clearBtn.innerHTML = `${spinIcon} Clearing...`;
      try {
        await fetch('/api/context/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p }),
        });
        appendTelemetryLog(`[CONTEXT] Cleared stored memory for ${p}`);
        await refreshMemoryStats();
      } catch (err) {
        appendTelemetryLog(`[CONTEXT] Clear failed: ${err.message}`);
      } finally {
        clearBtn.disabled = false;
        clearBtn.innerHTML = `${trashIcon} Clear Memory`;
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

async function refreshMemoryStats() {
  const statsHint = document.getElementById('memoryStatsHint');
  const memSelect = document.getElementById('memoryModeSelect');
  const pathInput = document.getElementById('pathInput');
  const p = (pathInput && pathInput.value.trim()) || '.';
  try {
    const res = await fetch(`/api/context?path=${encodeURIComponent(p)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (memSelect && data.mode) {
      memSelect.value = data.mode;
    }
    if (statsHint) {
      const depsCount = Object.keys(data.dependencies || {}).length;
      const pastCount = (data.historicalInvestigations || []).length;
      const bugsCount = (data.knownBugs || []).length;
      const lastCommit = data.lastCommitHash ? data.lastCommitHash.slice(0, 7) : 'none';
      statsHint.innerText = `${depsCount} dependencies indexed, ${pastCount} past investigations, ${bugsCount} known bugs. Head: ${lastCommit}`;
    }
  } catch (e) {
    if (statsHint) statsHint.innerText = 'Local-first memory active. Storage ready.';
  }
}

function openSettingsModal() {
  const overlay = document.getElementById('settingsModalOverlay');
  if (overlay) {
    syncModalControls(currentSettings);
    refreshMemoryStats();
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
      const branchChipEl = document.getElementById('branchChip');
      if (branchChipEl) {
        const branchSvg = window.AnvexoIcons ? window.AnvexoIcons.getSvg('branch', { size: 11, className: 'branch-icon' }) : '';
        branchChipEl.innerHTML = `${branchSvg}<span>${metadata.hasGit ? 'git: active' : 'git: none'}</span>`;
      }
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
    let iconName = 'file';
    if (file.endsWith('.json')) {
      iconName = 'file-text';
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.mjs')) {
      iconName = 'file-code';
    } else if (file.includes('config') || file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.toml')) {
      iconName = 'settings';
    }
    const iconSvg = window.AnvexoIcons ? window.AnvexoIcons.getSvg(iconName, { size: 'sm', className: 'file-type-icon' }) : '';
    item.innerHTML = `<span class="file-icon-wrapper" aria-hidden="true">${iconSvg}</span><span class="file-name">${escapeHtml(file)}</span>`;
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
  const spinIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('spinner', { className: 'anvexo-icon-spin btn-icon' }) : '';
  runBtn.innerHTML = `${spinIcon}<span>Investigating...</span>`;
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

    let iconName = 'clock';
    if (step.status === 'completed' || step.status === 'passed') iconName = 'check';
    else if (step.status === 'failed' || step.status === 'error') iconName = 'error';
    else if (step.status === 'running') iconName = 'spinner';

    const iconSvg = window.AnvexoIcons ? window.AnvexoIcons.getSvg(iconName, { size: 'sm', className: step.status === 'running' ? 'anvexo-icon-spin' : '' }) : '';

    const badge = document.createElement('span');
    badge.className = `step-badge ${step.status}`;
    badge.innerHTML = `<span class="step-badge-icon" aria-hidden="true">${iconSvg}</span><span>${step.status.toUpperCase()}</span>`;

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

  const errIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('error', { size: 'sm', className: 'anvexo-icon-accent' }) : '';
  const container = document.getElementById('reportContainer');
  container.innerHTML = `
    <div class="report-card">
      <div class="report-card-title" style="color: var(--status-fail); display: flex; align-items: center; gap: 6px;">
        ${errIcon} Investigation Failed
      </div>
      <div style="font-family: var(--editor-font); font-size: 11px;">${job.error || 'Unknown execution error'}</div>
    </div>
  `;
}

function resetRunState() {
  const runBtn = document.getElementById('runBtn');
  runBtn.disabled = false;
  const playIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('play', { className: 'play-icon btn-icon' }) : '';
  runBtn.innerHTML = `${playIcon}<span>Investigate</span>`;
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

      let iconName = 'warning';
      if (finding.verificationStatus === 'verified') iconName = 'test-pass';
      else if (finding.verificationStatus === 'contradicted') iconName = 'test-fail';

      const iconSvg = window.AnvexoIcons ? window.AnvexoIcons.getSvg(iconName, { size: 'sm' }) : '';

      item.innerHTML = `
        <div class="finding-claim">${escapeHtml(finding.claim)}</div>
        <div class="finding-details" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <span class="finding-badge ${statusClass}">
            <span class="finding-badge-icon" aria-hidden="true">${iconSvg}</span>
            <span>${escapeHtml(finding.verificationStatus.toUpperCase())}</span>
          </span>
          <span>Confidence: ${(finding.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="finding-details" style="margin-top: 4px;">${escapeHtml(finding.details || '')}</div>
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

  if (report.proofReport) {
    renderProofReport(report.proofReport);
    window.hasLoadedProof = true;
  }

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
    const shieldCheckIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg('shield-check', { size: 'sm' }) : '';
    drawerAudit.innerHTML = `<div class="log-entry pass" style="display: flex; align-items: center; gap: 6px;">${shieldCheckIcon} Zero security violations or denials.</div>`;
    return;
  }

  logs.forEach(log => {
    const isDeny = log.decision === 'deny';
    const entry = document.createElement('div');
    entry.className = `log-entry ${isDeny ? 'error' : 'pass'}`;
    const logIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg(isDeny ? 'shield-alert' : 'shield-check', { size: 'sm' }) : '';
    entry.innerHTML = `<span>[${log.timestamp}]</span> <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">${logIcon} ${log.decision.toUpperCase()}</span> <span>scope: ${escapeHtml(log.scope)} on ${escapeHtml(log.resource)}</span>`;
    drawerAudit.appendChild(entry);

    const sideItem = document.createElement('div');
    sideItem.className = 'file-item';
    const sideIcon = window.AnvexoIcons ? window.AnvexoIcons.getSvg(isDeny ? 'shield-alert' : 'shield-check', { size: 'sm' }) : '';
    sideItem.innerHTML = `<span class="badge ${isDeny ? 'badge-danger' : 'badge-pass'}" style="display: inline-flex; align-items: center; gap: 4px; margin-right: 6px;">${sideIcon} ${escapeHtml(log.decision.toUpperCase())}</span><span style="font-family: var(--font-mono); font-size: 10.5px;">${escapeHtml(log.scope)} (${escapeHtml(log.resource)})</span>`;
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

async function initAutonomyControls() {
  const sel = document.getElementById('autonomyModeSelect');
  if (!sel) return;
  try {
    const res = await fetch('/api/autonomy');
    if (res.ok) {
      const data = await res.json();
      if (data.mode) {
        sel.value = data.mode;
      }
    }
  } catch {}

  sel.addEventListener('change', async () => {
    const newMode = sel.value;
    try {
      const res = await fetch('/api/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        appendTelemetryLog(`[AUTONOMY] Safe Autonomy Engine mode switched to: [${newMode.toUpperCase()}]`);
      } else {
        const err = await res.json();
        alert(`Failed to update autonomy mode: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      appendTelemetryLog(`[ERROR] Autonomy policy update error: ${err.message}`);
    }
  });
}

function initProofControls() {
  const btn = document.getElementById('refreshProofBtn');
  if (btn) {
    btn.addEventListener('click', () => runProofVerification());
  }
}

async function runProofVerification() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const container = document.getElementById('proofContainer');
  const badge = document.getElementById('proofStatusBadge');
  if (badge) badge.innerText = 'VERIFYING...';
  if (container) container.innerHTML = '<div class="empty-state">Evaluating evidence ledger against registered claims...</div>';

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: currentPath }),
    });
    if (res.ok) {
      const report = await res.json();
      renderProofReport(report);
    } else {
      const err = await res.json();
      if (container) container.innerHTML = `<div class="log-entry error">Verification failed: ${escapeHtml(err.error || 'Unknown error')}</div>`;
      if (badge) badge.innerText = 'ERROR';
    }
  } catch (err) {
    if (container) container.innerHTML = `<div class="log-entry error">Network error: ${escapeHtml(err.message)}</div>`;
    if (badge) badge.innerText = 'ERROR';
  }
}

function renderProofReport(report) {
  const container = document.getElementById('proofContainer');
  const badge = document.getElementById('proofStatusBadge');
  if (!container) return;

  if (badge) {
    badge.innerText = (report.overallStatus || 'unverified').toUpperCase();
    badge.className = `badge ${report.overallStatus === 'verified' ? 'badge-verified' : report.overallStatus === 'partially_verified' ? 'badge-partial' : report.overallStatus === 'failed' ? 'badge-contradicted' : 'badge-unverified'}`;
  }

  const statGrid = `
    <div class="ei-stat-grid">
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.claims ? report.claims.length : 0}</span>
        <span class="ei-stat-label">Total Claims</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.checksPassedCount || 0}/${report.checksAttemptedCount || 0}</span>
        <span class="ei-stat-label">Checks Passed</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.dynamicExecutionsCount || 0}</span>
        <span class="ei-stat-label">Dynamic Executions</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.staticAnalysesCount || 0}</span>
        <span class="ei-stat-label">Static Analyses</span>
      </div>
    </div>
  `;

  let claimsHtml = '';
  if (report.claims && report.claims.length > 0) {
    claimsHtml = report.claims.map(claim => {
      const claimBadgeClass = claim.status === 'verified' ? 'badge-verified' : claim.status === 'partially_verified' ? 'badge-partial' : claim.status === 'failed' ? 'badge-contradicted' : 'badge-unverified';
      const checksList = (claim.checks || []).map(check => {
        const marker = check.passed ? '<span style="color: var(--status-pass);">✓ PASSED</span>' : '<span style="color: var(--status-fail);">✗ FAILED</span>';
        const execLabel = check.isExecution ? '<span class="badge badge-sm badge-info">DYNAMIC EXECUTION</span>' : '<span class="badge badge-sm">STATIC/INSPECTION</span>';
        const cmdInfo = check.commandExecuted ? `<div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-top: 4px;">Command: ${escapeHtml(check.commandExecuted)} (exit code: ${check.exitCode})</div>` : '';
        const errInfo = check.error ? `<div style="color: var(--status-fail); font-size: 11px; margin-top: 2px;">Error: ${escapeHtml(check.error)}</div>` : '';
        return `
          <div style="padding: 8px 10px; border-bottom: 1px solid var(--border-hairline); display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 500;">${marker} ${escapeHtml(check.name)}</span>
              ${execLabel}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(check.description)}</div>
            ${cmdInfo}
            ${errInfo}
          </div>
        `;
      }).join('');

      const uncertaintiesHtml = (claim.unresolvedUncertainties && claim.unresolvedUncertainties.length > 0)
        ? `<div style="margin-top: 8px; font-size: 11px; color: var(--status-pending);">Uncertainties: ${claim.unresolvedUncertainties.map(u => escapeHtml(u)).join('; ')}</div>`
        : '';

      return `
        <div class="ei-card">
          <div class="ei-card-header">
            <span class="ei-card-title">${escapeHtml(claim.statement)}</span>
            <span class="badge ${claimBadgeClass}">[${escapeHtml((claim.status || '').toUpperCase())}]</span>
          </div>
          ${claim.rationale ? `<div style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(claim.rationale)}</div>` : ''}
          <div style="background: var(--bg-card); border: 1px solid var(--border-hairline); border-radius: 4px; overflow: hidden; margin-top: 6px;">
            ${checksList || '<div style="padding: 8px; font-size: 11px; color: var(--text-muted);">No checks associated.</div>'}
          </div>
          ${uncertaintiesHtml}
        </div>
      `;
    }).join('');
  } else {
    claimsHtml = '<div class="empty-state">No claims registered. Run an investigation to generate verified empirical claims.</div>';
  }

  let nextStepsHtml = '';
  if (report.suggestedNextSteps && report.suggestedNextSteps.length > 0) {
    nextStepsHtml = `
      <div class="ei-card" style="border-left: 3px solid var(--accent-orange);">
        <span class="ei-card-title">RECOMMENDED NEXT VERIFICATION STEPS</span>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
          ${report.suggestedNextSteps.map(s => `<div style="font-size: 11.5px; color: var(--text-primary);">→ ${escapeHtml(s)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = statGrid + claimsHtml + nextStepsHtml;
}

function initImpactControls() {
  const btn = document.getElementById('runImpactBtn');
  if (btn) {
    btn.addEventListener('click', () => runImpactSimulation());
  }
}

async function runImpactSimulation(targetOverride) {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const targetInput = document.getElementById('impactTargetInput');
  const target = targetOverride || (targetInput ? targetInput.value.trim() : '') || 'src/index.ts';
  if (targetInput) targetInput.value = target;

  const container = document.getElementById('impactContainer');
  const badge = document.getElementById('impactRiskBadge');
  if (badge) badge.innerText = 'SIMULATING...';
  if (container) container.innerHTML = `<div class="empty-state">Tracing dependency graph and blast radius for ${escapeHtml(target)}...</div>`;

  try {
    const res = await fetch('/api/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: currentPath, target }),
    });
    if (res.ok) {
      const report = await res.json();
      renderImpactReport(report);
    } else {
      const err = await res.json();
      if (container) container.innerHTML = `<div class="log-entry error">Impact simulation failed: ${escapeHtml(err.error || 'Unknown error')}</div>`;
      if (badge) badge.innerText = 'ERROR';
    }
  } catch (err) {
    if (container) container.innerHTML = `<div class="log-entry error">Network error: ${escapeHtml(err.message)}</div>`;
    if (badge) badge.innerText = 'ERROR';
  }
}

function renderImpactReport(report) {
  const container = document.getElementById('impactContainer');
  const badge = document.getElementById('impactRiskBadge');
  if (!container) return;

  const riskClass = `badge-risk-${report.riskLevel || 'low'}`;
  if (badge) {
    badge.innerText = `RISK: ${(report.riskLevel || 'low').toUpperCase()} (${report.riskScore || 0}/100)`;
    badge.className = `badge ${riskClass}`;
  }

  const statGrid = `
    <div class="ei-stat-grid">
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.riskScore || 0}/100</span>
        <span class="ei-stat-label">Risk Score</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.directDependencies ? report.directDependencies.length : 0}</span>
        <span class="ei-stat-label">Direct Dependencies</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.reverseDependencies ? report.reverseDependencies.length : 0}</span>
        <span class="ei-stat-label">Downstream Dependents</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.relatedTests ? report.relatedTests.length : 0}</span>
        <span class="ei-stat-label">Relevant Tests</span>
      </div>
      <div class="ei-stat-card">
        <span class="ei-stat-value">${report.affectedEndpoints ? report.affectedEndpoints.length : 0}</span>
        <span class="ei-stat-label">API Endpoints</span>
      </div>
    </div>
  `;

  let riskFactorsHtml = '';
  if (report.riskFactors && report.riskFactors.length > 0) {
    riskFactorsHtml = `
      <div class="ei-conflict-banner">
        <span style="font-weight: 600;">DETECTED RISK FACTORS</span>
        ${report.riskFactors.map(rf => `<div>! ${escapeHtml(rf)}</div>`).join('')}
      </div>
    `;
  }

  const downstreamList = (report.reverseDependencies || []).map(rd => `
    <div style="padding: 6px 10px; border-bottom: 1px solid var(--border-hairline); font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
      <span>← ${escapeHtml(rd)}</span>
      <span class="badge badge-sm">AFFECTED</span>
    </div>
  `).join('');

  const endpointsList = (report.affectedEndpoints || []).map(ep => `
    <div style="padding: 6px 10px; border-bottom: 1px solid var(--border-hairline); font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
      <span class="badge badge-sm badge-info">${escapeHtml(ep.method)}</span>
      <span style="font-family: var(--font-mono); font-size: 11px;">${escapeHtml(ep.path)}</span>
      <span style="color: var(--text-muted); font-size: 10.5px;">(${escapeHtml(ep.handlerFile)})</span>
    </div>
  `).join('');

  const testsList = (report.relatedTests || []).map(t => `
    <div style="padding: 6px 10px; border-bottom: 1px solid var(--border-hairline); font-family: var(--font-mono); font-size: 11px; color: var(--status-pass);">
      ✓ ${escapeHtml(t)}
    </div>
  `).join('');

  const recommendationsList = (report.recommendedValidationSteps || []).map(rec => `
    <div style="font-size: 11.5px; color: var(--text-primary); margin-top: 4px;">
      → ${escapeHtml(rec)}
    </div>
  `).join('');

  container.innerHTML = `
    ${statGrid}
    ${riskFactorsHtml}
    <div class="ei-card">
      <span class="ei-card-title">DOWNSTREAM REVERSE DEPENDENCIES (${(report.reverseDependencies || []).length})</span>
      <div style="background: var(--bg-card); border: 1px solid var(--border-hairline); border-radius: 4px; max-height: 180px; overflow-y: auto;">
        ${downstreamList || '<div style="padding: 8px; font-size: 11px; color: var(--text-muted);">No reverse dependents identified.</div>'}
      </div>
    </div>
    <div class="ei-card">
      <span class="ei-card-title">AFFECTED API ENDPOINTS (${(report.affectedEndpoints || []).length})</span>
      <div style="background: var(--bg-card); border: 1px solid var(--border-hairline); border-radius: 4px; max-height: 140px; overflow-y: auto;">
        ${endpointsList || '<div style="padding: 8px; font-size: 11px; color: var(--text-muted);">No HTTP endpoints affected.</div>'}
      </div>
    </div>
    <div class="ei-card">
      <span class="ei-card-title">RELEVANT TEST SUITES (${(report.relatedTests || []).length})</span>
      <div style="background: var(--bg-card); border: 1px solid var(--border-hairline); border-radius: 4px; max-height: 140px; overflow-y: auto;">
        ${testsList || '<div style="padding: 8px; font-size: 11px; color: var(--text-muted);">No targeted test suites identified.</div>'}
      </div>
    </div>
    <div class="ei-card">
      <span class="ei-card-title">RECOMMENDED VALIDATION STEPS</span>
      ${recommendationsList || '<div style="font-size: 11px; color: var(--text-muted);">Run standard regression suite.</div>'}
    </div>
  `;
}

let activeReproSession = null;

function initReproControls() {
  const runBtn = document.getElementById('runReproBtn');
  const verifyBtn = document.getElementById('verifyFixBtn');

  if (runBtn) {
    runBtn.addEventListener('click', () => runReproduction());
  }
  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => verifyReproductionFix());
  }
}

async function runReproduction() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const descInput = document.getElementById('reproDescInput');
  const cmdInput = document.getElementById('reproCmdInput');
  const bugDesc = (descInput ? descInput.value.trim() : '') || 'Test reproduction';
  const cmd = cmdInput ? cmdInput.value.trim() : '';

  const container = document.getElementById('reproduceContainer');
  const badge = document.getElementById('reproStatusBadge');
  const verifyBtn = document.getElementById('verifyFixBtn');
  if (verifyBtn) verifyBtn.style.display = 'none';

  if (badge) badge.innerText = 'EXECUTING...';
  if (container) container.innerHTML = `<div class="empty-state">Executing reproduction sandbox for: ${escapeHtml(bugDesc)}...</div>`;

  try {
    const res = await fetch('/api/reproduce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: currentPath,
        bugDescription: bugDesc,
        command: cmd || undefined,
      }),
    });
    if (res.ok) {
      activeReproSession = await res.json();
      renderReproSession(activeReproSession);
    } else {
      const err = await res.json();
      if (container) container.innerHTML = `<div class="log-entry error">Reproduction failed: ${escapeHtml(err.error || 'Unknown error')}</div>`;
      if (badge) badge.innerText = 'ERROR';
    }
  } catch (err) {
    if (container) container.innerHTML = `<div class="log-entry error">Network error: ${escapeHtml(err.message)}</div>`;
    if (badge) badge.innerText = 'ERROR';
  }
}

async function verifyReproductionFix() {
  if (!activeReproSession || !activeReproSession.id) return;
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const badge = document.getElementById('reproStatusBadge');

  if (badge) badge.innerText = 'VERIFYING FIX...';
  appendTelemetryLog(`[REPRODUCTION] Verifying fix for session ${activeReproSession.id}...`);

  try {
    const res = await fetch('/api/reproduce/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: currentPath,
        sessionId: activeReproSession.id,
      }),
    });
    if (res.ok) {
      activeReproSession = await res.json();
      renderReproSession(activeReproSession);
    } else {
      const err = await res.json();
      alert(`Fix verification error: ${err.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Fix verification network error: ${err.message}`);
  }
}

function renderReproSession(session) {
  const container = document.getElementById('reproduceContainer');
  const badge = document.getElementById('reproStatusBadge');
  const verifyBtn = document.getElementById('verifyFixBtn');
  if (!container) return;

  const isReproduced = session.isReproduced;
  const isFixed = session.isFixed;
  const statusStr = (session.status || '').toUpperCase();

  if (badge) {
    badge.innerText = `STATUS: ${statusStr}`;
    badge.className = `badge ${isFixed ? 'badge-verified' : isReproduced ? 'badge-contradicted' : 'badge-unverified'}`;
  }

  if (verifyBtn) {
    verifyBtn.style.display = isReproduced && !isFixed ? 'inline-block' : 'none';
  }

  let initialExecHtml = '';
  if (session.initialExecution) {
    initialExecHtml = `
      <div class="ei-card">
        <div class="ei-card-header">
          <span class="ei-card-title">INITIAL REPRODUCTION ATTEMPT</span>
          <span class="badge ${session.initialExecution.exitCode !== 0 ? 'badge-contradicted' : 'badge-verified'}">EXIT CODE ${session.initialExecution.exitCode}</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">Command: ${escapeHtml(session.initialExecution.command)} (${session.initialExecution.durationMs}ms)</div>
        <pre class="ei-code-box">${escapeHtml(session.initialExecution.stdout || session.initialExecution.stderr || 'No console output produced.')}</pre>
      </div>
    `;
  }

  let postFixExecHtml = '';
  if (session.postFixExecution) {
    postFixExecHtml = `
      <div class="ei-card">
        <div class="ei-card-header">
          <span class="ei-card-title">POST-FIX VERIFICATION RUN</span>
          <span class="badge ${session.postFixExecution.exitCode === 0 ? 'badge-verified' : 'badge-contradicted'}">EXIT CODE ${session.postFixExecution.exitCode}</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">Command: ${escapeHtml(session.postFixExecution.command)} (${session.postFixExecution.durationMs}ms)</div>
        <pre class="ei-code-box">${escapeHtml(session.postFixExecution.stdout || session.postFixExecution.stderr || 'No console output produced.')}</pre>
      </div>
    `;
  }

  let unverifiedHtml = '';
  if (session.unverifiedClaims && session.unverifiedClaims.length > 0) {
    unverifiedHtml = `
      <div class="ei-conflict-banner">
        <span style="font-weight: 600;">LIMITATIONS &amp; UNVERIFIED CLAIMS</span>
        ${session.unverifiedClaims.map(u => `<div>! ${escapeHtml(u)}</div>`).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="ei-card">
      <div class="ei-card-header">
        <span class="ei-card-title">${escapeHtml(session.bugDescription)}</span>
        <span class="badge ${isReproduced ? 'badge-contradicted' : 'badge-unverified'}">${isReproduced ? 'CONFIRMED REPRODUCED' : 'NOT REPRODUCED'}</span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(session.summary)}</div>
    </div>
    ${initialExecHtml}
    ${postFixExecHtml}
    ${unverifiedHtml}
  `;
}

function initMemoryControls() {
  const toggleBtn = document.getElementById('toggleAddMemoryBtn');
  const cancelBtn = document.getElementById('cancelMemoryBtn');
  const saveBtn = document.getElementById('saveMemoryBtn');
  const form = document.getElementById('memoryAddForm');
  const typeFilter = document.getElementById('memoryTypeFilter');
  const searchInput = document.getElementById('memorySearchInput');

  if (toggleBtn && form) {
    toggleBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    });
  }
  if (cancelBtn && form) {
    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveMemoryRecord());
  }
  if (typeFilter) {
    typeFilter.addEventListener('change', () => fetchMemoryRecords());
  }
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchMemoryRecords(), 250);
    });
  }
}

async function fetchMemoryRecords() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const container = document.getElementById('memoryContainer');
  const typeFilter = document.getElementById('memoryTypeFilter');
  const searchInput = document.getElementById('memorySearchInput');

  const selectedType = typeFilter ? typeFilter.value : '';
  const search = searchInput ? searchInput.value.trim() : '';

  let url = `/api/memory?repo=${encodeURIComponent(currentPath)}`;
  if (selectedType) url += `&type=${encodeURIComponent(selectedType)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      renderMemoryRecords(data.memories || []);
    } else {
      if (container) container.innerHTML = '<div class="empty-state">Could not load project decision memories.</div>';
    }
  } catch {
    if (container) container.innerHTML = '<div class="empty-state">Network error loading decision memory.</div>';
  }
}

function renderMemoryRecords(memories) {
  const container = document.getElementById('memoryContainer');
  if (!container) return;

  if (memories.length === 0) {
    container.innerHTML = '<div class="empty-state">No decision records found for this repository. Click "+ Add Memory" to persist architectural context.</div>';
    return;
  }

  container.innerHTML = memories.map(mem => {
    const filesHtml = (mem.relatedFiles && mem.relatedFiles.length > 0)
      ? `<div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-top: 4px;">Governed Files: ${mem.relatedFiles.map(f => escapeHtml(f)).join(', ')}</div>`
      : '';

    return `
      <div class="ei-card" id="mem-card-${mem.id}">
        <div class="ei-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-sm badge-info">[${escapeHtml((mem.type || '').toUpperCase())}]</span>
            <span class="ei-card-title">${escapeHtml(mem.summary)}</span>
          </div>
          <button class="btn btn-sm btn-danger" onclick="deleteMemoryRecord('${mem.id}')" aria-label="Delete decision memory">Delete</button>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(mem.explanation)}</div>
        ${filesHtml}
      </div>
    `;
  }).join('');
}

async function saveMemoryRecord() {
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';
  const typeSel = document.getElementById('newMemoryType');
  const summaryInput = document.getElementById('newMemorySummary');
  const explanationInput = document.getElementById('newMemoryExplanation');
  const filesInput = document.getElementById('newMemoryFiles');
  const form = document.getElementById('memoryAddForm');

  const type = typeSel ? typeSel.value : 'architecture_decision';
  const summary = summaryInput ? summaryInput.value.trim() : '';
  const explanation = explanationInput ? explanationInput.value.trim() : '';
  const files = filesInput && filesInput.value.trim() ? filesInput.value.split(',').map(f => f.trim()) : [];

  if (!summary || !explanation) {
    alert('Summary headline and detailed explanation are required.');
    return;
  }

  try {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: currentPath,
        type,
        summary,
        explanation,
        relatedFiles: files,
      }),
    });
    if (res.ok) {
      if (summaryInput) summaryInput.value = '';
      if (explanationInput) explanationInput.value = '';
      if (filesInput) filesInput.value = '';
      if (form) form.style.display = 'none';
      appendTelemetryLog(`[MEMORY] Persisted new ${type}: ${summary}`);
      fetchMemoryRecords();
    } else {
      const err = await res.json();
      alert(`Failed to save memory: ${err.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Error saving memory: ${err.message}`);
  }
}

async function deleteMemoryRecord(id) {
  if (!confirm('Permanently delete this project decision memory record?')) return;
  const pathInput = document.getElementById('pathInput');
  const currentPath = pathInput.value.trim() || '.';

  try {
    const res = await fetch('/api/memory/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: currentPath, id }),
    });
    if (res.ok) {
      appendTelemetryLog(`[MEMORY] Deleted decision record ${id}`);
      fetchMemoryRecords();
    }
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}
window.deleteMemoryRecord = deleteMemoryRecord;

/* ==========================================================================
   GITHUB REPOSITORY INTELLIGENCE PLATFORM (CLIENT LOGIC)
   ========================================================================== */

let currentGitHubJobId = null;
let githubPollTimer = null;
let activeGitHubSubtab = 'overview';
let lastGitHubReport = null;

const GITHUB_STAGE_LABELS = {
  validate_url: 'Validating GitHub Identity & URL',
  fetch_metadata: 'Retrieving Metadata, Releases & Branches',
  inspect_structure: 'Inspecting Codebase Structure & Topography',
  fetch_commit_history: 'Ingesting Commit History & Timeline',
  analyze_contributors: 'Profiling Contributor Activities & Roles',
  inspect_milestones_and_diffs: 'Analyzing Chronological Milestones & Diffs',
  inspect_dependencies: 'Auditing Dependencies & Lockfiles',
  run_security_scan: 'Executing Evidence-Based Security Checks',
  evaluate_tests: 'Inspecting Test Suite & Health Metrics',
  collect_evidence: 'Aggregating Immutable Evidence Records',
  deduplicate_findings: 'Applying Finding Deduplication Keys',
  synthesize_architecture: 'Synthesizing Architecture Topology',
  generate_conclusion: 'Synthesizing 10 Core Answers & Verdict',
  finalize_report: 'Finalizing Report & Export Encodings',
};

function initGitHubPlatform() {
  const analyzeBtn = document.getElementById('githubAnalyzeBtn');
  const cancelBtn = document.getElementById('githubCancelBtn');
  const clearBtn = document.getElementById('githubClearUrlBtn');
  const sampleSelect = document.getElementById('githubSampleSelect');
  const urlInput = document.getElementById('githubUrlInput');
  const quickBtn = document.getElementById('quickAnalyzeBtn');

  if (sampleSelect) {
    sampleSelect.addEventListener('change', () => {
      const val = sampleSelect.value;
      if (val) {
        urlInput.value = val.startsWith('mock://') ? val : `mock://${val}`;
        hideGitHubAlert();
      }
    });
  }

  if (clearBtn && urlInput) {
    clearBtn.addEventListener('click', () => {
      urlInput.value = '';
      urlInput.focus();
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => startGitHubInvestigation());
  }

  if (quickBtn) {
    quickBtn.addEventListener('click', () => startGitHubInvestigation('mock://dr5t/ANVEXO-demo'));
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => cancelGitHubInvestigation());
  }

  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startGitHubInvestigation();
      }
    });
  }

  // Pre-load recent investigations if any
  fetchGitHubHistory();
}

function showGitHubAlert(msg, type = 'error') {
  const banner = document.getElementById('githubAlertBanner');
  if (!banner) return;
  banner.textContent = msg;
  banner.style.display = 'block';
  if (type === 'error') {
    banner.style.background = 'rgba(248, 81, 73, 0.12)';
    banner.style.borderColor = 'rgba(248, 81, 73, 0.35)';
    banner.style.color = 'var(--status-fail, #F85149)';
  } else {
    banner.style.background = 'rgba(245, 158, 11, 0.12)';
    banner.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    banner.style.color = '#F59E0B';
  }
}

function hideGitHubAlert() {
  const banner = document.getElementById('githubAlertBanner');
  if (banner) banner.style.display = 'none';
}

async function startGitHubInvestigation(overrideUrl) {
  if (currentGitHubJobId) {
    showGitHubAlert('An investigation is already in progress. Please wait or cancel it.', 'warn');
    return;
  }

  hideGitHubAlert();
  const urlInput = document.getElementById('githubUrlInput');
  const inputVal = (overrideUrl || (urlInput ? urlInput.value : '')).trim();

  if (!inputVal) {
    showGitHubAlert('Please enter a GitHub repository URL or sample repo (e.g. mock://dr5t/ANVEXO-demo).');
    return;
  }

  const analyzeBtn = document.getElementById('githubAnalyzeBtn');
  const cancelBtn = document.getElementById('githubCancelBtn');
  const progressContainer = document.getElementById('githubProgressContainer');
  const progressBar = document.getElementById('githubProgressBar');
  const progressPercent = document.getElementById('githubProgressPercent');
  const progressCounter = document.getElementById('githubProgressCounter');
  const progressStageTitle = document.getElementById('githubProgressStageTitle');
  const progressMsg = document.getElementById('githubProgressMessage');

  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `
      <span class="github-spinner" style="width:13px; height:13px;"></span>
      <span>Investigating...</span>
    `;
  }
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
  if (progressContainer) progressContainer.style.display = 'flex';
  if (progressBar) progressBar.style.width = '5%';
  if (progressPercent) progressPercent.textContent = '5%';
  if (progressCounter) progressCounter.textContent = 'Stage 1 of 14';
  if (progressStageTitle) progressStageTitle.textContent = 'Validating GitHub Identity & URL...';
  if (progressMsg) progressMsg.textContent = `Targeting: ${inputVal}`;

  appendTelemetryLog(`[GITHUB] Starting repository intelligence for: ${inputVal}`);

  try {
    const res = await fetch('/api/github/investigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: inputVal, mock: true }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start investigation');
    }

    currentGitHubJobId = data.jobId;
    pollGitHubJob(currentGitHubJobId);
  } catch (err) {
    resetGitHubButtons();
    if (progressContainer) progressContainer.style.display = 'none';
    showGitHubAlert(err.message || 'Investigation request failed');
  }
}

function resetGitHubButtons() {
  const analyzeBtn = document.getElementById('githubAnalyzeBtn');
  const cancelBtn = document.getElementById('githubCancelBtn');
  if (analyzeBtn) {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = `
      <svg class="anvexo-icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span>Analyze Repository</span>
    `;
  }
  if (cancelBtn) cancelBtn.style.display = 'none';
}

async function cancelGitHubInvestigation() {
  if (!currentGitHubJobId) return;
  const jobId = currentGitHubJobId;
  clearTimeout(githubPollTimer);
  currentGitHubJobId = null;

  try {
    await fetch(`/api/github/jobs/${jobId}/cancel`, { method: 'POST' });
  } catch {}

  resetGitHubButtons();
  const progressContainer = document.getElementById('githubProgressContainer');
  if (progressContainer) progressContainer.style.display = 'none';
  showGitHubAlert('Investigation was cancelled by user.', 'warn');
  appendTelemetryLog(`[GITHUB] Investigation ${jobId} cancelled.`);
}

async function pollGitHubJob(jobId) {
  if (currentGitHubJobId !== jobId) return;

  try {
    const res = await fetch(`/api/github/jobs/${jobId}`);
    if (!res.ok) {
      throw new Error(`Could not query investigation job ${jobId}`);
    }

    const job = await res.json();

    const progressBar = document.getElementById('githubProgressBar');
    const progressPercent = document.getElementById('githubProgressPercent');
    const progressCounter = document.getElementById('githubProgressCounter');
    const progressStageTitle = document.getElementById('githubProgressStageTitle');
    const progressMsg = document.getElementById('githubProgressMessage');

    const pct = Math.max(5, Math.min(100, Math.round(job.percentage || 0)));
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressCounter) progressCounter.textContent = `Stage ${job.stageIndex || 1} of ${job.totalStages || 14}`;

    const stageLabel = GITHUB_STAGE_LABELS[job.currentStage] || job.currentStage;
    if (progressStageTitle) progressStageTitle.textContent = stageLabel;

    if (job.events && job.events.length > 0) {
      const lastEvent = job.events[job.events.length - 1];
      if (progressMsg) progressMsg.textContent = lastEvent.message;
    }

    if (job.status === 'completed' && job.report) {
      currentGitHubJobId = null;
      resetGitHubButtons();
      if (progressBar) progressBar.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';
      if (progressStageTitle) progressStageTitle.textContent = 'Investigation Complete';
      if (progressMsg) progressMsg.textContent = 'All 14 stages synthesized into evidence-based report.';

      lastGitHubReport = job.report;
      renderGitHubReport(job.report);
      appendTelemetryLog(`[GITHUB] Investigation completed successfully for ${job.owner}/${job.repo}`);

      setTimeout(() => {
        const progressContainer = document.getElementById('githubProgressContainer');
        if (progressContainer) progressContainer.style.display = 'none';
      }, 1600);
      return;
    }

    if (job.status === 'failed') {
      currentGitHubJobId = null;
      resetGitHubButtons();
      const progressContainer = document.getElementById('githubProgressContainer');
      if (progressContainer) progressContainer.style.display = 'none';
      showGitHubAlert(`Investigation failed: ${job.error || 'Check aborted or unreachable'}`);
      return;
    }

    if (job.status === 'cancelled') {
      currentGitHubJobId = null;
      resetGitHubButtons();
      const progressContainer = document.getElementById('githubProgressContainer');
      if (progressContainer) progressContainer.style.display = 'none';
      showGitHubAlert('Investigation was cancelled.', 'warn');
      return;
    }

    // Schedule next poll tick (fast 250ms for snappy demo experience)
    githubPollTimer = setTimeout(() => pollGitHubJob(jobId), 250);
  } catch (err) {
    currentGitHubJobId = null;
    resetGitHubButtons();
    showGitHubAlert(`Polling error: ${err.message}`);
  }
}

function renderGitHubReport(report) {
  const container = document.getElementById('githubResultsContainer');
  if (!container) return;

  const repo = report.repository;
  const meta = report.metadata;
  const conc = report.finalConclusion;
  const statusStr = (conc?.overallStatus || 'HEALTHY').toUpperCase();

  let verdictClass = 'verdict-healthy';
  if (statusStr.includes('SIGNIFICANT') || statusStr.includes('FAIL')) {
    verdictClass = 'verdict-issues';
  } else if (statusStr.includes('NEEDS')) {
    verdictClass = 'verdict-attention';
  } else if (statusStr.includes('INCOMPLETE')) {
    verdictClass = 'verdict-incomplete';
  }

  const createdDateStr = new Date(meta.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const firstCommitStr = meta.firstCommitDate || report.developmentTimeline[0]?.date || createdDateStr;
  const latestCommitStr = report.commitsSample[0]?.sha?.slice(0, 8) || 'HEAD';

  container.innerHTML = `
    <!-- Top Hero Card -->
    <div class="github-repo-hero">
      <div class="hero-top-row">
        <div class="hero-title-group">
          <div class="repo-avatar">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </div>
          <div>
            <a href="${meta.htmlUrl}" target="_blank" class="repo-full-name">${escapeHtml(meta.fullName)} ↗</a>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Report ID: <code>${report.id}</code></div>
          </div>
        </div>
        <div class="hero-badges">
          <span class="verdict-pill ${verdictClass}">${escapeHtml(statusStr)}</span>
          ${report.isMock ? '<span class="simulation-disclaimer">⚠️ MOCK SIMULATION DATA</span>' : '<span class="badge badge-accent">LIVE REPO</span>'}
        </div>
      </div>

      <p class="hero-desc">${escapeHtml(meta.description || 'No description provided by repository maintainers.')}</p>

      <div class="hero-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Primary Stack</span>
          <span class="meta-value">${escapeHtml(meta.primaryLanguage || 'TypeScript')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Default Branch</span>
          <span class="meta-value">${escapeHtml(meta.defaultBranch || 'main')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Community Stars</span>
          <span class="meta-value">⭐ ${meta.starsCount.toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Forks</span>
          <span class="meta-value">🍴 ${meta.forksCount.toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Open Issues</span>
          <span class="meta-value">⚠️ ${meta.openIssuesCount.toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Repo Created</span>
          <span class="meta-value">${createdDateStr}</span>
        </div>
        <div class="meta-item" title="First commit date is measured from historical git commits, distinct from GitHub repo creation date">
          <span class="meta-label">First Commit</span>
          <span class="meta-value">${firstCommitStr}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Latest Commit</span>
          <span class="meta-value"><code>${latestCommitStr}</code></span>
        </div>
      </div>
    </div>

    <!-- Navigation Pills -->
    <div class="github-subnav">
      <button class="github-subnav-btn active" data-subtab="overview">Overview &amp; 10 Core Answers</button>
      <button class="github-subnav-btn" data-subtab="contributors">Contributors &amp; Commits (${report.contributors.length})</button>
      <button class="github-subnav-btn" data-subtab="codebase">Codebase &amp; Architecture</button>
      <button class="github-subnav-btn" data-subtab="security">Security &amp; Findings (${report.securityFindings.length})</button>
      <button class="github-subnav-btn" data-subtab="tests">Test Health &amp; Checks</button>
      <button class="github-subnav-btn" data-subtab="exports">Export &amp; History</button>
    </div>

    <!-- SUB-PANE 1: Overview & 10 Core Answers -->
    <div id="ghSubpane-overview" class="github-tab-pane active">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Executive Summary</span>
          <span class="badge">${(report.durationMs / 1000).toFixed(1)}s Investigation</span>
        </div>
        <p style="color:var(--text-secondary); line-height:1.6; margin:0; font-size:13px;">
          ${escapeHtml(report.executiveSummary)}
        </p>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">10 Evidence-Based Core Answers</span>
          <span class="badge badge-accent">Ground Truth Synthesis</span>
        </div>
        <div class="answers-grid">
          ${renderAnswersCards(conc.answers)}
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Prioritized Remediation Plan</span>
          <span class="badge">${conc.prioritizedRemediation.length} Action Items</span>
        </div>
        <div class="remediation-list">
          ${renderRemediationList(conc.prioritizedRemediation)}
        </div>
      </div>
    </div>

    <!-- SUB-PANE 2: Contributors & History -->
    <div id="ghSubpane-contributors" class="github-tab-pane">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Identified Contributors &amp; Authorship Profiles</span>
          <span class="badge">${report.contributors.length} Identifiable Contributors</span>
        </div>
        <div class="contributors-grid">
          ${renderContributorsGrid(report.contributors)}
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Chronological Development Milestones</span>
          <span class="badge">${report.developmentTimeline.length} Milestones</span>
        </div>
        <div class="timeline-milestones">
          ${renderMilestonesList(report.developmentTimeline)}
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Analyzed Commits Sample</span>
          <span class="badge">${report.commitsAnalyzedCount} Commits Ingested</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="diff-table" style="width:100%; font-size:12px; border-collapse:collapse;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-hairline); color:var(--text-muted);">
                <th style="padding:8px;">SHA</th>
                <th style="padding:8px;">Message</th>
                <th style="padding:8px;">Author / Committer</th>
                <th style="padding:8px;">Date</th>
                <th style="padding:8px;">Diff Stats</th>
              </tr>
            </thead>
            <tbody>
              ${renderCommitsTableRows(report.commitsSample)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SUB-PANE 3: Codebase & Architecture -->
    <div id="ghSubpane-codebase" class="github-tab-pane">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Architecture Overview</span>
          <span class="badge">${escapeHtml(report.architectureOverview.primaryStack)}</span>
        </div>
        <p style="color:var(--text-secondary); line-height:1.6; margin:0; font-size:13px;">
          ${escapeHtml(report.architectureOverview.summary)}
        </p>
        <div style="margin-top:8px;">
          <strong style="font-size:12px; color:var(--text-primary);">Application Entry Points:</strong>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
            ${report.architectureOverview.entryPoints.map(ep => `<span class="badge badge-accent"><code>${escapeHtml(ep)}</code></span>`).join('')}
          </div>
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Directory Topology</span>
          <span class="badge">${report.architectureOverview.directories.length} Subsystems</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:10px;">
          ${report.architectureOverview.directories.map(d => `
            <div style="background:var(--bg-editor); border:1px solid var(--border-hairline); padding:10px 12px; border-radius:6px;">
              <code style="color:var(--accent-orange); font-size:12px;">${escapeHtml(d.path)}</code>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${escapeHtml(d.purpose)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Dependency Manifests</span>
          <span class="badge">${report.dependencyManifests.length} Manifest(s)</span>
        </div>
        ${report.dependencyManifests.map(m => `
          <div style="background:var(--bg-editor); border:1px solid var(--border-hairline); padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:var(--text-primary); font-size:13px;">${escapeHtml(m.path)}</strong>
              <div style="color:var(--text-muted); font-size:11.5px; margin-top:2px;">Manager: <code>${escapeHtml(m.manager)}</code> | Lockfile Present: ${m.hasLockfile ? '✅ Yes' : '❌ Missing'}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:var(--text-primary); font-weight:600; font-size:13px;">${m.directDependenciesCount} direct / ${m.devDependenciesCount} dev</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- SUB-PANE 4: Security & Quality Findings -->
    <div id="ghSubpane-security" class="github-tab-pane">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Evidence-Based Security &amp; Quality Audit</span>
          <span class="badge">${report.securityFindings.length} Observation(s)</span>
        </div>
        <div class="findings-list">
          ${renderFindingsList(report.securityFindings)}
        </div>
      </div>
    </div>

    <!-- SUB-PANE 5: Test Results & Project Health -->
    <div id="ghSubpane-tests" class="github-tab-pane">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Automated Verification &amp; Test Suite</span>
          <span class="badge ${report.testExecution.status === 'ALL_PASSED' ? 'badge-accent' : 'badge-danger'}">${escapeHtml(report.testExecution.status)}</span>
        </div>
        <div class="hero-meta-grid">
          <div class="meta-item">
            <span class="meta-label">Test Runner</span>
            <span class="meta-value">${escapeHtml(report.testExecution.framework)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Passed</span>
            <span class="meta-value" style="color:var(--status-pass);">✅ ${report.testExecution.passed}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Failed</span>
            <span class="meta-value" style="${report.testExecution.failed > 0 ? 'color:var(--status-fail);' : ''}">${report.testExecution.failed > 0 ? `❌ ${report.testExecution.failed}` : '0'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Skipped</span>
            <span class="meta-value">${report.testExecution.skipped}</span>
          </div>
        </div>
        <p style="color:var(--text-secondary); font-size:12.5px; margin:4px 0 0 0;">
          ${escapeHtml(report.testExecution.notes)}
        </p>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Repository Health &amp; Maintenance Indicators</span>
          <span class="badge">Governance</span>
        </div>
        <div class="hero-meta-grid">
          <div class="meta-item">
            <span class="meta-label">Commit Velocity</span>
            <span class="meta-value" style="text-transform:uppercase;">${report.maintenanceIndicators.commitFrequency}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Bus Factor Risk</span>
            <span class="meta-value" style="text-transform:uppercase; color:${report.maintenanceIndicators.busFactorRisk === 'low' ? 'var(--status-pass)' : '#F59E0B'}">${report.maintenanceIndicators.busFactorRisk}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">CI Configured</span>
            <span class="meta-value">${report.maintenanceIndicators.hasContinuousIntegration ? '✅ Yes' : '⚠️ Missing'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Documentation</span>
            <span class="meta-value">${report.maintenanceIndicators.hasDocumentation ? '✅ Verified' : '⚠️ Partial'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SUB-PANE 6: Exports & Local History -->
    <div id="ghSubpane-exports" class="github-tab-pane">
      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Export Investigation Artifacts</span>
          <span class="badge">Permanent Record</span>
        </div>
        <div class="export-actions-row">
          <a href="/api/github/reports/${report.id}/export?format=markdown" download class="btn btn-primary">
            <svg class="anvexo-icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download Markdown (.md)</span>
          </a>

          <a href="/api/github/reports/${report.id}/export?format=json" download class="btn btn-sm">
            <svg class="anvexo-icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download JSON (.json)</span>
          </a>

          <a href="/api/github/reports/${report.id}/export?format=html" download class="btn btn-sm">
            <svg class="anvexo-icon btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download Standalone HTML (.html)</span>
          </a>

          <button id="ghDeleteReportBtn" class="btn btn-danger btn-sm" onclick="deleteInvestigationReport('${report.id}')">
            <span>Remove from Local History</span>
          </button>
        </div>
      </div>

      <div class="github-card">
        <div class="card-title-row">
          <span class="card-title">Previous Local Investigations</span>
          <span class="badge" id="ghHistoryCountBadge">Saved Reports</span>
        </div>
        <div id="ghHistoryListContainer" style="overflow-x:auto;">
          <div style="color:var(--text-muted); font-size:12px; padding:10px 0;">Loading local history...</div>
        </div>
      </div>
    </div>
  `;

  // Attach Subnav Switchers
  const subnavButtons = container.querySelectorAll('.github-subnav-btn');
  subnavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.getAttribute('data-subtab');
      subnavButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-subtab') === targetSubtab));
      container.querySelectorAll('.github-tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === `ghSubpane-${targetSubtab}`);
      });
      if (targetSubtab === 'exports') {
        fetchGitHubHistory();
      }
    });
  });
}

function renderAnswersCards(answers) {
  if (!answers || Object.keys(answers).length === 0) {
    return '<div style="color:var(--text-muted);">No structured answers synthesized.</div>';
  }

  const questionKeys = [
    { key: 'whatProjectDoes', title: '1. What does the project do?' },
    { key: 'howStructured', title: '2. How is it structured?' },
    { key: 'visibleHistory', title: '3. What development history is visible?' },
    { key: 'contributorsChangedParts', title: '4. Which contributors changed which parts?' },
    { key: 'whatIsWorking', title: '5. What is working?' },
    { key: 'whatIsFailing', title: '6. What is failing?' },
    { key: 'verifiedIssues', title: '7. Which issues have been verified?' },
    { key: 'needsInvestigation', title: '8. What needs further investigation?' },
    { key: 'isReadyForUse', title: '9. Is the project ready for its stated use?' },
    { key: 'whatToFixFirst', title: '10. What should be fixed first?' },
  ];

  return questionKeys.map(q => {
    const ans = answers[q.key] || 'Not explicitly determined from evidence.';
    return `
      <div class="answer-card">
        <div class="answer-q">${escapeHtml(q.title)}</div>
        <div class="answer-a">${escapeHtml(ans)}</div>
      </div>
    `;
  }).join('');
}

function renderRemediationList(items) {
  if (!items || items.length === 0) {
    return '<div style="color:var(--text-muted); font-size:12px;">No urgent remediation actions required.</div>';
  }

  return items.map(item => `
    <div class="remediation-item">
      <span class="priority-pill ${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span>
      <div style="flex:1;">
        <strong style="color:var(--text-primary); font-size:12.5px;">${escapeHtml(item.recommendation)}</strong>
        ${item.targetFile ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Target: <code>${escapeHtml(item.targetFile)}</code></div>` : ''}
        <div style="font-size:11.5px; color:var(--text-secondary); margin-top:4px;">${escapeHtml(item.rationale)}</div>
      </div>
    </div>
  `).join('');
}

function renderContributorsGrid(contributors) {
  return contributors.map(c => `
    <div class="contributor-card">
      <div class="contributor-header">
        <div>
          <div class="contrib-name">${escapeHtml(c.name)}</div>
          <div class="contrib-username">@${escapeHtml(c.username)}</div>
        </div>
        <span class="contrib-commits">${c.commitsCount} commits</span>
      </div>
      <div class="contrib-areas">
        <strong>Technical Focus:</strong> ${c.technicalAreas.map(a => `<span class="badge" style="font-size:10px; margin:2px;">${escapeHtml(a)}</span>`).join('')}
      </div>
      <div style="font-size:11.5px; color:var(--text-muted);">
        <strong>Top Files:</strong> ${c.filesModified.map(f => `<code>${escapeHtml(f)}</code>`).join(', ')}
      </div>
      <div class="contrib-note">
        ${escapeHtml(c.attributionNote)}
      </div>
    </div>
  `).join('');
}

function renderMilestonesList(milestones) {
  return milestones.map(m => `
    <div class="milestone-item">
      <div class="milestone-date">${escapeHtml(m.date)}</div>
      <div class="milestone-details">
        <div class="milestone-title">
          ${escapeHtml(m.title)}
          <span class="badge badge-accent" style="font-size:10px; margin-left:6px;">${escapeHtml(m.type)}</span>
        </div>
        <div class="milestone-desc">${escapeHtml(m.description)}</div>
      </div>
    </div>
  `).join('');
}

function renderCommitsTableRows(commits) {
  return commits.map(c => `
    <tr style="border-bottom:1px solid var(--border-hairline);">
      <td style="padding:8px; font-family:var(--font-mono); color:var(--accent-orange);"><code>${c.sha.slice(0, 8)}</code></td>
      <td style="padding:8px; color:var(--text-primary); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.message)}</td>
      <td style="padding:8px; color:var(--text-secondary);">${escapeHtml(c.authorName)} ${c.authorName !== c.committerName ? `<span style="color:var(--text-muted); font-size:10.5px;">(committer: ${escapeHtml(c.committerName)})</span>` : ''}</td>
      <td style="padding:8px; font-family:var(--font-mono); color:var(--text-muted); font-size:11px;">${escapeHtml(c.timestamp.slice(0, 10))}</td>
      <td style="padding:8px; font-family:var(--font-mono); font-size:11px;">
        <span style="color:var(--status-pass);">+${c.stats?.additions || 0}</span> / 
        <span style="color:var(--status-fail);">-${c.stats?.deletions || 0}</span>
      </td>
    </tr>
  `).join('');
}

function renderFindingsList(findings) {
  if (!findings || findings.length === 0) {
    return '<div style="color:var(--status-pass); font-size:12.5px;">✅ Zero security vulnerabilities or risky patterns detected.</div>';
  }

  return findings.map(f => {
    const sev = f.severity.toLowerCase();
    return `
      <div class="finding-card sev-${sev}">
        <div class="finding-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="priority-pill ${sev === 'high' ? 'p1' : sev === 'medium' ? 'p2' : 'p3'}">${escapeHtml(f.severity)}</span>
            <span class="finding-title">${escapeHtml(f.title)}</span>
          </div>
          <span class="finding-id">${escapeHtml(f.id)}</span>
        </div>
        <div class="finding-desc">${escapeHtml(f.description)}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">
          <strong>Affected File:</strong> <code>${escapeHtml(f.affectedFile)}</code>
          <span style="margin-left:12px;"><strong>Verification:</strong> ${escapeHtml(f.verificationStatus)}</span>
        </div>
        ${f.evidenceCode ? `
          <div class="finding-code">${escapeHtml(f.evidenceCode)}</div>
        ` : ''}
        <div style="font-size:12px; color:var(--accent-orange);">
          <strong>Remediation:</strong> ${escapeHtml(f.remediation)}
        </div>
      </div>
    `;
  }).join('');
}

async function fetchGitHubHistory() {
  const container = document.getElementById('ghHistoryListContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/github/history');
    if (!res.ok) return;
    const list = await res.json();

    const countBadge = document.getElementById('ghHistoryCountBadge');
    if (countBadge) countBadge.textContent = `${list.length} Saved`;

    if (list.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:8px 0;">No previous investigations saved yet.</div>';
      return;
    }

    container.innerHTML = `
      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--border-hairline); color:var(--text-muted);">
            <th style="padding:6px 8px;">Repository</th>
            <th style="padding:6px 8px;">Status</th>
            <th style="padding:6px 8px;">Date</th>
            <th style="padding:6px 8px; text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(item => `
            <tr style="border-bottom:1px solid var(--border-hairline);">
              <td style="padding:6px 8px; font-weight:600; color:var(--text-primary);">${escapeHtml(item.owner)}/${escapeHtml(item.repo)}</td>
              <td style="padding:6px 8px;"><span class="badge ${item.overallStatus?.includes('Healthy') ? 'badge-accent' : 'badge-danger'}">${escapeHtml(item.overallStatus || item.status)}</span></td>
              <td style="padding:6px 8px; color:var(--text-muted); font-family:var(--font-mono); font-size:11px;">${new Date(item.startedAt).toLocaleString()}</td>
              <td style="padding:6px 8px; text-align:right;">
                <button class="btn btn-sm" onclick="loadPreviousInvestigation('${item.id}')" style="margin-right:6px;">Open</button>
                <button class="btn btn-danger btn-sm" onclick="deleteInvestigationReport('${item.id}')">&times;</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {}
}

async function loadPreviousInvestigation(id) {
  try {
    const res = await fetch(`/api/github/history/${id}`);
    if (!res.ok) {
      alert('Could not load previous report');
      return;
    }
    const report = await res.json();
    lastGitHubReport = report;
    renderGitHubReport(report);
  } catch (err) {
    alert(`Failed to load report: ${err.message}`);
  }
}
window.loadPreviousInvestigation = loadPreviousInvestigation;

async function deleteInvestigationReport(id) {
  if (!confirm('Remove this investigation report from local history?')) return;
  try {
    const res = await fetch(`/api/github/history/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchGitHubHistory();
      // If active report deleted, reset view
      if (lastGitHubReport && lastGitHubReport.id === id) {
        lastGitHubReport = null;
        const container = document.getElementById('githubResultsContainer');
        if (container) {
          container.innerHTML = `
            <div class="github-welcome-card">
              <h2>Report Removed</h2>
              <p>The investigation record was removed from local history.</p>
              <button class="btn btn-primary" onclick="startGitHubInvestigation('mock://dr5t/ANVEXO-demo')">Launch Sample Investigation</button>
            </div>
          `;
        }
      }
    }
  } catch (err) {
    alert(`Failed to delete report: ${err.message}`);
  }
}
window.deleteInvestigationReport = deleteInvestigationReport;
