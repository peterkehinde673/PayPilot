function optionalPositiveAmount(value: string | undefined, fallback: string): string {
  if (value && /^\d{1,9}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0) return value;
  return fallback;
}

export const config = {
  port: Number.isInteger(Number(process.env.PORT)) && Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3001,
  paypalBaseUrl: process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com',
  paypalReturnUrl: process.env.PAYPAL_RETURN_URL ?? 'http://localhost:5173/',
  paypalCancelUrl: process.env.PAYPAL_CANCEL_URL ?? 'http://localhost:5173/',
  maxAutoPurchase: optionalPositiveAmount(process.env.PAYPILOT_MAX_AUTO_PURCHASE, '500.00'),
  policyCurrency: (process.env.PAYPILOT_POLICY_CURRENCY ?? 'USD').toUpperCase()
};
