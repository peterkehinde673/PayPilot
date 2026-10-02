import { describe, expect, it } from 'vitest';
import { createPurchase, listPurchases, updatePurchase } from '../server/purchaseStore';

describe('purchase store', () => {
  it('creates and updates purchase records', () => {
    createPurchase({
      id: 'purchase-1',
      productId: 'laptop-pro-14',
      productName: 'Pro 14 Developer Laptop',
      amount: '849.00',
      currency: 'USD',
      status: 'approval_required'
    });

    const updated = updatePurchase('purchase-1', { status: 'checkout_created', paypalOrderId: 'ORDER-1' });
    expect(updated?.status).toBe('checkout_created');
    expect(updated?.paypalOrderId).toBe('ORDER-1');
    expect(listPurchases()[0]?.productName).toBe('Pro 14 Developer Laptop');
  });
});


describe('purchase capture state', () => {
  it('tracks a successful captured transition', () => {
    createPurchase({
      id: 'capture-test',
      productId: 'laptop',
      productName: 'Laptop',
      amount: '500.00',
      currency: 'USD',
      status: 'checkout_created',
      paypalOrderId: 'ORDER-CAPTURE'
    });

    const updated = updatePurchase('capture-test', { status: 'captured' });

    expect(updated?.status).toBe('captured');
    expect(listPurchases().find((item) => item.id === 'capture-test')?.status).toBe('captured');
  });
});
