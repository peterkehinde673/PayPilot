export type SpendingPolicy = {
  maxAutoPurchase: string;
  currency: string;
  requireApprovalAboveLimit: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
};

const DEFAULT_POLICY: SpendingPolicy = {
  maxAutoPurchase: '500.00',
  currency: 'USD',
  requireApprovalAboveLimit: true
};

export function getSpendingPolicy(): SpendingPolicy {
  const max = process.env.PAYPILOT_MAX_AUTO_PURCHASE ?? DEFAULT_POLICY.maxAutoPurchase;
  const currency = (process.env.PAYPILOT_POLICY_CURRENCY ?? DEFAULT_POLICY.currency).toUpperCase();
  return {
    maxAutoPurchase: /^\d{1,9}(?:\.\d{1,2})?$/.test(max) ? max : DEFAULT_POLICY.maxAutoPurchase,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_POLICY.currency,
    requireApprovalAboveLimit: true
  };
}

export function evaluatePurchase(amount: string, currency: string, policy = getSpendingPolicy()): PolicyDecision {
  const numericAmount = Number(amount);
  const normalizedCurrency = currency.toUpperCase();

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount) || numericAmount <= 0) {
    return { allowed: false, requiresApproval: false, reason: 'Purchase amount is invalid.' };
  }

  if (normalizedCurrency !== policy.currency) {
    return { allowed: false, requiresApproval: false, reason: `Policy is configured for ${policy.currency} purchases.` };
  }

  const limit = Number(policy.maxAutoPurchase);
  if (numericAmount > limit && policy.requireApprovalAboveLimit) {
    return { allowed: false, requiresApproval: true, reason: `This purchase exceeds the automatic spending limit of ${policy.currency} ${policy.maxAutoPurchase}.` };
  }

  return { allowed: true, requiresApproval: false, reason: `Purchase is within the automatic spending limit of ${policy.currency} ${policy.maxAutoPurchase}.` };
}
