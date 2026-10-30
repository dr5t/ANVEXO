# Gemma Model Provider Configuration & Verification Guide

## 1. Overview

ANVEXO integrates Gemma models via [`GemmaProvider`](../../src/providers/gemma.ts) for multimodal software investigation and regression test recommendations.

The provider supports two request formats:
1. **Google Gemini API**: Hosted inference through Google's `generateContent` REST API.
2. **Local Ollama-compatible API**: Inference through `/api/generate`; the default endpoint is `http://127.0.0.1:11434`.

The local route does not itself guarantee an air-gapped environment. It sends requests to the configured endpoint.

---

## 2. Provider Model Registry

The provider contains a static registry for hosted models and local fallback identifiers. Registry entries describe configured defaults; they do not prove that a model is currently available or that an account can access it.

### 2.1 Google AI Studio Route (`gemini-api`)
| Model Identifier | Architecture | Context Window | Max Output | Multimodal Vision | Function Calling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gemma-4-31b-it` (Default) | 31B Dense Instruct | 262,144 tokens | 8,192 tokens | Yes | Yes |
| `gemma-4-26b-a4b-it` | 26B MoE Instruct | 262,144 tokens | 8,192 tokens | Yes | Yes |
| `gemma-2-27b-it` | 27B Dense Instruct | 8,192 tokens | 4,096 tokens | No | Yes |
| `gemma-2-9b-it` | 9B Dense Instruct | 8,192 tokens | 4,096 tokens | No | No |

### 2.2 Local Inference Route (`local`)
| Model Tag | Description | Endpoint |
| :--- | :--- | :--- |
| `gemma4:latest` (default fallback) | Default local model identifier | `http://127.0.0.1:11434/api/generate` |
| `gemma2:9b` (default fallback) | Additional local model identifier | `http://127.0.0.1:11434/api/generate` |
| Dynamic (`/api/tags`) | Gemma names returned by the local daemon | `http://127.0.0.1:11434/api/generate` |

Hosted model names and metadata are a static provider registry; their availability and capabilities are not checked until a request reaches the configured service.

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

The provider uses generic errors for hosted HTTP failures and does not include the API response body in those errors. Do not send private repository content to a hosted provider unless permitted by your data-handling policy.

### 3.2 Local Daemon Configuration
The local route defaults to `http://127.0.0.1:11434`. Set these variables to select a different local endpoint or model:
```bash
export GEMMA_BASE_URL="http://127.0.0.1:11435"
export GEMMA_MODEL="gemma4:latest"
```

To run with Ollama:
```bash
ollama serve
ollama pull gemma4:latest
```

`GEMMA_MODEL` and `GEMMA_BASE_URL` are read by `GemmaProvider`. Constructor options `defaultModel` and `baseUrl` take precedence over environment values.

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
The investigation prompt requests JSON with the following fields. The provider extracts a JSON object when possible and supplies fallback values when parsing fails, so a response does not prove that every field came from valid model JSON:
- `summary`: High-level synopsis of the failure.
- `suspectedRootCause`: Pinpointed defect explanation.
- `codeEvidence`: File paths, line numbers, and snippets.
- `proposedFix`: Code remediation patch.
- `suggestedRegressionTests`: Test commands to prevent regressions.

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

### 5.1 Offline Mocked Unit Tests
Verifies route switching, payload formatting, model listing, image validation, error API key scrubbing, and JSON markdown fallback:
```bash
npx vitest run tests/unit/gemma.test.ts
```

### 5.2 Live API Smoke Test (Opt-In)
This test makes one real completion request through the Gemini `generateContent` API. It is excluded from `npm test` and does not fall back to the local route. It is not a multimodal investigation test. Without `GEMMA_API_KEY`, the dedicated command skips without a network request.

On macOS or Linux, enter the key without echoing it, run the test, then clear it:
```bash
read -s GEMMA_API_KEY
export GEMMA_API_KEY
npm run test:gemma
unset GEMMA_API_KEY
```

On Windows PowerShell:
```powershell
$secureKey = Read-Host -AsSecureString 'Gemma API key'
$env:GEMMA_API_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
npm run test:gemma
Remove-Item Env:GEMMA_API_KEY
```

The smoke test defaults to `gemma-4-31b-it`; `GEMMA_MODEL` selects another model and `GEMMA_BASE_URL` may point to a Gemini-API-compatible endpoint. The test only checks the basic response shape and non-empty content. Store keys in a secret manager or CI secret store; never commit or print them.

Without a key, this command safely skips and makes no network request:
```bash
npm run test:gemma
```

`npm test` excludes the live smoke test and does not require a Gemma key or live model service. The test suite also includes local integration tests and may execute local subprocesses.

### 5.3 Full Verification Suite
```bash
npm run lint
npm run build
npm test
```
