import { LogLevel } from './types.js';

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: string, component: string, message: string): string {
  return `[${formatTimestamp()}] [${level}] [${component}] ${message}`;
}

export function debug(component: string, message: string): void {
  if (currentLevel <= LogLevel.DEBUG) {
    process.stderr.write(formatMessage('DEBUG', component, message) + '\n');
  }
}

export function info(component: string, message: string): void {
  if (currentLevel <= LogLevel.INFO) {
    process.stderr.write(formatMessage('INFO', component, message) + '\n');
  }
}

export function warn(component: string, message: string): void {
  if (currentLevel <= LogLevel.WARN) {
    process.stderr.write(formatMessage('WARN', component, message) + '\n');
  }
}

export function error(component: string, message: string): void {
  if (currentLevel <= LogLevel.ERROR) {
    process.stderr.write(formatMessage('ERROR', component, message) + '\n');
  }
}
