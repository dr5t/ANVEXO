import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillDefinition } from '../core/types.js';
import { parseSkillMarkdown } from './parser.js';

export class SkillManager {
  private userSkillsDir: string;
  private builtinSkillsDir: string;

  constructor(customUserDir?: string) {
    this.userSkillsDir = customUserDir || join(homedir(), '.anvexo', 'skills');
    const currentDir = dirname(fileURLToPath(import.meta.url));
    this.builtinSkillsDir = join(currentDir, 'builtin');
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

  listProjectSkills(repoPath: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    const projectDir = join(repoPath, '.anvexo', 'skills');
    if (!existsSync(projectDir)) {
      return skills;
    }
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(projectDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          skills.push(parseSkillMarkdown(content, entry.name, 'project', skillFile));
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
    const map = new Map<string, SkillDefinition>();

    for (const s of this.listBuiltinSkills()) {
      map.set(s.id, s);
    }

    for (const s of this.listUserSkills()) {
      map.set(s.id, s);
    }

    if (repoPath) {
      for (const s of this.listProjectSkills(repoPath)) {
        map.set(s.id, s);
      }
    }

    return Array.from(map.values());
  }

  getSkill(id: string, repoPath?: string): SkillDefinition | undefined {
    const all = this.listAllSkills(repoPath);
    return all.find((s) => s.id === id || s.name.toLowerCase() === id.toLowerCase());
  }
}
