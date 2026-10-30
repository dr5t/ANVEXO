#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { InvestigationEngine } from '../engine/index.js';
import { LogLevel, MemoryMode, PermissionScope, PermissionDecision } from '../core/index.js';
import { setLogLevel } from '../core/logger.js';
import { ConfigManager } from '../core/config.js';
import { ProviderFactory } from '../providers/index.js';
import { PermissionManager } from '../permissions/index.js';
import { ToolRegistry, registerBuiltinTools } from '../tools/index.js';
import { RuleManager } from '../rules/index.js';
import { SkillManager } from '../skills/index.js';
import { PluginManager } from '../plugins/index.js';
import { GitService } from '../git/index.js';
import { CommandDispatcher } from '../commands/index.js';
import { AgentRuntime } from '../agent/index.js';
import { McpClient } from '../mcp/index.js';
import { ChangeImpactSimulator } from '../impact/index.js';
import { BugReproductionLab } from '../reproduction/index.js';
import { ProofVerifier } from '../proof/index.js';
import { DecisionMemoryManager, type DecisionMemoryType } from '../memory/index.js';
import { SafeAutonomyEngine, type AutonomyMode } from '../autonomy/index.js';

const program = new Command();

program
  .name('anvexo')
  .description('ANVEXO - Autonomous Developer Workspace & AI Agent Platform')
  .version('0.1.0');

program
  .option('-p, --print <prompt>', 'Run in headless non-interactive mode with single prompt')
  .option('--plan', 'Run in plan-only mode requiring confirmation')
  .option('--auto-approve', 'Automatically approve read operations')
  .argument('[prompt]', 'Initial coding or investigation prompt')
  .action(async (promptArg: string | undefined, opts: { print?: string; plan?: boolean; autoApprove?: boolean }) => {
    const configManager = new ConfigManager();
    const repoPath = process.cwd();
    const providerFactory = new ProviderFactory(configManager);
    const provider = providerFactory.getActiveProvider();
    const permissions = new PermissionManager();
    const tools = new ToolRegistry(permissions);
    registerBuiltinTools(tools);

    permissions.grant(PermissionScope.FILE_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    permissions.grant(PermissionScope.GIT_READ, '*', PermissionDecision.ALWAYS_ALLOW);
    permissions.grant(PermissionScope.TEST_RUN, '*', PermissionDecision.ALWAYS_ALLOW);

    const ruleManager = new RuleManager();
    const skillManager = new SkillManager();
    const pluginManager = new PluginManager();
    const gitService = new GitService();
    const commandDispatcher = new CommandDispatcher();

    const runtime = new AgentRuntime({
      repoPath,
      provider,
      permissions,
      tools,
      ruleManager,
      skillManager,
      mode: opts.plan ? 'plan' : 'interactive',
    });

    const targetPrompt = opts.print || promptArg;

    if (opts.print) {
      const session = runtime.createSession('autonomous');
      try {
        const updated = await runtime.run(targetPrompt!, session, (evt) => {
          if (evt.type === 'thought' && evt.content) {
            process.stdout.write(evt.content + '\n');
          }
        });
        const lastMsg = updated.messages[updated.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
          process.stdout.write(lastMsg.content + '\n');
        }
        process.exit(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${msg}\n`);
        process.exit(1);
      }
    }

    const session = runtime.createSession(opts.plan ? 'plan' : 'interactive');

    const prefs = configManager.loadUserPreferences();
    const isGit = await gitService.isGitRepo(repoPath);
    let branchInfo = 'no-git';
    if (isGit) {
      const st = await gitService.getStatus(repoPath);
      branchInfo = st.branch;
    }

    process.stdout.write('\x1b[1mANVEXO Developer Agent\x1b[0m v0.1.0\n');
    process.stdout.write(`Workspace: \x1b[36m${repoPath}\x1b[0m (git: ${branchInfo})\n`);
    process.stdout.write(`Provider:  \x1b[33m${provider.name}\x1b[0m (${prefs.activeModel})\n`);
    process.stdout.write('Type natural language tasks, or \x1b[35m/help\x1b[0m for commands, \x1b[35mexit\x1b[0m to quit.\n\n');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'anvexo> ',
    });

    const runAgentTurn = async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        process.stdout.write('Closing ANVEXO session.\n');
        process.exit(0);
      }

      if (trimmed.startsWith('/')) {
        const cmdRes = await commandDispatcher.execute(trimmed, {
          repoPath,
          configManager,
          skillManager,
          ruleManager,
          pluginManager,
          providerFactory,
          gitService,
        });
        process.stdout.write(cmdRes.message + '\n\n');
        rl.prompt();
        return;
      }

      process.stdout.write('\n');
      await runtime.run(trimmed, session, (event) => {
        if (event.type === 'thought' && event.content) {
          process.stdout.write(event.content + '\n');
        } else if (event.type === 'tool_start') {
          process.stdout.write(`\x1b[34m[TOOL]\x1b[0m Running ${event.toolName}...\n`);
        } else if (event.type === 'tool_end') {
          process.stdout.write(`\x1b[32m[DONE]\x1b[0m ${event.toolName} finished.\n`);
        } else if (event.type === 'plan_ready') {
          process.stdout.write(`\x1b[33m[PLAN]\x1b[0m ${event.content}\n`);
        } else if (event.type === 'waiting_approval') {
          process.stdout.write(`\x1b[31m[AUTH]\x1b[0m ${event.content}\n`);
        } else if (event.type === 'error') {
          process.stdout.write(`\x1b[31m[ERROR]\x1b[0m ${event.content}\n`);
        }
      });
      process.stdout.write('\n');
      rl.prompt();
    };

    if (promptArg) {
      await runAgentTurn(promptArg);
    } else {
      rl.prompt();
    }

    rl.on('line', async (line) => {
      await runAgentTurn(line);
    });

    rl.on('close', () => {
      process.stdout.write('\nExiting ANVEXO.\n');
      process.exit(0);
    });
  });

program
  .command('doctor')
  .description('Run comprehensive environment diagnostics and health checks')
  .action(async () => {
    const configManager = new ConfigManager();
    const gitService = new GitService();
    const repoPath = process.cwd();

    process.stdout.write('ANVEXO Environment & System Diagnostics\n');
    process.stdout.write('=======================================\n');

    const nodeVer = process.version;
    const nodeMajor = parseInt(nodeVer.slice(1).split('.')[0], 10);
    const nodeOk = nodeMajor >= 20;
    process.stdout.write(`[${nodeOk ? 'PASS' : 'FAIL'}] Node.js runtime: ${nodeVer} (required >= 20.0.0)\n`);

    const isGit = await gitService.isGitRepo(repoPath);
    process.stdout.write(`[${isGit ? 'PASS' : 'WARN'}] Git repository: ${isGit ? 'valid repo' : 'not a git repository'}\n`);

    const prefs = configManager.loadUserPreferences();
    process.stdout.write(`[INFO] Active Provider: ${prefs.activeProvider} (Model: ${prefs.activeModel})\n`);

    const keys = ['anthropic', 'openai', 'gemini'] as const;
    for (const k of keys) {
      const hasKey = Boolean(configManager.getApiKey(k));
      process.stdout.write(`[${hasKey ? 'PASS' : 'INFO'}] ${k.toUpperCase()} API key: ${hasKey ? 'configured' : 'not set'}\n`);
    }

    const ruleManager = new RuleManager();
    const rules = ruleManager.listAllRules(repoPath);
    process.stdout.write(`[PASS] Rules engine: ${rules.length} active rules loaded\n`);

    const skillManager = new SkillManager();
    const skills = skillManager.listAllSkills(repoPath);
    process.stdout.write(`[PASS] Skills engine: ${skills.length} skills discovered\n`);

    const pluginManager = new PluginManager();
    const plugins = pluginManager.listAllPlugins(repoPath);
    process.stdout.write(`[PASS] Plugin system: ${plugins.length} plugins registered\n`);

    process.stdout.write('\nDiagnostics complete.\n');
  });

program
  .command('init')
  .description('Initialize ANVEXO configuration, rules, and skills in the current project')
  .action(async () => {
    const repoPath = process.cwd();
    const anvexoDir = join(repoPath, '.anvexo');
    const rulesDir = join(anvexoDir, 'rules');
    const skillsDir = join(anvexoDir, 'skills');

    mkdirSync(rulesDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });

    const configPath = join(anvexoDir, 'config.json');
    if (!existsSync(configPath)) {
      writeFileSync(configPath, JSON.stringify({
        project: 'anvexo-project',
        version: '0.1.0',
        memoryMode: 'local',
        rules: [],
      }, null, 2), 'utf-8');
    }

    const defaultRulePath = join(rulesDir, 'workspace-conventions.md');
    if (!existsSync(defaultRulePath)) {
      writeFileSync(defaultRulePath, '# Project Conventions\n\n1. Write deterministic, verified code.\n2. Run tests before submitting fixes.\n', 'utf-8');
    }

    process.stdout.write(`Initialized ANVEXO project configuration in ${anvexoDir}\n`);
  });

const configCmd = program
  .command('config')
  .description('Inspect or modify ANVEXO user and project configuration');

configCmd
  .command('list')
  .description('List all user preferences')
  .action(() => {
    const cm = new ConfigManager();
    process.stdout.write(JSON.stringify(cm.loadUserPreferences(), null, 2) + '\n');
  });

configCmd
  .command('get <key>')
  .description('Get value of a configuration key')
  .action((key: string) => {
    const cm = new ConfigManager();
    const prefs = cm.loadUserPreferences() as unknown as Record<string, unknown>;
    process.stdout.write(String(prefs[key] ?? 'undefined') + '\n');
  });

configCmd
  .command('set <key> <val>')
  .description('Set value of a configuration key')
  .action((key: string, val: string) => {
    const cm = new ConfigManager();
    const prefs = cm.loadUserPreferences() as unknown as Record<string, unknown>;
    prefs[key] = val;
    cm.saveUserPreferences(prefs);
    process.stdout.write(`Updated ${key} = ${val}\n`);
  });

const skillsCmd = program
  .command('skills')
  .description('Inspect and run available skills');

skillsCmd
  .command('list')
  .description('List all discovered skills')
  .action(() => {
    const sm = new SkillManager();
    const skills = sm.listAllSkills(process.cwd());
    for (const s of skills) {
      process.stdout.write(`${s.id.padEnd(25)} [${s.scope.padEnd(8)}] ${s.description}\n`);
    }
  });

skillsCmd
  .command('inspect <id>')
  .description('Inspect skill definition and instructions')
  .action((id: string) => {
    const sm = new SkillManager();
    const s = sm.getSkill(id, process.cwd());
    if (!s) {
      process.stderr.write(`Skill not found: ${id}\n`);
      process.exit(1);
    }
    process.stdout.write(`Skill: ${s.name} (${s.id})\nScope: ${s.scope}\n\n${s.instructions}\n`);
  });

const rulesCmd = program
  .command('rules')
  .description('Inspect active governing rules');

rulesCmd
  .command('list')
  .description('List active rules and precedence')
  .action(() => {
    const rm = new RuleManager();
    const rules = rm.listAllRules(process.cwd());
    for (const r of rules) {
      process.stdout.write(`[${r.scope.toUpperCase().padEnd(7)}] Priority ${String(r.priority).padStart(3)}: ${r.title}\n`);
    }
  });

const pluginsCmd = program
  .command('plugins')
  .description('Manage ANVEXO extension plugins');

pluginsCmd
  .command('list')
  .description('List installed plugins')
  .action(() => {
    const pm = new PluginManager();
    const plugins = pm.listAllPlugins(process.cwd());
    if (plugins.length === 0) {
      process.stdout.write('No plugins installed.\n');
      return;
    }
    for (const p of plugins) {
      process.stdout.write(`${p.id.padEnd(20)} v${p.version} [${p.enabled ? 'ENABLED' : 'DISABLED'}] ${p.description}\n`);
    }
  });

const mcpCmd = program
  .command('mcp')
  .description('Manage Model Context Protocol servers');

mcpCmd
  .command('list')
  .description('List configured MCP servers')
  .action(() => {
    const cm = new ConfigManager();
    const prefs = cm.loadUserPreferences();
    if (prefs.mcpServers.length === 0) {
      process.stdout.write('No MCP servers configured in preferences.\n');
      return;
    }
    for (const s of prefs.mcpServers) {
      process.stdout.write(`${s.id.padEnd(15)} [${s.transport}] ${s.name} (enabled: ${s.enabled})\n`);
    }
  });

mcpCmd
  .command('test <id>')
  .description('Test connection to configured MCP server')
  .action(async (id: string) => {
    const cm = new ConfigManager();
    const prefs = cm.loadUserPreferences();
    const s = prefs.mcpServers.find((server) => server.id === id);
    if (!s) {
      process.stderr.write(`MCP server not found: ${id}\n`);
      process.exit(1);
    }
    const client = new McpClient(s);
    try {
      await client.connect();
      const tools = await client.listTools();
      process.stdout.write(`Connected to ${s.name}. Discovered ${tools.length} tools:\n`);
      for (const t of tools) {
        process.stdout.write(`  - ${t.name}: ${t.description || 'No description'}\n`);
      }
      await client.disconnect();
    } catch (err) {
      process.stderr.write(`MCP connection failed: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

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

    let mode = MemoryMode.PERSISTENT_INTELLIGENCE;
    if (opts.memoryMode === 'ephemeral' || opts.memoryMode === 'zero') {
      mode = MemoryMode.ZERO_PERSISTENT;
    } else if (opts.memoryMode === 'local') {
      mode = MemoryMode.LOCAL_CONTEXT;
    } else if (opts.memoryMode === 'cloud') {
      mode = MemoryMode.USER_CLOUD;
    }

    const autoApprove = Boolean(opts.autoApprove || program.opts().autoApprove);
    const engine = new InvestigationEngine(mode);
    const report = await engine.investigate({
      objective: opts.objective,
      repositoryPath: repoPath,
      autoApprove,
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
    const shutdown = async () => {
      await server.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await new Promise(() => {});
  });

program
  .command('impact')
  .description('Simulate downstream change impact for a file, module, or proposed diff')
  .argument('<target>', 'File, module, or symbol to simulate impact for')
  .option('-r, --repo <path>', 'Repository root path', process.cwd())
  .option('-d, --diff <path>', 'Optional git diff file for incremental analysis')
  .option('--json', 'Output report as JSON', false)
  .action(async (target: string, opts: { repo: string; diff?: string; json: boolean }) => {
    const fs = await import('node:fs');
    let diffContent: string | undefined;
    if (opts.diff && fs.existsSync(opts.diff)) {
      diffContent = fs.readFileSync(opts.diff, 'utf-8');
    }
    const simulator = new ChangeImpactSimulator(opts.repo);
    const report = await simulator.simulate({
      repoRoot: opts.repo,
      target,
      proposedDiff: diffContent,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(simulator.formatReport(report) + '\n');
    }
  });

program
  .command('reproduce')
  .description('Execute a controlled bug reproduction in isolated sandbox')
  .argument('<description>', 'Bug symptom, error message, or description')
  .option('-r, --repo <path>', 'Repository root path', process.cwd())
  .option('-c, --cmd <command>', 'Reproduction command to execute')
  .option('-t, --test <path>', 'Specific reproduction test file')
  .option('--verify-fix', 'Attempt fix verification by re-running reproduction and regression suite', false)
  .option('--regression-cmd <command>', 'Command to run full regression test suite', 'npm test')
  .option('--json', 'Output session as JSON', false)
  .action(async (desc: string, opts: { repo: string; cmd?: string; test?: string; verifyFix: boolean; regressionCmd: string; json: boolean }) => {
    const lab = new BugReproductionLab(opts.repo);
    let session = await lab.runReproduction({
      repoRoot: opts.repo,
      bugDescription: desc,
      reproductionCommand: opts.cmd,
      reproductionTestPath: opts.test,
    });
    if (opts.verifyFix && session.isReproduced) {
      session = await lab.verifyFix(session, opts.regressionCmd);
    }
    if (opts.json) {
      process.stdout.write(JSON.stringify(session, null, 2) + '\n');
    } else {
      process.stdout.write(lab.formatReport(session) + '\n');
    }
    process.exit(session.isReproduced || session.isFixed ? 0 : 1);
  });

program
  .command('verify')
  .description('Execute evidence-backed Proof Mode verification')
  .argument('[path]', 'Repository root path', process.cwd())
  .option('-o, --objective <objective>', 'Objective or claim to verify', 'Repository verification baseline')
  .option('--json', 'Output proof report as JSON', false)
  .action(async (repoPath: string, opts: { objective: string; json: boolean }) => {
    const engine = new InvestigationEngine();
    const rep = await engine.investigate({
      objective: opts.objective,
      repositoryPath: repoPath,
      autoApprove: true,
    });
    const verifier = new ProofVerifier(repoPath);
    if (rep.evidence) {
      verifier.ingestEvidenceRecords(rep.evidence);
    }
    const proofReport = verifier.generateReport(rep.id);
    if (opts.json) {
      process.stdout.write(JSON.stringify(proofReport, null, 2) + '\n');
    } else {
      process.stdout.write(verifier.formatReport(proofReport) + '\n');
    }
  });

const memoryCmd = program
  .command('memory')
  .description('Manage persistent Project Decision Memory');

memoryCmd
  .command('list')
  .description('List project decision records')
  .option('-r, --repo <path>', 'Repository root path', process.cwd())
  .option('-t, --type <type>', 'Filter by memory type')
  .option('-s, --search <query>', 'Search keywords')
  .option('--json', 'Output as JSON', false)
  .action((opts: { repo: string; type?: string; search?: string; json: boolean }) => {
    const mm = new DecisionMemoryManager(opts.repo);
    const records = mm.list({
      types: opts.type ? [opts.type as DecisionMemoryType] : undefined,
      search: opts.search,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(records, null, 2) + '\n');
    } else {
      process.stdout.write(`Project Decision Memory (${records.length} records):\n\n`);
      for (const r of records) {
        process.stdout.write(`[${r.type.toUpperCase()}] ${r.summary} (${r.status})\n`);
        process.stdout.write(`  ${r.explanation}\n`);
        if (r.relatedFiles.length > 0) {
          process.stdout.write(`  Files: ${r.relatedFiles.join(', ')}\n`);
        }
        process.stdout.write('\n');
      }
    }
  });

memoryCmd
  .command('add')
  .description('Add a new decision memory record')
  .option('-r, --repo <path>', 'Repository root path', process.cwd())
  .requiredOption('-t, --type <type>', 'Memory type (architecture_decision, implementation_choice, rejected_solution, etc.)')
  .requiredOption('-s, --summary <summary>', 'Summary headline')
  .requiredOption('-e, --explanation <explanation>', 'Detailed rationale')
  .option('-f, --files <files>', 'Comma-separated related files')
  .option('--tags <tags>', 'Comma-separated tags')
  .action((opts: { repo: string; type: string; summary: string; explanation: string; files?: string; tags?: string }) => {
    const mm = new DecisionMemoryManager(opts.repo);
    const rec = mm.add({
      type: opts.type as DecisionMemoryType,
      summary: opts.summary,
      explanation: opts.explanation,
      relatedFiles: opts.files ? opts.files.split(',').map(f => f.trim()) : [],
      tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : [],
    });
    process.stdout.write(`Created decision record: ${rec.id} [${rec.type}]\n`);
  });

memoryCmd
  .command('conflicts <proposal>')
  .description('Check a proposal against project decision memory for conflicts')
  .option('-r, --repo <path>', 'Repository root path', process.cwd())
  .action((proposal: string, opts: { repo: string }) => {
    const mm = new DecisionMemoryManager(opts.repo);
    const conflicts = mm.checkConflicts(proposal);
    if (conflicts.length === 0) {
      process.stdout.write('[PASS] No conflicts with documented project decisions.\n');
    } else {
      process.stdout.write(`[WARNING] Found ${conflicts.length} conflict(s):\n\n`);
      for (const c of conflicts) {
        process.stdout.write(`! [${c.severity.toUpperCase()}] ${c.summary}\n  ${c.explanation}\n\n`);
      }
    }
  });

const autonomyCmd = program
  .command('autonomy')
  .description('Inspect or manage Safe Autonomy Engine execution policies');

autonomyCmd
  .command('status')
  .description('Show current autonomy mode and security budget')
  .action(() => {
    const engine = new SafeAutonomyEngine('assisted');
    const state = engine.getState();
    const policy = engine.getPolicy();
    process.stdout.write(`Mode:                      ${policy.mode.toUpperCase()}\n`);
    process.stdout.write(`Require Mutation Approval: ${policy.requireApprovalForMutations ? 'YES' : 'NO'}\n`);
    process.stdout.write(`Require Command Approval:  ${policy.requireApprovalForCommands ? 'YES' : 'NO'}\n`);
    process.stdout.write(`Max Time Budget:           ${policy.budget.maxDurationSeconds}s\n`);
    process.stdout.write(`Max Tool Invocations:      ${policy.budget.maxToolInvocations}\n`);
    process.stdout.write(`Max File Modifications:    ${policy.budget.maxFileModifications}\n`);
    process.stdout.write(`Protected Paths:           ${policy.protectedPaths.length} patterns\n`);
  });

program.parse();
