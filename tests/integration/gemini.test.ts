import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../src/providers/gemini.js';

const apiKey = process.env.GEMINI_API_KEY?.trim();

if (!apiKey) {
  console.info('Gemini live smoke test skipped. Set GEMINI_API_KEY to run the real API request.');
}

describe('Gemini API live integration smoke test', () => {
  const liveTest = apiKey ? it : it.skip;

  liveTest('connects to the configured Gemini model and receives a non-empty completion', async () => {
    const provider = new GeminiProvider({
      apiKey,
      baseUrl: process.env.GEMINI_BASE_URL?.trim() || undefined,
      defaultModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
      timeoutMs: 45_000,
    });

    const completion = await provider.complete({
      messages: [{ role: 'user', content: 'Reply with a short confirmation that the Gemini API smoke test succeeded.' }],
      maxTokens: 64,
    });

    expect(completion).toEqual(expect.objectContaining({
      content: expect.any(String),
      finishReason: expect.any(String),
    }));
    expect(completion.content.trim().length).toBeGreaterThan(0);
  }, 60_000);
});
