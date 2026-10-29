const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  {
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  {
    regex: /\b(?:ghp_[a-zA-Z0-9]{30,40}|github_pat_[a-zA-Z0-9_]{60,82})\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    regex: /\bsk-[a-zA-Z0-9]{20,}\b/g,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    regex: /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    regex: /(password|passwd)["']?\s*[:=]\s*["']?([^\s"';&\[\]]{4,})["']?/gi,
    replacement: '$1="[REDACTED_SECRET]"',
  },
  {
    regex: /(secret|api_key|apikey|api[_-]?key|access[_-]?token|auth[_-]?token|token|auth)["']?\s*[:=]\s*["']?([^\s"';&\[\]]{4,})["']?/gi,
    replacement: '$1="[REDACTED]"',
  },
];

export function redactSecrets(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }
  let sanitized = input;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement);
  }
  return sanitized;
}
