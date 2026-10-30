import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ToolDefinition, ToolResult } from '../core/index.js';
import { PermissionScope, redactSecrets } from '../core/index.js';
import { validatePathWithinRoot } from '../server/security.js';
import {
  isSafeDiagnosticCommand,
  isShellExecutable,
  isTestCommand,
  parseCommandLine,
  resolveShellFreeCommand,
} from '../terminal/command.js';

const sensitiveSystemPaths = new Set(['/etc/passwd', '/etc/shadow', '/etc/sudoers']);

function isSensitiveSystemPath(filePath: string): boolean {
  const portablePath = filePath.replace(/\\/g, '/');
  return sensitiveSystemPaths.has(path.posix.resolve(portablePath));
}

export function getCleanSubprocessEnv(): Record<string, string> {
  return {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    USER: process.env.USER || '',
    SHELL: process.env.SHELL || '',
    LANG: process.env.LANG || 'en_US.UTF-8',
    TMPDIR: process.env.TMPDIR || '/tmp',
    NODE_ENV: process.env.NODE_ENV || 'test',
    CI: 'true',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
  };
}

function executeCommandTool(args: Record<string, unknown>, command: string, timeout: number, testOnly: boolean): ToolResult {
  const parsed = parseCommandLine(command);
  if (!parsed) {
    return { success: false, output: '', error: 'Command rejected: shell syntax is not allowed.', duration: 0, metadata: {} };
  }
  if (isShellExecutable(parsed.executable)) {
    return { success: false, output: '', error: 'Command rejected: shell executables are not allowed.', duration: 0, metadata: {} };
  }
  if (testOnly && !isTestCommand(parsed)) {
    return { success: false, output: '', error: 'Command rejected: executable is not an approved test runner.', duration: 0, metadata: {} };
  }

  const requestedCwd = typeof args.path === 'string' ? args.path : process.cwd();
  let cwd = path.resolve(requestedCwd);
  const rootPath = typeof args.rootPath === 'string' ? args.rootPath : undefined;
  if (rootPath) {
    try {
      cwd = validatePathWithinRoot(requestedCwd, rootPath);
    } catch {
      return { success: false, output: '', error: 'Command rejected: working directory must remain inside the workspace.', duration: 0, metadata: {} };
    }
  }

  if (args.autonomyMode === 'observe' && !isSafeDiagnosticCommand(command, rootPath || cwd)) {
    return { success: false, output: '', error: 'Command rejected by Observe mode: only approved read-only diagnostics are allowed.', duration: 0, metadata: {} };
  }

  const invocation = resolveShellFreeCommand(parsed, cwd);
  const invocationArgs = [...invocation.args];
  if (args.autonomyMode === 'observe' && path.win32.basename(invocation.executable).toLowerCase() === 'git') {
    invocationArgs.unshift('-c', 'core.fsmonitor=false', '--no-pager');
    if (invocationArgs.includes('diff')) invocationArgs.splice(2, 0, '-c', 'diff.external=');
    if (invocationArgs.includes('diff') && !invocationArgs.includes('--no-ext-diff')) invocationArgs.push('--no-ext-diff');
  }

  const metadata = { command: redactSecrets(command) };
  try {
    const result = spawnSync(invocation.executable, invocationArgs, {
      cwd,
      encoding: 'utf-8',
      timeout,
      maxBuffer: 5_000_000,
      env: getCleanSubprocessEnv(),
      shell: false,
    });
    const stdout = redactSecrets((result.stdout || '').trim());
    const stderr = redactSecrets((result.stderr || '').trim());

    if (result.error) {
      return { success: false, output: stdout, error: redactSecrets(result.error.message), duration: 0, metadata: { ...metadata, exitCode: result.status ?? -1 } };
    }

    const success = result.status === 0;
    return {
      success,
      output: testOnly && !stdout ? stderr : stdout,
      error: success ? undefined : (stderr || `${testOnly ? 'Tests' : 'Command'} failed with exit code ${result.status}`),
      duration: 0,
      metadata: { ...metadata, exitCode: result.status ?? -1 },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Command failed';
    return { success: false, output: '', error: redactSecrets(message), duration: 0, metadata };
  }
}

export function createFileReadTool(): ToolDefinition {
  return {
    name: 'file_read',
    description: 'Read the contents of a file',
    requiredPermission: PermissionScope.FILE_READ,
    risk: 'low',
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const maxBytes = (args.maxBytes as number) || 1_048_576;

      if (!filePath || typeof filePath !== 'string') {
        return { success: false, output: '', error: 'Path is required', duration: 0, metadata: {} };
      }

      if (filePath.includes('\0')) {
        return { success: false, output: '', error: 'Null byte detected in path', duration: 0, metadata: {} };
      }

      if (isSensitiveSystemPath(filePath)) {
        return { success: false, output: '', error: 'Access to system sensitive files is forbidden', duration: 0, metadata: {} };
      }

      let resolved = path.resolve(filePath);
      if (args.rootPath && typeof args.rootPath === 'string') {
        try {
          resolved = validatePathWithinRoot(filePath, args.rootPath);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, output: '', error: msg, duration: 0, metadata: {} };
        }
      }

      if (!fs.existsSync(resolved)) {
        return { success: false, output: '', error: `File not found: ${filePath}`, duration: 0, metadata: {} };
      }

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `Path is a directory: ${filePath}`, duration: 0, metadata: {} };
      }

      if (stat.size > maxBytes) {
        const buffer = Buffer.alloc(maxBytes);
        const fd = fs.openSync(resolved, 'r');
        fs.readSync(fd, buffer, 0, maxBytes, 0);
        fs.closeSync(fd);
        return {
          success: true,
          output: redactSecrets(buffer.toString('utf-8')),
          duration: 0,
          metadata: { truncated: true, totalSize: stat.size, readBytes: maxBytes },
        };
      }

      const content = fs.readFileSync(resolved, 'utf-8');
      return { success: true, output: redactSecrets(content), duration: 0, metadata: { size: stat.size } };
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
    description: 'Search for a pattern in files',
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
        const searchRoot = path.resolve(searchPath);
        if (!fs.existsSync(searchRoot) || !fs.statSync(searchRoot).isDirectory()) {
          return { success: false, output: '', error: `Search directory not found: ${searchPath}`, duration: 0, metadata: {} };
        }

        let matcher: RegExp;
        try {
          matcher = new RegExp(pattern);
        } catch {
          return { success: false, output: '', error: 'Search pattern is not a valid regular expression', duration: 0, metadata: {} };
        }

        const allowedExtensions = new Set([
          '.ts', '.js', '.py', '.java', '.json', '.yaml', '.yml', '.toml', '.md',
          '.go', '.rs', '.c', '.cpp', '.h', '.jsx', '.tsx', '.vue', '.svelte',
          '.rb', '.php', '.swift', '.kt',
        ]);
        const excludedDirectories = new Set(['node_modules', 'dist', '.git', '.anvexo', 'coverage', 'build', 'vendor']);
        const matches: string[] = [];

        function searchDirectory(directory: string): void {
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink() || (entry.isDirectory() && excludedDirectories.has(entry.name))) {
              continue;
            }

            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
              searchDirectory(entryPath);
              continue;
            }
            if (!entry.isFile() || !allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
              continue;
            }

            const contents = fs.readFileSync(entryPath, 'utf-8').split(/\r?\n/);
            let fileMatchCount = 0;
            for (let index = 0; index < contents.length && fileMatchCount < maxResults; index++) {
              if (matcher.test(contents[index])) {
                matches.push(`${entryPath}:${index + 1}:${contents[index]}`);
                fileMatchCount++;
              }
            }
          }
        }

        searchDirectory(searchRoot);
        const output = redactSecrets(matches.join('\n'));
        return { success: true, output, duration: 0, metadata: { matchCount: matches.length } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `Search failed: ${message}`, duration: 0, metadata: {} };
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
          env: getCleanSubprocessEnv(),
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
          env: getCleanSubprocessEnv(),
          shell: false,
        });
        const output = redactSecrets(statusRes.stdout || '');
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
          env: getCleanSubprocessEnv(),
          shell: false,
        });
        const stderr = res.stderr || '';
        if (res.status !== 0 && (stderr.includes('does not have any commits yet') || stderr.includes('unknown revision'))) {
          return { success: true, output: 'No commits in repository', duration: 0, metadata: { entryCount: 0 } };
        }
        if (res.error) {
          return { success: false, output: '', error: res.error.message, duration: 0, metadata: {} };
        }
        const output = redactSecrets((res.stdout || '').trim());
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
          env: getCleanSubprocessEnv(),
          shell: false,
        });
        if (res.error) {
          return { success: false, output: '', error: res.error.message, duration: 0, metadata: {} };
        }
        const output = redactSecrets((res.stdout || '').trim());
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
      const command = args.command;
      const timeout = (args.timeout as number) || 30000;

      if (typeof command !== 'string' || !command.trim()) {
        return { success: false, output: '', error: 'Command is required', duration: 0, metadata: {} };
      }
      return executeCommandTool(args, command, timeout, false);
    },
  };
}

export function createFileWriteTool(): ToolDefinition {
  return {
    name: 'file_write',
    description: 'Write content to a file in the workspace',
    requiredPermission: PermissionScope.FILE_WRITE,
    risk: 'medium',
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const content = args.content as string;

      if (!filePath || typeof filePath !== 'string') {
        return { success: false, output: '', error: 'Path is required', duration: 0, metadata: {} };
      }
      if (typeof content !== 'string') {
        return { success: false, output: '', error: 'Content is required', duration: 0, metadata: {} };
      }
      if (filePath.includes('\0')) {
        return { success: false, output: '', error: 'Null byte detected in path', duration: 0, metadata: {} };
      }

      if (isSensitiveSystemPath(filePath)) {
        return { success: false, output: '', error: 'Access to system sensitive files is forbidden', duration: 0, metadata: {} };
      }

      let resolved = path.resolve(filePath);
      if (args.rootPath && typeof args.rootPath === 'string') {
        try {
          resolved = validatePathWithinRoot(filePath, args.rootPath);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, output: '', error: msg, duration: 0, metadata: {} };
        }
      }

      try {
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolved, content, 'utf-8');
        return {
          success: true,
          output: `Successfully wrote ${Buffer.byteLength(content, 'utf-8')} bytes to ${filePath}`,
          duration: 0,
          metadata: { path: filePath, bytes: Buffer.byteLength(content, 'utf-8') },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: msg, duration: 0, metadata: {} };
      }
    },
  };
}

export function createFileDeleteTool(): ToolDefinition {
  return {
    name: 'file_delete',
    description: 'Delete a file in the workspace',
    requiredPermission: PermissionScope.FILE_DELETE,
    risk: 'high',
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;

      if (!filePath || typeof filePath !== 'string') {
        return { success: false, output: '', error: 'Path is required', duration: 0, metadata: {} };
      }
      if (filePath.includes('\0')) {
        return { success: false, output: '', error: 'Null byte detected in path', duration: 0, metadata: {} };
      }

      if (isSensitiveSystemPath(filePath)) {
        return { success: false, output: '', error: 'Access to system sensitive files is forbidden', duration: 0, metadata: {} };
      }

      let resolved = path.resolve(filePath);
      if (args.rootPath && typeof args.rootPath === 'string') {
        try {
          resolved = validatePathWithinRoot(filePath, args.rootPath);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, output: '', error: msg, duration: 0, metadata: {} };
        }
      }

      if (!fs.existsSync(resolved)) {
        return { success: false, output: '', error: `File not found: ${filePath}`, duration: 0, metadata: {} };
      }

      try {
        fs.unlinkSync(resolved);
        return {
          success: true,
          output: `Successfully deleted file ${filePath}`,
          duration: 0,
          metadata: { path: filePath },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: msg, duration: 0, metadata: {} };
      }
    },
  };
}

export function createTestRunTool(): ToolDefinition {
  return {
    name: 'test_run',
    description: 'Execute tests in the repository',
    requiredPermission: PermissionScope.TEST_RUN,
    risk: 'medium',
    async execute(args): Promise<ToolResult> {
      const command = typeof args.command === 'string' && args.command.trim() ? args.command : 'npm test';
      const timeout = (args.timeout as number) || 60000;
      return executeCommandTool(args, command, timeout, true);
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

export function registerWorkspaceTools(registry: { register: (tool: ToolDefinition) => void }): void {
  registerBuiltinTools(registry);
  registry.register(createFileWriteTool());
  registry.register(createFileDeleteTool());
  registry.register(createTestRunTool());
}
