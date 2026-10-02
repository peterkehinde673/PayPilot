import { describe, expect, it } from 'vitest';

describe('configuration defaults', () => {
  it('uses the safe sandbox and policy defaults', async () => {
    const module = await import('../server/config');
    expect(module.config.paypalBaseUrl).toContain('sandbox.paypal.com');
    expect(module.config.maxAutoPurchase).toBe('500.00');
    expect(module.config.policyCurrency).toBe('USD');
  });
});
