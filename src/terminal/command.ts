import * as fs from 'node:fs';
import * as path from 'node:path';
import { validatePathWithinRoot } from '../server/security.js';

export interface ParsedCommand {
  executable: string;
  args: string[];
}

const shellExecutables = new Set(['bash', 'cmd', 'csh', 'dash', 'fish', 'ksh', 'powershell', 'pwsh', 'sh', 'tcsh', 'zsh']);
const safeTestFlags = new Set(['--coverage', '--no-coverage', '--no-color', '--passwithnotests', '--verbose', '--reporter=verbose', '-v']);
const safeGitStatusFlags = new Set(['--short', '--porcelain', '--branch', '--untracked-files=no']);
const safeGitLogFlags = new Set(['--oneline', '--no-decorate']);
const safeGitDiffFlags = new Set(['--stat', '--cached', '--no-ext-diff', '--no-textconv']);
const safeGitBranchFlags = new Set(['--show-current', '--list']);

export function parseCommandLine(command: string): ParsedCommand | undefined {
  if (!command.trim() || command.includes('\0') || /[\r\n]/.test(command)) return undefined;

  const tokens: string[] = [];
  let token = '';
  let tokenStarted = false;
  let quote: 'single' | 'double' | undefined;

  for (let index = 0; index < command.length; index++) {
    const character = command[index];

    if (quote === 'single') {
      if (character === "'") quote = undefined;
      else token += character;
      tokenStarted = true;
      continue;
    }

    if (quote === 'double') {
      if (character === '"') {
        quote = undefined;
      } else if (character === '\\' && (command[index + 1] === '"' || command[index + 1] === '\\')) {
        token += command[++index];
      } else {
        token += character;
      }
      tokenStarted = true;
      continue;
    }

    if (character === '"') {
      quote = 'double';
      tokenStarted = true;
      continue;
    }
    if (character === "'") {
      quote = 'single';
      tokenStarted = true;
      continue;
    }
    if (';&|<>'.includes(character) || character === '`' || (character === '$' && command[index + 1] === '(')) {
      return undefined;
    }
    if (character === '\\' && /[\s'"\\]/.test(command[index + 1] || '')) {
      token += command[++index];
      tokenStarted = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = '';
        tokenStarted = false;
      }
      continue;
    }

    token += character;
    tokenStarted = true;
  }

  if (quote) return undefined;
  if (tokenStarted) tokens.push(token);
  if (tokens.length === 0 || !tokens[0]) return undefined;

  return { executable: tokens[0], args: tokens.slice(1) };
}

export function isShellExecutable(executable: string): boolean {
  const name = path.win32.basename(executable).toLowerCase().replace(/\.exe$/, '');
  return shellExecutables.has(name);
}

export function isTestCommand(command: ParsedCommand, rootPath?: string): boolean {
  const executable = commandName(command.executable);
  const args = command.args;

  if (executable === 'npm') return args.length === 1 && args[0] === 'test';
  if (executable === 'vitest') return args[0] === 'run' && isSafeTestArguments(args.slice(1), rootPath);
  if (executable === 'npx') {
    if (args[0] === 'vitest') return args[1] === 'run' && isSafeTestArguments(args.slice(2), rootPath);
    if (args[0] === 'jest' || args[0] === 'mocha' || args[0] === 'ava') {
      return isSafeTestArguments(args.slice(1), rootPath);
    }
  }
  if (executable === 'python' || executable === 'python3') {
    return args[0] === '-m' && args[1] === 'pytest' && isSafeTestArguments(args.slice(2), rootPath);
  }
  if (executable === 'cargo') return args[0] === 'test' && isSafeTestArguments(args.slice(1), rootPath);
  return false;
}

export function isSafeDiagnosticCommand(command: string | undefined, rootPath?: string): boolean {
  if (!command) return true;
  const parsed = parseCommandLine(command);
  if (!parsed || isShellExecutable(parsed.executable)) return false;

  const executable = commandName(parsed.executable);
  const args = parsed.args;
  if (isTestCommand(parsed, rootPath)) return true;

  if (executable === 'git') {
    const subcommand = args[0];
    const options = args.slice(1);
    if (subcommand === 'status') return options.every(option => safeGitStatusFlags.has(option));
    if (subcommand === 'log') return areSafeGitLogArguments(options);
    if (subcommand === 'diff') return areSafeGitDiffArguments(options, rootPath);
    if (subcommand === 'branch') return options.every(option => safeGitBranchFlags.has(option));
    return false;
  }

  if (executable === 'ls') {
    return args.every(argument => {
      if (['-a', '-l', '-la', '-al'].includes(argument)) return true;
      return isContainedPath(argument, rootPath, 'directory');
    });
  }

  if (executable === 'cat') {
    return args.length > 0 && args.every(argument => isContainedPath(argument, rootPath, 'file') && !isProtectedReadPath(argument));
  }

  return false;
}

export function resolveShellFreeCommand(command: ParsedCommand, cwd: string): ParsedCommand {
  if (process.platform !== 'win32') return command;

  const executable = commandName(command.executable);
  if (executable === 'npm' || executable === 'npx') {
    const npmExecPath = process.env.npm_execpath;
    const npmBinDirectory = npmExecPath
      ? path.dirname(npmExecPath)
      : path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin');
    const cliPath = path.join(npmBinDirectory, executable === 'npm' ? 'npm-cli.js' : 'npx-cli.js');
    if (fs.existsSync(cliPath)) return { executable: process.execPath, args: [cliPath, ...command.args] };
  }

  if (executable === 'vitest') {
    const cliPath = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
    if (fs.existsSync(cliPath)) return { executable: process.execPath, args: [cliPath, ...command.args] };
  }

  return command;
}

function commandName(executable: string): string {
  return path.win32.basename(executable).toLowerCase().replace(/\.(?:cmd|exe|bat)$/, '');
}

function isSafeTestArguments(args: string[], rootPath?: string): boolean {
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (safeTestFlags.has(argument.toLowerCase())) continue;
    if (argument === '--reporter' && ['spec', 'verbose'].includes((args[index + 1] || '').toLowerCase())) {
      index++;
      continue;
    }
    if (argument.startsWith('-') || !isSafeRelativeArgument(argument)) return false;
    if (rootPath && rootPath !== '*' && !isContainedPath(argument, rootPath, 'file')) return false;
  }
  return true;
}

function areSafeGitLogArguments(args: string[]): boolean {
  for (let index = 0; index < args.length; index++) {
    if (safeGitLogFlags.has(args[index])) continue;
    if (args[index] === '-n' && /^\d{1,3}$/.test(args[index + 1] || '')) {
      index++;
      continue;
    }
    return false;
  }
  return true;
}

function areSafeGitDiffArguments(args: string[], rootPath?: string): boolean {
  for (let index = 0; index < args.length; index++) {
    if (safeGitDiffFlags.has(args[index])) continue;
    if (args[index] === '--') {
      return args.slice(index + 1).every(argument => isContainedPath(argument, rootPath));
    }
    return false;
  }
  return true;
}

function isSafeRelativeArgument(argument: string): boolean {
  const portablePath = argument.replace(/\\/g, '/');
  return !path.isAbsolute(argument)
    && !path.win32.isAbsolute(argument)
    && !portablePath.split('/').includes('..')
    && !portablePath.startsWith('~');
}

function isContainedPath(argument: string, rootPath: string | undefined, type?: 'file' | 'directory'): boolean {
  if (!rootPath || rootPath === '*' || !isSafeRelativeArgument(argument) || isProtectedReadPath(argument)) return false;
  try {
    const resolved = validatePathWithinRoot(argument, rootPath);
    const stat = fs.statSync(resolved);
    return type === 'file' ? stat.isFile() : type === 'directory' ? stat.isDirectory() : true;
  } catch {
    return false;
  }
}

function isProtectedReadPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/');
  return segments.some(segment => segment === '.git' || segment === '.ssh' || segment === '.env' || segment.startsWith('.env.') || segment === 'id_rsa' || segment === 'id_ed25519' || segment.endsWith('.pem') || segment.endsWith('.key'));
}