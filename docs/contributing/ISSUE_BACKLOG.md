# ANVEXO Engineering Issue Backlog

This backlog outlines 11 concrete, non-overlapping engineering issues justified by the actual ANVEXO codebase audit. No duplicate issues exist in GitHub (verified against GitHub issue list; only `#1` was closed for logo assets).

---

## Issue Matrix Summary

| # | Title | Assignee | Complexity | Labels |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Add comprehensive unit and mock test suite for Gemma 4 provider | Member 2 | Medium | `enhancement`, `testing`, `gemma-4` |
| **ISSUE-02** | Add live integration test runner and environment diagnostics for Gemma 4 | Member 2 | Medium | `testing`, `gemma-4` |
| **ISSUE-03** | Add dedicated Gemma 4 CLI investigation command | Member 2 | Small | `enhancement`, `cli`, `gemma-4` |
| **ISSUE-04** | Implement structured JSON and Markdown report exporters with persistence | Member 3 | Medium | `enhancement`, `anveshan` |
| **ISSUE-05** | Add dynamic hypothesis generator and evaluator to ANVESHAN engine | Member 3 | Large | `enhancement`, `anveshan`, `core` |
| **ISSUE-06** | Integrate ECHO dependency graph with ChangeImpactSimulator | Member 4 | Medium | `enhancement`, `echo`, `impact` |
| **ISSUE-07** | Add visual ASCII and DOT dependency graph exporter to Impact Simulator | Member 4 | Medium | `enhancement`, `impact`, `cli` |
| **ISSUE-08** | Add GitHub Actions CI workflow for automated linting, build, and tests | Member 5 | Small | `ci`, `automation` |
| **ISSUE-09** | Add Apache-2.0 open-source license and configure package.json | Member 5 | Small | `documentation`, `legal`, `good first issue` |
| **ISSUE-10** | Add automated Proof Mode end-to-end regression validation test suite | Member 5 | Medium | `testing`, `proof-mode` |
| **ISSUE-11** | Enhance Unified Engineering Workflow Runner with streaming progress events | Project Lead | Medium | `architecture`, `workflow` |

---

## Detailed Issue Specifications

### ISSUE-01: Add comprehensive unit and mock test suite for Gemma 4 provider
- **Assignee**: Member 2
- **Labels**: `enhancement`, `testing`, `gemma-4`
- **Complexity**: Medium
- **Problem Statement**:
  `GemmaProvider` is implemented in `src/providers/gemma.ts` but has zero dedicated unit tests in `tests/`. There is no test coverage verifying routing between `gemini-api` and `local` (Ollama/vLLM), model metadata accuracy (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`), multimodal payload parsing, or screenshot base64 validation limits.
- **Why It Matters**:
  Without unit tests, the Gemma 4 integration cannot be safely refactored or verified for the MLH "Best Use of Gemma 4" prize category.
- **Exact Files Affected**:
  - `tests/unit/gemma.test.ts` (new)
  - `src/providers/gemma.ts` (minor fixes if needed)
- **Proposed Implementation**:
  1. Create `tests/unit/gemma.test.ts` using Vitest.
  2. Mock `fetch` globally to test `completeViaGeminiApi` (Google AI Studio endpoint) and `completeViaLocal` (Ollama endpoint at `/api/generate`).
  3. Test model listing: assert `gemma-4-31b-it` has 256K context and tool calling support.
  4. Test image validation: assert unsupported MIME types throw, and images exceeding 5MB are rejected.
  5. Test structured output JSON parser fallback when the model returns markdown codeblocks.
- **Acceptance Criteria**:
  - `tests/unit/gemma.test.ts` passes with at least 8 distinct assertions.
  - 100% of methods in `GemmaProvider` are tested without making external network calls.
- **Required Tests**:
  - `npx vitest run tests/unit/gemma.test.ts`
- **Dependencies**: None.

---

### ISSUE-02: Add live integration test runner and environment diagnostics for Gemma 4
- **Assignee**: Member 2
- **Labels**: `testing`, `gemma-4`
- **Complexity**: Medium
- **Problem Statement**:
  Currently, tests run only in offline mode. There is no automated integration script that checks if `GEMMA_API_KEY` or `GEMINI_API_KEY` is present in the environment or if a local Ollama daemon is running on port 11434, to execute a live multimodal investigation check.
- **Why It Matters**:
  Judges for "Best Use of Gemma 4" need a deterministic, reproducible script to test live inference when credentials or local Ollama daemons are provided.
- **Exact Files Affected**:
  - `tests/integration/gemma.test.ts` (new)
  - `package.json` (add `"test:gemma": "vitest run tests/integration/gemma.test.ts"`)
- **Proposed Implementation**:
  1. Create an integration test that inspects `process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY`.
  2. If keys are absent and local Ollama is down, skip gracefully with a clear diagnostic message rather than failing.
  3. When configured, execute `provider.investigateIssue()` on a sample test repository fixture and assert `codeEvidence`, `proposedFix`, and `suggestedRegressionTests` are generated.
- **Acceptance Criteria**:
  - `npm run test:gemma` executes cleanly without breaking CI in headless environments.
  - Accurately reports whether live Gemma 4 endpoint or local daemon responded.
- **Required Tests**:
  - `npm run test:gemma`
- **Dependencies**: ISSUE-01.

---

### ISSUE-03: Add dedicated Gemma 4 CLI investigation command
- **Assignee**: Member 2
- **Labels**: `enhancement`, `cli`, `gemma-4`
- **Complexity**: Small
- **Problem Statement**:
  The ANVEXO CLI offers general `anvexo investigate` and `anvexo workflow`, but does not provide an explicit `anvexo gemma <objective>` subcommand to invoke `GemmaProvider.investigateIssue()` with terminal logs and screenshot attachments directly from the command line.
- **Why It Matters**:
  Enables developers and MLH judges to run Gemma 4 multimodal investigations directly from their terminal using simple CLI flags (`--screenshot`, `--diff`, `--log`).
- **Exact Files Affected**:
  - `src/cli/index.ts`
  - `tests/unit/commands.test.ts`
- **Proposed Implementation**:
  1. Add `anvexo gemma <objective>` command in `src/cli/index.ts`.
  2. Support options: `-p, --path <path>`, `-s, --screenshot <file>`, `-l, --log <file>`, `-m, --model <model>`, `--json`.
  3. Load and base64-encode screenshots when specified.
  4. Output formatted Gemma investigation findings including suspected root cause and recommended regression tests.
- **Acceptance Criteria**:
  - `anvexo gemma "fix crash"` executes and displays Gemma analysis.
  - Returns exit code 0 on success and handles missing credentials with a helpful setup hint.
- **Required Tests**:
  - `npx vitest run tests/unit/commands.test.ts`
- **Dependencies**: ISSUE-01.

---

### ISSUE-04: Implement structured JSON and Markdown report exporters with persistence
- **Assignee**: Member 3
- **Labels**: `enhancement`, `anveshan`
- **Complexity**: Medium
- **Problem Statement**:
  `src/reporting/index.ts` only formats reports as an ASCII terminal string via `formatReport()`. There is no structured JSON exporter or GitHub Flavored Markdown exporter, nor does ANVESHAN automatically persist completed investigation reports to disk.
- **Why It Matters**:
  Developers and CI pipelines require machine-readable JSON reports and formatted Markdown artifacts to share investigation findings in pull requests and bug trackers.
- **Exact Files Affected**:
  - `src/reporting/index.ts`
  - `src/reporting/markdown.ts` (new)
  - `src/engine/index.ts`
  - `tests/unit/reporting.test.ts` (new)
- **Proposed Implementation**:
  1. Implement `formatMarkdownReport(report: InvestigationReport): string` producing GitHub-style tables, diff codeblocks, and verification status badges.
  2. Implement `saveReport(report: InvestigationReport, repoRoot: string): Promise<string>` that saves `.anvexo/reports/report-<id>.json` and `.anvexo/reports/report-<id>.md`.
  3. Wire auto-saving into `InvestigationEngine.investigate()`.
- **Acceptance Criteria**:
  - Generated Markdown is clean GFM with no broken tables or unescaped characters.
  - JSON file contains complete evidence, steps, findings, limitations, and Proof Mode data.
- **Required Tests**:
  - `npx vitest run tests/unit/reporting.test.ts`
- **Dependencies**: None.

---

### ISSUE-05: Add dynamic hypothesis generator and evaluator to ANVESHAN engine
- **Assignee**: Member 3
- **Labels**: `enhancement`, `anveshan`, `core`
- **Complexity**: Large
- **Problem Statement**:
  `report.hypotheses` in `InvestigationReport` is currently hardcoded as an empty array `[]` (`src/engine/index.ts:169`). ANVESHAN does not yet actively formulate and test competing hypotheses against incoming evidence records during step execution.
- **Why It Matters**:
  Hypothesis-driven elimination is the core scientific principle of ANVESHAN. Making hypotheses dynamic transforms ANVESHAN into a true diagnostic reasoning engine.
- **Exact Files Affected**:
  - `src/engine/hypotheses.ts` (new)
  - `src/engine/index.ts`
  - `src/core/types.ts`
  - `tests/unit/planner.test.ts`
- **Proposed Implementation**:
  1. Create `HypothesisEngine` in `src/engine/hypotheses.ts`.
  2. Generate 2-4 candidate hypotheses based on objective keywords, uncommitted diffs, and test failure patterns.
  3. After each step in `InvestigationEngine`, evaluate whether new evidence supports (`SUPPORTED`), refutes (`CONTRADICTED`), or leaves open each hypothesis.
  4. Populate `report.hypotheses` with supporting/contradicting evidence IDs and final probability scores.
- **Acceptance Criteria**:
  - Investigations with failing tests or uncommitted changes produce populated `report.hypotheses`.
  - Hypotheses link directly to collected `EvidenceRecord` IDs.
- **Required Tests**:
  - Unit tests asserting hypothesis generation and status updating.
- **Dependencies**: ISSUE-04.

---

### ISSUE-06: Integrate ECHO dependency graph with ChangeImpactSimulator
- **Assignee**: Member 4
- **Labels**: `enhancement`, `echo`, `impact`
- **Complexity**: Medium
- **Problem Statement**:
  `src/context/dependencies.ts` has a standalone dependency parser that is decoupled from `ChangeImpactSimulator` in `src/impact/simulator.ts`. This duplicates file scanning and regex extraction logic, while `ContextManager` does not share graph data with the impact engine.
- **Why It Matters**:
  Unifying ECHO's dependency analysis with `ChangeImpactSimulator` speeds up repository indexing, avoids redundant disk I/O, and ensures consistent reverse dependency detection.
- **Exact Files Affected**:
  - `src/context/dependencies.ts`
  - `src/context/manager.ts`
  - `src/impact/simulator.ts`
  - `tests/unit/context.test.ts`
- **Proposed Implementation**:
  1. Refactor `analyzeDependencies()` in `src/context/dependencies.ts` to share module resolution logic with `ChangeImpactSimulator`.
  2. Cache the shared dependency graph inside `.anvexo/context.json`.
  3. Update `ChangeImpactSimulator` to optionally accept precomputed graph context from `ContextManager`.
- **Acceptance Criteria**:
  - `ChangeImpactSimulator` and `ContextManager` produce identical reverse dependency sets for the same target files.
  - Re-running impact simulation on indexed repositories is at least 2x faster.
- **Required Tests**:
  - `npx vitest run tests/unit/context.test.ts tests/unit/impact.test.ts`
- **Dependencies**: None.

---

### ISSUE-07: Add visual ASCII and DOT dependency graph exporter to Impact Simulator
- **Assignee**: Member 4
- **Labels**: `enhancement`, `impact`, `cli`
- **Complexity**: Medium
- **Problem Statement**:
  `ChangeImpactSimulator` calculates affected modules and dependencies as flat string arrays. Developers and operators cannot visually trace why a given module was identified as impacted.
- **Why It Matters**:
  A visual dependency hierarchy (ASCII tree or Graphviz DOT format) clarifies high-risk cascading blast radiuses at a glance.
- **Exact Files Affected**:
  - `src/impact/simulator.ts`
  - `src/impact/types.ts`
  - `src/impact/graph.ts` (new)
  - `src/cli/index.ts`
  - `tests/unit/impact.test.ts`
- **Proposed Implementation**:
  1. Add `renderAsciiGraph(report: ChangeImpactReport): string` in `src/impact/graph.ts`.
  2. Add `renderDotGraph(report: ChangeImpactReport): string` producing valid Graphviz DOT syntax.
  3. Expose `--graph` and `--dot` flags on `anvexo impact <target>`.
- **Acceptance Criteria**:
  - `anvexo impact src/server/router.ts --graph` prints a formatted tree showing direct and downstream dependents.
  - DOT output renders valid node/edge definitions.
- **Required Tests**:
  - Unit tests asserting graph output contains root target and connected nodes.
- **Dependencies**: ISSUE-06.

---

### ISSUE-08: Add GitHub Actions CI workflow for automated linting, build, and tests
- **Assignee**: Member 5
- **Labels**: `ci`, `automation`
- **Complexity**: Small
- **Problem Statement**:
  The repository currently has no `.github/workflows/` directory. Pull requests cannot be automatically checked for compilation errors, lint issues, or Vitest regressions before merging.
- **Why It Matters**:
  Automated CI is a foundational requirement for any serious open-source project and ensures zero regressions across all 5 contributors' parallel PRs.
- **Exact Files Affected**:
  - `.github/workflows/ci.yml` (new)
- **Proposed Implementation**:
  1. Create `.github/workflows/ci.yml` triggered on `push` to `main` and `pull_request` to `main`.
  2. Test across Node.js 20.x and 22.x on `ubuntu-latest`.
  3. Run: `npm ci`, `npm run lint`, `npm run build`, and `npm test`.
  4. Include coverage reporting via `@vitest/coverage-v8`.
- **Acceptance Criteria**:
  - GitHub Actions runs successfully and verifies all 26 test suites.
  - Clean build output with zero unhandled errors.
- **Required Tests**:
  - Validated locally using GitHub Actions syntax linter or dry-run.
- **Dependencies**: None.

---

### ISSUE-09: Add Apache-2.0 open-source license and configure package.json
- **Assignee**: Member 5
- **Labels**: `documentation`, `legal`, `good first issue`
- **Complexity**: Small
- **Problem Statement**:
  `package.json` currently contains `"license": "UNLICENSED"` and the repository root lacks a standard open-source `LICENSE` file. This disqualifies ANVEXO from the MLH "Best Open-Source AI Project" category.
- **Why It Matters**:
  An OSI-approved open-source license (Apache-2.0) is strictly mandatory for open-source AI projects.
- **Exact Files Affected**:
  - `LICENSE` (new, Apache-2.0)
  - `package.json` (update `"license": "Apache-2.0"`)
  - `README.md` (add License badge and section)
- **Proposed Implementation**:
  1. Add standard Apache License 2.0 text in root `LICENSE`.
  2. Update `package.json` license identifier to `"Apache-2.0"`.
  3. Link license in `README.md` footer.
- **Acceptance Criteria**:
  - `npm pack` or `npm info` recognizes the Apache-2.0 SPDX identifier.
  - `LICENSE` file is present in repository root.
- **Required Tests**:
  - `npm run build` succeeds cleanly.
- **Dependencies**: None.

---

### ISSUE-10: Add automated Proof Mode end-to-end regression validation test suite
- **Assignee**: Member 5
- **Labels**: `testing`, `proof-mode`
- **Complexity**: Medium
- **Problem Statement**:
  Proof Mode correctly enforces that test claims require dynamic execution, but lacks an automated end-to-end regression test suite verifying git revision hash capture, multi-step evidence binding, and uncertainty propagation under failure conditions.
- **Why It Matters**:
  Proof Mode is ANVEXO's core differentiator. A dedicated end-to-end integration test ensures its verification invariants remain unbreakable.
- **Exact Files Affected**:
  - `tests/integration/proof.test.ts` (new)
  - `package.json` (add `"test:proof": "vitest run tests/integration/proof.test.ts"`)
- **Proposed Implementation**:
  1. Create `tests/integration/proof.test.ts`.
  2. Test a multi-claim scenario: code modification + test run + regression check.
  3. Assert that when an execution check times out or fails with exit code 1, the overall status strictly resolves to `failed` or `partially_verified`.
  4. Assert that unresolved uncertainties downgrade status from `verified` to `partially_verified`.
- **Acceptance Criteria**:
  - Verifies that model assertions without execution checks are rejected as `unverified`.
  - All tests pass deterministically.
- **Required Tests**:
  - `npm run test:proof`
- **Dependencies**: None.

---

### ISSUE-11: Enhance Unified Engineering Workflow Runner with streaming progress events
- **Assignee**: Project Lead (You)
- **Labels**: `architecture`, `workflow`
- **Complexity**: Medium
- **Problem Statement**:
  `EngineeringWorkflowRunner` executes all 8 stages sequentially in a single batch. Neither the CLI nor the Web UI can stream real-time phase updates (e.g., "Starting Change Impact Simulation", "Executing Reproduction Lab") to the user.
- **Why It Matters**:
  Real-time event streaming dramatically improves the developer experience and makes multi-stage investigations transparent.
- **Exact Files Affected**:
  - `src/engine/workflow.ts`
  - `src/server/router.ts`
  - `src/cli/index.ts`
  - `tests/integration/workflow.test.ts`
- **Proposed Implementation**:
  1. Add an optional event listener callback `onProgress?: (event: WorkflowProgressEvent) => void` to `WorkflowOptions`.
  2. Emit events at the start and completion of each stage: `investigation`, `impact`, `memory`, `autonomy`, `reproduction`, `proof`.
  3. Update CLI `anvexo workflow` with an animated terminal spinner updating with each phase.
  4. Update `/api/workflow` to stream SSE (Server-Sent Events) or return progress snapshots.
- **Acceptance Criteria**:
  - CLI `anvexo workflow` renders live progress as each stage executes.
  - Existing workflow integration tests continue to pass with 100% compliance.
- **Required Tests**:
  - `npx vitest run tests/integration/workflow.test.ts`
- **Dependencies**: ISSUE-01 through ISSUE-10.
