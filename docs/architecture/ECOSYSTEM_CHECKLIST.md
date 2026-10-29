# ANVEXO Developer Ecosystem Implementation Checklist

## P0: Shared Core and Infrastructure
- [x] Baseline repository and test verification (147/147 tests passing across 20 suites)
- [x] User and project configuration engine (src/core/config.ts)
- [x] Model provider abstraction layer (src/providers/)
  - [x] ModelProvider interface and types
  - [x] Anthropic provider adapter
  - [x] OpenAI provider adapter
  - [x] Gemini provider adapter
  - [x] Ollama local provider adapter
  - [x] Local heuristic / offline agent provider
- [x] Central permission and policy engine extension (src/permissions/)
  - [x] Granular scopes (file:read, file:write, file:delete, command:execute, git:read, git:write, test:run, network, plugin:install, plugin:execute, mcp:connect)
  - [x] Path canonicalization and symlink containment
  - [x] Real-time audit log
- [x] Skills engine and SKILL.md system (src/skills/)
  - [x] SKILL.md specification and parser
  - [x] Discovery in project (.anvexo/skills) and user (~/.anvexo/skills)
  - [x] Built-in core skills
- [x] Rules engine (src/rules/)
  - [x] Multi-scope rule discovery (system, workspace, user)
  - [x] Deterministic precedence resolution
- [x] Plugin system (src/plugins/)
  - [x] Manifest validation (anvexo-plugin.json)
  - [x] Capability sandboxing and lifecycle
- [x] MCP client integration (src/mcp/)
  - [x] Stdio and HTTP transport adapter
  - [x] Dynamic tool registry conversion
- [x] Commands system (src/commands/)
  - [x] Slash command dispatcher (/help, /status, /model, /plan, /investigate, /test, /diff, /skills, /rules, /plugins, /doctor)
- [x] Interactive agent runtime (src/agent/)
  - [x] Bounded multi-step execution loop
  - [x] Plan mode and approval gates
  - [x] Session persistence

## P1: Terminal CLI Evolution
- [x] anvexo doctor command
- [x] anvexo init command
- [x] anvexo config command
- [x] anvexo skills command
- [x] anvexo rules command
- [x] anvexo plugins command
- [x] anvexo mcp command
- [x] anvexo agent / chat interactive mode
- [x] anvexo investigate (preserved and integrated)

## P2: Desktop IDE Expansion
- [x] Real filesystem project explorer (file open, tree navigation, file create/rename/delete)
- [x] Real code editor (syntax, lines, tabs, dirty indicators, save)
- [x] Real integrated terminal runner (interactive process execution, streaming)
- [x] Real Git panel (status, diffs, stage/unstage, commit)
- [x] Agent interactive coding & investigation panel
- [x] Skills, Rules, and Plugins explorer in UI
- [x] 6 Themes switcher (Obsidian Slate, Midnight Graphite, Light Paper, High Contrast Dark, High Contrast Light, Neutral Sand)

## P3: Website & Documentation Platform
- [x] Integrated documentation platform routes (/docs, /site)
- [x] Complete documentation pages for ecosystem specifications
- [x] Obsidian Slate brand consistency
