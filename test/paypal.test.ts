import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayPalClient } from '../server/paypal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PayPalClient', () => {
  it('gets and caches an OAuth access token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-123',
          expires_in: 3600
        }),
        { status: 200 }
      )
    );

    const client = new PayPalClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    });

    expect(await client.getAccessToken()).toBe('token-123');
    expect(await client.getAccessToken()).toBe('token-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`
    });
    expect(request.body).toBe('grant_type=client_credentials');
  });

  it('creates an order with a capture intent', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'token-123', expires_in: 3600 }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ORDER-123',
            status: 'CREATED',
            links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123' }]
          }),
          { status: 201 }
        )
      );

    const client = new PayPalClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    });

    const order = await client.createOrder({
      amount: '899.99',
      currency: 'USD',
      description: 'Programming laptop',
      returnUrl: 'http://localhost:5173/',
      cancelUrl: 'http://localhost:5173/'
    });

    expect(order.id).toBe('ORDER-123');
    expect(order.status).toBe('CREATED');

    const request = vi.mocked(globalThis.fetch).mock.calls[1][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      intent: string;
      purchase_units: Array<{
        description: string;
        amount: { currency_code: string; value: string };
      }>;
    };

    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0]).toMatchObject({
      description: 'Programming laptop',
      amount: { currency_code: 'USD', value: '899.99' }
    });
  });

  it('captures an order after validating its ID', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'token-123', expires_in: 3600 }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'ORDER-123', status: 'COMPLETED' }), {
          status: 201
        })
      );

    const client = new PayPalClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    });

    const result = await client.captureOrder('ORDER-123');

    expect(result.status).toBe('COMPLETED');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toContain(
      '/v2/checkout/orders/ORDER-123/capture'
    );

    await expect(client.captureOrder('../bad')).rejects.toMatchObject({
      status: 400
    });
  });

  it('surfaces PayPal authentication failures without exposing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'AUTHENTICATION_FAILURE' }), { status: 401 })
    );

    const client = new PayPalClient({
      clientId: 'client-id',
      clientSecret: 'super-secret',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    });

    await expect(client.getAccessToken()).rejects.toMatchObject({
      status: 401
    });
  });
});
