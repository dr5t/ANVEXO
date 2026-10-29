---
name: refactor-module
description: Restructure code for clarity and maintainability while preserving public behavior
tools: file_read, file_search, test_run
---

# Refactor Module Skill

Safely refactor complex or duplicated code while preserving all existing behaviors and tests.

## Workflow

1. Read target module and all corresponding unit tests.
2. Run baseline test suite to verify tests currently pass.
3. Identify refactoring target (extract function, simplify branching, deduplicate).
4. Apply structural improvements without modifying public APIs.
5. Re-run test suite to verify zero regressions.

## Arguments
- `target`: Path of the file or module to refactor (required)
- `goal`: Specific refactoring objective (required)

## Prompts
- "Refactor src/permissions/manager.ts to simplify key resolution"
- "Deduplicate error formatting in src/core/logger.ts"
