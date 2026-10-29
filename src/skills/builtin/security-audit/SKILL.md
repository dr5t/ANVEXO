---
name: security-audit
description: Audit codebase for path traversals, command injection, secret leakage, and permission flaws
tools: file_search, file_read
---

# Security Audit Skill

Conduct rigorous threat-model audits against codebase attack vectors and hostile inputs.

## Workflow

1. Search for command execution points (`spawn`, `exec`, `child_process`). Verify direct argument vector usage (`shell: false`).
2. Search for filesystem path construction (`join`, `resolve`). Verify canonicalization (`realpathSync`) and containment checks.
3. Search for secret patterns, API tokens, and private keys. Verify automated redaction.
4. Verify HTTP security boundaries: Host headers, Origin headers, CORS restrictions, rate limits.
5. Produce a verified audit report detailing risks and required remediations.

## Arguments
- `scope`: Target directory to audit (default: src)

## Prompts
- "Audit src/server for path traversal and host header vulnerabilities"
- "Audit all tool execution boundaries for shell injection vectors"
