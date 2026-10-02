import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPurchasePlan } from '../server/ai';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('purchase intent agent', () => {
  it('uses the safe local parser without an AI key', async () => {
    vi.stubEnv('AI_API_KEY', '');
    const plan = await buildPurchasePlan('Find me a programming laptop under $900');

    expect(plan.provider).toBe('fallback');
    expect(plan.intent.category).toBe('computers');
    expect(plan.intent.maxPrice).toBe('900');
    expect(plan.intent.currency).toBe('USD');
    expect(plan.intent.requirements).toContain('programming');
    expect(plan.options).toEqual([]);
  });

  it('normalizes structured AI intent and never exposes the API key', async () => {
    vi.stubEnv('AI_API_KEY', 'secret-key');
    vi.stubEnv('AI_API_URL', 'https://ai.example.test/v1/chat/completions');
    vi.stubEnv('AI_MODEL', 'test-model');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'computers',
                query: 'programming laptop',
                maxPrice: '900',
                currency: 'usd',
                requirements: ['programming', 'portable'],
                reasoning: 'The request has a clear category and budget.'
              })
            }
          }]
        }),
        { status: 200 }
      )
    );

    const plan = await buildPurchasePlan('Find me a programming laptop under $900');

    expect(plan.provider).toBe('ai');
    expect(plan.intent.currency).toBe('USD');
    expect(plan.intent.maxPrice).toBe('900');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://ai.example.test/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.stringify(init?.body)).not.toContain('secret-key');
  });
});
