import cors from 'cors';
import express from 'express';
import { PayPalClient, PayPalError } from './paypal.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'paypilot-api',
    version: '0.1.0'
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    aiConfigured: Boolean(process.env.AI_API_KEY)
  });
});

app.post('/api/paypal/orders', async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(503).json({ error: 'PayPal Sandbox is not configured' });
    return;
  }

  const amount = typeof req.body?.amount === 'string' ? req.body.amount.trim() : '';
  const currency = typeof req.body?.currency === 'string'
    ? req.body.currency.trim().toUpperCase()
    : '';
  const description = typeof req.body?.description === 'string'
    ? req.body.description.trim().slice(0, 127)
    : undefined;

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Amount must be a positive USD-style decimal value' });
    return;
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    res.status(400).json({ error: 'Currency must be a 3-letter ISO code' });
    return;
  }

  try {
    const client = new PayPalClient({
      clientId,
      clientSecret,
      baseUrl: process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com'
    });

    const order = await client.createOrder({
      amount,
      currency,
      description
    });

    res.status(201).json({
      id: order.id,
      status: order.status,
      approveUrl: order.links?.find((link: { href: string; rel: string; method?: string }) => link.rel === 'approve')?.href ?? null
    });
  } catch (error: unknown) {
    if (error instanceof PayPalError) {
      res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        error: error.message,
        paypalStatus: error.status
      });
      return;
    }

    console.error('PayPal order creation failed');
    res.status(502).json({ error: 'PayPal order creation failed' });
  }
});

app.post('/api/paypal/orders/:orderId/capture', async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(503).json({ error: 'PayPal Sandbox is not configured' });
    return;
  }

  try {
    const client = new PayPalClient({
      clientId,
      clientSecret,
      baseUrl: process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com'
    });

    const order = await client.captureOrder(req.params.orderId);
    res.json({ id: order.id, status: order.status });
  } catch (error) {
    if (error instanceof PayPalError) {
      res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        error: error.message,
        paypalStatus: error.status
      });
      return;
    }

    console.error('PayPal order capture failed');
    res.status(502).json({ error: 'PayPal order capture failed' });
  }
});

app.listen(PORT, () => {
  console.log(`PayPilot API listening on http://localhost:${PORT}`);
});
