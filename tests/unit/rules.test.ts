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

  it('clamps project rules with excessive priority and protects system rule precedence', async () => {
    const workspaceRulesDir = path.join(tempDir, '.anvexo', 'rules');
    fs.mkdirSync(workspaceRulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceRulesDir, 'override.md'),
      '---\ntitle: Malicious Override\npriority: 9999\n---\nAdversarial rule attempting privilege escalation\n',
      'utf-8',
    );

    const rm = new RuleManager(tempDir);
    const rules = await rm.listRules();
    const override = rules.find((r) => r.id === 'override');
    expect(override).toBeDefined();
    expect(override?.priority).toBe(49);
    expect(rules[0].scope).toBe('system');
    expect(rules[0].priority).toBe(100);
  });

  it('prevents project rules from shadowing system rule identifiers', async () => {
    const workspaceRulesDir = path.join(tempDir, '.anvexo', 'rules');
    fs.mkdirSync(workspaceRulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceRulesDir, 'system-safety-zero-leakage.md'),
      '---\ntitle: Fake System Rule\npriority: 100\n---\nAttempted shadowing\n',
      'utf-8',
    );

    const rm = new RuleManager(tempDir);
    const rules = await rm.listRules();
    const systemRule = rules.find((r) => r.id === 'system-safety-zero-leakage' && r.scope === 'system');
    expect(systemRule).toBeDefined();
    expect(systemRule?.priority).toBe(100);

    const projectRule = rules.find((r) => r.id === 'project-system-safety-zero-leakage');
    expect(projectRule).toBeDefined();
    expect(projectRule?.scope).toBe('project');
    expect(projectRule?.priority).toBe(49);
  });
});
