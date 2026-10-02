import { describe, expect, it } from 'vitest';

describe('PayPilot foundation', () => {
  it('has the expected service identity', () => {
    expect({ service: 'paypilot-api', version: '0.1.0' }).toEqual({
      service: 'paypilot-api',
      version: '0.1.0'
    });
  });
});
