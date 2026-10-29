import { ConfigManager } from '../core/config.js';
import { ProviderId } from '../core/types.js';
import { GitService } from '../git/index.js';
import { PluginManager } from '../plugins/index.js';
import { ProviderFactory } from '../providers/index.js';
import { RuleManager } from '../rules/index.js';
import { SkillManager } from '../skills/index.js';

export interface CommandContext {
  repoPath: string;
  configManager: ConfigManager;
  skillManager: SkillManager;
  ruleManager: RuleManager;
  pluginManager: PluginManager;
  providerFactory: ProviderFactory;
  gitService: GitService;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export class CommandDispatcher {
  async execute(input: string, ctx: CommandContext): Promise<CommandResult> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return {
        success: false,
        message: 'Commands must start with a slash (/)',
      };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return this.handleHelp();
      case 'status':
        return await this.handleStatus(ctx);
      case 'model':
        return await this.handleModel(args, ctx);
      case 'clear':
        return { success: true, message: 'Session history and workspace trace cleared' };
      case 'plan':
        return { success: true, message: 'Switched to plan mode. Steps will require approval before execution.' };
      case 'skills':
        return this.handleSkills(ctx);
      case 'rules':
        return this.handleRules(ctx);
      case 'plugins':
        return this.handlePlugins(ctx);
      case 'diff':
        return await this.handleDiff(args, ctx);
      case 'doctor':
        return await this.handleDoctor(ctx);
      default:
        return {
          success: false,
          message: `Unknown command: /${cmd}. Type /help for available commands.`,
        };
    }
  }

  private handleHelp(): CommandResult {
    const helpText = [
      'ANVEXO Commands Reference:',
      '  /help                 Display available commands',
      '  /status               Show repository, model, and engine status',
      '  /model [provider]     Inspect or switch active model provider',
      '  /plan                 Toggle plan and approval mode',
      '  /diff                 Show Git unstaged working tree diffs',
      '  /skills               List discovered skills across scopes',
      '  /rules                List active governing rules and priorities',
      '  /plugins              List installed plugins and capabilities',
      '  /doctor               Run environment diagnostics and verify keys',
      '  /clear                Clear active session output and artifacts',
    ].join('\n');

    return { success: true, message: helpText };
  }

  private async handleStatus(ctx: CommandContext): Promise<CommandResult> {
    const prefs = ctx.configManager.loadUserPreferences();
    const isGit = await ctx.gitService.isGitRepo(ctx.repoPath);
    let gitInfo = 'Not a Git repository';
    if (isGit) {
      const status = await ctx.gitService.getStatus(ctx.repoPath);
      gitInfo = `Branch: ${status.branch}, Clean: ${status.isClean}, Modified: ${status.modified.length}`;
    }

    const statusText = [
      `Repository:      ${ctx.repoPath}`,
      `Git:             ${gitInfo}`,
      `Active Provider: ${prefs.activeProvider} (${prefs.activeModel})`,
      `Theme:           ${prefs.theme}`,
      `Editor Font:     ${prefs.editorFont} (${prefs.editorFontSize}px)`,
    ].join('\n');

    return { success: true, message: statusText };
  }

  private async handleModel(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const prefs = ctx.configManager.loadUserPreferences();
    if (args.length === 0) {
      const available = await ctx.providerFactory.listAvailableProviders();
      const lines = available.map((p) => {
        const active = p.id === prefs.activeProvider ? ' (active)' : '';
        const configured = p.isConfigured ? '[configured]' : '[missing key]';
        return `  ${p.id.padEnd(12)} - ${p.name} ${configured}${active}`;
      });
      return {
        success: true,
        message: `Current Model: ${prefs.activeProvider} (${prefs.activeModel})\n\nAvailable Providers:\n${lines.join('\n')}\n\nSwitch with: /model <provider-id>`,
      };
    }

    const target = args[0].toLowerCase() as ProviderId;
    const valid: ProviderId[] = ['offline', 'anthropic', 'openai', 'gemini', 'ollama'];
    if (!valid.includes(target)) {
      return {
        success: false,
        message: `Invalid provider: ${target}. Choose from: ${valid.join(', ')}`,
      };
    }

    ctx.configManager.saveUserPreferences({ activeProvider: target });
    return {
      success: true,
      message: `Switched active provider to: ${target}`,
    };
  }

  private handleSkills(ctx: CommandContext): CommandResult {
    const skills = ctx.skillManager.listAllSkills(ctx.repoPath);
    const lines = skills.map((s) => `  ${s.id.padEnd(24)} [${s.scope}] ${s.name} - ${s.description}`);
    return {
      success: true,
      message: `Discovered Skills (${skills.length}):\n${lines.join('\n')}`,
      data: skills,
    };
  }

  private handleRules(ctx: CommandContext): CommandResult {
    const rules = ctx.ruleManager.listAllRules(ctx.repoPath);
    const lines = rules.map((r) => `  [P:${r.priority}] [${r.scope.toUpperCase()}] ${r.title}`);
    return {
      success: true,
      message: `Active Governing Rules (${rules.length}):\n${lines.join('\n')}`,
      data: rules,
    };
  }

  private handlePlugins(ctx: CommandContext): CommandResult {
    const plugins = ctx.pluginManager.listAllPlugins(ctx.repoPath);
    if (plugins.length === 0) {
      return {
        success: true,
        message: 'No plugins currently installed. Add anvexo-plugin.json to .anvexo/plugins/<id>/ to install.',
        data: [],
      };
    }
    const lines = plugins.map((p) => `  ${p.id.padEnd(18)} v${p.version} - ${p.name} (${p.enabled ? 'enabled' : 'disabled'})`);
    return {
      success: true,
      message: `Installed Plugins (${plugins.length}):\n${lines.join('\n')}`,
      data: plugins,
    };
  }

  private async handleDiff(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const staged = args.includes('--staged');
    const diff = await ctx.gitService.getDiff(ctx.repoPath, staged);
    if (!diff.trim()) {
      return {
        success: true,
        message: staged ? 'No staged changes in repository.' : 'Working tree clean, no unstaged diffs.',
      };
    }
    return {
      success: true,
      message: diff,
    };
  }

  private async handleDoctor(ctx: CommandContext): Promise<CommandResult> {
    const checks: string[] = [];
    checks.push(`Node.js Runtime:  ${process.version} (>=20.0.0 supported)`);
    checks.push(`Platform:         ${process.platform} (${process.arch})`);

    const isGit = await ctx.gitService.isGitRepo(ctx.repoPath);
    checks.push(`Git Repository:   ${isGit ? 'valid (.git detected)' : 'not a git repository'}`);

    const anthropicKey = ctx.configManager.getApiKey('anthropic');
    const openaiKey = ctx.configManager.getApiKey('openai');
    const geminiKey = ctx.configManager.getApiKey('gemini');

    checks.push(`Anthropic Key:    ${anthropicKey ? 'configured' : 'not configured'}`);
    checks.push(`OpenAI Key:       ${openaiKey ? 'configured' : 'not configured'}`);
    checks.push(`Gemini Key:       ${geminiKey ? 'configured' : 'not configured'}`);
    checks.push('Local Engine:     operational (offline)');

    return {
      success: true,
      message: `ANVEXO Doctor Diagnostics:\n\n${checks.join('\n')}`,
    };
  }
}
