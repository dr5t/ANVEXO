---
name: Explain Codebase
description: Analyze architectural topography, entry points, and component relationships
tools: file_list, file_read, file_search
---

# Explain Codebase Skill

Provides comprehensive architectural explanations of a repository or specific subsystem.

## Workflow

1. Discover package manifests, configuration files, and primary entry points.
2. Trace dependency hierarchy and internal imports.
3. Map key services, data contracts, and public APIs.
4. Outline the primary execution dataflow.
5. Summarize architecture in clear developer-focused documentation.

## Arguments
- `focus`: Subsystem or directory path to focus on (optional)

## Prompts
- "Explain the architectural layout and dataflow of this repository"
- "Explain how the permission system and router interact"
