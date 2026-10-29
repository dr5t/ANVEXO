import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RuleManager } from '../../src/rules/index.js';

describe('Rules Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-rules-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('lists default system safety rules with highest priority (100)', async () => {
    const rm = new RuleManager(tempDir);
    const rules = await rm.listRules();
    expect(rules.length).toBeGreaterThan(0);

    const systemRules = rules.filter((r) => r.scope === 'system');
    expect(systemRules.length).toBeGreaterThanOrEqual(4);
    for (const r of systemRules) {
      expect(r.priority).toBe(100);
    }
  });

  it('orders rules strictly by priority descending', async () => {
    const workspaceRulesDir = path.join(tempDir, '.anvexo', 'rules');
    fs.mkdirSync(workspaceRulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceRulesDir, 'workspace-rule.md'),
      '---\nid: workspace-rule\ntitle: Workspace Rule\npriority: 15\nscope: workspace\n---\nWorkspace specific constraint\n',
      'utf-8',
    );

    const rm = new RuleManager(tempDir);
    const rules = await rm.listRules();
    expect(rules[0].priority).toBe(100);
    const last = rules[rules.length - 1];
    expect(last.id).toBe('workspace-rule');
    expect(last.priority).toBe(15);
  });

  it('builds comprehensive system prompt with all active rules', async () => {
    const rm = new RuleManager(tempDir);
    await rm.listRules();
    const prompt = rm.buildSystemPrompt();
    expect(prompt).toContain('GOVERNING RULES');
    expect(prompt).toContain('Path Traversal Defense');
    expect(prompt).toContain('Secret Redaction');
  });
});
