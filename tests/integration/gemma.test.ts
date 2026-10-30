import { describe, it, expect } from 'vitest';
import { GemmaProvider } from '../../src/providers/gemma.js';

describe('Gemma Live Integration Harness', () => {
  const gemmaKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMMA_BASE_URL || 'http://127.0.0.1:11434';

  async function isLocalDaemonActive(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  it('runs live Gemma model verification or skips with clear diagnostics', async (ctx) => {
    const hasKey = Boolean(gemmaKey);
    const localActive = await isLocalDaemonActive();

    if (!hasKey && !localActive) {
      console.log('\n[DIAGNOSTIC] Gemma 4 live verification skipped:');
      console.log('  Neither GEMMA_API_KEY nor a running local Ollama daemon was detected.');
      console.log('  To enable live verification:');
      console.log('    1. Google AI Studio: set GEMMA_API_KEY="AIzaSy..." in your environment.');
      console.log('    2. Local Inference: start Ollama (`ollama serve` and `ollama run gemma4:latest`).\n');
      ctx.skip();
      return;
    }

    if (hasKey) {
      const provider = new GemmaProvider({
        apiKey: gemmaKey,
        route: 'gemini-api',
        defaultModel: 'gemma-4-31b-it',
      });

      const models = await provider.listModels();
      expect(models.length).toBeGreaterThan(0);

      const completion = await provider.complete({
        messages: [{ role: 'user', content: 'Reply with the word VERIFIED' }],
        maxTokens: 50,
      });

      expect(completion.content).toBeTruthy();
      expect(completion.finishReason).toBeDefined();
    } else if (localActive) {
      const provider = new GemmaProvider({
        baseUrl,
        route: 'local',
        defaultModel: 'gemma4:latest',
      });

      const models = await provider.listModels();
      expect(models.length).toBeGreaterThan(0);

      const completion = await provider.complete({
        messages: [{ role: 'user', content: 'Reply with the word VERIFIED' }],
        maxTokens: 50,
      });

      expect(completion.content).toBeTruthy();
    }
  });
});
