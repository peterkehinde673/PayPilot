import { describe, expect, it } from 'vitest';
import { discoverProducts } from '../server/catalog';

describe('product discovery', () => {
  it('returns only catalog products within the interpreted budget', () => {
    const products = discoverProducts({
      request: 'Find me a programming laptop under $900',
      category: 'computers',
      query: 'programming laptop',
      maxPrice: '900',
      currency: 'USD',
      requirements: ['programming']
    });

    expect(products).toHaveLength(3);
    expect(products.every((product) => Number(product.price) <= 900)).toBe(true);
  });

  it('does not invent results outside the supported currency or category', () => {
    const products = discoverProducts({
      request: 'Find a laptop under €900',
      category: 'computers',
      query: 'laptop',
      maxPrice: '900',
      currency: 'EUR',
      requirements: []
    });

    expect(products).toEqual([]);
  });
});
