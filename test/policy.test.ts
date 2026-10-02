import { describe, expect, it } from 'vitest';
import { evaluatePurchase } from '../server/policy';

describe('spending policy', () => {
  it('allows purchases at or below the automatic limit', () => {
    const result = evaluatePurchase('500.00', 'USD');
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it('requires human approval above the automatic limit', () => {
    const result = evaluatePurchase('699.00', 'USD');
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it('blocks a policy currency mismatch', () => {
    const result = evaluatePurchase('100.00', 'EUR');
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(false);
  });
}
