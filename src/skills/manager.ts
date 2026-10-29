import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillDefinition } from '../core/types.js';
import { parseSkillMarkdown } from './parser.js';

export class SkillManager {
  private repoPath?: string;
  private userSkillsDir: string;
  private builtinSkillsDir: string;

  constructor(repoPathOrUserDir?: string) {
    if (repoPathOrUserDir && !repoPathOrUserDir.includes('.anvexo')) {
      this.repoPath = repoPathOrUserDir;
      this.userSkillsDir = join(homedir(), '.anvexo', 'skills');
    } else {
      this.userSkillsDir = repoPathOrUserDir || join(homedir(), '.anvexo', 'skills');
    }
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const localBuiltin = join(currentDir, 'builtin');
    const fallbackBuiltin = join(currentDir, '../../src/skills/builtin');
    this.builtinSkillsDir = existsSync(localBuiltin) ? localBuiltin : fallbackBuiltin;
  }

  listBuiltinSkills(): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    if (!existsSync(this.builtinSkillsDir)) {
      return skills;
    }
    const entries = readdirSync(this.builtinSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(this.builtinSkillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          skills.push(parseSkillMarkdown(content, entry.name, 'built-in', skillFile));
        }
      }
    }
    return skills;
  }

  listProjectSkills(repoPath?: string): SkillDefinition[] {
    const targetRepo = repoPath || this.repoPath;
    const skills: SkillDefinition[] = [];
    if (!targetRepo) {
      return skills;
    }
    const projectDir = join(targetRepo, '.anvexo', 'skills');
    if (!existsSync(projectDir)) {
      return skills;
    }
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(projectDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          skills.push(parseSkillMarkdown(content, entry.name, 'workspace', skillFile));
        }
      }
    }
    return skills;
  }

  listUserSkills(): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    if (!existsSync(this.userSkillsDir)) {
      return skills;
    }
    const entries = readdirSync(this.userSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(this.userSkillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          skills.push(parseSkillMarkdown(content, entry.name, 'user', skillFile));
        }
      }
    }
    return skills;
  }

  listAllSkills(repoPath?: string): SkillDefinition[] {
    const targetRepo = repoPath || this.repoPath;
    const map = new Map<string, SkillDefinition>();

    for (const s of this.listBuiltinSkills()) {
      map.set(s.id, s);
    }

    for (const s of this.listUserSkills()) {
      map.set(s.id, s);
    }

    if (targetRepo) {
      for (const s of this.listProjectSkills(targetRepo)) {
        map.set(s.id, s);
      }
    }

    return Array.from(map.values());
  }

  async listSkills(repoPath?: string): Promise<SkillDefinition[]> {
    return this.listAllSkills(repoPath);
  }

  getSkill(id: string, repoPath?: string): SkillDefinition | undefined {
    const all = this.listAllSkills(repoPath);
    return all.find((s) => s.id === id || s.name.toLowerCase() === id.toLowerCase());
  }
}
