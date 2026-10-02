import { describe, expect, it } from 'vitest';
import { evaluatePurchase } from '../server/policy';

describe('approval gate', () => {
  it('marks purchases above the automatic limit for explicit approval', () => {
    const decision = evaluatePurchase('699.00', 'USD');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it('allows purchases at the configured limit without approval', () => {
    const decision = evaluatePurchase('500.00', 'USD');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.allowed).toBe(true);
  });
});
