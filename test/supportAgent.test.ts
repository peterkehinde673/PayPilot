import { describe, expect, it } from 'vitest';
import { createPurchase } from '../server/purchaseStore';
import { handleSupportRequest } from '../server/supportAgent';

describe('post-purchase support agent', () => {
  it('returns safe order status guidance', () => {
    createPurchase({
      id: 'support-purchase',
      productId: 'item-1',
      productName: 'Test item',
      amount: '100.00',
      currency: 'USD',
      status: 'captured'
    });

    const result = handleSupportRequest('support-purchase', 'order_status');
    expect(result?.message).toContain('captured');
  });

  it('does not issue an unverified refund', () => {
    createPurchase({ id: 'refund-purchase', productId: 'item-2', productName: 'Refund item', amount: '50.00', currency: 'USD', status: 'captured' });
    const result = handleSupportRequest('refund-purchase', 'refund_guidance');
    expect(result?.message).toContain('does not issue an unverified refund');
  });
});
