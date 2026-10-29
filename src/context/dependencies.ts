import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DependencyAnalysisResult {
  dependencies: Record<string, string>;
  dependencyGraph: Record<string, string[]>;
}

const IMPORT_PATTERNS = [
  /(?:import|export)\s+(?:[\w*\s{},]+from\s+)?['"](\.[^'"]+)['"]/g,
  /require\(['"](\.[^'"]+)['"]\)/g,
  /from\s+(\.[^\s]+)\s+import/g,
];

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage',
  '.anvexo', '__pycache__', '.next', 'vendor',
]);

export function analyzeDependencies(repoRoot: string): DependencyAnalysisResult {
  const resolvedRoot = path.resolve(repoRoot);
  const dependencies: Record<string, string> = {};
  const dependencyGraph: Record<string, string[]> = {};

  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.dependencies && typeof pkg.dependencies === 'object') {
        Object.assign(dependencies, pkg.dependencies);
      }
      if (pkg.devDependencies && typeof pkg.devDependencies === 'object') {
        for (const [name, ver] of Object.entries(pkg.devDependencies)) {
          dependencies[`${name} (dev)`] = ver as string;
        }
      }
    } catch {}
  }

  const reqPath = path.join(resolvedRoot, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const lines = fs.readFileSync(reqPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/==|>=|<=|~=/);
          if (parts[0]) {
            dependencies[parts[0].trim()] = parts[1] ? parts[1].trim() : 'latest';
          }
        }
      }
    } catch {}
  }

  const files = collectSourceFiles(resolvedRoot);
  for (const file of files) {
    const relFile = path.relative(resolvedRoot, file);
    const imports = extractLocalImports(file, resolvedRoot);
    if (imports.length > 0) {
      dependencyGraph[relFile] = imports;
    }
  }

  return { dependencies, dependencyGraph };
}

function collectSourceFiles(dir: string): string[] {
  const result: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.anvexo') {
        continue;
      }
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          result.push(full);
        }
      }
    }
  }

  walk(dir);
  return result;
}

function extractLocalImports(filePath: string, repoRoot: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const importedPaths = new Set<string>();
  const dir = path.dirname(filePath);

  for (const regex of IMPORT_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const importTarget = match[1];
      if (importTarget) {
        const absoluteTarget = resolveImportPath(path.resolve(dir, importTarget));
        if (absoluteTarget) {
          const relTarget = path.relative(repoRoot, absoluteTarget);
          importedPaths.add(relTarget);
        } else {
          importedPaths.add(importTarget);
        }
      }
    }
  }

  return [...importedPaths];
}

function resolveImportPath(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.py`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return c;
    }
  }

  return null;
}
