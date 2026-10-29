import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ToolDefinition, ToolResult } from '../core/index.js';
import { PermissionScope } from '../core/index.js';

export function createFileReadTool(): ToolDefinition {
  return {
    name: 'file_read',
    description: 'Read the contents of a file',
    requiredPermission: PermissionScope.FILE_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const maxBytes = (args.maxBytes as number) || 1_048_576;

      if (!fs.existsSync(filePath)) {
        return { success: false, output: '', error: `File not found: ${filePath}`, duration: 0, metadata: {} };
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `Path is a directory: ${filePath}`, duration: 0, metadata: {} };
      }

      if (stat.size > maxBytes) {
        const buffer = Buffer.alloc(maxBytes);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, maxBytes, 0);
        fs.closeSync(fd);
        return {
          success: true,
          output: buffer.toString('utf-8'),
          duration: 0,
          metadata: { truncated: true, totalSize: stat.size, readBytes: maxBytes },
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, output: content, duration: 0, metadata: { size: stat.size } };
    },
  };
}

export function createFileListTool(): ToolDefinition {
  return {
    name: 'file_list',
    description: 'List files in a directory',
    requiredPermission: PermissionScope.FILE_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const dirPath = args.path as string;
      const maxDepth = (args.maxDepth as number) || 3;
      const entries: string[] = [];

      function walk(dir: string, depth: number): void {
        if (depth > maxDepth) return;
        let items: fs.Dirent[];
        try {
          items = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '__pycache__') continue;
          const full = path.join(dir, item.name);
          const rel = path.relative(args.path as string, full);
          if (item.isDirectory()) {
            entries.push(rel + '/');
            walk(full, depth + 1);
          } else {
            entries.push(rel);
          }
        }
      }

      if (!fs.existsSync(dirPath)) {
        return { success: false, output: '', error: `Directory not found: ${dirPath}`, duration: 0, metadata: {} };
      }

      walk(dirPath, 0);
      return { success: true, output: entries.join('\n'), duration: 0, metadata: { count: entries.length } };
    },
  };
}

export function createFileSearchTool(): ToolDefinition {
  return {
    name: 'file_search',
    description: 'Search for a pattern in files using grep',
    requiredPermission: PermissionScope.FILE_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const searchPath = args.path as string;
      const pattern = args.pattern as string;
      const maxResults = (args.maxResults as number) || 100;

      if (!pattern) {
        return { success: false, output: '', error: 'Pattern is required', duration: 0, metadata: {} };
      }

      try {
        const argsList = [
          '-rn',
          '--exclude-dir=node_modules',
          '--exclude-dir=dist',
          '--exclude-dir=.git',
          '--exclude-dir=coverage',
          '--exclude-dir=build',
          '--exclude-dir=vendor',
          '--include=*.ts',
          '--include=*.js',
          '--include=*.py',
          '--include=*.java',
          '--include=*.json',
          '--include=*.yaml',
          '--include=*.yml',
          '--include=*.toml',
          '--include=*.md',
          '--include=*.go',
          '--include=*.rs',
          '--include=*.c',
          '--include=*.cpp',
          '--include=*.h',
          '--include=*.jsx',
          '--include=*.tsx',
          '--include=*.vue',
          '--include=*.svelte',
          '--include=*.rb',
          '--include=*.php',
          '--include=*.swift',
          '--include=*.kt',
          '-m',
          String(maxResults),
          '--',
          pattern,
          searchPath,
        ];
        const res = spawnSync('grep', argsList, {
          encoding: 'utf-8',
          maxBuffer: 5_000_000,
          timeout: 10000,
          shell: false,
        });

        if (res.error) {
          return { success: false, output: '', error: res.error.message, duration: 0, metadata: {} };
        }

        const stdout = res.stdout || '';
        const lines = stdout.trim().split('\n').filter(Boolean);
        return { success: true, output: stdout.trim(), duration: 0, metadata: { matchCount: lines.length } };
      } catch {
        return { success: false, output: '', error: 'Search failed or timed out', duration: 0, metadata: {} };
      }
    },
  };
}

export function createGitStatusTool(): ToolDefinition {
  return {
    name: 'git_status',
    description: 'Get the current Git status of the repository',
    requiredPermission: PermissionScope.GIT_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const repoPath = args.path as string;
      try {
        const statusRes = spawnSync('git', ['status', '--porcelain'], {
          cwd: repoPath,
          encoding: 'utf-8',
          timeout: 5000,
          shell: false,
        });
        if (statusRes.error) {
          const msg = statusRes.error.message;
          if (msg.includes('not a git repository')) {
            return { success: true, output: 'Not a Git repository', duration: 0, metadata: { hasGit: false } };
          }
          return { success: false, output: '', error: msg, duration: 0, metadata: {} };
        }
        const stderr = statusRes.stderr || '';
        if (statusRes.status !== 0 && stderr.includes('not a git repository')) {
          return { success: true, output: 'Not a Git repository', duration: 0, metadata: { hasGit: false } };
        }
        const branchRes = spawnSync('git', ['branch', '--show-current'], {
          cwd: repoPath,
          encoding: 'utf-8',
          timeout: 5000,
          shell: false,
        });
        const output = statusRes.stdout || '';
        const branch = (branchRes.stdout || '').trim();
        return {
          success: true,
          output: `Branch: ${branch}\n${output}`.trim(),
          duration: 0,
          metadata: { branch, changedFiles: output.trim().split('\n').filter(Boolean).length },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: msg, duration: 0, metadata: {} };
      }
    },
  };
}

export function createGitLogTool(): ToolDefinition {
  return {
    name: 'git_log',
    description: 'Get recent Git commit history',
    requiredPermission: PermissionScope.GIT_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const repoPath = args.path as string;
      const count = Math.min((args.count as number) || 20, 100);
      try {
        const res = spawnSync('git', ['log', '--oneline', '--no-decorate', '-n', String(count)], {
          cwd: repoPath,
          encoding: 'utf-8',
          timeout: 5000,
          shell: false,
        });
        const stderr = res.stderr || '';
        if (res.status !== 0 && (stderr.includes('does not have any commits yet') || stderr.includes('unknown revision'))) {
          return { success: true, output: 'No commits in repository', duration: 0, metadata: { entryCount: 0 } };
        }
        if (res.error) {
          return { success: false, output: '', error: res.error.message, duration: 0, metadata: {} };
        }
        const output = (res.stdout || '').trim();
        return { success: true, output, duration: 0, metadata: { entryCount: output.split('\n').filter(Boolean).length } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: msg, duration: 0, metadata: {} };
      }
    },
  };
}

export function createGitDiffTool(): ToolDefinition {
  return {
    name: 'git_diff',
    description: 'Show unstaged changes in the repository',
    requiredPermission: PermissionScope.GIT_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const repoPath = args.path as string;
      const file = args.file as string | undefined;
      try {
        const gitArgs = file ? ['diff', '--', file] : ['diff'];
        const res = spawnSync('git', gitArgs, {
          cwd: repoPath,
          encoding: 'utf-8',
          timeout: 10000,
          shell: false,
        });
        if (res.error) {
          return { success: false, output: '', error: res.error.message, duration: 0, metadata: {} };
        }
        const output = (res.stdout || '').trim();
        return { success: true, output: output || 'No unstaged changes', duration: 0, metadata: {} };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: msg, duration: 0, metadata: {} };
      }
    },
  };
}

export function createRunCommandTool(): ToolDefinition {
  return {
    name: 'run_command',
    description: 'Execute a shell command in the repository',
    requiredPermission: PermissionScope.COMMAND_EXECUTE,
    risk: 'medium',
    async execute(args): Promise<ToolResult> {
      const cwd = args.path as string;
      const command = args.command as string;
      const timeout = (args.timeout as number) || 30000;

      if (!command) {
        return { success: false, output: '', error: 'Command is required', duration: 0, metadata: {} };
      }

      const cleanEnv: Record<string, string> = {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        USER: process.env.USER || '',
        SHELL: process.env.SHELL || '',
        NODE_ENV: process.env.NODE_ENV || 'test',
        CI: 'true',
      };

      try {
        const res = spawnSync(command, {
          cwd,
          encoding: 'utf-8',
          timeout,
          maxBuffer: 5_000_000,
          env: cleanEnv,
          shell: true,
        });

        const stdout = (res.stdout || '').trim();
        const stderr = (res.stderr || '').trim();

        if (res.error) {
          return {
            success: false,
            output: stdout,
            error: res.error.message,
            duration: 0,
            metadata: { command, exitCode: res.status ?? -1 },
          };
        }

        if (res.status !== 0) {
          return {
            success: false,
            output: stdout,
            error: stderr || `Command exited with code ${res.status}`,
            duration: 0,
            metadata: { command, exitCode: res.status ?? -1 },
          };
        }

        return { success: true, output: stdout, duration: 0, metadata: { command } };
      } catch (err: unknown) {
        const execErr = err as { stdout?: string; stderr?: string; status?: number; message?: string };
        return {
          success: false,
          output: execErr.stdout || '',
          error: execErr.stderr || execErr.message || 'Command failed',
          duration: 0,
          metadata: { command, exitCode: execErr.status },
        };
      }
    },
  };
}

export function registerBuiltinTools(registry: { register: (tool: ToolDefinition) => void }): void {
  registry.register(createFileReadTool());
  registry.register(createFileListTool());
  registry.register(createFileSearchTool());
  registry.register(createGitStatusTool());
  registry.register(createGitLogTool());
  registry.register(createGitDiffTool());
  registry.register(createRunCommandTool());
}
