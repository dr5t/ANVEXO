import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AffectedApiEndpoint,
  AffectedDatabaseSchema,
  AffectedSecurityFlow,
  ChangeImpactReport,
  ImpactRiskLevel,
  ImpactSimulatorOptions,
  SymbolReference,
} from './types.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage',
  '.anvexo', '__pycache__', '.next', 'vendor',
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ChangeImpactSimulator {
  private repoRoot: string;
  private cachedFiles: string[] | null = null;
  private cachedFileContents: Map<string, string> = new Map();

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  async simulate(
    targetOrOptions: string | ImpactSimulatorOptions,
    extraOptions?: Partial<ImpactSimulatorOptions>,
  ): Promise<ChangeImpactReport> {
    const options: ImpactSimulatorOptions =
      typeof targetOrOptions === 'string'
        ? { target: targetOrOptions, ...extraOptions }
        : targetOrOptions;

    const resolvedRoot = path.resolve(options.repoRoot || this.repoRoot);
    this.repoRoot = resolvedRoot;

    // Handle incremental diff analysis if provided
    let targets: string[] = [];
    if (options.proposedDiff) {
      targets = this.extractFilesFromDiff(options.proposedDiff, resolvedRoot);
    }

    if (targets.length === 0) {
      const normalizedTarget = this.normalizeTarget(options.target, resolvedRoot);
      targets = [normalizedTarget];
    }

    const primaryTarget = targets[0] || options.target;
    const allRepoFiles = this.getAllSourceFiles(resolvedRoot);

    // Compute direct dependencies
    const directDependencies = new Set<string>();
    const exports = new Set<string>();
    const imports = new Set<string>();

    for (const target of targets) {
      const fullTarget = path.join(resolvedRoot, target);
      if (fs.existsSync(fullTarget) && fs.statSync(fullTarget).isFile()) {
        const content = this.readFile(fullTarget);
        const fileImports = this.extractImports(content, target, resolvedRoot);
        for (const imp of fileImports) {
          directDependencies.add(imp);
          imports.add(imp);
        }
        const fileExports = this.extractExports(content);
        for (const exp of fileExports) {
          exports.add(exp);
        }
      }
    }

    // Compute reverse dependencies (which files import any of the targets)
    const reverseDependencies = new Set<string>();
    const targetSet = new Set(targets);

    for (const file of allRepoFiles) {
      if (targetSet.has(file)) continue;
      const fullPath = path.join(resolvedRoot, file);
      const content = this.readFile(fullPath);
      const fileImports = this.extractImports(content, file, resolvedRoot);

      for (const imp of fileImports) {
        if (targetSet.has(imp)) {
          reverseDependencies.add(file);
          break;
        }
      }
    }

    // Cascade transitive dependencies (level 2)
    const affectedModules = new Set<string>([...targets, ...reverseDependencies]);
    for (const file of allRepoFiles) {
      if (affectedModules.has(file)) continue;
      const fullPath = path.join(resolvedRoot, file);
      const content = this.readFile(fullPath);
      const fileImports = this.extractImports(content, file, resolvedRoot);

      for (const imp of fileImports) {
        if (reverseDependencies.has(imp)) {
          affectedModules.add(file);
          break;
        }
      }
    }

    // Extract symbol references for exported symbols
    const symbolReferences: SymbolReference[] = [];
    for (const exp of exports) {
      const referencedIn: string[] = [];
      const regex = new RegExp(`\\b${escapeRegExp(exp)}\\b`, 'g');

      for (const revDep of reverseDependencies) {
        const content = this.readFile(path.join(resolvedRoot, revDep));
        if (regex.test(content)) {
          referencedIn.push(revDep);
        }
      }

      symbolReferences.push({
        name: exp,
        kind: 'export',
        definedIn: primaryTarget,
        referencedIn,
      });
    }

    // Identify affected API endpoints
    const affectedEndpoints = this.detectAffectedApiEndpoints(affectedModules, resolvedRoot);

    // Identify related tests
    const relatedTests = this.detectRelatedTests(affectedModules, allRepoFiles, targets, resolvedRoot);

    // Identify config and env dependencies
    const configDependencies = this.detectConfigDependencies(targets, resolvedRoot);

    // Identify database schemas / models
    const databaseSchemas = this.detectDatabaseSchemas(affectedModules, resolvedRoot);

    // Identify security & auth flows
    const securityFlows = this.detectSecurityFlows(affectedModules, resolvedRoot);

    // Calculate risk score & risk level
    const { riskScore, riskLevel, riskFactors } = this.calculateRisk({
      reverseDependenciesCount: reverseDependencies.size,
      affectedModulesCount: affectedModules.size,
      relatedTestsCount: relatedTests.length,
      affectedEndpointsCount: affectedEndpoints.length,
      securityFlowsCount: securityFlows.length,
      databaseSchemasCount: databaseSchemas.length,
      exportsCount: exports.size,
    });

    // Recommendations
    const recommendedValidationSteps = this.buildRecommendations({
      target: primaryTarget,
      relatedTests,
      securityFlows,
      affectedEndpoints,
      databaseSchemas,
      riskLevel,
    });

    const confidence = this.calculateConfidence(allRepoFiles.length, targets);
    const limitations = this.collectLimitations(targets, resolvedRoot);

    const summary = `Change impact simulation for ${primaryTarget}: ` +
      `${directDependencies.size} direct dependencies, ` +
      `${reverseDependencies.size} downstream dependent modules, ` +
      `${relatedTests.length} relevant test suites, ` +
      `Risk Level: ${riskLevel.toUpperCase()} (Score: ${riskScore}/100).`;

    return {
      id: randomUUID(),
      target: primaryTarget,
      repositoryPath: resolvedRoot,
      timestamp: new Date(),
      directDependencies: [...directDependencies],
      reverseDependencies: [...reverseDependencies],
      exports: [...exports],
      imports: [...imports],
      symbolReferences,
      affectedEndpoints,
      relatedTests,
      affectedModules: [...affectedModules],
      configDependencies,
      databaseSchemas,
      securityFlows,
      riskLevel,
      riskScore,
      riskFactors,
      confidence,
      limitations,
      recommendedValidationSteps,
      summary,
    };
  }

  private normalizeTarget(target: string, repoRoot: string): string {
    let rel = path.isAbsolute(target) ? path.relative(repoRoot, target) : target;
    rel = rel.replace(/\\/g, '/');
    if (!rel.startsWith('src/') && !rel.startsWith('tests/') && !rel.includes('/')) {
      // Look for match in repo
      const files = this.getAllSourceFiles(repoRoot);
      const match = files.find(f => f.endsWith(rel) || path.basename(f, path.extname(f)) === rel);
      if (match) return match;
    }
    return rel;
  }

  private extractFilesFromDiff(diff: string, repoRoot: string): string[] {
    const files = new Set<string>();
    const lines = diff.split('\n');
    for (const line of lines) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (match && match[2]) {
        files.add(match[2].trim());
      } else {
        const plusMatch = line.match(/^\+\+\+ b\/(.+?)$/);
        if (plusMatch && plusMatch[1] && plusMatch[1] !== '/dev/null') {
          files.add(plusMatch[1].trim());
        }
      }
    }
    return [...files].filter(f => fs.existsSync(path.join(repoRoot, f)));
  }

  private getAllSourceFiles(repoRoot: string): string[] {
    if (this.cachedFiles) return this.cachedFiles;

    const result: string[] = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.anvexo') continue;
        if (EXCLUDED_DIRS.has(entry.name)) continue;

        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (CODE_EXTENSIONS.has(ext)) {
            result.push(path.relative(repoRoot, full).replace(/\\/g, '/'));
          }
        }
      }
    };

    walk(repoRoot);
    this.cachedFiles = result;
    return result;
  }

  private readFile(fullPath: string): string {
    if (this.cachedFileContents.has(fullPath)) {
      return this.cachedFileContents.get(fullPath)!;
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      this.cachedFileContents.set(fullPath, content);
      return content;
    } catch {
      return '';
    }
  }

  private extractImports(content: string, fromFile: string, repoRoot: string): string[] {
    const imports = new Set<string>();
    const importRegexes = [
      /(?:import|export)\s+(?:[\w*\s{},]+from\s+)?['"](\.[^'"]+)['"]/g,
      /require\(['"](\.[^'"]+)['"]\)/g,
      /from\s+([.\w]+)\s+import/g,
    ];

    const dir = path.dirname(path.join(repoRoot, fromFile));

    for (const regex of importRegexes) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const importSpecifier = match[1];
        if (!importSpecifier) continue;

        const resolvedTarget = this.resolveImportPath(dir, importSpecifier, repoRoot);
        if (resolvedTarget) {
          imports.add(resolvedTarget);
        }
      }
    }

    return [...imports];
  }

  private resolveImportPath(fromDir: string, specifier: string, repoRoot: string): string | null {
    const candidateBase = path.resolve(fromDir, specifier);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py'];

    for (const ext of ['', ...extensions]) {
      const p = candidateBase + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return path.relative(repoRoot, p).replace(/\\/g, '/');
      }
    }

    // Index file check
    for (const ext of extensions) {
      const p = path.join(candidateBase, `index${ext}`);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return path.relative(repoRoot, p).replace(/\\/g, '/');
      }
    }

    return null;
  }

  private extractExports(content: string): string[] {
    const exports = new Set<string>();
    const patterns = [
      /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g,
      /export\s+class\s+([a-zA-Z0-9_$]+)/g,
      /export\s+interface\s+([a-zA-Z0-9_$]+)/g,
      /export\s+type\s+([a-zA-Z0-9_$]+)/g,
      /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g,
      /export\s+enum\s+([a-zA-Z0-9_$]+)/g,
      /export\s*\{\s*([^}]+)\s*\}/g,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const matched = match[1];
        if (matched) {
          if (matched.includes(',')) {
            for (const item of matched.split(',')) {
              const clean = item.trim().split(/\s+as\s+/)[0]?.trim();
              if (clean && /^[a-zA-Z0-9_$]+$/.test(clean)) {
                exports.add(clean);
              }
            }
          } else {
            exports.add(matched.trim());
          }
        }
      }
    }

    return [...exports];
  }

  private detectAffectedApiEndpoints(affectedModules: Set<string>, repoRoot: string): AffectedApiEndpoint[] {
    const endpoints: AffectedApiEndpoint[] = [];
    const routerFiles = [...affectedModules].filter(f => f.includes('router') || f.includes('server') || f.includes('routes') || f.includes('api'));

    for (const rf of routerFiles) {
      const full = path.join(repoRoot, rf);
      const content = this.readFile(full);
      const routeRegex = /(?:method === ['"](GET|POST|PUT|DELETE|PATCH)['"]\s*&&\s*pathname === ['"]([^'"]+)['"])|(?:app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"])/g;

      let match: RegExpExecArray | null;
      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1] || match[3] || 'GET';
        const pathStr = match[2] || match[4] || '/';
        endpoints.push({
          method: method.toUpperCase(),
          path: pathStr,
          handlerFile: rf,
        });
      }
    }

    return endpoints;
  }

  private detectRelatedTests(
    affectedModules: Set<string>,
    allFiles: string[],
    targets: string[],
    repoRoot: string,
  ): string[] {
    const tests = new Set<string>();
    const testFiles = allFiles.filter(f => f.includes('.test.') || f.includes('.spec.') || f.startsWith('tests/'));

    for (const tf of testFiles) {
      const full = path.join(repoRoot, tf);
      const content = this.readFile(full);
      const imports = this.extractImports(content, tf, repoRoot);

      for (const imp of imports) {
        if (affectedModules.has(imp)) {
          tests.add(tf);
          break;
        }
      }

      // Also match by component basename (e.g. context.test.ts for src/context/*)
      const baseName = path.basename(tf).replace(/\.(test|spec)\.[a-zA-Z]+$/, '');
      for (const t of targets) {
        const targetBase = path.basename(t, path.extname(t));
        if (baseName === targetBase || targetBase.includes(baseName) || baseName.includes(targetBase)) {
          tests.add(tf);
        }
      }
    }

    return [...tests];
  }

  private detectConfigDependencies(targets: string[], repoRoot: string): string[] {
    const configs = new Set<string>();
    const knownConfigFiles = ['package.json', 'tsconfig.json', 'vitest.config.ts', '.env', '.env.example'];

    for (const cf of knownConfigFiles) {
      if (fs.existsSync(path.join(repoRoot, cf))) {
        for (const t of targets) {
          if (t.includes('config') || t.includes('env') || t.includes('package')) {
            configs.add(cf);
          }
        }
      }
    }

    return [...configs];
  }

  private detectDatabaseSchemas(affectedModules: Set<string>, repoRoot: string): AffectedDatabaseSchema[] {
    const schemas: AffectedDatabaseSchema[] = [];
    for (const file of affectedModules) {
      if (file.includes('schema') || file.includes('model') || file.includes('migration') || file.endsWith('.prisma') || file.endsWith('.sql')) {
        const content = this.readFile(path.join(repoRoot, file));
        const modelMatches = content.match(/(?:interface|type|class|table)\s+([A-Z][a-zA-Z0-9_]+)/g);
        if (modelMatches) {
          for (const m of modelMatches) {
            const modelName = m.split(/\s+/)[1];
            if (modelName) {
              schemas.push({
                modelName,
                schemaFile: file,
              });
            }
          }
        }
      }
    }
    return schemas;
  }

  private detectSecurityFlows(affectedModules: Set<string>, repoRoot: string): AffectedSecurityFlow[] {
    const flows: AffectedSecurityFlow[] = [];
    const securityKeywords = ['permission', 'auth', 'token', 'secret', 'password', 'cors', 'rate-limit', 'sandbox'];

    for (const file of affectedModules) {
      const lowerFile = file.toLowerCase();
      const isSecurityFile = securityKeywords.some(kw => lowerFile.includes(kw));

      if (isSecurityFile) {
        const content = this.readFile(path.join(repoRoot, file));
        if (lowerFile.includes('permission')) {
          flows.push({
            type: 'permission_scope',
            description: `Permission evaluation and grant control in ${file}`,
            file,
          });
        } else if (lowerFile.includes('security') || lowerFile.includes('sanitize') || lowerFile.includes('redact')) {
          flows.push({
            type: 'data_sanitization',
            description: `Security sanitization, path bounds, or secret scrubbing in ${file}`,
            file,
          });
        } else {
          flows.push({
            type: 'auth_middleware',
            description: `Authentication or security flow logic in ${file}`,
            file,
          });
        }
      }
    }

    return flows;
  }

  private calculateRisk(metrics: {
    reverseDependenciesCount: number;
    affectedModulesCount: number;
    relatedTestsCount: number;
    affectedEndpointsCount: number;
    securityFlowsCount: number;
    databaseSchemasCount: number;
    exportsCount: number;
  }): { riskScore: number; riskLevel: ImpactRiskLevel; riskFactors: string[] } {
    let score = 0;
    const factors: string[] = [];

    // Downstream reach
    if (metrics.reverseDependenciesCount > 10) {
      score += 25;
      factors.push(`High downstream impact: imported by ${metrics.reverseDependenciesCount} modules`);
    } else if (metrics.reverseDependenciesCount > 3) {
      score += 15;
      factors.push(`Moderate downstream impact: imported by ${metrics.reverseDependenciesCount} modules`);
    } else if (metrics.reverseDependenciesCount > 0) {
      score += 5;
    }

    // Security sensitivity
    if (metrics.securityFlowsCount > 0) {
      score += 30;
      factors.push(`Affects ${metrics.securityFlowsCount} security or permission flow(s)`);
    }

    // API surface exposure
    if (metrics.affectedEndpointsCount > 0) {
      score += 20;
      factors.push(`Potentially impacts ${metrics.affectedEndpointsCount} external HTTP API endpoint(s)`);
    }

    // Database / data models
    if (metrics.databaseSchemasCount > 0) {
      score += 15;
      factors.push(`Touches ${metrics.databaseSchemasCount} data model/schema definition(s)`);
    }

    // Test coverage risk
    if (metrics.relatedTestsCount === 0 && metrics.reverseDependenciesCount > 0) {
      score += 20;
      factors.push('Zero automated test suites detected covering this component or its dependents');
    } else if (metrics.relatedTestsCount === 1) {
      score += 5;
    }

    const finalScore = Math.min(100, Math.max(5, score));
    let level: ImpactRiskLevel = 'low';
    if (finalScore >= 70) level = 'critical';
    else if (finalScore >= 45) level = 'high';
    else if (finalScore >= 25) level = 'medium';

    return { riskScore: finalScore, riskLevel: level, riskFactors: factors };
  }

  private buildRecommendations(params: {
    target: string;
    relatedTests: string[];
    securityFlows: AffectedSecurityFlow[];
    affectedEndpoints: AffectedApiEndpoint[];
    databaseSchemas: AffectedDatabaseSchema[];
    riskLevel: ImpactRiskLevel;
  }): string[] {
    const recs: string[] = [];

    if (params.relatedTests.length > 0) {
      recs.push(`Execute relevant test suites: ${params.relatedTests.slice(0, 3).map(t => `npx vitest run ${t}`).join('; ')}`);
    } else {
      recs.push(`Add targeted regression tests covering ${params.target} before deploying changes.`);
    }

    if (params.securityFlows.length > 0) {
      recs.push('Perform security permission audit and verify Default-Deny boundaries remain intact.');
    }

    if (params.affectedEndpoints.length > 0) {
      recs.push(`Validate HTTP responses and rate limiting on affected endpoints: ${params.affectedEndpoints.slice(0, 3).map(e => `${e.method} ${e.path}`).join(', ')}.`);
    }

    if (params.databaseSchemas.length > 0) {
      recs.push('Verify backward compatibility for affected schema structures.');
    }

    if (params.riskLevel === 'high' || params.riskLevel === 'critical') {
      recs.push('Require explicit code review and clean CI test run before merging modifications.');
    }

    return recs;
  }

  private calculateConfidence(totalFiles: number, targets: string[]): number {
    if (totalFiles === 0) return 0.5;
    if (targets.length === 0) return 0.6;
    return 0.95;
  }

  private collectLimitations(targets: string[], repoRoot: string): string[] {
    const limitations: string[] = [];
    limitations.push('Static dependency parsing resolves local relative imports; dynamic runtime requires and reflection are not guaranteed to be captured.');
    for (const t of targets) {
      const full = path.join(repoRoot, t);
      if (!fs.existsSync(full)) {
        limitations.push(`Target path '${t}' does not exist as a physical file on disk.`);
      }
    }
    return limitations;
  }

  formatReport(report: ChangeImpactReport): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                    ANVEXO CHANGE IMPACT SIMULATION REPORT                      ');
    lines.push('================================================================================');
    lines.push(`Target:             ${report.target}`);
    lines.push(`Risk Level:         [${report.riskLevel.toUpperCase()}] (Score: ${report.riskScore}/100)`);
    lines.push(`Direct Imports:     ${report.directDependencies.length}`);
    lines.push(`Reverse Dependents: ${report.reverseDependencies.length} modules`);
    lines.push(`Affected Modules:   ${report.affectedModules.length} total`);
    lines.push(`Relevant Tests:     ${report.relatedTests.length} test suite(s)`);
    lines.push(`API Endpoints:      ${report.affectedEndpoints.length}`);
    lines.push(`Security Flows:     ${report.securityFlows.length}`);
    lines.push(`Analysis Confidence:${Math.round(report.confidence * 100)}%`);
    lines.push('--------------------------------------------------------------------------------');

    if (report.riskFactors.length > 0) {
      lines.push('RISK FACTORS:');
      for (const rf of report.riskFactors) {
        lines.push(`  ! ${rf}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.reverseDependencies.length > 0) {
      lines.push('DOWNSTREAM REVERSE DEPENDENCIES:');
      for (const rd of report.reverseDependencies.slice(0, 10)) {
        lines.push(`  ← ${rd}`);
      }
      if (report.reverseDependencies.length > 10) {
        lines.push(`    ... and ${report.reverseDependencies.length - 10} more`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.affectedEndpoints.length > 0) {
      lines.push('AFFECTED API ENDPOINTS:');
      for (const ep of report.affectedEndpoints) {
        lines.push(`  • [${ep.method}] ${ep.path} (${ep.handlerFile})`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.relatedTests.length > 0) {
      lines.push('RELEVANT TEST SUITES:');
      for (const t of report.relatedTests) {
        lines.push(`  ✓ ${t}`);
      }
      lines.push('--------------------------------------------------------------------------------');
    }

    if (report.recommendedValidationSteps.length > 0) {
      lines.push('RECOMMENDED VALIDATION STEPS:');
      for (const rec of report.recommendedValidationSteps) {
        lines.push(`  → ${rec}`);
      }
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
