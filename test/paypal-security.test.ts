import { describe, expect, it, vi, afterEach } from 'vitest';
import { PayPalClient, PayPalError } from '../server/paypal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PayPal transport security', () => {
  it('rejects non-HTTPS PayPal endpoints', () => {
    expect(() => new PayPalClient({
      clientId: 'client',
      clientSecret: 'secret',
      baseUrl: 'http://example.test'
    })).toThrowError(PayPalError);
  });

  it('uses an abort timeout for OAuth requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200 })
    );

    const client = new PayPalClient({
      clientId: 'client',
      clientSecret: 'secret',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    });

    await client.getAccessToken();

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal)
    });
  });
});
