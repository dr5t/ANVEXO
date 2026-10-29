import { describe, it, expect } from 'vitest';
import { createInvestigationPlan } from '../../src/planner/index.js';
import type { ProjectMetadata } from '../../src/core/types.js';

describe('createInvestigationPlan', () => {
  const baseProject: ProjectMetadata = {
    rootPath: '/test/project',
    name: 'test-project',
    languages: ['typescript'],
    frameworks: ['vite'],
    packageManager: 'npm',
    testRunner: 'vitest',
    hasGit: true,
    configFiles: ['package.json', 'tsconfig.json'],
    entryPoints: ['src/index.ts'],
  };

  it('creates a plan with file listing step', () => {
    const plan = createInvestigationPlan('Check project health', baseProject);
    const fileListStep = plan.steps.find(s => s.toolName === 'file_list');
    expect(fileListStep).toBeDefined();
    expect(fileListStep!.status).toBe('pending');
  });

  it('includes git steps when project has git', () => {
    const plan = createInvestigationPlan('Check project', baseProject);
    const gitSteps = plan.steps.filter(s => s.toolName.startsWith('git_'));
    expect(gitSteps.length).toBeGreaterThanOrEqual(2);
  });

  it('excludes git steps when project has no git', () => {
    const noGitProject = { ...baseProject, hasGit: false };
    const plan = createInvestigationPlan('Check project', noGitProject);
    const gitSteps = plan.steps.filter(s => s.toolName.startsWith('git_'));
    expect(gitSteps.length).toBe(0);
  });

  it('includes config file reading steps', () => {
    const plan = createInvestigationPlan('Check project', baseProject);
    const readSteps = plan.steps.filter(s =>
      s.toolName === 'file_read' && s.description.includes('configuration'),
    );
    expect(readSteps.length).toBe(2);
  });

  it('includes entry point reading steps', () => {
    const plan = createInvestigationPlan('Check project', baseProject);
    const entrySteps = plan.steps.filter(s =>
      s.toolName === 'file_read' && s.description.includes('entry point'),
    );
    expect(entrySteps.length).toBe(1);
  });

  it('includes test execution when test runner detected', () => {
    const plan = createInvestigationPlan('Check project', baseProject);
    const testStep = plan.steps.find(s => s.toolName === 'run_command');
    expect(testStep).toBeDefined();
    expect(testStep!.description).toContain('vitest');
  });

  it('excludes test step when no test runner', () => {
    const noTestProject = { ...baseProject, testRunner: undefined };
    const plan = createInvestigationPlan('Check project', noTestProject);
    const testStep = plan.steps.find(s => s.toolName === 'run_command');
    expect(testStep).toBeUndefined();
  });

  it('extracts keywords from objective for search steps', () => {
    const plan = createInvestigationPlan('Why does authentication fail intermittently', baseProject);
    const searchSteps = plan.steps.filter(s => s.toolName === 'file_search');
    expect(searchSteps.length).toBeGreaterThan(0);
    const searchTerms = searchSteps.map(s => (s.toolArgs.pattern as string).toLowerCase());
    expect(searchTerms.some(t => t.includes('authentication') || t.includes('fail') || t.includes('intermittent'))).toBe(true);
  });

  it('stores objective in plan', () => {
    const plan = createInvestigationPlan('My objective', baseProject);
    expect(plan.objective).toBe('My objective');
  });

  it('assigns unique IDs to all steps', () => {
    const plan = createInvestigationPlan('Check project', baseProject);
    const ids = new Set(plan.steps.map(s => s.id));
    expect(ids.size).toBe(plan.steps.length);
  });
});
