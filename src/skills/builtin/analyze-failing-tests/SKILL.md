---
name: Analyze Failing Tests
description: Run automated tests, isolate stack traces, and identify exact failure lines
tools: test_run, file_read, file_search
---

# Analyze Failing Tests Skill

Pinpoint the precise line of code and runtime condition causing automated test suites to fail.

## Workflow

1. Execute project test runner in isolated environment.
2. Parse test failure output, stack traces, and assertion diffs.
3. Locate corresponding test files and source modules under test.
4. Contrast expected values with actual received values.
5. Identify minimal code fix required to satisfy test assertions without breaking existing tests.

## Arguments
- `filter`: Specific test file or test name pattern to execute (optional)

## Prompts
- "Analyze why settings.test.ts is failing"
- "Run the unit test suite and diagnose assertion mismatches"
