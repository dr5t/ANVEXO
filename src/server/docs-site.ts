export interface DocSection {
  id: string;
  title: string;
  summary: string;
  content: string;
}

export const DOCUMENTATION_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: 'Overview and Architecture',
    summary: 'Master architecture of the ANVEXO developer ecosystem and shared runtime core.',
    content: `
      <h2>ANVEXO: Complete Developer Ecosystem</h2>
      <p>ANVEXO is an autonomous software investigation workbench, coding agent, and developer platform built around two core pillars:</p>
      <ul>
        <li><strong>ANVESHAN:</strong> Autonomous software investigation, hypothesis testing, evidence collection, and root-cause verification.</li>
        <li><strong>ECHO:</strong> Codebase intelligence, Git history indexing, architectural dependency mapping, and persistent project context.</li>
      </ul>
      <p>The ecosystem provides three connected interfaces sharing a single runtime core:</p>
      <ol>
        <li><strong>Desktop IDE:</strong> Split Canvas workbench with real file management, syntax editor, Git panel, integrated terminal, and contextual investigation panel.</li>
        <li><strong>Terminal CLI:</strong> Full terminal coding agent (anvexo) with plan/approval modes, doctor, config, skills, rules, plugins, and MCP management.</li>
        <li><strong>Documentation Platform:</strong> Comprehensive reference documentation and security specifications.</li>
      </ol>
      <p>All operations are evidence-backed. Mock data, simulated execution, and fake progress are prohibited across the platform.</p>
    `,
  },
  {
    id: 'cli',
    title: 'CLI Installation and Command Reference',
    summary: 'Complete guide for installing and using the anvexo terminal binary.',
    content: `
      <h2>ANVEXO Terminal CLI</h2>
      <p>The ANVEXO CLI is an interactive coding agent and investigation tool comparable to modern terminal agents.</p>
      <h3>Installation</h3>
      <pre><code>npm install -g anvexo
# or run directly from the workspace
npm link</code></pre>
      <h3>Command Reference</h3>
      <table>
        <thead>
          <tr><th>Command</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>anvexo doctor</code></td><td>Inspect Node version, Git status, provider keys, and system readiness.</td></tr>
          <tr><td><code>anvexo init [path]</code></td><td>Scaffold .anvexo/ directory with config.json, rules, and skills.</td></tr>
          <tr><td><code>anvexo agent [path]</code></td><td>Start interactive agent session with tool execution and streaming.</td></tr>
          <tr><td><code>anvexo investigate &lt;path&gt;</code></td><td>Run autonomous root-cause investigation on target repository.</td></tr>
          <tr><td><code>anvexo discover &lt;path&gt;</code></td><td>Inspect repository languages, frameworks, package managers, and entrypoints.</td></tr>
          <tr><td><code>anvexo config list</code></td><td>View active configuration and user preferences.</td></tr>
          <tr><td><code>anvexo skills list</code></td><td>List built-in, user, and workspace skills.</td></tr>
          <tr><td><code>anvexo rules list</code></td><td>View governing safety, user, and project rules by priority.</td></tr>
          <tr><td><code>anvexo plugins list</code></td><td>Inspect installed plugins and their permission scopes.</td></tr>
          <tr><td><code>anvexo mcp list</code></td><td>List configured Model Context Protocol servers.</td></tr>
          <tr><td><code>anvexo serve</code></td><td>Start local API server and Desktop Workbench on port 4173.</td></tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'workbench',
    title: 'Desktop IDE Workbench',
    summary: 'Using the Split Canvas workbench for editing, investigation, and testing.',
    content: `
      <h2>Desktop IDE Workbench</h2>
      <p>The ANVEXO Desktop Workbench is accessible locally at <code>http://127.0.0.1:4173</code>.</p>
      <h3>Core Panels</h3>
      <ul>
        <li><strong>Project Explorer:</strong> Real filesystem navigation with expandable folders, file creation, and deletion.</li>
        <li><strong>Code Editor:</strong> Real editor with line numbers, syntax styling, tabbed navigation, dirty state indicator, and diff viewer.</li>
        <li><strong>Investigation Workbench:</strong> Interactive objective prompt, hypothesis formation, real evidence findings, and audit log.</li>
        <li><strong>Git Workbench:</strong> Branch indicator, uncommitted files, diff view, stage/unstage controls, and commit workflow.</li>
        <li><strong>Integrated Terminal:</strong> Process execution, working directory awareness, exit status, and real command output.</li>
        <li><strong>Settings Modal:</strong> Six canonical themes (Obsidian Slate, Graphite, Midnight, Light, Solarized Dark, Solarized Light), typography controls, and memory persistence preferences.</li>
      </ul>
    `,
  },
  {
    id: 'anveshan',
    title: 'ANVESHAN Investigation Engine',
    summary: 'Autonomous root-cause analysis, hypothesis testing, diagnostic execution, and evidence tracking.',
    content: `
      <h2>ANVESHAN Investigation Engine</h2>
      <p>ANVESHAN is ANVEXO's autonomous software investigation engine that moves beyond simple code browsing into rigorous hypothesis-driven root-cause analysis.</p>
      <h3>Investigation Lifecycle</h3>
      <ol>
        <li><strong>Discovery &amp; Inspection:</strong> Analyzes git repository topography, unstaged diffs, branch state, and recently modified files.</li>
        <li><strong>Hypothesis Formulation:</strong> Automatically constructs testable hypotheses regarding the reported failure, regression, or defect.</li>
        <li><strong>Diagnostic Execution:</strong> Executes targeted diagnostics, automated tests, and code searches under explicit capability approval.</li>
        <li><strong>Evidence Synthesis:</strong> Classifies gathered artifacts into affirmative, contradictory, or inconclusive findings with exact file line links.</li>
        <li><strong>Remediation Recommendations:</strong> Synthesizes verified findings into targeted fixes, preventing hallucinations with explicit uncertainty bounds.</li>
      </ol>
      <p>Every step in ANVESHAN is recorded in a tamper-resistant DAG audit trail with real exit codes and execution runtimes.</p>
    `,
  },
  {
    id: 'echo',
    title: 'ECHO Codebase Intelligence',
    summary: 'Architectural dependency graphs, git commit tracking, contradiction detection, and local-first memory.',
    content: `
      <h2>ECHO Codebase Intelligence</h2>
      <p>ECHO maintains continuous architectural understanding of repositories across multi-session developer workflows.</p>
      <h3>Core Intelligence Capabilities</h3>
      <ul>
        <li><strong>Topological Dependency Graphing:</strong> Automatically parses package manifests, module import trees, and circular dependency structures.</li>
        <li><strong>Commit-Aware Staleness Detection:</strong> Compares cached index hashes against the current git HEAD commit, detecting out-of-sync intelligence automatically.</li>
        <li><strong>Contradiction Detection:</strong> Tracks discrepancies between historical test passes, git changes, and observed runtime behaviors.</li>
        <li><strong>Four Local-First Memory Modes:</strong> Supports Mode A (Ephemeral/Zero-Persistent), Mode B (Local Repo Context), Mode C (Persistent Intelligence), and Mode D (User-Controlled Cloud Storage).</li>
      </ul>
      <p>All intelligence indexing adheres strictly to local-first privacy, preventing unauthorized code exfiltration.</p>
    `,
  },
  {
    id: 'providers',
    title: 'Model Provider Integrations',
    summary: 'Configuring Anthropic, OpenAI, Gemini, Ollama, and built-in offline heuristic providers.',
    content: `
      <h2>Model Provider Abstraction</h2>
      <p>ANVEXO provides a unified model interface supporting commercial providers, local models, and offline execution:</p>
      <ul>
        <li><strong>Anthropic:</strong> Claude 3.5 Sonnet, Claude 3 Opus via ANTHROPIC_API_KEY.</li>
        <li><strong>OpenAI:</strong> GPT-4o, GPT-4o-mini via OPENAI_API_KEY.</li>
        <li><strong>Google Gemini:</strong> Gemini 1.5 Pro, Flash via GEMINI_API_KEY.</li>
        <li><strong>Ollama:</strong> Local models (Llama 3, Qwen) via OLLAMA_HOST (default http://127.0.0.1:11434).</li>
        <li><strong>Offline Heuristic:</strong> Local deterministic model provider with zero external network access and zero API keys required.</li>
      </ul>
      <p>Configure keys in <code>~/.anvexo/config.json</code> or standard environment variables.</p>
    `,
  },
  {
    id: 'skills',
    title: 'Skills System and SKILL.md',
    summary: 'Creating and executing reusable task workflows with frontmatter metadata.',
    content: `
      <h2>Skills System</h2>
      <p>Skills encapsulate reusable engineering workflows in standardized <code>SKILL.md</code> files. Skills provide workflow instructions but cannot grant themselves elevated security permissions.</p>
      <h3>Directory Hierarchy</h3>
      <ol>
        <li><strong>Built-in Skills:</strong> Bundled within ANVEXO core (investigate-bug, explain-codebase, review-diff, analyze-failing-tests, refactor-module, security-audit).</li>
        <li><strong>User Skills:</strong> Located in <code>~/.anvexo/skills/&lt;skill-name&gt;/SKILL.md</code>.</li>
        <li><strong>Workspace Skills:</strong> Located in <code>.anvexo/skills/&lt;skill-name&gt;/SKILL.md</code>.</li>
      </ol>
      <h3>SKILL.md Format</h3>
      <pre><code>---
name: investigate-bug
description: Perform autonomous evidence-backed root-cause analysis on a reported defect
version: 1.0.0
---

## Instructions
1. Inspect the reported stack trace or failing test.
2. Locate the source file and review relevant Git modifications.
3. Form verifiable hypotheses and execute diagnostic tests.
4. Report verified findings and propose targeted resolution.</code></pre>
    `,
  },
  {
    id: 'rules',
    title: 'Rules Engine and Precedence',
    summary: 'Hierarchical rule resolution across system, user, and workspace scopes.',
    content: `
      <h2>Rules Engine</h2>
      <p>The rules engine governs agent behavior through deterministic priority ordering:</p>
      <ul>
        <li><strong>System Safety Rules (Priority: 100):</strong> Non-negotiable constraints including path traversal defenses, secret redaction, and bounded loops.</li>
        <li><strong>User Rules (Priority: 50):</strong> User personal development guidelines from <code>~/.anvexo/rules/</code>.</li>
        <li><strong>Workspace Rules (Priority: 10):</strong> Project-specific conventions from <code>.anvexo/rules/</code>.</li>
      </ul>
      <p>Workspace rules cannot override system safety rules or expand security permissions.</p>
    `,
  },
  {
    id: 'plugins',
    title: 'Plugin System and Sandboxing',
    summary: 'Developing and installing extensions with anvexo-plugin.json manifests.',
    content: `
      <h2>Plugin System</h2>
      <p>ANVEXO plugins allow modular extension of tools and commands under strict capability gating.</p>
      <h3>Manifest Specification (anvexo-plugin.json)</h3>
      <pre><code>{
  "id": "git-tools-extension",
  "name": "Advanced Git Tools",
  "version": "1.0.0",
  "description": "Additional Git inspection and branch analysis tools",
  "main": "dist/index.js",
  "capabilities": ["git:read", "git:write"]
}</code></pre>
      <p>Plugins must explicitly declare required capabilities. Undeclared capabilities are blocked at runtime.</p>
    `,
  },
  {
    id: 'mcp',
    title: 'Model Context Protocol (MCP)',
    summary: 'Integrating external tools via stdio and HTTP JSON-RPC 2.0 transports.',
    content: `
      <h2>Model Context Protocol Integrations</h2>
      <p>ANVEXO integrates external tools using the open Model Context Protocol (MCP):</p>
      <ul>
        <li><strong>Stdio Transport:</strong> Spawns an external CLI process and communicates via JSON-RPC 2.0 over standard I/O pipes.</li>
        <li><strong>HTTP Transport:</strong> Connects to remote or local HTTP MCP servers using JSON-RPC 2.0 requests.</li>
      </ul>
      <p>Configure MCP servers in <code>.anvexo/config.json</code> under the <code>mcpServers</code> section.</p>
    `,
  },
  {
    id: 'security',
    title: 'Permission Engine and Security Model',
    summary: 'Defense-in-depth security baseline, path traversal defenses, and secret redaction.',
    content: `
      <h2>Security Engineering and Threat Model</h2>
      <p>ANVEXO enforces strict security controls preventing model hallucinations from causing destructive outcomes:</p>
      <ul>
        <li><strong>Central Permission Engine:</strong> Evaluates all tool invocations before execution. Scope permissions include <code>file:read</code>, <code>file:write</code>, <code>file:delete</code>, <code>command:execute</code>, <code>git:read</code>, <code>git:write</code>, <code>test:run</code>, and <code>network</code>.</li>
        <li><strong>Filesystem Defenses:</strong> Canonical path resolution (fs.realpathSync), null-byte rejection, and path-traversal boundary enforcement prevent directory escapes.</li>
        <li><strong>Command Injection Defenses:</strong> Argument array execution where supported, clean environment variables, subshell timeouts, and process tree termination.</li>
        <li><strong>Secret Redaction:</strong> Automatic regex-based masking of API keys, Bearer tokens, private keys, and passwords in all logs, reports, and UI responses.</li>
        <li><strong>Local Server Isolation:</strong> Bound strictly to 127.0.0.1 by default, Host header verification, Origin verification, and Sec-Fetch-Site cross-site request validation.</li>
      </ul>
    `,
  },
  {
    id: 'verification',
    title: 'Testing and Verification Baseline',
    summary: 'Automated test suite verification and quality standards.',
    content: `
      <h2>Quality and Verification</h2>
      <p>ANVEXO maintains strict test verification standards. No feature is marked complete without executed and passing tests.</p>
      <h3>Verification Commands</h3>
      <pre><code># Run complete test suite
npm test

# Run test coverage report
npm run test:coverage

# Run TypeScript type check
npm run build

# Run linter
npm run lint</code></pre>
      <p>All 147 tests across 20 core test suites execute without failures (100% pass rate), validating server security, permission enforcement, memory caching, tool execution, and discovery.</p>
    `,
  },
];

export function renderDocsHtml(activeSectionId: string = 'overview'): string {
  const currentSection = DOCUMENTATION_SECTIONS.find((s) => s.id === activeSectionId) || DOCUMENTATION_SECTIONS[0];

  const navLinks = DOCUMENTATION_SECTIONS.map((s) => {
    const activeClass = s.id === currentSection.id ? 'active' : '';
    return `<li><a href="/docs?page=${s.id}" class="nav-item ${activeClass}">${s.title}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANVEXO Documentation | ${currentSection.title}</title>
  <style>
    :root {
      --bg-base: #0C0D0E;
      --bg-surface: #141618;
      --bg-elevated: #24272A;
      --border-subtle: #2A2E33;
      --text-primary: #EDEDED;
      --text-secondary: #8A9096;
      --accent: #E54D2E;
      --accent-subtle: rgba(229, 77, 46, 0.15);
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-primary);
    }
    .brand-title {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.05em;
    }
    .brand-badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }
    .header-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      margin-left: 16px;
      transition: color 0.15s;
    }
    .header-links a:hover { color: var(--text-primary); }
    .layout-container {
      display: flex;
      flex: 1;
    }
    aside {
      width: 280px;
      background-color: var(--bg-surface);
      border-right: 1px solid var(--border-subtle);
      padding: 24px 16px;
      overflow-y: auto;
    }
    .nav-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      margin-bottom: 12px;
      padding-left: 8px;
    }
    aside ul { list-style: none; }
    .nav-item {
      display: block;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      margin-bottom: 2px;
      transition: all 0.15s;
    }
    .nav-item:hover {
      background-color: var(--bg-elevated);
      color: var(--text-primary);
    }
    .nav-item.active {
      background-color: var(--accent-subtle);
      color: var(--accent);
      font-weight: 600;
    }
    main {
      flex: 1;
      padding: 40px 48px;
      max-width: 900px;
      overflow-y: auto;
    }
    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 8px;
    }
    h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 24px 0 12px 0;
      color: var(--text-primary);
    }
    p {
      margin-bottom: 16px;
      color: var(--text-secondary);
      font-size: 14px;
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 24px;
      color: var(--text-secondary);
      font-size: 14px;
    }
    li { margin-bottom: 8px; }
    strong { color: var(--text-primary); }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-primary);
    }
    pre {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 20px;
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: #D1D5DB;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid var(--border-subtle);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: var(--bg-surface);
      color: var(--text-primary);
      font-weight: 600;
    }
    td { color: var(--text-secondary); }
    footer {
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      padding: 16px 24px;
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand-wrap">
      <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
        <polygon points="20,4 34,36 28,36 20,18 12,36 6,36" fill="#8A9096" />
        <polygon points="20,4 34,36 28,36 24,27 20,27 20,18" fill="#E54D2E" />
      </svg>
      <span class="brand-title">ANVEXO</span>
      <span class="brand-badge">DOCS</span>
    </a>
    <div class="header-links">
      <a href="/">Desktop IDE</a>
      <a href="/api/health">API Health</a>
      <a href="https://github.com/shauryatiwari/ANVEXO">Repository</a>
    </div>
  </header>

  <div class="layout-container">
    <aside>
      <div class="nav-title">Documentation</div>
      <ul>
        ${navLinks}
      </ul>
    </aside>

    <main>
      ${currentSection.content}
    </main>
  </div>

  <footer>
    <span>ANVEXO Developer Ecosystem: Autonomous Investigation and Engineering Platform</span>
    <span>147/147 Tests Verified (100% Pass)</span>
  </footer>
</body>
</html>`;
}
