import { randomUUID } from 'node:crypto';
import type { InvestigationPlan, InvestigationStep, ProjectMetadata } from '../core/index.js';
import { PermissionScope, logger } from '../core/index.js';

export function createInvestigationPlan(
  objective: string,
  project: ProjectMetadata,
): InvestigationPlan {
  logger.info('planner', `Creating plan for: ${objective}`);
  const steps: InvestigationStep[] = [];

  steps.push(makeStep(
    'List project files and directory structure',
    'file_list',
    { path: project.rootPath, maxDepth: 3 },
    PermissionScope.FILE_READ,
  ));

  if (project.hasGit) {
    steps.push(makeStep(
      'Check Git status for uncommitted changes',
      'git_status',
      { path: project.rootPath },
      PermissionScope.GIT_READ,
    ));

    steps.push(makeStep(
      'Review recent Git commit history',
      'git_log',
      { path: project.rootPath, count: 20 },
      PermissionScope.GIT_READ,
    ));

    steps.push(makeStep(
      'Check for unstaged changes',
      'git_diff',
      { path: project.rootPath },
      PermissionScope.GIT_READ,
    ));
  }

  for (const configFile of project.configFiles.slice(0, 5)) {
    steps.push(makeStep(
      `Read configuration file: ${configFile}`,
      'file_read',
      { path: `${project.rootPath}/${configFile}` },
      PermissionScope.FILE_READ,
    ));
  }

  for (const entry of project.entryPoints.slice(0, 3)) {
    steps.push(makeStep(
      `Read entry point: ${entry}`,
      'file_read',
      { path: `${project.rootPath}/${entry}` },
      PermissionScope.FILE_READ,
    ));
  }

  const keywords = extractKeywords(objective);
  if (keywords.length > 0) {
    for (const kw of keywords.slice(0, 3)) {
      steps.push(makeStep(
        `Search codebase for: ${kw}`,
        'file_search',
        { path: project.rootPath, pattern: kw },
        PermissionScope.FILE_READ,
      ));
    }
  }

  if (project.testRunner) {
    const testCmd = getTestCommand(project);
    if (testCmd) {
      steps.push(makeStep(
        `Run existing tests using ${project.testRunner}`,
        'run_command',
        { path: project.rootPath, command: testCmd, timeout: 60000 },
        PermissionScope.TEST_RUN,
      ));
    }
  }

  logger.info('planner', `Created plan with ${steps.length} steps`);
  return { objective, steps, createdAt: new Date() };
}

function makeStep(
  description: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  requiredPermission: PermissionScope,
): InvestigationStep {
  return {
    id: randomUUID(),
    description,
    toolName,
    toolArgs,
    requiredPermission,
    status: 'pending',
    evidenceIds: [],
  };
}

function extractKeywords(objective: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must',
    'and', 'or', 'but', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'of', 'about',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
    'if', 'then', 'when', 'where', 'how', 'why', 'what', 'which', 'who',
    'investigate', 'find', 'check', 'fix', 'debug', 'look', 'identify',
    'determine', 'analyze', 'understand', 'verify', 'test', 'run',
  ]);

  return objective
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 10);
}

function getTestCommand(project: ProjectMetadata): string | null {
  switch (project.testRunner) {
    case 'vitest': return 'npx vitest run --reporter=verbose';
    case 'jest': return 'npx jest --verbose --no-coverage';
    case 'mocha': return 'npx mocha --reporter spec';
    case 'pytest': return 'python -m pytest -v';
    case 'cargo': return 'cargo test';
    case 'ava': return 'npx ava --verbose';
    default: return null;
  }
}
