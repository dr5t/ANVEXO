import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectMetadata } from '../core/index.js';
import { logger } from '../core/index.js';

interface DetectionRule {
  file: string;
  language?: string;
  framework?: string;
  packageManager?: string;
  testRunner?: string;
}

const DETECTION_RULES: DetectionRule[] = [
  { file: 'package.json', language: 'javascript' },
  { file: 'tsconfig.json', language: 'typescript' },
  { file: 'pyproject.toml', language: 'python' },
  { file: 'setup.py', language: 'python' },
  { file: 'requirements.txt', language: 'python', packageManager: 'pip' },
  { file: 'Pipfile', language: 'python', packageManager: 'pipenv' },
  { file: 'Cargo.toml', language: 'rust', packageManager: 'cargo' },
  { file: 'go.mod', language: 'go' },
  { file: 'pom.xml', language: 'java', packageManager: 'maven' },
  { file: 'build.gradle', language: 'java', packageManager: 'gradle' },
  { file: 'build.gradle.kts', language: 'kotlin', packageManager: 'gradle' },
  { file: 'Gemfile', language: 'ruby', packageManager: 'bundler' },
  { file: 'composer.json', language: 'php', packageManager: 'composer' },
  { file: 'Package.swift', language: 'swift', packageManager: 'spm' },
  { file: 'CMakeLists.txt', language: 'c/c++', packageManager: 'cmake' },
  { file: 'Makefile', language: 'c/c++' },
  { file: '.csproj', language: 'csharp', packageManager: 'dotnet' },
  { file: 'next.config.js', framework: 'nextjs' },
  { file: 'next.config.ts', framework: 'nextjs' },
  { file: 'next.config.mjs', framework: 'nextjs' },
  { file: 'vite.config.ts', framework: 'vite' },
  { file: 'vite.config.js', framework: 'vite' },
  { file: 'angular.json', framework: 'angular' },
  { file: 'svelte.config.js', framework: 'svelte' },
  { file: 'vue.config.js', framework: 'vue' },
  { file: 'nuxt.config.ts', framework: 'nuxt' },
  { file: 'remix.config.js', framework: 'remix' },
  { file: 'astro.config.mjs', framework: 'astro' },
  { file: 'django-admin.py', framework: 'django' },
  { file: 'manage.py', framework: 'django' },
  { file: 'Dockerfile', framework: 'docker' },
  { file: 'docker-compose.yml', framework: 'docker-compose' },
  { file: 'docker-compose.yaml', framework: 'docker-compose' },
  { file: 'jest.config.js', testRunner: 'jest' },
  { file: 'jest.config.ts', testRunner: 'jest' },
  { file: 'vitest.config.ts', testRunner: 'vitest' },
  { file: 'vitest.config.js', testRunner: 'vitest' },
  { file: 'pytest.ini', testRunner: 'pytest' },
  { file: 'setup.cfg', testRunner: 'pytest' },
  { file: '.mocharc.yml', testRunner: 'mocha' },
  { file: 'karma.conf.js', testRunner: 'karma' },
  { file: 'yarn.lock', packageManager: 'yarn' },
  { file: 'pnpm-lock.yaml', packageManager: 'pnpm' },
  { file: 'package-lock.json', packageManager: 'npm' },
  { file: 'bun.lockb', packageManager: 'bun' },
];

export async function discoverProject(rootPath: string): Promise<ProjectMetadata> {
  const resolved = path.resolve(rootPath);
  logger.info('discovery', `Discovering project at ${resolved}`);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const configFiles: string[] = [];
  let packageManager: string | undefined;
  let testRunner: string | undefined;

  for (const rule of DETECTION_RULES) {
    const filePath = path.join(resolved, rule.file);
    if (fs.existsSync(filePath)) {
      configFiles.push(rule.file);
      if (rule.language) languages.add(rule.language);
      if (rule.framework) frameworks.add(rule.framework);
      if (rule.packageManager && !packageManager) packageManager = rule.packageManager;
      if (rule.testRunner && !testRunner) testRunner = rule.testRunner;
    }
  }

  if (languages.size === 0) {
    const extensions = scanFileExtensions(resolved, 2);
    for (const [ext, count] of extensions) {
      if (count >= 1) {
        const lang = EXTENSION_MAP[ext];
        if (lang) languages.add(lang);
      }
    }
  }

  const hasGit = fs.existsSync(path.join(resolved, '.git'));
  const name = extractProjectName(resolved);
  const entryPoints = detectEntryPoints(resolved);

  if (configFiles.includes('package.json')) {
    const pkgData = parsePackageJson(resolved);
    if (pkgData) {
      if (pkgData.testRunner && !testRunner) testRunner = pkgData.testRunner;
      for (const fw of pkgData.frameworks) frameworks.add(fw);
    }
  }

  const result: ProjectMetadata = {
    rootPath: resolved,
    name,
    languages: [...languages],
    frameworks: [...frameworks],
    packageManager,
    testRunner,
    hasGit,
    configFiles,
    entryPoints,
  };

  logger.info('discovery', `Detected: languages=[${result.languages}] frameworks=[${result.frameworks}] pm=${result.packageManager} test=${result.testRunner} git=${result.hasGit}`);
  return result;
}

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rs': 'rust',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c', '.h': 'c',
  '.cpp': 'c++', '.cc': 'c++', '.hpp': 'c++',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

function scanFileExtensions(dir: string, maxDepth: number): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(d: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'vendor' || e.name === '__pycache__' || e.name === 'dist' || e.name === 'build') continue;
      if (e.isDirectory()) {
        walk(path.join(d, e.name), depth + 1);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (ext) counts.set(ext, (counts.get(ext) || 0) + 1);
      }
    }
  }

  walk(dir, 0);
  return counts;
}

function extractProjectName(rootPath: string): string {
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {}
  }

  const cargoPath = path.join(rootPath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf-8');
      const match = content.match(/name\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    } catch {}
  }

  return path.basename(rootPath);
}

function detectEntryPoints(rootPath: string): string[] {
  const candidates = [
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
    'src/app.ts', 'src/app.js', 'index.ts', 'index.js',
    'main.py', 'app.py', 'src/main.py', 'src/app.py',
    'main.go', 'cmd/main.go',
    'src/main.rs', 'src/lib.rs',
    'src/main/java', 'src/Main.java',
  ];

  return candidates.filter(c => fs.existsSync(path.join(rootPath, c)));
}

function parsePackageJson(rootPath: string): { testRunner?: string; frameworks: string[] } | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf-8'));
    const frameworks: string[] = [];
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.react) frameworks.push('react');
    if (allDeps.express) frameworks.push('express');
    if (allDeps.fastify) frameworks.push('fastify');
    if (allDeps.koa) frameworks.push('koa');
    if (allDeps.nest || allDeps['@nestjs/core']) frameworks.push('nestjs');
    if (allDeps.electron) frameworks.push('electron');

    let testRunner: string | undefined;
    if (allDeps.vitest) testRunner = 'vitest';
    else if (allDeps.jest) testRunner = 'jest';
    else if (allDeps.mocha) testRunner = 'mocha';
    else if (allDeps.ava) testRunner = 'ava';

    return { testRunner, frameworks };
  } catch {
    return null;
  }
}
