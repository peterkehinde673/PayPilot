export type PayPalClientConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

export type CreateOrderInput = {
  amount: string;
  currency: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
};

type PayPalTokenResponse = {
  access_token: string;
  expires_in: number;
};

type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method?: string }>;
};

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

export class PayPalClient {
  private readonly config: PayPalClientConfig;
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(config: PayPalClientConfig) {
    const baseUrl = new URL(config.baseUrl);
    if (baseUrl.protocol !== 'https:') {
      throw new PayPalError('PayPal base URL must use HTTPS', 400);
    }
    baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '');
    this.config = { ...config, baseUrl: baseUrl.toString().replace(/\/$/, '') };
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000)
    });

    const data = await readJson(response);

    if (!response.ok || !isTokenResponse(data)) {
      throw new PayPalError('PayPal authentication failed', response.status, data);
    }

    this.accessToken = data.access_token;
    this.accessTokenExpiresAt =
      Date.now() + Math.max(0, data.expires_in - 60) * 1000;

    return data.access_token;
  }

  async createOrder(input: CreateOrderInput): Promise<PayPalOrderResponse> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID(),
        Prefer: 'return=representation'
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        intent: 'CAPTURE',
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl
        },
        purchase_units: [
          {
            description: input.description,
            amount: {
              currency_code: input.currency,
              value: input.amount
            }
          }
        ]
      })
    });

    const data = await readJson(response);

    if (!response.ok || !isOrderResponse(data)) {
      throw new PayPalError('PayPal order creation failed', response.status, data);
    }

    return data;
  }

  async captureOrder(orderId: string): Promise<PayPalOrderResponse> {
    if (!/^[-A-Za-z0-9_]+$/.test(orderId) || orderId.length > 64) {
      throw new PayPalError('Invalid PayPal order ID', 400);
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15_000),
        body: '{}'
      }
    );

    const data = await readJson(response);

    if (!response.ok || !isOrderResponse(data)) {
      throw new PayPalError('PayPal order capture failed', response.status, data);
    }

    return data;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function isTokenResponse(value: unknown): value is PayPalTokenResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.access_token === 'string' && typeof data.expires_in === 'number';
}

function isOrderResponse(value: unknown): value is PayPalOrderResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string' && typeof data.status === 'string';
}
