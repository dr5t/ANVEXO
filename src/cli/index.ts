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
  .option('--auto-approve', 'Auto-approve all read permissions', false)
  .option('--skip-tests', 'Skip test execution', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--quiet', 'Suppress all logging, output only the report', false)
  .option('--json', 'Output report as JSON instead of formatted text', false)
  .action(async (repoPath: string, opts: {
    objective: string;
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

    const engine = new InvestigationEngine();
    const report = await engine.investigate({
      objective: opts.objective,
      repositoryPath: repoPath,
      autoApprove: opts.autoApprove,
      skipTests: opts.skipTests,
      verbose: opts.verbose,
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

program.parse();
