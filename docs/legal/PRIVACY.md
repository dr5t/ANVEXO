# ANVEXO Privacy Policy (Draft)

**Document Status**: Pre-Release Draft  
**Effective Date**: [EFFECTIVE_DATE_DRAFT]  
**Entity**: [ORGANIZATION_NAME_DRAFT]  
**Jurisdiction**: [GOVERNING_JURISDICTION_DRAFT]  
**Contact**: [PRIVACY_CONTACT_EMAIL_DRAFT]  

## 1. Architectural Philosophy and Local-First Guarantee

ANVEXO is engineered with a strict local-first architecture. Software debugging, codebase exploration, hypothesis evaluation, and AST topography analysis occur directly on the developer's local workstation or internal build runner by default.

Key Privacy Principles:
1. ANVEXO does not transmit source code, repository metadata, git history, or environment variables to any remote servers by default.
2. ANVEXO contains zero covert telemetry, usage analytics, tracking beacons, or device fingerprinting.
3. Telemetry is permanently disabled in the core platform.

## 2. Information Handled by Storage Modes

ANVEXO supports four distinct context and intelligence modes:

- Mode A (Ephemeral): All discovered evidence, execution plans, and hypothesis records reside solely in volatile process memory. When the investigation process terminates, all data is purged immediately from memory.
- Mode B (Local Project Context): Investigation results, dependency graphs, and historical bug indexes are stored in a dedicated local directory (`.anvexo/` within the repository root). This data never leaves the developer filesystem unless committed by the developer to their own version control system.
- Mode C (Persistent Machine Intelligence): Architectural intelligence and cross-investigation learnings are persisted in the user local application data directory (`~/.anvexo/storage/`). Access is restricted to the local operating system user account.
- Mode D (User-Configured Cloud Storage): If and only if the operator explicitly configures remote cloud synchronization (e.g. S3-compatible or Google Cloud Storage endpoints), encrypted summaries are uploaded strictly to the bucket credentials provided by the operator. ANVEXO operates no intermediary cloud relay.

## 3. Third-Party Model Providers and External Services

ANVEXO can interface with operator-selected AI model providers (such as Anthropic, OpenAI, or local Ollama instances) for complex hypothesis reasoning.

Operator Controls:
1. Model requests are dispatched only when an explicit provider API key is configured in local environment variables.
2. Prompts sent to model providers include only the minimal context snippets gathered during investigation steps.
3. Users can inspect all prompts and responses in the Tool Console tab before and during execution.
4. Users operating in offline, air-gapped, or strictly regulated environments can utilize local models with zero outbound internet connections.

## 4. Data Retention and Deletion

1. Local Data Deletion: The operator can purge all local context at any time using the CLI command `anvexo context --clear --repo <path>` or by executing a `POST /api/context/clear` request.
2. Cloud Storage Deletion: Because cloud storage uses operator-owned buckets in Mode D, data deletion policies are governed directly by the operator's cloud lifecycle settings.

## 5. Subprocessors

ANVEXO in its default self-hosted distribution utilizes zero third-party subprocessors. No vendor dependencies process user source code. If enterprise managed hosting is selected in future releases, a formal Subprocessor Disclosure will be published specifying infrastructure vendors.

## 6. Updates to this Policy

Revisions to this policy will be documented in the repository release notes. This document is a draft and requires formal legal review prior to commercial distribution.
