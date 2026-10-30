# Gemma Model Provider Configuration & Verification Guide

## 1. Overview

ANVEXO integrates Google Gemma open models via [`GemmaProvider`](../../src/providers/gemma.ts) for automated multimodal software investigation, root cause analysis, and regression test recommendation.

The provider features dual-route execution:
1. **Google AI Studio (Gemini API Protocol)**: Hosted Gemma inference via Google's REST API endpoint.
2. **Local Inference Daemon (Ollama / vLLM)**: Fully offline, private local model execution via REST API.

---

## 2. Supported Models & Topography

### 2.1 Google AI Studio Route (`gemini-api`)
| Model Identifier | Architecture | Context Window | Max Output | Multimodal Vision | Function Calling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gemma-4-31b-it` (Default) | 31B Dense Instruct | 262,144 tokens | 8,192 tokens | Yes | Yes |
| `gemma-4-26b-a4b-it` | 26B MoE Instruct | 262,144 tokens | 8,192 tokens | Yes | Yes |
| `gemma-2-27b-it` | 27B Dense Instruct | 8,192 tokens | 4,096 tokens | No | Yes |
| `gemma-2-9b-it` | 9B Dense Instruct | 8,192 tokens | 4,096 tokens | No | No |

### 2.2 Local Inference Route (`local`)
| Model Tag | Description | Context Window | Endpoint |
| :--- | :--- | :--- | :--- |
| `gemma4:latest` (Default) | Gemma 4 local container | 65,536 tokens | `http://127.0.0.1:11434/api/generate` |
| `gemma2:9b` | Gemma 2 9B local | 8,192 tokens | `http://127.0.0.1:11434/api/generate` |
| Dynamic (`/api/tags`) | Auto-discovered Gemma models | 32,768 tokens | `http://127.0.0.1:11434/api/generate` |

---

## 3. Environment Variables & Authentication

### 3.1 Google AI Studio Configuration
To use Google-hosted Gemma models:
```bash
export GEMMA_API_KEY="your-google-ai-studio-api-key"
# Alternatively, standard Gemini API key is recognized as fallback:
export GEMINI_API_KEY="your-google-ai-studio-api-key"
```

Endpoint URL constructed:
```text
https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={API_KEY}
```

*Security Invariant*: API keys are automatically redacted in terminal error messages and caught exceptions as `[REDACTED_API_KEY]`.

### 3.2 Local Daemon Configuration
For air-gapped local execution without API keys:
```bash
# Default connects to http://127.0.0.1:11434
export GEMMA_BASE_URL="http://127.0.0.1:11434"
```

To run with Ollama:
```bash
ollama serve
ollama pull gemma4:latest
```

---

## 4. Multimodal & Diagnostic Capabilities

`GemmaProvider.investigateIssue()` accepts a structured diagnostic context:
- `objective`: Problem description or bug report.
- `repoPath`: Workspace root directory.
- `terminalLog`: Execution failures, compiler errors, or stack traces.
- `gitDiff`: Active uncommitted code changes.
- `relevantFiles`: Extracted source code snippets.
- `screenshot`: Base64-encoded UI crash or visual artifact.

### Multimodal Constraints
- Supported MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- Payload limit: Maximum 5MB base64 data.
- Local Ollama: Base64 image payloads are extracted and forwarded via the Ollama `images: []` request body.

### Structured Diagnostic Output
Gemma produces JSON conforming to `GemmaInvestigationResult`:
- `summary`: High-level synopsis of the failure.
- `suspectedRootCause`: Pinpointed defect explanation.
- `codeEvidence`: File paths, line numbers, and snippets.
- `proposedFix`: Code remediation patch.
- `suggestedRegressionTests`: Test commands to prevent regressions.
- `evidenceRecords`: Transformed into `EvidenceRecord`s with `VerificationStatus.UNVERIFIED` for code claims and `VERIFIED` for attached visual screenshots.

### 4.4 CLI Command Usage
Run direct Gemma 4 multimodal investigations from your terminal:
```bash
# Basic investigation
npx anvexo gemma "Diagnose runtime crash in auth"

# With multimodal screenshot, terminal log, and git diff
npx anvexo gemma "Investigate login failure" --screenshot error.png --log trace.log --diff

# Raw JSON output for machine parsing
npx anvexo gemma "Memory leak check" --json
```

---

## 5. Verification & Testing Instructions

### 5.1 Offline Unit Tests (24 Mocked Tests)
Verifies route switching, payload formatting, model listing, image validation, error API key scrubbing, and JSON markdown fallback:
```bash
npx vitest run tests/unit/gemma.test.ts
```

### 5.2 Live Integration Tests (Non-Blocking)
Verifies connectivity with live Google AI Studio API or local Ollama daemon:
```bash
# With API key
GEMMA_API_KEY="AIzaSy..." npm run test:gemma

# Or with local Ollama
GEMMA_BASE_URL="http://127.0.0.1:11434" npm run test:gemma

# Offline / Headless CI (skips cleanly with diagnostic notice)
npm run test:gemma
```

### 5.3 Full Verification Suite
```bash
npm run lint
npm run build
npm test
```
