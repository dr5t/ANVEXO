#!/usr/bin/env node

import { Command } from 'commander';
import { InvestigationEngine } from '../engine/index.js';
import { LogLevel } from '../core/index.js';
import { setLogLevel } from '../core/logger.js';

const program = new Command();

program
  .name('anvexo')
  .description('ANVEXO - AI-powered software investigation platform')
  .version('0.1.0');

program
  .command('investigate')
  .description('Run an investigation on a local repository')
  .argument('<path>', 'Path to the repository to investigate')
  .option('-o, --objective <objective>', 'Investigation objective', 'General project investigation and health check')
  .option('-m, --memory-mode <mode>', 'Memory mode (ephemeral, local, persistent, cloud)', 'persistent')
  .option('--auto-approve', 'Auto-approve all read permissions', false)
  .option('--skip-tests', 'Skip test execution', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--quiet', 'Suppress all logging, output only the report', false)
  .option('--json', 'Output report as JSON instead of formatted text', false)
  .action(async (repoPath: string, opts: {
    objective: string;
    memoryMode: string;
    autoApprove: boolean;
    skipTests: boolean;
    verbose: boolean;
    quiet: boolean;
    json: boolean;
  }) => {
    if (opts.quiet) {
      setLogLevel(LogLevel.SILENT);
    } else if (opts.verbose) {
      setLogLevel(LogLevel.DEBUG);
    }

    const { MemoryMode } = await import('../core/index.js');
    let mode = MemoryMode.PERSISTENT_INTELLIGENCE;
    if (opts.memoryMode === 'ephemeral' || opts.memoryMode === 'zero') {
      mode = MemoryMode.ZERO_PERSISTENT;
    } else if (opts.memoryMode === 'local') {
      mode = MemoryMode.LOCAL_CONTEXT;
    } else if (opts.memoryMode === 'cloud') {
      mode = MemoryMode.USER_CLOUD;
    }

    const engine = new InvestigationEngine(mode);
    const report = await engine.investigate({
      objective: opts.objective,
      repositoryPath: repoPath,
      autoApprove: opts.autoApprove,
      skipTests: opts.skipTests,
      verbose: opts.verbose,
      memoryMode: mode,
    });

    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(engine.formatReport(report) + '\n');
    }

    const failedSteps = report.plan.steps.filter(s => s.status === 'failed').length;
    process.exit(failedSteps > 0 ? 1 : 0);
  });

program
  .command('discover')
  .description('Detect project type and configuration')
  .argument('<path>', 'Path to the repository')
  .option('--json', 'Output as JSON', false)
  .action(async (repoPath: string, opts: { json: boolean }) => {
    const { discoverProject } = await import('../discovery/index.js');
    const metadata = await discoverProject(repoPath);
    if (opts.json) {
      process.stdout.write(JSON.stringify(metadata, null, 2) + '\n');
    } else {
      process.stdout.write(`Name:            ${metadata.name}\n`);
      process.stdout.write(`Path:            ${metadata.rootPath}\n`);
      process.stdout.write(`Languages:       ${metadata.languages.join(', ') || 'unknown'}\n`);
      process.stdout.write(`Frameworks:      ${metadata.frameworks.join(', ') || 'none detected'}\n`);
      process.stdout.write(`Package Manager: ${metadata.packageManager || 'unknown'}\n`);
      process.stdout.write(`Test Runner:     ${metadata.testRunner || 'none detected'}\n`);
      process.stdout.write(`Git:             ${metadata.hasGit ? 'yes' : 'no'}\n`);
      process.stdout.write(`Config Files:    ${metadata.configFiles.join(', ')}\n`);
      process.stdout.write(`Entry Points:    ${metadata.entryPoints.join(', ') || 'none detected'}\n`);
    }
  });

const contextCmd = program
  .command('context')
  .description('Manage project context and intelligence memory');

contextCmd
  .command('inspect')
  .description('Inspect current project memory and context')
  .argument('<path>', 'Path to the repository')
  .action(async (repoPath: string) => {
    const { ContextManager } = await import('../context/index.js');
    const cm = new ContextManager();
    const ctx = await cm.init(repoPath);
    process.stdout.write(JSON.stringify(ctx, null, 2) + '\n');
  });

contextCmd
  .command('rebuild')
  .description('Rebuild dependency graph and commit index')
  .argument('<path>', 'Path to the repository')
  .action(async (repoPath: string) => {
    const { ContextManager } = await import('../context/index.js');
    const cm = new ContextManager();
    await cm.init(repoPath);
    const updated = await cm.rebuildIndex(repoPath);
    process.stdout.write(`Rebuilt index for ${updated.repoRoot}. Dependencies: ${Object.keys(updated.dependencies).length}, Graph files: ${Object.keys(updated.dependencyGraph).length}\n`);
  });

contextCmd
  .command('clear')
  .description('Clear saved project memory')
  .argument('<path>', 'Path to the repository')
  .action(async (repoPath: string) => {
    const { ContextManager } = await import('../context/index.js');
    const cm = new ContextManager();
    await cm.clearMemory(repoPath);
    process.stdout.write(`Cleared project memory for ${repoPath}\n`);
  });

program
  .command('serve')
  .description('Start the local ANVEXO API server and workbench')
  .option('-p, --port <port>', 'Port number to listen on', '4173')
  .option('-h, --host <host>', 'Host address to bind', '127.0.0.1')
  .action(async (opts: { port: string; host: string }) => {
    const { AnvexoServer } = await import('../server/index.js');
    const server = new AnvexoServer({
      port: parseInt(opts.port, 10),
      host: opts.host,
    });
    const { url } = await server.start();
    process.stdout.write(`ANVEXO Workbench server running at ${url}\n`);
    process.on('SIGINT', async () => {
      await server.stop();
      process.exit(0);
    });
  });

program.parse();
