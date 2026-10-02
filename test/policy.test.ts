import { describe, expect, it } from 'vitest';
import { evaluatePurchase } from '../server/policy';

describe('spending policy', () => {
  const policy = {
    maxAutoPurchase: '500.00',
    currency: 'USD',
    requireApprovalAboveLimit: true
  };

  it('allows a purchase exactly at the automatic limit', () => {
    const result = evaluatePurchase('500.00', 'USD', policy);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it('requires human approval above the automatic limit', () => {
    const result = evaluatePurchase('500.01', 'USD', policy);
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it('blocks a policy currency mismatch', () => {
    const result = evaluatePurchase('100.00', 'EUR', policy);
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(false);
  });

  it('rejects malformed and non-positive amounts', () => {
    expect(evaluatePurchase('0', 'USD', policy).allowed).toBe(false);
    expect(evaluatePurchase('-1.00', 'USD', policy).allowed).toBe(false);
    expect(evaluatePurchase('not-a-price', 'USD', policy).allowed).toBe(false);
    expect(evaluatePurchase('10.999', 'USD', policy).allowed).toBe(false);
  });
});
