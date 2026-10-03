import cors from 'cors';
import express from 'express';
import { PayPalClient, PayPalError } from './paypal.js';
import { AIProviderError, buildPurchasePlan } from './ai.js';
import { discoverProducts } from './catalog.js';
import { compareProducts } from './reasoning.js';
import { evaluatePurchase } from './policy.js';
import { createPurchase, findPurchase, findPurchaseByPayPalOrderId, listPurchases, removePurchase, updatePurchase } from './purchaseStore.js';
import { addNotification, listNotifications } from './notifications.js';
import { handleSupportRequest, type SupportAction } from './supportAgent.js';
import { config } from './config.js';
import { normalizeUserRequest, SECURITY_HEADERS } from './security.js';
import { initializeDatabase } from './db.js';

const approvalTokens = new Map<string, { amount: string; currency: string; expiresAt: number }>();
const approvalCleanup = setInterval(() => {
  const now = Date.now();
  for (const [token, approval] of approvalTokens) {
    if (approval.expiresAt <= now) approvalTokens.delete(token);
  }
}, 60_000);
approvalCleanup.unref?.();

function issueApprovalToken(amount: string, currency: string): string {
  const token = crypto.randomUUID();
  approvalTokens.set(token, { amount, currency, expiresAt: Date.now() + 10 * 60 * 1000 });
  return token;
}

const app = express();
const PORT = config.port;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
});
app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('dist'));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile('index.html', { root: 'dist' });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'paypilot-api',
    version: '0.1.0'
  });
});

app.post('/api/ai/intent', async (req, res) => {
  const request = normalizeUserRequest(req.body?.request);

  if (!request) {
    res.status(400).json({ error: 'Request must be a non-empty string of 1000 characters or fewer' });
    return;
  }

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

app.post('/api/purchases/approval', async (req, res) => {
  const amount = typeof req.body?.amount === 'string' ? req.body.amount.trim() : '';
  const currency = typeof req.body?.currency === 'string' ? req.body.currency.trim().toUpperCase() : '';
  const decision = evaluatePurchase(amount, currency);

  if (!decision.requiresApproval) {
    res.status(decision.allowed ? 200 : 400).json({ approved: false, decision });
    return;
  }

  const token = issueApprovalToken(amount, currency);
  await addNotification({ type: 'approval_required', purchaseId: 'approval-pending', message: decision.reason });
  res.json({ approved: true, approvalToken: token, decision, expiresInSeconds: 600 });
});

app.get('/api/config', (_req, res) => {
  res.json({
    paypalConfigured: Boolean(config.paypalClientId && config.paypalClientSecret),
    aiConfigured: Boolean(config.aiApiKey)
  });
});

app.post('/api/purchases/:purchaseId/support', async (req, res) => {
  const action = typeof req.body?.action === 'string' ? req.body.action as SupportAction : undefined;
  if (!action || !['track', 'refund_guidance', 'order_status'].includes(action)) {
    res.status(400).json({ error: 'Unsupported support action' });
    return;
  }
  const result = await handleSupportRequest(req.params.purchaseId, action);
  if (!result) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json(result);
});

app.get('/api/purchases/:purchaseId', (req, res) => {
  const purchase = await findPurchase(req.params.purchaseId);
  if (!purchase) {
    res.status(404).json({ error: 'Purchase not found' });
    return;
  }
  res.json({ purchase });
});

app.get('/api/notifications', async (_req, res) => {
  res.json({ notifications: await listNotifications() });
});

app.get('/api/purchases', async (_req, res) => {
  res.json({ purchases: await listPurchases() });
});

app.post('/api/paypal/orders', async (req, res) => {
  const clientId = config.paypalClientId;
  const clientSecret = config.paypalClientSecret;

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

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Amount must be a positive USD-style decimal value' });
    return;
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    res.status(400).json({ error: 'Currency must be a 3-letter ISO code' });
    return;
  }

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

  let purchaseIdForRollback: string | null = null;
  try {
    const client = new PayPalClient({
      clientId,
      clientSecret,
      baseUrl: config.paypalBaseUrl
    });

    const purchaseId = crypto.randomUUID();
    purchaseIdForRollback = purchaseId;
    const purchase = await createPurchase({ id: purchaseId, productId: typeof req.body?.productId === 'string' ? req.body.productId : 'unknown', productName: description ?? 'PayPilot purchase', amount, currency, status: 'checkout_created' });

    const order = await client.createOrder({
      amount,
      currency,
      description,
      returnUrl: config.paypalReturnUrl,
      cancelUrl: config.paypalCancelUrl
    });

    await updatePurchase(purchase.id, { paypalOrderId: order.id });
    await addNotification({ type: 'checkout_ready', purchaseId: purchase.id, message: `PayPal checkout is ready for ${purchase.productName}.` });
    res.status(201).json({
      purchaseId: purchase.id,
      id: order.id,
      status: order.status,
      approveUrl: order.links?.find((link: { href: string; rel: string; method?: string }) => link.rel === 'approve')?.href ?? null
    });
  } catch (error: unknown) {
    if (error instanceof PayPalError) {
      if (purchaseIdForRollback) await removePurchase(purchaseIdForRollback);
      res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        error: error.message,
        paypalStatus: error.status
      });
      return;
    }

    if (purchaseIdForRollback) {
      await removePurchase(purchaseIdForRollback);
    }
    console.error('PayPal order creation failed');
    res.status(502).json({ error: 'PayPal order creation failed' });
  }
});

app.post('/api/paypal/orders/:orderId/capture', async (req, res) => {
  const clientId = config.paypalClientId;
  const clientSecret = config.paypalClientSecret;

  if (!clientId || !clientSecret) {
    res.status(503).json({ error: 'PayPal Sandbox is not configured' });
    return;
  }

  try {
    const client = new PayPalClient({
      clientId,
      clientSecret,
      baseUrl: config.paypalBaseUrl
    });

    const requestedPurchaseId = typeof req.body?.purchaseId === 'string' ? req.body.purchaseId : '';
    const purchase = requestedPurchaseId
      ? await findPurchase(requestedPurchaseId)
      : await findPurchaseByPayPalOrderId(req.params.orderId);
    if (!purchase || purchase.paypalOrderId !== req.params.orderId) {
      res.status(409).json({ error: 'PayPal order is not linked to the supplied purchase' });
      return;
    }

    if (purchase.status === 'captured') {
      res.status(409).json({ error: 'Purchase has already been captured', purchaseId: purchase.id, status: purchase.status });
      return;
    }

    const order = await client.captureOrder(req.params.orderId);
    const updatedPurchase = await updatePurchase(purchase.id, { status: 'captured' });
    await addNotification({ type: 'payment_captured', purchaseId: purchase.id, message: `Payment captured for ${purchase.productName}.` });
    res.json({ id: order.id, status: order.status, purchaseId: updatedPurchase?.id ?? null });
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

(async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`PayPilot API listening on http://localhost:${PORT}`);
  });
})().catch((error: unknown) => {
  console.error('PayPilot database initialization failed', error);
  process.exit(1);
});
