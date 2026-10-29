---
name: Investigate Bug
description: Perform autonomous evidence-backed root cause analysis on a software defect
tools: file_read, file_search, git_log, git_diff, git_status, test_run
---

# Investigate Bug Skill

Execute a structured, deterministic root-cause investigation for an observed defect or symptom.

## Workflow

1. Read and analyze the bug description or error symptom.
2. Locate the failing code path using file search and keyword discovery.
3. Inspect recent Git commits touching the affected module to identify potential regressions.
4. Run relevant tests in isolation to reproduce the issue.
5. Form explicit hypotheses and verify against source code and execution evidence.
6. Provide an evidence-backed root cause statement and proposed patch.

## Arguments
- `target`: The module, file path, or error symptom to investigate (required)
- `reproduce`: Optional test command or reproduction step

## Prompts
- "Investigate why token refresh fails intermittently with HTTP 401"
- "Investigate why user permissions are not persisted after save"
