# ANVEXO Developer Ecosystem Implementation Checklist

## P0: Shared Core and Infrastructure
- [x] Baseline repository and test verification (109/109 tests passing)
- [ ] User and project configuration engine (src/core/config.ts)
- [ ] Model provider abstraction layer (src/providers/)
  - [ ] ModelProvider interface and types
  - [ ] Anthropic provider adapter
  - [ ] OpenAI provider adapter
  - [ ] Gemini provider adapter
  - [ ] Ollama local provider adapter
  - [ ] Local heuristic / offline agent provider
- [ ] Central permission and policy engine extension (src/permissions/)
  - [ ] Granular scopes (file:read, file:write, file:delete, command:execute, git:read, git:write, test:run, network, plugin:install, plugin:execute, mcp:connect)
  - [ ] Path canonicalization and symlink containment
  - [ ] Real-time audit log
- [ ] Skills engine and SKILL.md system (src/skills/)
  - [ ] SKILL.md specification and parser
  - [ ] Discovery in project (.anvexo/skills) and user (~/.anvexo/skills)
  - [ ] Built-in core skills
- [ ] Rules engine (src/rules/)
  - [ ] Multi-scope rule discovery (system, workspace, user)
  - [ ] Deterministic precedence resolution
- [ ] Plugin system (src/plugins/)
  - [ ] Manifest validation (anvexo-plugin.json)
  - [ ] Capability sandboxing and lifecycle
- [ ] MCP client integration (src/mcp/)
  - [ ] Stdio and HTTP transport adapter
  - [ ] Dynamic tool registry conversion
- [ ] Commands system (src/commands/)
  - [ ] Slash command dispatcher (/help, /status, /model, /plan, /investigate, /test, /diff, /skills, /rules, /plugins, /doctor)
- [ ] Interactive agent runtime (src/agent/)
  - [ ] Bounded multi-step execution loop
  - [ ] Plan mode and approval gates
  - [ ] Session persistence

## P1: Terminal CLI Evolution
- [ ] anvexo doctor command
- [ ] anvexo init command
- [ ] anvexo config command
- [ ] anvexo skills command
- [ ] anvexo rules command
- [ ] anvexo plugins command
- [ ] anvexo mcp command
- [ ] anvexo agent / chat interactive mode
- [ ] anvexo investigate (preserved and integrated)

## P2: Desktop IDE Expansion
- [ ] Real filesystem project explorer (file open, tree navigation, file create/rename/delete)
- [ ] Real code editor (syntax, lines, tabs, dirty indicators, save)
- [ ] Real integrated terminal runner (interactive process execution, streaming)
- [ ] Real Git panel (status, diffs, stage/unstage, commit)
- [ ] Agent interactive coding & investigation panel
- [ ] Skills, Rules, and Plugins explorer in UI
- [ ] 6 Themes switcher (Obsidian Slate, Midnight Graphite, Light Paper, High Contrast Dark, High Contrast Light, Neutral Sand)

## P3: Website & Documentation Platform
- [ ] Integrated documentation platform routes (/docs, /site)
- [ ] Complete documentation pages for ecosystem specifications
- [ ] Obsidian Slate brand consistency
