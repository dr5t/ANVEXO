import { describe, it, expect } from 'vitest';
import { GemmaProvider } from '../../src/providers/gemma.js';

const apiKey = process.env.GEMMA_API_KEY?.trim();

if (!apiKey) {
  console.info('Gemma live smoke test skipped. Set GEMMA_API_KEY to run the real API request.');
}

describe('Gemma API live integration smoke test', () => {
  const liveTest = apiKey ? it : it.skip;

  liveTest('connects to the configured model and receives a non-empty completion', async () => {
    const provider = new GemmaProvider({
      apiKey,
      route: 'gemini-api',
      baseUrl: process.env.GEMMA_BASE_URL?.trim() || undefined,
      defaultModel: process.env.GEMMA_MODEL?.trim() || 'gemma-4-31b-it',
      timeoutMs: 45_000,
    });

    const completion = await provider.complete({
      messages: [{ role: 'user', content: 'Reply with a short confirmation that the Gemma API smoke test succeeded.' }],
      maxTokens: 64,
    });

    expect(completion).toEqual(expect.objectContaining({
      content: expect.any(String),
      finishReason: expect.any(String),
    }));
    expect(completion.content.trim().length).toBeGreaterThan(0);
  }, 60_000);
});
