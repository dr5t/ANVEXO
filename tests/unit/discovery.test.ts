import { describe, it, expect } from 'vitest';
import { discoverProject } from '../../src/discovery/index.js';
import * as path from 'node:path';

describe('discoverProject', () => {
  it('discovers the ANVEXO project itself', async () => {
    const projectRoot = path.resolve(process.cwd());
    const metadata = await discoverProject(projectRoot);

    expect(metadata.name).toBe('anvexo');
    expect(metadata.languages).toContain('typescript');
    expect(metadata.hasGit).toBe(true);
    expect(metadata.configFiles).toContain('package.json');
    expect(metadata.configFiles).toContain('tsconfig.json');
    expect(metadata.testRunner).toBe('vitest');
    expect(metadata.rootPath).toBe(projectRoot);
  });

  it('throws on nonexistent path', async () => {
    await expect(discoverProject('/nonexistent/path/xyz')).rejects.toThrow('does not exist');
  });

  it('throws on file path instead of directory', async () => {
    const filePath = path.resolve(process.cwd(), 'package.json');
    await expect(discoverProject(filePath)).rejects.toThrow('not a directory');
  });

  it('detects package manager from lock files', async () => {
    const metadata = await discoverProject(process.cwd());
    expect(metadata.packageManager).toBeTruthy();
  });
});
