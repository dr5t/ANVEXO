# ANVEXO Architecture and Engineering Specification

## 1. System Overview

ANVEXO is an autonomous software engineering and investigation platform designed for deterministic software diagnosis and codebase intelligence. It combines two core capabilities into a single unified engine:

1. ANVESHAN: Autonomous hypothesis testing, step-by-step investigation planning, and evidence-driven root cause analysis.
2. ECHO: Deep codebase intelligence, git history analysis, dependency graphing, and persistent cross-investigation memory.

## 2. Core Architectural Pillars

```
+------------------------------------------------------------------------+
|                      ANVEXO Workspaces & Interfaces                   |
|   CLI (anvexo investigate/serve)  |  Split IDE Workbench (Web Canvas)   |
+-----------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                     Production Server & API Layer                      |
|  Sliding Window Rate Limiter (120 req/min) | Canonical Path Validator  |
|  Job Manager with Per-Repo Locks          | Strict CSP & CORS Headers |
+------------------------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                     Investigation Engine Orchestrator                  |
|  Phase 1: Project Topography Discovery (Languages, Build Tools, Tests)  |
|  Phase 2: Context Retrieval (ECHO Modes A, B, C, D)                    |
|  Phase 3: Deterministic Step Planner (DAG Generation)                  |
|  Phase 4: Tool Execution Loop (Timeout, Concurrency, Cancellation)     |
|  Phase 5: Evidence Store & Hypothesis Evaluation                       |
|  Phase 6: Findings Synthesis & Report Formatter                        |
+------------------------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                        Sandboxed Tool Registry                         |
|  file_read | file_list | file_search | git_status | git_log | git_diff  |
|                       run_command (Controlled)                         |
+------------------------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                       Scope-Based Permission System                    |
|  file:read | file:write | git:read | test:run | command:execute         |
|  Grants: ALWAYS_ALLOW | ALLOW_ONCE | DENY (with complete audit log)    |
+------------------------------------------------------------------------+
```

## 3. Topography Discovery Engine

Before an investigation commences, the discovery subsystem analyzes the target repository without executing any arbitrary binaries. It applies rule-based scanners across 40+ languages and frameworks:
- Detects primary and secondary programming languages.
- Identifies build systems and package managers (e.g. npm, pnpm, yarn, cargo, go modules, poetry, gradle).
- Discovers test frameworks (e.g. vitest, jest, pytest, go test, cargo test).
- Extracts configuration files and potential entry points.
- Analyzes git repository topology.

## 4. Deterministic Step Planning

The planner produces an execution Directed Acyclic Graph (DAG) tailored to the objective:
- Topography inspection steps to catalog dependencies.
- Git evidence steps checking uncommitted diffs, recent commit logs, and branch health.
- Targeted search steps indexing keywords extracted from the user objective.
- Safe testing steps executing verified test runners within timeout limits.

Each step in the DAG defines:
- A descriptive human-readable title.
- Target tool name and exact JSON parameter payload.
- Required permission scope.
- Status tracking (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`).

## 5. Scope-Based Permission Subsystem

Every tool invocation passes through the permission engine:
- Scopes: `file:read`, `file:write`, `command:execute`, `git:read`, `test:run`.
- Matching: Exact path matching, prefix matching, and wildcard matching (`*`).
- Evaluation:
  1. If an explicit rule matches, return the configured decision (`ALWAYS_ALLOW` or `DENY`).
  2. If an `ALLOW_ONCE` grant exists, consume it and permit execution.
  3. Otherwise, prompt the operator for confirmation or reject execution in non-interactive environments.
- Audit Logging: Every decision, timestamp, resource identifier, and scope is permanently appended to the session audit log.

## 6. Context & Memory Architecture (ECHO)

ANVEXO provides four memory operational modes:
- Mode A (Ephemeral): Zero disk footprint; all evidence and DAG states vanish on process termination.
- Mode B (Local Context): Persisted in `.anvexo/` within the repository root. Stores historical investigations, dependency matrices, and known bug signatures.
- Mode C (Machine Intelligence): Persisted in `~/.anvexo/storage/` for cross-repository intelligence on the developer machine.
- Mode D (User Cloud): Synchronizes encrypted summaries strictly to user-configured cloud buckets (S3 or GCS) with zero intermediary server relay.

## 7. Contradiction Detection

When synthesizing findings, the context manager cross-references current hypotheses against past investigations in the repository:
- Checks if a current hypothesis contradicts a prior verified finding.
- Checks if a current finding reintroduces a known previously fixed defect.
- Surfaces contradictions in the report limitations section with direct references to earlier investigation IDs.

## 8. Web Security & Path Containment

The HTTP server and workbench interface enforce enterprise security standards:
- Path Traversal Containment: Paths are canonicalized via `fs.realpathSync`. Any path attempting directory traversal outside the target repository throws a 403 `SecurityError`.
- Sliding Window Rate Limiting: Tracks client request counts in 60-second windows with automatic memory cleanup.
- Concurrency Control: Per-repository mutual exclusion locks prevent race conditions and concurrent destructive operations on the same codebase.
- Content Security Policy: Strict CSP headers prevent XSS, blocking external scripts and enforcing local stylesheet isolation.
- Process Cancellation: Operators can cancel long-running jobs via `POST /api/jobs/:id/cancel`, killing the underlying worker and immediately releasing repository locks.
