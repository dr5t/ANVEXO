# ANVEXO Team Workstreams & Architecture Ownership

## 1. Executive Summary & Objective

This document defines the roles, system component ownership, and non-overlapping workstreams for the five-person engineering team developing **ANVEXO**. 

The strategic goal of this team structure is to prepare a production-grade submission for:
1. **MLH Best Use of Gemma 4** (demonstrating model routing via Gemini API and local Ollama/vLLM daemon, multimodal screenshot/log diagnosis, and structured regression recommendations).
2. **MLH Best Open-Source AI Project** (demonstrating transparent architecture, deterministic tool execution, scope-based permissions, reproducible Proof Mode verification, and open-source licensing).

---

## 2. Team Structure & Component Ownership

```
+---------------------------------------------------------------------------------------+
|                                    PROJECT LEAD (Me)                                  |
|   Architecture Governance | PR Approval | Workflow Orchestrator | Release Management  |
+---------------------------------------------------------------------------------------+
         |                          |                           |                   |
         v                          v                           v                   v
+------------------+     +--------------------+     +-------------------+     +------------------+
|    MEMBER 2      |     |     MEMBER 3       |     |     MEMBER 4      |     |     MEMBER 5     |
| Gemma 4 Runtime  |     | ANVESHAN Engine    |     | ECHO Intelligence |     | Proof Mode & CI  |
| Provider Routing |     | Step Planning      |     | Dependency Graph  |     | Regression Suite |
| Multimodal Tests |     | Evidence Reports   |     | Change Impact Sim |     | OS Licensing     |
+------------------+     +--------------------+     +-------------------+     +------------------+
```

### Detailed Ownership Matrix

| Role | Focus Area | Primary Codebase Files Owned | Restricted / Read-Only Files |
| :--- | :--- | :--- | :--- |
| **Project Lead (You)** | Architecture, Cross-Feature Workflow, Server/CLI Integration, Governance | `src/engine/workflow.ts`, `src/cli/index.ts`, `src/server/router.ts`, `src/server/server.ts` | All submodules (approves changes across all) |
| **Member 2** | Gemma 4 Provider, Multimodal Diagnostics, Local Daemon Routing | `src/providers/gemma.ts`, `tests/unit/gemma.test.ts`, `tests/integration/gemma.test.ts` | `src/engine/`, `src/context/`, `src/proof/` |
| **Member 3** | ANVESHAN Engine, Hypothesis Engine, Structured Reporting | `src/engine/index.ts`, `src/engine/hypotheses.ts`, `src/reporting/index.ts`, `src/reporting/markdown.ts`, `tests/unit/reporting.test.ts` | `src/providers/gemma.ts`, `src/impact/`, `src/autonomy/` |
| **Member 4** | ECHO Intelligence, Change Impact Simulator, Dependency Visualizer | `src/context/dependencies.ts`, `src/impact/simulator.ts`, `src/impact/graph.ts`, `tests/unit/impact.test.ts` | `src/providers/`, `src/proof/`, `src/server/` |
| **Member 5** | Proof Mode Verifier, Regression Testing, CI Workflows, Open-Source Licensing | `src/proof/verifier.ts`, `src/proof/types.ts`, `.github/workflows/ci.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `LICENSE`, `package.json` (license/scripts) | `src/engine/`, `src/context/`, `src/providers/` |

---

## 3. Workstream Definitions & Technical Boundaries

### Workstream 1: Project Lead (Architecture & Governance)
- **Mission**: Coordinate interfaces across submodules, ensure zero regressions on the 26 existing test suites (206 tests), conduct PR reviews, and maintain the `EngineeringWorkflowRunner`.
- **Interface Invariants**:
  - `EngineeringWorkflowRunner.run(options: WorkflowOptions): Promise<UnifiedEngineeringReport>` is the top-level contract.
  - Submodules communicate via well-defined TypeScript interfaces (`InvestigationReport`, `ChangeImpactReport`, `BugReproductionSession`, `ProofReport`, `DecisionMemoryRecord`).
  - No submodule may bypass `SafeAutonomyEngine.validateAction()`.

### Workstream 2: Member 2 (Gemma 4 Provider & Verification)
- **Mission**: Solidify the Gemma 4 integration as the flagship AI capability. Provide verifiable offline and live testing for Google Gemma 4 models (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`, `gemma4:latest`).
- **Core Deliverables**:
  - Comprehensive unit test suite `tests/unit/gemma.test.ts` asserting route detection (`gemini-api` vs `local`), model listing, token context limits, and error handling.
  - Image attachment validation tests (verifying base64 payload size checks and MIME validation).
  - Integration test harness `tests/integration/gemma.test.ts` supporting mock responses and optional live verification when `GEMMA_API_KEY` is present.
  - Dedicated CLI investigation flag/command for Gemma 4.

### Workstream 3: Member 3 (ANVESHAN Engine & Evidence Reports)
- **Mission**: Advance the deterministic hypothesis testing and diagnostic reporting engine.
- **Core Deliverables**:
  - Dynamic Hypothesis Generation & Scoring (`src/engine/hypotheses.ts`): Generate plausible failure hypotheses based on project topography and evaluate them against incoming evidence records.
  - Structured Exporters (`src/reporting/`): Implement JSON exporter (`report.toJson()`) and Markdown file generator (`report.toMarkdown()`) in addition to existing terminal ASCII output.
  - Report Persistence: Automatically store completed reports to `.anvexo/reports/report-<id>.json`.

### Workstream 4: Member 4 (ECHO Intelligence & Change Impact Simulator)
- **Mission**: Deepen repository graph understanding and eliminate duplicate dependency extraction logic.
- **Core Deliverables**:
  - Unified Dependency Graphing: Harmonize `src/context/dependencies.ts` with `ChangeImpactSimulator` to share dependency cache and support both relative and package imports.
  - Dependency Graph Visualization: Provide ASCII tree output and Graphviz DOT representation in `ChangeImpactSimulator` for CLI and report visualization.
  - Incremental Analysis: Cache dependency graph nodes to avoid re-reading unchanged files during iterative development.

### Workstream 5: Member 5 (Proof Mode, CI & Open-Source Compliance)
- **Mission**: Establish robust regression automation, verifiable Proof Mode compliance, and open-source licensing.
- **Core Deliverables**:
  - Open Source Licensing: Update `package.json` from `UNLICENSED` to `Apache-2.0` and introduce the standard `LICENSE` file.
  - GitHub Actions CI Pipeline: Implement `.github/workflows/ci.yml` running linting, TypeScript compilation, and Vitest across Node 20 and Node 22 on all PRs.
  - Issue & PR Templates: Create `.github/PULL_REQUEST_TEMPLATE.md` requiring test evidence, proof references, and assigned issue links.
  - Proof Mode Test Suite Enhancement: Create end-to-end regression validation for evidence binding and revision hash tracking.

---

## 4. Conflict Avoidance Protocols

1. **Strict File Isolation**: Each member works strictly on files within their assigned ownership matrix.
2. **Interface Freezing**: Shared types in `src/core/types.ts` and submodule headers may only be altered with Project Lead approval.
3. **No Dual Merges to Shared Endpoints**: Only the Project Lead merges changes to `src/server/router.ts` or `src/cli/index.ts`. Members provide exportable handler functions that the Project Lead connects.
4. **Clean Git Branching**: Feature branches follow `feat/<member>-<issue-title>` or `fix/<member>-<issue-title>`. Direct pushes to `main` are strictly forbidden.
