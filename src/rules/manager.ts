import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RuleDefinition } from '../core/types.js';

export class RuleManager {
  private repoPath?: string;
  private userRulesDir: string;

  constructor(repoPathOrUserDir?: string) {
    if (repoPathOrUserDir && !repoPathOrUserDir.includes('.anvexo')) {
      this.repoPath = repoPathOrUserDir;
      this.userRulesDir = join(homedir(), '.anvexo', 'rules');
    } else {
      this.userRulesDir = repoPathOrUserDir || join(homedir(), '.anvexo', 'rules');
    }
  }

  getSystemRules(): RuleDefinition[] {
    return [
      {
        id: 'system-safety-zero-leakage',
        title: 'Secret Redaction and Zero Leakage',
        scope: 'system',
        content: 'Never output, log, or persist private API keys, tokens, passwords, or credentials.',
        priority: 100,
        enabled: true,
      },
      {
        id: 'system-safety-boundary-containment',
        title: 'Path Traversal Defense and Boundary Containment',
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
      {
        id: 'system-safety-bounded-execution',
        title: 'Bounded Execution Loop',
        scope: 'system',
        content: 'Always enforce maximum iteration bounds and timeout checks to prevent infinite agent execution loops.',
        priority: 100,
        enabled: true,
      },
    ];
  }

  listProjectRules(repoPath?: string): RuleDefinition[] {
    const targetRepo = repoPath || this.repoPath;
    const rules: RuleDefinition[] = [];
    if (!targetRepo) {
      return rules;
    }
    const projectDir = join(targetRepo, '.anvexo', 'rules');
    if (!existsSync(projectDir)) {
      return rules;
    }
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(projectDir, entry.name);
        const content = readFileSync(filePath, 'utf-8');
        const id = entry.name.replace(/\.md$/, '');
        let title = id;
        let priority = 10;
        const trimmed = content.trim();
        if (trimmed.startsWith('---')) {
          const secondDelim = trimmed.indexOf('---', 3);
          if (secondDelim !== -1) {
            const fm = trimmed.slice(3, secondDelim);
            for (const line of fm.split('\n')) {
              const colon = line.indexOf(':');
              if (colon !== -1) {
                const k = line.slice(0, colon).trim().toLowerCase();
                const v = line.slice(colon + 1).trim();
                if (k === 'title') title = v;
                if (k === 'priority') priority = parseInt(v, 10) || 10;
              }
            }
          }
        }
        rules.push({
          id,
          title,
          scope: 'project',
          content: content.trim(),
          path: filePath,
          priority,
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
        let title = id;
        let priority = 50;
        const trimmed = content.trim();
        if (trimmed.startsWith('---')) {
          const secondDelim = trimmed.indexOf('---', 3);
          if (secondDelim !== -1) {
            const fm = trimmed.slice(3, secondDelim);
            for (const line of fm.split('\n')) {
              const colon = line.indexOf(':');
              if (colon !== -1) {
                const k = line.slice(0, colon).trim().toLowerCase();
                const v = line.slice(colon + 1).trim();
                if (k === 'title') title = v;
                if (k === 'priority') priority = parseInt(v, 10) || 50;
              }
            }
          }
        }
        rules.push({
          id,
          title,
          scope: 'user',
          content: content.trim(),
          path: filePath,
          priority,
          enabled: true,
        });
      }
    }
    return rules;
  }

  listAllRules(repoPath?: string): RuleDefinition[] {
    const targetRepo = repoPath || this.repoPath;
    const rules = [...this.getSystemRules()];
    rules.push(...this.listUserRules());
    if (targetRepo) {
      rules.push(...this.listProjectRules(targetRepo));
    }
    return rules.sort((a, b) => b.priority - a.priority);
  }

  async listRules(repoPath?: string): Promise<RuleDefinition[]> {
    return this.listAllRules(repoPath);
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
