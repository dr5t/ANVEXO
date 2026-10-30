export { InvestigationEngine } from './engine/index.js';
export type { InvestigationOptions } from './engine/index.js';
export { PermissionManager } from './permissions/index.js';
export { ToolRegistry, registerBuiltinTools } from './tools/index.js';
export { discoverProject } from './discovery/index.js';
export { EvidenceCollector } from './evidence/index.js';
export { createInvestigationPlan } from './planner/index.js';
export { formatReport, generateFindings } from './reporting/index.js';
export { ContextManager, analyzeDependencies } from './context/index.js';
export type { StorageAdapter, DependencyAnalysisResult } from './context/index.js';
export {
  AnvexoServer,
  ApiRouter,
  RateLimiter,
  JobManager,
  validatePathWithinRoot,
  validateRepositoryExists,
  SecurityError,
} from './server/index.js';
export type { ServerConfig, RateLimitConfig, InvestigationJob, JobStatus } from './server/index.js';
export { ConfigManager } from './core/config.js';
export {
  ProviderFactory,
  OfflineModelProvider,
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
} from './providers/index.js';
export { SkillManager, parseSkillMarkdown } from './skills/index.js';
export { RuleManager } from './rules/index.js';
export { PluginManager } from './plugins/index.js';
export { McpClient } from './mcp/index.js';
export { GitService } from './git/index.js';
export { TerminalManager, TerminalSession } from './terminal/index.js';
export { CommandDispatcher } from './commands/index.js';
export { AgentRuntime } from './agent/index.js';
export * from './proof/index.js';
export * from './impact/index.js';
export * from './reproduction/index.js';
export * from './autonomy/index.js';
export * from './memory/index.js';
export * from './core/index.js';

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { AnvexoServer } = await import('./server/index.js');
  const server = new AnvexoServer();
  const { url } = await server.start();
  process.stdout.write(`ANVEXO Workbench server running at ${url}\n`);
  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
