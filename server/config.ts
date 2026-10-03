function optionalPositiveAmount(value: string | undefined, fallback: string): string {
  if (value && /^\d{1,9}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0) return value;
  return fallback;
}

function requiredSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  try {
    const url = new URL(value ?? fallback);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return fallback;
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const config = {
  paypalClientId: requiredSecret('PAYPAL_CLIENT_ID'),
  paypalClientSecret: requiredSecret('PAYPAL_CLIENT_SECRET'),
  aiApiKey: requiredSecret('AI_API_KEY'),
  databaseUrl: requiredSecret('DATABASE_URL'),
  port: Number.isInteger(Number(process.env.PORT)) && Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3001,
  paypalBaseUrl: normalizeUrl(process.env.PAYPAL_BASE_URL, 'https://api-m.sandbox.paypal.com'),
  paypalReturnUrl: normalizeUrl(process.env.PAYPAL_RETURN_URL, 'http://localhost:5173/'),
  paypalCancelUrl: normalizeUrl(process.env.PAYPAL_CANCEL_URL, 'http://localhost:5173/'),
  webOrigin: normalizeUrl(process.env.PAYPILOT_WEB_ORIGIN, 'http://localhost:5173'),
  maxAutoPurchase: optionalPositiveAmount(process.env.PAYPILOT_MAX_AUTO_PURCHASE, '500.00'),
  policyCurrency: (process.env.PAYPILOT_POLICY_CURRENCY ?? 'USD').toUpperCase()
};
