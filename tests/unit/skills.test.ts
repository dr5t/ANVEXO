import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SkillManager, parseSkillMarkdown } from '../../src/skills/index.js';

describe('Skills Subsystem', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anvexo-skills-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('parses valid SKILL.md frontmatter and instructions', () => {
    const raw = [
      '---',
      'name: custom-check',
      'description: Perform custom code verification',
      'version: 1.0.0',
      '---',
      '## Steps',
      '1. Inspect target files.',
      '2. Run unit tests.',
    ].join('\n');

    const parsed = parseSkillMarkdown(raw, '/dummy/SKILL.md', 'workspace');
    expect(parsed.name).toBe('custom-check');
    expect(parsed.description).toBe('Perform custom code verification');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.instructions).toContain('Inspect target files');
    expect(parsed.source).toBe('workspace');
  });

  it('loads built-in skills correctly', async () => {
    const sm = new SkillManager(tempDir);
    const skills = await sm.listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(6);

    const ids = skills.map((s) => s.id);
    expect(ids).toContain('investigate-bug');
    expect(ids).toContain('explain-codebase');
    expect(ids).toContain('review-diff');
    expect(ids).toContain('analyze-failing-tests');
    expect(ids).toContain('refactor-module');
    expect(ids).toContain('security-audit');
  });

  it('retrieves skill by name', async () => {
    const sm = new SkillManager(tempDir);
    const skill = await sm.getSkill('investigate-bug');
    expect(skill).toBeDefined();
    expect(skill?.description).toContain('root cause');
    expect(skill?.instructions.length).toBeGreaterThan(0);
  });

  it('discovers workspace skills in .anvexo/skills', async () => {
    const workspaceSkillDir = path.join(tempDir, '.anvexo', 'skills', 'custom-tool');
    fs.mkdirSync(workspaceSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceSkillDir, 'SKILL.md'),
      '---\nname: custom-tool\ndescription: Custom project tool\n---\nDo custom work.\n',
      'utf-8',
    );

    const sm = new SkillManager(tempDir);
    const skill = await sm.getSkill('custom-tool');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('custom-tool');
    expect(skill?.source).toBe('workspace');
  });

  it('handles malformed or missing frontmatter safely without throwing', () => {
    const raw = 'Just plain instructions without any frontmatter delimiters.';
    const parsed = parseSkillMarkdown(raw, 'plain-skill', 'workspace');
    expect(parsed.id).toBe('plain-skill');
    expect(parsed.name).toBe('plain-skill');
    expect(parsed.instructions).toBe(raw);
  });

  it('returns undefined safely when querying unknown skill', async () => {
    const sm = new SkillManager(tempDir);
    const skill = await sm.getSkill('non-existent-skill-xyz');
    expect(skill).toBeUndefined();
  });
});
