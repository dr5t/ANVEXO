# ANVEXO Engineering Backlog Audit

## 1. Backlog Overview & Architecture Mapping

The IDs in this document are internal planning labels, not GitHub issue numbers. The detailed descriptions below are historical proposals and must not be treated as a current issue tracker or as verified descriptions of the current code.

### Current status at `pr-for-hacktoberrfest` commit `84030f3`

The audit found no open GitHub issues; pull-request state is tracked on GitHub and is not represented by these internal planning labels. The current default test run passed 29 test files and 292 tests; see [`docs/mlh-submission/VERIFICATION.md`](../mlh-submission/VERIFICATION.md) for all commands, results, and live-test limitations.

| Internal ID | Current audit status |
| :--- | :--- |
| ISSUE-01 | Implemented: Gemma provider unit tests exist in `tests/unit/gemma.test.ts`. |
| ISSUE-02 | Implemented narrowly: `test:gemma` runs a separate hosted text-completion smoke test. It does not test local-daemon access or multimodal investigation. |
| ISSUE-03 | Partially implemented: failed investigation steps are recorded and the unified workflow reports impact-analysis failures. Step dependency evaluation from the original proposal is not present in the investigation engine. |
| ISSUE-04 | Implemented: JSON and Markdown exports and report persistence exist in `src/reporting/` and are tested. |
| ISSUE-05 | Candidate gap: `ContextManager` stores a dependency graph, but `ChangeImpactSimulator` does not accept or consume that graph. |
| ISSUE-06 | Candidate gap: impact analysis uses regular expressions for import/export discovery; type-only imports are not distinguished, and alias resolution is not established by the current tests. |
| ISSUE-07 | Implemented: autonomy and security regression suites exist in `tests/unit/autonomy.test.ts` and `tests/unit/security.test.ts`. |
| ISSUE-08 | Not implemented: the inspected branch has no `.github/workflows/` directory or GitHub Actions workflow. |
| ISSUE-09 | Gated and incomplete: there is no license audit or root `LICENSE`; `package.json` declares `UNLICENSED`. |
| ISSUE-10 | The proposed demo harness is absent: there is no `test:demo` script or `tests/integration/demo.test.ts`. `tests/integration/workflow.test.ts` is a distinct local integration suite. |
| DEF-01 | Implemented: the Gemma CLI command exists and has command tests. |
| DEF-02 | No visual dependency graph exporter was found in the inspected source. |
| DEF-03 | No streaming progress-event interface was found in the unified workflow implementation. |

These are audit findings, not new GitHub issues. Remaining candidates should be reviewed and prioritized by the project lead before work is assigned.

---

## 2. Historical Issue Mapping & Ownership

The following matrix preserves the original proposals and ownership assignments for historical reference. It does not represent active GitHub issues or imply that the proposed work remains outstanding.

### Original core proposals

| ID | Title | Assignee | Priority | Proposed Branch Name |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Add comprehensive unit & mock test suite for Gemma 4 provider error handling | Bhumika | Core | `feat/bhumika-gemma-unit-tests` |
| **ISSUE-02** | Add live integration test runner and environment diagnostics for Gemma 4 | Bhumika | Core | `feat/bhumika-gemma-live-tests` |
| **ISSUE-03** | Implement ANVESHAN step dependency evaluation and workflow failure recovery | Alok | Core | `feat/alok-workflow-recovery` |
| **ISSUE-04** | Implement structured JSON and Markdown investigation report exporters with disk persistence | Alok | Core | `feat/alok-report-exporters` |
| **ISSUE-05** | Integrate ECHO repository context retrieval with ChangeImpactSimulator cache | Somi | Core | `feat/somi-echo-impact-integration` |
| **ISSUE-06** | Enhance TypeScript impact analysis with type-only import and barrel export resolution | Somi | Core | `feat/somi-impact-ts-analysis` |
| **ISSUE-07** | Implement security regression test suite for autonomy engine and execution sandbox | Akhil | Core | `test/akhil-security-hardening` |
| **ISSUE-08** | Implement automated GitHub Actions CI workflow and contributor environment setup | Akhil | Core | `ci/akhil-github-actions` |
| **ISSUE-09** | **[GATED]** Open-source licensing inspection and third-party attribution audit | Akhil & Shaurya | Gated | `docs/akhil-license-audit` |
| **ISSUE-10** | Implement end-to-end Gemma 4 verification and MLH demo validation harness | Shaurya | Core / Lead | `feat/shaurya-gemma-demo-verification` |

### Original deferred proposals

| ID | Title | Previous ID | Reason for Deferral |
| :--- | :--- | :--- | :--- |
| **DEF-01** | Dedicated Gemma 4 CLI investigation command (`anvexo gemma`) | ISSUE-03 | CLI convenience flag is secondary to robust provider error handling, unit tests, and live verification. |
| **DEF-02** | Visual ASCII and Graphviz DOT dependency graph exporters | ISSUE-07 | Terminal rendering is secondary to unifying ECHO context cache and resolving TypeScript reverse dependency edge cases. |
| **DEF-03** | Streaming progress events for Unified Engineering Workflow Runner | ISSUE-11 | Real-time event streaming is secondary to workflow failure recovery and evidence validation stability. |

---

## 3. Historical Ownership Notes

The following ownership statements are preserved from the original planning proposal and do not describe current assignments:
1. **Bhumika (Gemma 4 Provider Reliability)**: Dedicated to `ISSUE-01` and `ISSUE-02`. Owns `src/providers/gemma.ts` and its test suites. Deferred CLI commands (`DEF-01`) avoid touching `src/cli/` before core provider behavior is rock solid.
2. **Alok (Investigation Resilience & Reports)**: Dedicated to `ISSUE-03` and `ISSUE-04`. Owns `src/evidence/index.ts`, `src/engine/index.ts` error handling, and `src/reporting/`. Refocused from abstract hypothesis generation to concrete evidence validation and failure recovery so ANVESHAN never crashes on tool failures.
3. **Somi (ECHO Context & TypeScript Impact)**: Dedicated to `ISSUE-05` and `ISSUE-06`. Owns `src/context/` and `src/impact/`. Unifies dependency indexing and solves real TypeScript AST/regex edge cases (type imports, re-exports) instead of premature graph visualization.
4. **Akhil (Security, CI & Governance)**: Dedicated to `ISSUE-07`, `ISSUE-08`, and gated `ISSUE-09`. Owns security regression testing (`src/autonomy/` and sandbox boundaries), GitHub Actions CI, and the license audit report.
5. **Shaurya (Lead, Orchestration & Gemma Verification)**: Dedicated to `ISSUE-10` and architecture governance. Ensures end-to-end integration across all submodules and acts as the gatekeeper for gated licensing and PR approvals.

---

## 4. Original Issue Specifications

The specifications in this section describe the proposed state when this backlog was written. Consult the current-status audit above and the linked source and tests before using any specification as an implementation task.

### ISSUE-01: Add comprehensive unit & mock test suite for Gemma 4 provider error handling
- **Assignee**: Bhumika
- **Proposed Branch**: `feat/bhumika-gemma-unit-tests`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  `GemmaProvider` (`src/providers/gemma.ts`) currently has zero unit tests. There is no automated test coverage verifying route detection between Google AI Studio (`completeViaGeminiApi`) and local Ollama (`completeViaLocal`), token context limit handling (256K context for `gemma-4-31b-it` and `gemma-4-26b-a4b-it`), multimodal image attachment packing, base64 size limits (rejecting payloads >5MB), and resilient JSON parsing fallback when the model wraps output in markdown code blocks.
- **Exact Files Affected**:
  - `tests/unit/gemma.test.ts` (new)
  - `src/providers/gemma.ts` (defensive error handling refinements)
- **Acceptance Criteria**:
  - `tests/unit/gemma.test.ts` contains at least 8 distinct, deterministic tests with zero external network requests.
  - Mocked tests verify both Google AI Studio API and local Ollama REST endpoints.
  - Unhandled JSON formatting errors and invalid MIME types throw descriptive errors rather than unhandled promise rejections.
  - Image payloads exceeding 5MB are rejected before dispatch.
- **Required Tests**:
  - `npx vitest run tests/unit/gemma.test.ts`
- **Dependencies**: None.

---

### ISSUE-02: Add live integration test runner and environment diagnostics for Gemma 4
- **Assignee**: Bhumika
- **Proposed Branch**: `feat/bhumika-gemma-live-tests`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  Create an automated live integration test suite that detects whether `GEMMA_API_KEY` / `GEMINI_API_KEY` is present in the environment or if a local Ollama daemon is reachable on `http://127.0.0.1:11434`. When active, it executes a live multimodal investigation check against a sample fixture repository. When inactive, it reports diagnostic status and skips gracefully without failing the build.
- **Exact Files Affected**:
  - `tests/integration/gemma.test.ts` (new)
  - `package.json` (add `"test:gemma": "vitest run tests/integration/gemma.test.ts"`)
- **Acceptance Criteria**:
  - `npm run test:gemma` executes cleanly in CI and local developer machines.
  - When keys or daemon are detected, live inference generates valid `codeEvidence`, `proposedFix`, and `suggestedRegressionTests`.
  - When offline, prints clear diagnostic instructions explaining how to configure API keys or local Ollama.
- **Required Tests**:
  - `npm run test:gemma`
- **Dependencies**: ISSUE-01.

---

### ISSUE-03: Implement ANVESHAN step dependency evaluation and workflow failure recovery
- **Assignee**: Alok
- **Proposed Branch**: `feat/alok-workflow-recovery`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  While initial evidence field validation was landed in `src/evidence/index.ts` (`bf623d9`), ANVESHAN's `InvestigationEngine` (`src/engine/index.ts`) still executes planned steps in a flat sequential loop without evaluating step dependencies (`step.dependencies`). If an upstream diagnostic step fails (e.g. `git_status` or a shell probe times out), downstream dependent steps still blindly attempt execution instead of being marked as skipped. The engine must evaluate step dependencies, gracefully handle tool execution rejections, record structured `EvidenceType.ERROR` diagnostic entries, and accurately record all unreached or failed stages in `report.limitations`.
- **Exact Files Affected**:
  - `src/engine/index.ts`
  - `tests/unit/engine.test.ts` (expanded)
  - `src/evidence/index.ts` (minor deduplication/sanitization if needed)
- **Acceptance Criteria**:
  - Steps with dependencies on failed/skipped steps are automatically marked `status: 'skipped'` with descriptive dependency failure reasons.
  - Unexpected tool execution errors or subprocess timeouts are trapped without unhandled rejections, recorded as `EvidenceType.ERROR`, and permit independent parallel steps to continue.
  - `report.limitations` cleanly lists all skipped and failed steps.
  - Zero regressions across existing engine tests.
- **Required Tests**:
  - `npx vitest run tests/unit/engine.test.ts tests/unit/evidence.test.ts`
- **Dependencies**: None.

---

### ISSUE-04: Implement structured JSON and Markdown investigation report exporters with disk persistence
- **Assignee**: Alok
- **Proposed Branch**: `feat/alok-report-exporters`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  `src/reporting/index.ts` currently only formats investigation results as an ASCII terminal string via `formatReport()`. Machine-readable JSON export and GitHub Flavored Markdown (GFM) export are missing, and completed reports are not automatically persisted to disk. Developers and CI pipelines need structured output to embed in PRs and bug trackers.
- **Exact Files Affected**:
  - `src/reporting/index.ts`
  - `src/reporting/markdown.ts` (new)
  - `src/engine/index.ts` (wire report persistence)
  - `tests/unit/reporting.test.ts` (new)
- **Acceptance Criteria**:
  - `formatMarkdownReport(report: InvestigationReport): string` produces valid GitHub Flavored Markdown with findings tables, code diffs, and verification badges.
  - `saveReport(report: InvestigationReport, repoRoot: string): Promise<string>` persists reports to `.anvexo/reports/report-<id>.json` and `.anvexo/reports/report-<id>.md`.
  - Directory `.anvexo/reports/` is automatically created if missing.
- **Required Tests**:
  - `npx vitest run tests/unit/reporting.test.ts`
- **Dependencies**: None.

---

### ISSUE-05: Integrate ECHO repository context retrieval with ChangeImpactSimulator cache
- **Assignee**: Somi
- **Proposed Branch**: `feat/somi-echo-impact-integration`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  `src/context/dependencies.ts` and `src/impact/simulator.ts` maintain separate file scanning and import parsing routines. This causes duplicate disk I/O and potential discrepancies in reverse dependency detection. Unify ECHO's dependency analysis with `ChangeImpactSimulator` so pre-computed dependency graphs in `.anvexo/context.json` can be directly consumed by the impact engine.
- **Exact Files Affected**:
  - `src/context/dependencies.ts`
  - `src/context/manager.ts`
  - `src/impact/simulator.ts`
  - `tests/unit/context.test.ts`
  - `tests/unit/impact.test.ts`
- **Acceptance Criteria**:
  - `ChangeImpactSimulator` accepts an optional pre-computed dependency graph from `ContextManager`.
  - Shared dependency cache is saved and retrieved from `.anvexo/context.json`.
  - Impact simulation execution time is reduced by at least 2x on pre-indexed repositories.
- **Required Tests**:
  - `npx vitest run tests/unit/context.test.ts tests/unit/impact.test.ts`
- **Dependencies**: None.

---

### ISSUE-06: Enhance TypeScript impact analysis with type-only import and barrel export resolution
- **Assignee**: Somi
- **Proposed Branch**: `feat/somi-impact-ts-analysis`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  `ChangeImpactSimulator` regex parsing does not reliably distinguish between runtime imports and compile-time TypeScript type imports (`import type { Foo } from './bar'`). Additionally, re-exports in barrel files (`export * from './submodule'`, `export { A, B } from './module'`) and path aliases (`@/...`) can cause reverse dependencies to be missed or inflated with zero-risk type changes.
- **Exact Files Affected**:
  - `src/impact/simulator.ts`
  - `src/impact/types.ts`
  - `tests/unit/impact.test.ts`
- **Acceptance Criteria**:
  - Type-only imports are tagged with lower risk weight compared to value imports in `ChangeImpactReport`.
  - Barrel file re-exports (`export * from ...`) correctly trace upstream consumers.
  - Circular module imports do not cause infinite loops or stack overflows.
- **Required Tests**:
  - `npx vitest run tests/unit/impact.test.ts`
- **Dependencies**: ISSUE-05.

---

### ISSUE-07: Implement security regression test suite for autonomy engine and execution sandbox
- **Assignee**: Akhil
- **Proposed Branch**: `test/akhil-security-hardening`
- **Priority**: Core
- **Complexity**: Medium
- **Description**:
  While `tests/unit/security.test.ts` validates path traversal and server limits, the autonomy and tool execution boundaries lack comprehensive regression testing. Need dedicated test coverage verifying `SafeAutonomyEngine` (`src/autonomy/engine.ts`) action budget enforcement, permission scope rejection (`READ_ONLY`, `WORKSPACE_WRITE`), dangerous shell execution blocking (`rm -rf`, `sudo`, piping to shell), environment variable sanitization, and audit log tamper detection.
- **Exact Files Affected**:
  - `tests/unit/autonomy.test.ts` (new)
  - `tests/unit/security.test.ts` (add sandbox regression scenarios)
  - `src/autonomy/engine.ts` (defensive hardening if gaps are found)
- **Acceptance Criteria**:
  - Verifies that attempting to execute commands exceeding the action budget throws a `SecurityError` or stops execution.
  - Verifies that attempts to invoke shell execution under `READ_ONLY` mode are strictly denied.
  - Verifies that command arguments containing chained dangerous commands (`rm -rf /`, `curl | sh`) are intercepted.
- **Required Tests**:
  - `npx vitest run tests/unit/autonomy.test.ts tests/unit/security.test.ts`
- **Dependencies**: None.

---

### ISSUE-08: Implement automated GitHub Actions CI workflow and contributor environment setup
- **Assignee**: Akhil
- **Proposed Branch**: `ci/akhil-github-actions`
- **Priority**: Core
- **Complexity**: Small
- **Description**:
  The repository has no `.github/workflows/` directory. Create a reproducible CI pipeline that runs on pull requests and pushes to `main`. Also create `.github/PULL_REQUEST_TEMPLATE.md` and update `CONTRIBUTING.md` to ensure all 5 contributors follow the exact test and lint verification workflow.
- **Exact Files Affected**:
  - `.github/workflows/ci.yml` (new)
  - `.github/PULL_REQUEST_TEMPLATE.md` (new)
  - `CONTRIBUTING.md` (new)
- **Acceptance Criteria**:
  - CI workflow triggers on PRs and pushes to `main`.
  - CI matrix executes on Node.js 20.x and 22.x on `ubuntu-latest`.
  - Workflow steps: `npm ci`, `npm run lint`, `npm run build`, `npm test`.
  - Contributor documentation provides clear, one-command setup instructions.
- **Required Tests**:
  - Local validation of GitHub Actions YAML syntax.
- **Dependencies**: None.

---

### ISSUE-09: [GATED] Open-source licensing inspection and third-party attribution audit
- **Assignee**: Akhil (Audit Preparation) & Shaurya (Project Owner Approval Gate)
- **Proposed Branch**: `docs/akhil-license-audit`
- **Priority**: Gated Task
- **Complexity**: Small
- **Description**:
  `package.json` currently declares `"license": "UNLICENSED"` and repository root lacks a `LICENSE` file. Open-source licensing (Apache-2.0) is mandatory for the MLH "Best Open-Source AI Project" category, but must be treated as a gated task:
  1. Inspect existing licensing across all dependencies in `package.json` (`commander`, `simple-git`, `@types/node`, `@vitest/coverage-v8`, `typescript`, `vitest`).
  2. Verify compatibility with Apache-2.0.
  3. Prepare attribution / NOTICE documentation.
  4. **Gate**: Submit findings to Project Owner (Shaurya) for explicit sign-off.
  5. **Do not modify `package.json` or add `LICENSE` automatically until explicit approval is granted.**
- **Exact Files Affected**:
  - `docs/legal/LICENSE_AUDIT.md` (new audit report)
  - `LICENSE` (staged, pending owner approval)
  - `package.json` (license string, pending owner approval)
- **Acceptance Criteria**:
  - Comprehensive audit report detailing all third-party license terms (MIT, Apache-2.0) committed to `docs/legal/LICENSE_AUDIT.md`.
  - Formal sign-off recorded from Shaurya before any license modification.
- **Required Tests**:
  - `npm run build`
- **Dependencies**: Project Owner explicit approval.

---

### ISSUE-10: Implement end-to-end Gemma 4 verification and MLH demo validation harness
- **Assignee**: Shaurya
- **Proposed Branch**: `feat/shaurya-gemma-demo-verification`
- **Priority**: Core / Lead
- **Complexity**: Medium
- **Description**:
  Create an end-to-end verification and demonstration harness in `tests/integration/demo.test.ts` and `src/engine/workflow.ts` that validates the complete pipeline: ingestion of code diffs, logs, and screenshots -> Gemma 4 multimodal investigation -> structured root cause and regression test recommendations -> evidence ingestion into ProofVerifier -> verified ProofReport output.
- **Exact Files Affected**:
  - `tests/integration/demo.test.ts` (new)
  - `src/engine/workflow.ts`
  - `package.json` (add `"test:demo": "vitest run tests/integration/demo.test.ts"`)
- **Acceptance Criteria**:
  - Validates full round-trip from multimodal input to verifiable Proof Mode status.
  - Serves as the reproducible proof harness for MLH hackathon evaluators.
  - Zero breakages across existing 26 test suites.
- **Required Tests**:
  - `npm run test:demo`
  - `npm test`
- **Dependencies**: ISSUE-01, ISSUE-03, ISSUE-05.
