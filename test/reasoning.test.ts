import { describe, expect, it } from 'vitest';
import { compareProducts } from '../server/reasoning';

describe('purchase reasoning', () => {
  it('scores requirement matches and budget headroom', () => {
    const comparison = compareProducts(
      {
        request: 'programming laptop under $900',
        category: 'computers',
        query: 'programming laptop',
        maxPrice: '900',
        currency: 'USD',
        requirements: ['programming']
      },
      [
        { id: 'a', name: 'Developer Laptop', price: '849.00', currency: 'USD', reason: 'Programming performance.' },
        { id: 'b', name: 'Basic Laptop', price: '599.00', currency: 'USD', reason: 'Everyday use.' }
      ]
    );

    expect(comparison.recommendedId).toBe('a');
    expect(comparison.assessments).toHaveLength(2);
    expect(comparison.summary).toContain('scores highest');
  });

  it('returns no recommendation when discovery returns nothing', () => {
    const comparison = compareProducts(
      {
        request: 'laptop under €900',
        category: 'computers',
        query: 'laptop',
        maxPrice: '900',
        currency: 'EUR',
        requirements: []
      },
      []
    );

    expect(comparison.recommendedId).toBeNull();
    expect(comparison.assessments).toEqual([]);
  });
});
