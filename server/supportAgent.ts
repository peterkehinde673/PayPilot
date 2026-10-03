import { findPurchase } from './purchaseStore.js';

export type SupportAction = 'track' | 'refund_guidance' | 'order_status';

export type SupportResponse = {
  purchaseId: string;
  action: SupportAction;
  message: string;
};

export async function handleSupportRequest(purchaseId: string, action: SupportAction): Promise<SupportResponse | null> {
  const purchase = await findPurchase(purchaseId);
  if (!purchase) return null;

  if (action === 'refund_guidance') {
    return {
      purchaseId,
      action,
      message: 'Refund requests require confirmation and must be handled through the merchant or PayPal-supported refund flow; PayPilot does not issue an unverified refund.'
    };
  }

  if (action === 'order_status') {
    return {
      purchaseId,
      action,
      message: 'Current PayPilot purchase status: ' + purchase.status + '.'
    };
  }

  return {
    purchaseId,
    action,
    message: 'Tracking information is not available yet. PayPilot will surface it when a supported tracking update is recorded.'
  };
}
