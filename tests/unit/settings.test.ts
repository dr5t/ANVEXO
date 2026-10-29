import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { AnvexoServer } from '../../src/server/index.js';

function requestGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Host: parsed.host,
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

interface IdeSettings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
  tabSize: string;
  wordWrap: boolean;
  lineNumbers: boolean;
  showSidebar: boolean;
  showBottomDrawer: boolean;
  sidebarWidth: number;
  defaultPath: string;
}

const DEFAULT_SETTINGS: IdeSettings = {
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

const VALID_THEMES = [
  'obsidian-slate',
  'midnight-graphite',
  'nord',
  'solarized-dark',
  'light-studio',
  'high-contrast',
];

const VALID_FONTS = [
  'JetBrains Mono',
  'IBM Plex Mono',
  'Fira Code',
  'Inter',
  'System Monospace',
];

function validateSettings(input: unknown): IdeSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const raw = input as Record<string, unknown>;
  const res: IdeSettings = { ...DEFAULT_SETTINGS };

  if (typeof raw.theme === 'string' && VALID_THEMES.includes(raw.theme)) {
    res.theme = raw.theme;
  }
  if (typeof raw.fontFamily === 'string' && VALID_FONTS.includes(raw.fontFamily)) {
    res.fontFamily = raw.fontFamily;
  }
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 11 && raw.fontSize <= 18) {
    res.fontSize = raw.fontSize;
  }
  if (typeof raw.lineHeight === 'number' && raw.lineHeight >= 1.2 && raw.lineHeight <= 2.0) {
    res.lineHeight = raw.lineHeight;
  }
  if (['400', '500', '600'].includes(String(raw.fontWeight))) {
    res.fontWeight = String(raw.fontWeight);
  }
  if (['2', '4', '8'].includes(String(raw.tabSize))) {
    res.tabSize = String(raw.tabSize);
  }
  if (typeof raw.wordWrap === 'boolean') {
    res.wordWrap = raw.wordWrap;
  }
  if (typeof raw.lineNumbers === 'boolean') {
    res.lineNumbers = raw.lineNumbers;
  }
  if (typeof raw.showSidebar === 'boolean') {
    res.showSidebar = raw.showSidebar;
  }
  if (typeof raw.showBottomDrawer === 'boolean') {
    res.showBottomDrawer = raw.showBottomDrawer;
  }
  if (typeof raw.sidebarWidth === 'number' && raw.sidebarWidth >= 240 && raw.sidebarWidth <= 650) {
    res.sidebarWidth = raw.sidebarWidth;
  }
  if (typeof raw.defaultPath === 'string' && raw.defaultPath.trim().length > 0) {
    res.defaultPath = raw.defaultPath.trim();
  }
  return res;
}

describe('IDE Settings & Branding Validation', () => {
  describe('Settings Schema & Validation Logic', () => {
    it('returns default settings when given null or non-object', () => {
      expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(validateSettings('invalid')).toEqual(DEFAULT_SETTINGS);
      expect(validateSettings(123)).toEqual(DEFAULT_SETTINGS);
    });

    it('accepts all 6 supported IDE themes', () => {
      for (const theme of VALID_THEMES) {
        const validated = validateSettings({ theme });
        expect(validated.theme).toBe(theme);
      }
    });

    it('falls back to default obsidian-slate for unknown theme', () => {
      const validated = validateSettings({ theme: 'rainbow-neon-glow' });
      expect(validated.theme).toBe('obsidian-slate');
    });

    it('accepts all supported monospace and UI fonts', () => {
      for (const font of VALID_FONTS) {
        const validated = validateSettings({ fontFamily: font });
        expect(validated.fontFamily).toBe(font);
      }
    });

    it('falls back to JetBrains Mono for invalid font family', () => {
      const validated = validateSettings({ fontFamily: 'Comic Sans MS' });
      expect(validated.fontFamily).toBe('JetBrains Mono');
    });

    it('clamps or falls back for out of range font sizes', () => {
      expect(validateSettings({ fontSize: 10 }).fontSize).toBe(12.5);
      expect(validateSettings({ fontSize: 25 }).fontSize).toBe(12.5);
      expect(validateSettings({ fontSize: 14 }).fontSize).toBe(14);
    });

    it('validates line height range within 1.2 and 2.0', () => {
      expect(validateSettings({ lineHeight: 0.8 }).lineHeight).toBe(1.55);
      expect(validateSettings({ lineHeight: 2.5 }).lineHeight).toBe(1.55);
      expect(validateSettings({ lineHeight: 1.75 }).lineHeight).toBe(1.75);
    });

    it('validates tab sizes 2, 4, and 8', () => {
      expect(validateSettings({ tabSize: '4' }).tabSize).toBe('4');
      expect(validateSettings({ tabSize: '8' }).tabSize).toBe('8');
      expect(validateSettings({ tabSize: '16' }).tabSize).toBe('2');
    });

    it('validates layout booleans and dimensions', () => {
      const custom = validateSettings({
        showSidebar: false,
        showBottomDrawer: false,
        sidebarWidth: 420,
        wordWrap: false,
        lineNumbers: false,
      });
      expect(custom.showSidebar).toBe(false);
      expect(custom.showBottomDrawer).toBe(false);
      expect(custom.sidebarWidth).toBe(420);
      expect(custom.wordWrap).toBe(false);
      expect(custom.lineNumbers).toBe(false);
    });
  });

  describe('Brand & Static Asset Delivery', () => {
    let server: AnvexoServer;
    let baseUrl: string;

    beforeEach(async () => {
      server = new AnvexoServer({ port: 0, host: '127.0.0.1' });
      const info = await server.start();
      baseUrl = info.url;
    });

    afterEach(async () => {
      await server.stop();
    });

    it('serves favicon.svg with image/svg+xml content-type', async () => {
      const res = await requestGet(`${baseUrl}/favicon.svg`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      expect(res.body).toContain('<svg');
    });

    it('serves anvexo-symbol.svg with valid geometry', async () => {
      const res = await requestGet(`${baseUrl}/brand/anvexo-symbol.svg`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      expect(res.body).toContain('<svg');
      expect(res.body).toContain('polygon');
    });

    it('serves anvexo-logo-dark.svg and anvexo-logo-light.svg', async () => {
      const darkRes = await requestGet(`${baseUrl}/brand/anvexo-logo-dark.svg`);
      expect(darkRes.status).toBe(200);
      expect(darkRes.headers['content-type']).toContain('image/svg+xml');
      expect(darkRes.body).toContain('ANVEXO');

      const lightRes = await requestGet(`${baseUrl}/brand/anvexo-logo-light.svg`);
      expect(lightRes.status).toBe(200);
      expect(lightRes.headers['content-type']).toContain('image/svg+xml');
      expect(lightRes.body).toContain('ANVEXO');
    });

    it('serves index.html referencing the settings dialog and 6 themes', async () => {
      const res = await requestGet(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('settingsModalOverlay');
      expect(res.body).toContain('obsidian-slate');
      expect(res.body).toContain('midnight-graphite');
      expect(res.body).toContain('nord');
      expect(res.body).toContain('solarized-dark');
      expect(res.body).toContain('light-studio');
      expect(res.body).toContain('high-contrast');
    });

    it('serves styles.css containing theme tokens for all 6 themes', async () => {
      const res = await requestGet(`${baseUrl}/styles.css`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('[data-theme="obsidian-slate"]');
      expect(res.body).toContain('[data-theme="midnight-graphite"]');
      expect(res.body).toContain('[data-theme="nord"]');
      expect(res.body).toContain('[data-theme="solarized-dark"]');
      expect(res.body).toContain('[data-theme="light-studio"]');
      expect(res.body).toContain('[data-theme="high-contrast"]');
    });
  });
});
