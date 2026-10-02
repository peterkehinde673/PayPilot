import cors from 'cors';
import express from 'express';
import { PayPalClient, PayPalError } from './paypal.js';
import { AIProviderError, buildPurchasePlan } from './ai.js';
import { discoverProducts } from './catalog.js';
import { compareProducts } from './reasoning.js';
import { evaluatePurchase } from './policy.js';
import { createPurchase, listPurchases, updatePurchase } from './purchaseStore.js';
import { addNotification, listNotifications } from './notifications.js';
import { handleSupportRequest, type SupportAction } from './supportAgent.js';

const approvalTokens = new Map<string, { amount: string; currency: string; expiresAt: number }>();

function issueApprovalToken(amount: string, currency: string): string {
  const token = crypto.randomUUID();
  approvalTokens.set(token, { amount, currency, expiresAt: Date.now() + 10 * 60 * 1000 });
  return token;
}

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

app.post('/api/ai/intent', async (req, res) => {
  const request = typeof req.body?.request === 'string' ? req.body.request : '';

  try {
    const plan = await buildPurchasePlan(request);
    const options = discoverProducts(plan.intent);
    const comparison = compareProducts(plan.intent, options);
    const recommended = options.find((product) => product.id === comparison.recommendedId);
    const policy = recommended ? evaluatePurchase(recommended.price, recommended.currency) : null;
    res.json({ ...plan, options, comparison, policy });
  } catch (error: unknown) {
    if (error instanceof AIProviderError) {
      res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        error: error.message
      });
      return;
    }

    console.error('AI purchase intent failed');
    res.status(502).json({ error: 'AI purchase intent failed' });
  }
});

app.post('/api/purchases/approval', (req, res) => {
  const amount = typeof req.body?.amount === 'string' ? req.body.amount.trim() : '';
  const currency = typeof req.body?.currency === 'string' ? req.body.currency.trim().toUpperCase() : '';
  const decision = evaluatePurchase(amount, currency);

  if (!decision.requiresApproval) {
    res.status(decision.allowed ? 200 : 400).json({ approved: false, decision });
    return;
  }

  const token = issueApprovalToken(amount, currency);
  addNotification({ type: 'approval_required', purchaseId: `approval-${token}`, message: decision.reason });
  res.json({ approved: true, approvalToken: token, decision, expiresInSeconds: 600 });
});

app.get('/api/config', (_req, res) => {
  res.json({
    paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    aiConfigured: Boolean(process.env.AI_API_KEY)
  });
});

app.post('/api/purchases/:purchaseId/support', (req, res) => {
  const action = typeof req.body?.action === 'string' ? req.body.action as SupportAction : undefined;
  if (!action || !['track', 'refund_guidance', 'order_status'].includes(action)) {
    res.status(400).json({ error: 'Unsupported support action' });
    return;
  }
  const result = handleSupportRequest(req.params.purchaseId, action);
  if (!result) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json(result);
});

app.get('/api/purchases/:purchaseId', (req, res) => {
  const purchase = listPurchases().find((item) => item.id === req.params.purchaseId);
  if (!purchase) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json({ purchase });
});

app.get('/api/notifications', (_req, res) => {
  res.json({ notifications: listNotifications() });
});

app.get('/api/purchases', (_req, res) => {
  res.json({ purchases: listPurchases() });
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
  const approvalToken = typeof req.body?.approvalToken === 'string' ? req.body.approvalToken : '';
  const decision = evaluatePurchase(amount, currency);

  if (decision.requiresApproval) {
    const approval = approvalTokens.get(approvalToken);
    if (!approval || approval.expiresAt <= Date.now() || approval.amount !== amount || approval.currency !== currency) {
      res.status(403).json({ error: 'Human approval is required before this purchase can proceed', decision });
      return;
    }
    approvalTokens.delete(approvalToken);
  } else if (!decision.allowed) {
    res.status(403).json({ error: decision.reason, decision });
    return;
  }

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

    const purchaseId = crypto.randomUUID();
    const purchase = createPurchase({ id: purchaseId, productId: typeof req.body?.productId === 'string' ? req.body.productId : 'unknown', productName: description ?? 'PayPilot purchase', amount, currency, status: 'checkout_created' });

    const order = await client.createOrder({
      amount,
      currency,
      description,
      returnUrl: process.env.PAYPAL_RETURN_URL ?? 'http://localhost:5173/',
      cancelUrl: process.env.PAYPAL_CANCEL_URL ?? 'http://localhost:5173/'
    });

    updatePurchase(purchase.id, { paypalOrderId: order.id });
    addNotification({ type: 'checkout_ready', purchaseId: purchase.id, message: `PayPal checkout is ready for ${purchase.productName}.` });
    res.status(201).json({
      purchaseId: purchase.id,
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
    const purchaseId = typeof req.body?.purchaseId === 'string' ? req.body.purchaseId : '';
    const purchase = purchaseId ? updatePurchase(purchaseId, { status: 'captured' }) : null;
    if (purchase) {
      addNotification({ type: 'checkout_ready', purchaseId: purchase.id, message: `Payment captured for ${purchase.productName}.` });
    }
    res.json({ id: order.id, status: order.status, purchaseId: purchase?.id ?? null });
  } catch (error: unknown) {
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
