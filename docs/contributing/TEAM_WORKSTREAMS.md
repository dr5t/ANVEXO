# ANVEXO Team Workstreams & Architecture Ownership

## 1. Executive Summary & Objective

This document defines the formal roles, component boundaries, and non-overlapping workstreams for the five-person engineering team developing **ANVEXO**.

The strategic objective of this team structure is to execute a rigorous, production-grade open-source contribution plan targeting two categories for the MLH Hackathon:
1. **MLH Best Use of Gemma 4**: Demonstrating deep integration of Google Gemma 4 models (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`) across Google AI Studio API and local Ollama inference daemons, multimodal reasoning (terminal logs, diffs, UI screenshots), structured root cause diagnostics, and empirical regression test synthesis.
2. **MLH Best Open-Source AI Project**: Demonstrating architectural transparency, deterministic DAG tool execution, safe autonomy security barriers, reproducible Proof Mode verification, CI automation, and gated open-source licensing.

---

## 2. Five-Member Team Ownership Structure

```
+--------------------------------------------------------------------------------------------------+
|                                    SHAURYA (Project Lead)                                        |
|   Architecture Governance | Workflow Orchestration | Gemma 4 E2E Demo | Release Management       |
+--------------------------------------------------------------------------------------------------+
         |                             |                            |                        |
         v                             v                            v                        v
+------------------+          +-------------------+        +-------------------+    +------------------+
|     BHUMIKA      |          |       ALOK        |        |       SOMI        |    |      AKHIL       |
| Gemma 4 Provider |          | ANVESHAN Engine   |        | ECHO Intelligence |    | Security Sandbox |
| Unit & Mock Test |          | Evidence Valid.   |        | TypeScript Impact |    | Regression Tests |
| Live Integration |          | Failure Recovery  |        | Context Retrieval |    | CI & Contributor |
| Error Handling   |          | Report Exporters  |        | Cache Unification |    | Gated License    |
+------------------+          +-------------------+        +-------------------+    +------------------+
```

### Component & File Ownership Matrix

| Member | Focus Area | Primary Codebase Files Owned | Restricted / Read-Only Files |
| :--- | :--- | :--- | :--- |
| **Shaurya** (Project Lead) | Architecture Governance, Gemma 4 Verification & E2E Demo, Orchestrator | `src/engine/workflow.ts`, `src/cli/index.ts`, `src/server/router.ts`, `src/server/server.ts`, `tests/integration/workflow.test.ts` | Subsystem internals (approves all cross-cutting changes) |
| **Bhumika** | Gemma 4 Provider Unit Tests, Error Handling, Live Integration Tests | `src/providers/gemma.ts`, `tests/unit/gemma.test.ts`, `tests/integration/gemma.test.ts` | `src/engine/`, `src/context/`, `src/proof/`, `src/autonomy/` |
| **Alok** | Investigation Evidence Validation, Workflow Failure Recovery, Report Exporters | `src/engine/index.ts`, `src/evidence/index.ts`, `src/reporting/index.ts`, `src/reporting/markdown.ts`, `tests/unit/reporting.test.ts`, `tests/unit/evidence.test.ts` | `src/providers/`, `src/impact/`, `src/autonomy/` |
| **Somi** | TypeScript Impact Analysis, ECHO Context Retrieval, Shared Graph Cache | `src/context/dependencies.ts`, `src/context/manager.ts`, `src/impact/simulator.ts`, `tests/unit/context.test.ts`, `tests/unit/impact.test.ts` | `src/providers/`, `src/proof/`, `src/server/` |
| **Akhil** | Security Regression Tests, Autonomy Sandbox, CI Workflow, Gated License Audit | `tests/unit/security.test.ts`, `tests/unit/autonomy.test.ts`, `.github/workflows/ci.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `docs/legal/` | `src/engine/`, `src/providers/`, `src/context/` |

---

## 3. Workstream Definitions & Technical Boundaries

### Workstream 1: Shaurya (Architecture Governance, Gemma 4 Verification & E2E Demo)
- **Core Mission**: Coordinate subsystem contracts, ensure zero regressions across existing test suites, conduct peer review approvals, and implement the end-to-end Gemma 4 verification demo harness.
- **Key Responsibilities**:
  - Maintain the unified workflow interface: `EngineeringWorkflowRunner.run(options: WorkflowOptions): Promise<UnifiedEngineeringReport>`.
  - Validate end-to-end multimodal input ingestion (code diffs, execution logs, screenshot images) passed to Gemma 4 and assert structured diagnostic handoff into Proof Mode.
  - Review and merge PRs from all four workstreams.
  - Gatekeeper for open-source licensing changes.

### Workstream 2: Bhumika (Gemma 4 Provider Unit & Live Integration Testing)
- **Core Mission**: Deliver complete unit, mock, and live integration test coverage for `GemmaProvider`, guaranteeing robust error handling and model fallback behavior.
- **Key Responsibilities**:
  - Implement comprehensive unit tests in `tests/unit/gemma.test.ts` mocking `fetch` to verify Google AI Studio (`completeViaGeminiApi`) and local Ollama (`completeViaLocal`) endpoints.
  - Validate input payload guardrails: image base64 size limits (rejecting >5MB payloads), MIME type filtering, model token limits, and markdown codeblock JSON extraction fallback.
  - Implement live integration suite in `tests/integration/gemma.test.ts` with environment diagnostics that test real Gemma 4 endpoints when `GEMMA_API_KEY` or local Ollama daemons are active, while skipping gracefully in headless environments.

### Workstream 3: Alok (Investigation Evidence Validation, Failure Recovery & Report Export)
- **Core Mission**: Harden ANVESHAN investigation execution against runtime errors, validate empirical evidence collection, and produce structured multi-format reports.
- **Key Responsibilities**:
  - Implement rigorous evidence record validation in `src/evidence/index.ts` and `src/engine/index.ts` to prevent corrupted, empty, or unverified entries from polluting findings.
  - Implement resilient workflow failure recovery in `InvestigationEngine`: handle tool crashes, execution timeouts, and hypothesis status updates gracefully without aborting the investigation.
  - Build structured report exporters in `src/reporting/`: generate GitHub Flavored Markdown (`formatMarkdownReport`) and machine-readable JSON, with automatic disk persistence to `.anvexo/reports/`.

### Workstream 4: Somi (TypeScript Impact Analysis & ECHO Context Retrieval)
- **Core Mission**: Unify repository dependency indexing between ECHO and ChangeImpactSimulator, eliminate duplicate disk scanning, and handle complex TypeScript import patterns.
- **Key Responsibilities**:
  - Integrate `src/context/dependencies.ts` with `src/impact/simulator.ts` to share a common dependency cache persisted in `.anvexo/context.json`.
  - Expand `ChangeImpactSimulator` regex/AST parsing to correctly resolve TypeScript edge cases: type-only imports (`import type`), barrel file re-exports (`export * from`), module path aliases (`@/*`), and circular references.
  - Ensure reverse dependency calculations accurately reflect true runtime and static blast radiuses.

### Workstream 5: Akhil (Security Regression Testing, CI & Gated Licensing)
- **Core Mission**: Expand security regression testing across the autonomy and sandbox boundaries, establish reproducible CI automation, and conduct the gated open-source license audit.
- **Key Responsibilities**:
  - Expand `tests/unit/security.test.ts` and `tests/unit/autonomy.test.ts` to enforce action budget boundaries, permission scopes (`READ_ONLY`, `WORKSPACE_WRITE`, `FULL_EXECUTE`), dangerous shell command rejection (`rm -rf`, `sudo`, curl pipe to shell), and sandbox escape prevention.
  - Build `.github/workflows/ci.yml` matrix testing Node 20 and Node 22 with linting, TypeScript compilation, and Vitest test runs.
  - Conduct third-party dependency licensing audit and prepare license documentation as a gated task requiring project owner (Shaurya) sign-off.

---

## 4. Conflict Avoidance Protocols

1. **Strict File Isolation**: Each contributor works exclusively on files defined in their ownership matrix.
2. **Interface Freezing**: Shared types in `src/core/types.ts` are frozen; modifications require unanimous consent and Shaurya's approval.
3. **Dedicated Branching**: Feature branches must strictly adhere to the convention `feat/<member>-<topic>`, `test/<member>-<topic>`, or `ci/<member>-<topic>`.
4. **No Code Comments**: Self-documenting code with clear symbols and strict typing. No inline comments (`//`, `/* */`).
5. **No Direct Commits**: All changes must land via pull request with clean CI passes and designated peer reviews.
