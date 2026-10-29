import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RuleDefinition, RuleScope } from '../core/types.js';

export class RuleManager {
  private userRulesDir: string;

  constructor(customUserDir?: string) {
    this.userRulesDir = customUserDir || join(homedir(), '.anvexo', 'rules');
  }

  getSystemRules(): RuleDefinition[] {
    return [
      {
        id: 'system-safety-zero-leakage',
        title: 'Zero Secret and Credential Leakage',
        scope: 'system',
        content: 'Never output, log, or persist private API keys, tokens, passwords, or credentials.',
        priority: 100,
        enabled: true,
      },
      {
        id: 'system-safety-boundary-containment',
        title: 'Filesystem Boundary Containment',
        scope: 'system',
        content: 'All filesystem modifications and read operations must be strictly contained within authorized repository root boundaries.',
        priority: 100,
        enabled: true,
      },
      {
        id: 'system-safety-deterministic-verification',
        title: 'Evidence-Based Verification',
        scope: 'system',
        content: 'Never claim a test passed, a bug was fixed, or a file was inspected without observed tool execution output.',
        priority: 100,
        enabled: true,
      },
    ];
  }

  listProjectRules(repoPath: string): RuleDefinition[] {
    const rules: RuleDefinition[] = [];
    const projectDir = join(repoPath, '.anvexo', 'rules');
    if (!existsSync(projectDir)) {
      return rules;
    }
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(projectDir, entry.name);
        const content = readFileSync(filePath, 'utf-8');
        const id = entry.name.replace(/\.md$/, '');
        const titleLine = content.split('\n')[0] || id;
        const title = titleLine.replace(/^#+\s*/, '').trim() || id;
        rules.push({
          id,
          title,
          scope: 'project',
          content: content.trim(),
          path: filePath,
          priority: 10,
          enabled: true,
        });
      }
    }
    return rules;
  }

  listUserRules(): RuleDefinition[] {
    const rules: RuleDefinition[] = [];
    if (!existsSync(this.userRulesDir)) {
      return rules;
    }
    const entries = readdirSync(this.userRulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(this.userRulesDir, entry.name);
        const content = readFileSync(filePath, 'utf-8');
        const id = entry.name.replace(/\.md$/, '');
        const titleLine = content.split('\n')[0] || id;
        const title = titleLine.replace(/^#+\s*/, '').trim() || id;
        rules.push({
          id,
          title,
          scope: 'user',
          content: content.trim(),
          path: filePath,
          priority: 50,
          enabled: true,
        });
      }
    }
    return rules;
  }

  listAllRules(repoPath?: string): RuleDefinition[] {
    const rules = [...this.getSystemRules()];
    rules.push(...this.listUserRules());
    if (repoPath) {
      rules.push(...this.listProjectRules(repoPath));
    }
    return rules.sort((a, b) => b.priority - a.priority);
  }

  buildSystemPrompt(repoPath?: string): string {
    const rules = this.listAllRules(repoPath).filter((r) => r.enabled);
    if (rules.length === 0) {
      return '';
    }
    const lines = rules.map((r) => `[RULE: ${r.title} (${r.scope.toUpperCase()})]\n${r.content}`);
    return `ACTIVE GOVERNING RULES:\n${lines.join('\n\n')}`;
  }
}
