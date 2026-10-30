# MLH Submission Verification

This guide separates checks that run offline from checks that require a live model service. A passing mocked or local integration test does not establish that a hosted model is available or that live inference succeeds.

## Verification environment

The repository was checked on the `pr-for-hacktoberrfest` branch at commit `74b3063` using Windows, Node.js 26.13.0, and the repository's installed dependencies.

| Command | Result |
| :--- | :--- |
| `npm test` | Passed: 29 test files and 291 tests |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test:gemma` | Skipped: `GEMMA_API_KEY` was not configured |
| `npm run test:gemini` | Skipped: `GEMINI_API_KEY` was not configured |

Neither live smoke test made an API request in this verification run. These results describe the recorded run and are not a permanent test count or a claim about future builds.

## 1. Automated unit tests

Run all default tests with:

```bash
npm test
```

Vitest includes `tests/**/*.test.ts` except the two live provider smoke tests. The default suite includes mocked provider tests and local integration tests; it does not require Gemma or Gemini credentials. Provider-specific mocked tests can be run separately:

```bash
npx vitest run tests/unit/gemma.test.ts tests/unit/gemini.test.ts
```

These tests exercise local code paths and mocked HTTP responses. They do not prove external model availability, account access, or live model quality.

## 2. Local integration tests

The default test suite includes local integration coverage such as:

- [`tests/integration/engine.test.ts`](../../tests/integration/engine.test.ts), which exercises investigation against the checked-out repository.
- [`tests/integration/workflow.test.ts`](../../tests/integration/workflow.test.ts), which exercises the engineering workflow and its local tools.

Run these tests directly with:

```bash
npx vitest run tests/integration/engine.test.ts tests/integration/workflow.test.ts
```

These tests can inspect the local filesystem and run local subprocesses. They do not perform Gemma or Gemini model inference.

## 3. Live model smoke tests

### Gemma through the hosted Gemini API

The opt-in test in [`tests/integration/gemma.test.ts`](../../tests/integration/gemma.test.ts) sends one real text-completion request through the hosted Gemini `generateContent` endpoint using `GemmaProvider`. It checks that the completion has the expected basic fields and non-empty text. It does not test multimodal investigation, local Ollama inference, or the accuracy of generated content.

Run it with:

```bash
npm run test:gemma
```

Set `GEMMA_API_KEY` to authorize the request. The test defaults to `gemma-4-31b-it`; `GEMMA_MODEL` selects another model identifier and `GEMMA_BASE_URL` changes the hosted API base URL. Without `GEMMA_API_KEY`, the test is skipped and makes no request. Secure setup examples are in the [Gemma provider configuration guide](../providers/GEMMA_CONFIGURATION.md).

### Gemini provider

The separate [`tests/integration/gemini.test.ts`](../../tests/integration/gemini.test.ts) smoke test sends a real text-completion request using `GeminiProvider`. Run it with:

```bash
npm run test:gemini
```

It requires `GEMINI_API_KEY` and can use `GEMINI_MODEL` and `GEMINI_BASE_URL`. Without the key, it is skipped and makes no request. This test is for the Gemini provider and is not evidence that Gemma inference succeeded.

Both live tests are excluded from `npm test`. Do not describe a skipped test, mocked response, or local workflow run as live model verification.

## 4. Build and static checks

Run the TypeScript check and production build with:

```bash
npm run lint
npm run build
```

These validate source typing and build output. Neither command makes a model request.

## 5. Manual CLI checks

After building, verify the CLI command surface with:

```bash
node dist/cli/index.js --help
node dist/cli/index.js gemma --help
```

To attempt a real Gemma-backed CLI investigation, configure `GEMMA_API_KEY` securely and run:

```bash
node dist/cli/index.js gemma "Investigate a reproducible application failure" --path .
```

The CLI invocation is a live provider workflow only when it successfully reaches the configured service. CLI help output alone verifies command registration, not model connectivity or output correctness.

## 6. Claims and limitations

- `GemmaProvider` supports a hosted Gemini API route and an Ollama-compatible local route. Mocked tests cover provider behavior; this verification run did not contact either service.
- The Gemma live smoke test currently exercises only hosted text completion. It does not validate local-daemon connectivity or multimodal investigation.
- Static model registry entries and configured defaults do not prove that a model is currently available or enabled for an account.
- No `.github/workflows/` directory is present on the inspected branch, so there is no repository GitHub Actions workflow to report as passing.
- `package.json` declares `"license": "UNLICENSED"` and the repository root has no `LICENSE` file. An open-source license claim is not verified; no license has been changed here.
- The dedicated `test:demo` script and `tests/integration/demo.test.ts` referenced by older planning material are absent. The existing workflow integration test is not that demo harness.
- Repository code, tests, and documentation establish implementation details and local test outcomes only. They do not independently establish MLH eligibility, hosted service availability, or live inference results.
