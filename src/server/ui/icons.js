/**
 * ANVEXO Precision SVG Icon System
 * 
 * Purpose-built, original SVG icons for the ANVEXO Autonomous Software
 * Investigation and Codebase Intelligence Platform.
 * 
 * Aesthetic: Restrained, technical, precision-engineered developer tooling.
 * Coordinate Grid: 24x24 viewBox, stroke-width: 1.75, currentColor by default.
 */

(function (global) {
  'use strict';

  /**
   * Raw SVG geometry definitions.
   * Every icon is drawn on a 24x24 viewport with consistent line caps,
   * joins, and optical balance.
   */
  const ICONS = {
    // -------------------------------------------------------------------------
    // Brand & Intelligence
    // -------------------------------------------------------------------------
    'anvexo-symbol': `
      <polygon points="12,3 21,21 16.5,21 12,12 7.5,21 3,21" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="12,3 21,21 16.5,21 14.5,16 12,16 12,12" fill="var(--accent-orange, #E54D2E)" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linejoin="round"/>
    `,
    'anveshan': `
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" stroke-dasharray="2 3"/>
      <polygon points="12,5 17,14 12,11 7,14" fill="var(--accent-orange, #E54D2E)" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'echo': `
      <circle cx="12" cy="12" r="2.5" fill="var(--accent-orange, #E54D2E)"/>
      <path d="M7.75 7.75 A6 6 0 0 1 16.25 7.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <path d="M5 5 A10 10 0 0 1 19 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <path d="M7.75 16.25 A6 6 0 0 0 16.25 16.25" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <path d="M5 19 A10 10 0 0 0 19 19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'agent': `
      <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="12" cy="2" r="1" fill="var(--accent-orange, #E54D2E)"/>
      <line x1="9" y1="11" x2="10.5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="13.5" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 14 Q12 16 15 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'hypothesis': `
      <path d="M12 3 L20 12 L12 21 L4 12 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="11" r="2.25" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" fill="none"/>
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor"/>
    `,
    'evidence': `
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="15.8" y1="15.8" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M8.5 11 A2.5 2.5 0 0 1 13.5 11" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <circle cx="11" cy="11" r="0.75" fill="currentColor"/>
    `,
    'dag': `
      <circle cx="5" cy="12" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="19" cy="6" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="19" cy="18" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M7.5 11 L16.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7.5 13 L16.5 16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <polygon points="17,7 15,6.5 16,8.5" fill="currentColor"/>
      <polygon points="17,17 16,15.5 15,17.5" fill="currentColor"/>
    `,
    'root-cause': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="12" cy="12" r="4.5" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" fill="none"/>
      <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="var(--accent-orange, #E54D2E)"/>
    `,

    // -------------------------------------------------------------------------
    // Navigation & Workspace
    // -------------------------------------------------------------------------
    'workspace': `
      <path d="M3 10.5 L12 3.5 L21 10.5 V19.5 C21 20.3 20.3 21 19.5 21 H4.5 C3.7 21 3 20.3 3 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <path d="M9 21 V13 H15 V21" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    `,
    'explorer': `
      <path d="M3 6.5 C3 5.7 3.7 5 4.5 5 H9 L11.5 7.5 H19.5 C20.3 7.5 21 8.2 21 9 V18.5 C21 19.3 20.3 20 19.5 20 H4.5 C3.7 20 3 19.3 3 18.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.5"/>
    `,
    'folder': `
      <path d="M3 6.5 C3 5.7 3.7 5 4.5 5 H9 L11.5 7.5 H19.5 C20.3 7.5 21 8.2 21 9 V18.5 C21 19.3 20.3 20 19.5 20 H4.5 C3.7 20 3 19.3 3 18.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    `,
    'folder-open': `
      <path d="M3 7 C3 6.2 3.7 5.5 4.5 5.5 H9 L11.5 8 H19.5 C20.3 8 21 8.7 21 9.5 V12" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <path d="M3 12 H21 L18.8 19.2 C18.6 19.7 18.1 20 17.5 20 H5.2 C4.6 20 4.1 19.7 3.9 19.2 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    `,
    'file': `
      <path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H14 L19 8 V19.5 C19 20.3 18.3 21 17.5 21 H6.5 C5.7 21 5 20.3 5 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="14,3 14,8 19,8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="8.5" y1="12" x2="15.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8.5" y1="16" x2="13" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'file-code': `
      <path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H14 L19 8 V19.5 C19 20.3 18.3 21 17.5 21 H6.5 C5.7 21 5 20.3 5 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="14,3 14,8 19,8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="9.5,12 8,14 9.5,16" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="14.5,12 16,14 14.5,16" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    'file-text': `
      <path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H14 L19 8 V19.5 C19 20.3 18.3 21 17.5 21 H6.5 C5.7 21 5 20.3 5 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="14,3 14,8 19,8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="8.5" y1="12" x2="15.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8.5" y1="15.5" x2="15.5" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'file-json': `
      <path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H14 L19 8 V19.5 C19 20.3 18.3 21 17.5 21 H6.5 C5.7 21 5 20.3 5 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="14,3 14,8 19,8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <path d="M9 12 C9 13 8 13.5 8 14 C8 14.5 9 15 9 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M15 12 C15 13 16 13.5 16 14 C16 14.5 15 15 15 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    `,
    'file-config': `
      <path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H14 L19 8 V19.5 C19 20.3 18.3 21 17.5 21 H6.5 C5.7 21 5 20.3 5 19.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="14,3 14,8 19,8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="14" r="2.2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <line x1="12" y1="11" x2="12" y2="11.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="12" y1="16.2" x2="12" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'search': `
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="8.5" y1="11" x2="13.5" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="8.5" x2="11" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'settings': `
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M12 2.5 L13.2 4.8 L15.7 4.5 L16.3 7 L18.8 7.6 L18.5 10.1 L20.7 11.4 L19.7 13.7 L21.3 15.6 L19.6 17.5 L20.3 20 L17.8 20.3 L16.8 22.5 L14.4 21.8 L12.8 23.7 L11.2 21.8 L8.8 22.5 L7.8 20.3 L5.3 20 L6 17.5 L4.3 15.6 L5.9 13.7 L4.9 11.4 L7.1 10.1 L6.8 7.6 L9.3 7 L9.9 4.5 L12.4 4.8 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
    `,
    'command-palette': `
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <polyline points="7,10 10,12 7,14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'history': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <polyline points="12,7 12,12 15.5,14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3.5 12 A8.5 8.5 0 0 1 12 3.5" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'panels': `
      <rect x="3" y="3.5" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="9" y1="3.5" x2="9" y2="20.5" stroke="currentColor" stroke-width="1.75"/>
      <line x1="9" y1="14" x2="21" y2="14" stroke="currentColor" stroke-width="1.5"/>
    `,
    'split-view': `
      <rect x="3" y="3.5" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="currentColor" stroke-width="1.75"/>
    `,
    'sidebar-toggle': `
      <rect x="3" y="3.5" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="9" y1="3.5" x2="9" y2="20.5" stroke="currentColor" stroke-width="1.75"/>
      <polyline points="15,9 13,12 15,15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    'drawer-toggle': `
      <rect x="3" y="3.5" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" stroke-width="1.75"/>
      <polyline points="10,10 12,8 14,10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    'chevron-down': `
      <polyline points="6,9.5 12,15.5 18,9.5" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'chevron-up': `
      <polyline points="6,14.5 12,8.5 18,14.5" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'chevron-left': `
      <polyline points="14.5,6 8.5,12 14.5,18" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'chevron-right': `
      <polyline points="9.5,6 15.5,12 9.5,18" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'close': `
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
    `,

    // -------------------------------------------------------------------------
    // Developer Tooling
    // -------------------------------------------------------------------------
    'terminal': `
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <polyline points="7,9 10,12 7,15" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="12" y1="15" x2="16.5" y2="15" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'code': `
      <polyline points="15.5,7 20.5,12 15.5,17" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <polyline points="8.5,7 3.5,12 8.5,17" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="13.5" y1="4.5" x2="10.5" y2="19.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'git': `
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="18" cy="9" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="6" y1="8.5" x2="6" y2="15.5" stroke="currentColor" stroke-width="1.75"/>
      <path d="M6 11 C6 13 18 11 18 11.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'branch': `
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="18" cy="9" r="2.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="6" y1="8.5" x2="6" y2="15.5" stroke="currentColor" stroke-width="1.75"/>
      <path d="M6 12 C10 12 14 11 18 11.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'commit': `
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="2" y1="12" x2="8.5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="15.5" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'diff': `
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
      <line x1="6.5" y1="8" x2="9.5" y2="8" stroke="var(--status-fail, #F85149)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="14.5" y1="8" x2="17.5" y2="8" stroke="var(--status-pass, #3FB950)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="16" y1="6.5" x2="16" y2="9.5" stroke="var(--status-pass, #3FB950)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="6.5" y1="14" x2="9.5" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="14.5" y1="14" x2="17.5" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'test': `
      <path d="M9 3 H15 M10 3 V8 L6 17 C5.5 18 6.2 19.5 7.5 19.5 H16.5 C17.8 19.5 18.5 18 18 17 L14 8 V3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="7.8" y1="15" x2="16.2" y2="15" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5"/>
      <circle cx="10" cy="17" r="0.75" fill="currentColor"/>
      <circle cx="13.5" cy="16.5" r="0.75" fill="currentColor"/>
    `,
    'test-pass': `
      <circle cx="12" cy="12" r="8.5" stroke="var(--status-pass, #3FB950)" stroke-width="1.75" fill="none"/>
      <polyline points="8,12 10.8,14.8 16,9.5" stroke="var(--status-pass, #3FB950)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'test-fail': `
      <circle cx="12" cy="12" r="8.5" stroke="var(--status-fail, #F85149)" stroke-width="1.75" fill="none"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="var(--status-fail, #F85149)" stroke-width="2" stroke-linecap="round"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke="var(--status-fail, #F85149)" stroke-width="2" stroke-linecap="round"/>
    `,
    'debug': `
      <circle cx="12" cy="13" r="5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M12 8 C10 8 9.5 6.5 9.5 5 M12 8 C14 8 14.5 6.5 14.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="12" y1="13" x2="12" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="4.5" y1="11" x2="7.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="19.5" y1="11" x2="16.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="4.5" y1="15" x2="7.2" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="19.5" y1="15" x2="16.8" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'logs': `
      <rect x="3.5" y="4" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="7" y1="8" x2="11" y2="8" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="13" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="7" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="7" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'package': `
      <polygon points="12,3 21,7.5 12,12 3,7.5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polygon points="12,12 21,7.5 21,16.5 12,21" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polygon points="12,12 3,7.5 3,16.5 12,21" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"/>
    `,
    'plugin': `
      <path d="M9 3 V6 H15 V3 M9 21 V18 H15 V21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="10" y1="12" x2="14" y2="12" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'mcp': `
      <rect x="3" y="8" width="6" height="8" rx="1.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <rect x="15" y="8" width="6" height="8" rx="1.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="var(--accent-orange, #E54D2E)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    `,
    'skill': `
      <polygon points="12,2.5 19.5,7 19.5,17 12,21.5 4.5,17 4.5,7" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polygon points="12,6.5 16,9 16,15 12,17.5 8,15 8,9" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
    `,
    'rule': `
      <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="8" y1="7.5" x2="16" y2="7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="11.5" x2="16" y2="11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <polyline points="8,15 9.5,16.5 13,14" stroke="var(--status-pass, #3FB950)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'api': `
      <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="18" cy="7" r="3" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="18" cy="17" r="3" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="9" y1="12" x2="15" y2="8" stroke="currentColor" stroke-width="1.5"/>
      <line x1="9" y1="12" x2="15" y2="16" stroke="currentColor" stroke-width="1.5"/>
    `,

    // -------------------------------------------------------------------------
    // Common Actions
    // -------------------------------------------------------------------------
    'play': `
      <polygon points="7,4 19.5,12 7,20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    `,
    'stop': `
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    `,
    'cancel': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
    `,
    'copy': `
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M5 15.5 H4.5 C3.7 15.5 3 14.8 3 14 V4.5 C3 3.7 3.7 3 4.5 3 H14 C14.8 3 15.5 3.7 15.5 4.5 V5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'check': `
      <polyline points="4.5,12 9.5,17 19.5,7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'download': `
      <path d="M12 3.5 V14.5 M7.5 10.5 L12 15 L16.5 10.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4 17.5 V19 C4 19.8 4.7 20.5 5.5 20.5 H18.5 C19.3 20.5 20 19.8 20 19 V17.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'upload': `
      <path d="M12 15.5 V4.5 M7.5 8.5 L12 4 L16.5 8.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4 17.5 V19 C4 19.8 4.7 20.5 5.5 20.5 H18.5 C19.3 20.5 20 19.8 20 19 V17.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'refresh': `
      <path d="M20 12 A8 8 0 1 1 17.5 6.5 L20 4 V9 H15" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'trash': `
      <path d="M4 6.5 H20 M10 3.5 H14 C14.6 3.5 15 4 15 4.5 V6.5 H9 V4.5 C9 4 9.4 3.5 10 3.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M6 6.5 L7 19.2 C7.1 19.9 7.7 20.5 8.4 20.5 H15.6 C16.3 20.5 16.9 19.9 17 19.2 L18 6.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="10" y1="10.5" x2="10" y2="16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="14" y1="10.5" x2="14" y2="16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'reset': `
      <path d="M3.5 12 A8.5 8.5 0 1 0 6 6 L3.5 3.5 V8.5 H8.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'clear': `
      <path d="M19 6.5 L17.5 5 L6 16.5 L7.5 18 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <path d="M13 10.5 L16.5 14 L12 18.5 H7.5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="12" y1="18.5" x2="20" y2="18.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'external-link': `
      <path d="M14 4 H20 V10 M19 5 L10 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M16 13 V18.5 C16 19.3 15.3 20 14.5 20 H5.5 C4.7 20 4 19.3 4 18.5 V9.5 C4 8.7 4.7 8 5.5 8 H11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
    `,
    'book': `
      <path d="M4 19.5 C4 18.1 5.1 17 6.5 17 H20 V3.5 H6.5 C5.1 3.5 4 4.6 4 6 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <path d="M4 6 V19.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,

    // -------------------------------------------------------------------------
    // Security & Permissions
    // -------------------------------------------------------------------------
    'shield': `
      <path d="M12 2.5 L19.5 5.5 V11.5 C19.5 16.5 16 20.5 12 21.8 C8 20.5 4.5 16.5 4.5 11.5 V5.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    `,
    'shield-check': `
      <path d="M12 2.5 L19.5 5.5 V11.5 C19.5 16.5 16 20.5 12 21.8 C8 20.5 4.5 16.5 4.5 11.5 V5.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <polyline points="8.5,11.5 11,14 15.5,9.5" stroke="var(--status-pass, #3FB950)" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'shield-audit': `
      <path d="M12 2.5 L19.5 5.5 V11.5 C19.5 16.5 16 20.5 12 21.8 C8 20.5 4.5 16.5 4.5 11.5 V5.5 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="9" y1="15" x2="13" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    `,
    'lock': `
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M8 10 V7 C8 4.8 9.8 3 12 3 C14.2 3 16 4.8 16 7 V10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
    `,
    'unlock': `
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M8 10 V7 C8 4.8 9.8 3 12 3 C14.2 3 16 4.8 16 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
    `,

    // -------------------------------------------------------------------------
    // Memory & Context
    // -------------------------------------------------------------------------
    'memory': `
      <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M4 6 V12 C4 13.6 7.6 15 12 15 C16.4 15 20 13.6 20 12 V6" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <path d="M4 12 V18 C4 19.6 7.6 21 12 21 C16.4 21 20 19.6 20 18 V12" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="12" cy="12" r="1" fill="var(--accent-orange, #E54D2E)"/>
    `,

    // -------------------------------------------------------------------------
    // Interface States & Utilities
    // -------------------------------------------------------------------------
    'sun': `
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="2" x2="12" y2="4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="12" y1="19.5" x2="12" y2="22" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="4.5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="19.5" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="4.9" y1="4.9" x2="6.7" y2="6.7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="17.3" y1="17.3" x2="19.1" y2="19.1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="4.9" y1="19.1" x2="6.7" y2="17.3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="17.3" y1="6.7" x2="19.1" y2="4.9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'moon': `
      <path d="M12 3 A9 9 0 0 0 21 12 A9 9 0 1 1 12 3 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
    `,
    'type': `
      <polyline points="4,6 4,4 20,4 20,6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="9" y1="20" x2="15" y2="20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    `,
    'layout': `
      <rect x="3" y="3.5" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="3" y1="8.5" x2="21" y2="8.5" stroke="currentColor" stroke-width="1.75"/>
      <line x1="8.5" y1="8.5" x2="8.5" y2="20.5" stroke="currentColor" stroke-width="1.75"/>
    `,
    'info': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="11" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="12" cy="7.5" r="0.75" fill="currentColor"/>
    `,
    'warning': `
      <polygon points="12,3.5 21.5,19.5 2.5,19.5" stroke="var(--status-pending, #F59E0B)" stroke-width="1.75" stroke-linejoin="round" fill="none"/>
      <line x1="12" y1="9" x2="12" y2="13.5" stroke="var(--status-pending, #F59E0B)" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="12" cy="16.5" r="0.8" fill="var(--status-pending, #F59E0B)"/>
    `,
    'error': `
      <circle cx="12" cy="12" r="8.5" stroke="var(--status-fail, #F85149)" stroke-width="1.75" fill="none"/>
      <line x1="12" y1="7.5" x2="12" y2="12.5" stroke="var(--status-fail, #F85149)" stroke-width="1.85" stroke-linecap="round"/>
      <circle cx="12" cy="16" r="0.8" fill="var(--status-fail, #F85149)"/>
    `,
    'spinner': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" stroke-opacity="0.2" fill="none"/>
      <path d="M12 3.5 A8.5 8.5 0 0 1 20.5 12" stroke="var(--accent-orange, #E54D2E)" stroke-width="2" stroke-linecap="round" fill="none"/>
    `,
    'clock': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <polyline points="12,6.5 12,12 15.5,14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
    'empty-dag': `
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>
      <circle cx="8" cy="9" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <circle cx="16" cy="9" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <circle cx="12" cy="15" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <line x1="9.5" y1="10" x2="11" y2="13.5" stroke="currentColor" stroke-width="1.2"/>
      <line x1="14.5" y1="10" x2="13" y2="13.5" stroke="currentColor" stroke-width="1.2"/>
    `,
    'empty-report': `
      <path d="M6 3.5 H14 L18 7.5 V20.5 H6 Z" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="14" r="3" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5" fill="none"/>
      <line x1="12" y1="12.5" x2="12" y2="15.5" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.5"/>
    `,
    'radar-scan': `
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
      <line x1="12" y1="12" x2="18" y2="6" stroke="var(--accent-orange, #E54D2E)" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    `,
  };

  /**
   * Helper size mapping
   */
  const SIZES = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    empty: 36,
  };

  /**
   * Public API
   */
  const AnvexoIcons = {
    /**
     * Check if icon exists
     */
    has(name) {
      return Object.prototype.hasOwnProperty.call(ICONS, name);
    },

    /**
     * Get all icon names
     */
    list() {
      return Object.keys(ICONS);
    },

    /**
     * Generate SVG string for an icon
     * @param {string} name
     * @param {object} [opts]
     */
    getSvg(name, opts = {}) {
      const inner = ICONS[name] || ICONS['file'];
      const sizeVal = typeof opts.size === 'number'
        ? opts.size
        : (SIZES[opts.size] || 16);
      const cls = opts.className ? `anvexo-icon ${opts.className}` : 'anvexo-icon';
      const ariaHidden = opts.ariaHidden !== false ? 'true' : 'false';
      const titleAttr = opts.title ? `<title>${opts.title}</title>` : '';
      const ariaLabel = opts.ariaLabel ? ` aria-label="${opts.ariaLabel}"` : '';

      return `<svg class="${cls}" viewBox="0 0 24 24" width="${sizeVal}" height="${sizeVal}" fill="none" aria-hidden="${ariaHidden}"${ariaLabel}>${titleAttr}${inner.trim()}</svg>`;
    },

    /**
     * Create an SVG DOM Node
     * @param {string} name
     * @param {object} [opts]
     */
    create(name, opts = {}) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = this.getSvg(name, opts);
      return wrapper.firstElementChild;
    },

    /**
     * Scan and replace all [data-anvexo-icon] placeholders in a container
     * @param {HTMLElement} [root]
     */
    hydrate(root = document) {
      const elements = root.querySelectorAll('[data-anvexo-icon]');
      elements.forEach(el => {
        const name = el.getAttribute('data-anvexo-icon');
        const size = el.getAttribute('data-anvexo-size') || undefined;
        const cls = el.getAttribute('data-anvexo-class') || '';
        const title = el.getAttribute('title') || '';
        const svgString = this.getSvg(name, { size, className: cls, title });
        el.outerHTML = svgString;
      });
    },
  };

  // Export to global and CommonJS/ES module environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnvexoIcons;
  }
  global.AnvexoIcons = AnvexoIcons;

})(typeof window !== 'undefined' ? window : globalThis);
