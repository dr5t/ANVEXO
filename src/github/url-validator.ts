import type { GitHubRepoIdentifier } from './types.js';

export function parseAndValidateGitHubUrl(input: string, forceMock: boolean = false): GitHubRepoIdentifier {
  if (!input || typeof input !== 'string') {
    throw new Error('Repository URL cannot be empty.');
  }

  const trimmed = input.trim();
  if (trimmed.length > 500) {
    throw new Error('Repository input is too long.');
  }

  // Check for mock scheme
  if (trimmed.startsWith('mock://') || forceMock) {
    const rawPath = trimmed.replace(/^mock:\/\//, '');
    const parts = rawPath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Mock repository must have format mock://owner/repo (e.g. mock://dr5t/ANVEXO-demo)');
    }
    const [owner, repo] = parts;
    validateRepoPart('owner', owner);
    validateRepoPart('repo', repo);
    return {
      owner,
      repo: repo.replace(/\.git$/i, ''),
      host: 'github.com',
      originalUrl: `mock://${owner}/${repo.replace(/\.git$/i, '')}`,
      isMock: true,
    };
  }

  // Block dangerous schemes
  const lower = trimmed.toLowerCase();
  const dangerousSchemes = ['file:', 'javascript:', 'data:', 'vbscript:', 'ftp:', 'ssh:'];
  for (const scheme of dangerousSchemes) {
    if (lower.startsWith(scheme)) {
      throw new Error(`Unsupported or dangerous protocol scheme: ${scheme}`);
    }
  }

  let owner = '';
  let repo = '';
  let host = 'github.com';

  // Support SSH format: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(/^git@([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) {
    host = sshMatch[1].toLowerCase();
    owner = sshMatch[2];
    repo = sshMatch[3];
  } else {
    // Standard URL or shorthand
    let urlString = trimmed;
    if (!urlString.includes('://') && !urlString.startsWith('//')) {
      if (urlString.startsWith('github.com/')) {
        urlString = `https://${urlString}`;
      } else if (!urlString.includes('/') || urlString.split('/').length === 2) {
        // e.g. "dr5t/ANVEXO"
        const parts = urlString.split('/');
        if (parts.length === 2 && parts[0] && parts[1]) {
          owner = parts[0];
          repo = parts[1].replace(/\.git$/i, '');
        } else {
          throw new Error('Invalid repository format. Expected "owner/repo" or full GitHub URL.');
        }
      } else {
        urlString = `https://${urlString}`;
      }
    }

    if (!owner && !repo) {
      let parsed: URL;
      try {
        parsed = new URL(urlString);
      } catch {
        throw new Error(`Malformed repository URL: "${input}".`);
      }

      const parsedHost = parsed.hostname.toLowerCase();
      if (parsedHost !== 'github.com' && parsedHost !== 'www.github.com') {
        throw new Error(`Unsupported host: "${parsedHost}". ANVEXO currently supports github.com repositories.`);
      }
      host = 'github.com';

      // Path inspection
      const pathSegments = parsed.pathname
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);

      if (pathSegments.length < 2) {
        throw new Error('GitHub URL must specify both an owner and a repository name (e.g. https://github.com/owner/repo).');
      }

      owner = pathSegments[0];
      repo = pathSegments[1].replace(/\.git$/i, '');
    }
  }

  // Security and sanity validations
  validateRepoPart('owner', owner);
  validateRepoPart('repo', repo);

  return {
    owner,
    repo,
    host,
    originalUrl: `https://github.com/${owner}/${repo}`,
    isMock: false,
  };
}

function validateRepoPart(partName: string, value: string): void {
  if (!value || value.length === 0) {
    throw new Error(`Repository ${partName} cannot be empty.`);
  }
  if (value.length > 100) {
    throw new Error(`Repository ${partName} is too long.`);
  }
  if (value === '.' || value === '..' || value.includes('/')) {
    throw new Error(`Invalid characters in repository ${partName}.`);
  }
  // GitHub allowed username and repository pattern
  const validPattern = /^[A-Za-z0-9_.-]+$/;
  if (!validPattern.test(value)) {
    throw new Error(`Repository ${partName} "${value}" contains invalid characters. Only alphanumeric, dashes, dots, and underscores are permitted.`);
  }
}

export function normalizeGitHubUrl(input: string): string {
  const parsed = parseAndValidateGitHubUrl(input);
  return parsed.originalUrl;
}
