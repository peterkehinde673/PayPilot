import type { ProductOption, PurchaseIntent } from './ai.js';

const CATALOG: ProductOption[] = [
  { id: 'laptop-pro-14', name: 'Pro 14 Developer Laptop', price: '849.00', currency: 'USD', reason: 'Portable performance suited to programming workloads.' },
  { id: 'laptop-air-15', name: 'Air 15 Productivity Laptop', price: '699.00', currency: 'USD', reason: 'Lower-cost option with a balance of portability and everyday performance.' },
  { id: 'laptop-studio-16', name: 'Studio 16 Performance Laptop', price: '899.00', currency: 'USD', reason: 'Higher-end option within a $900 budget.' },
  { id: 'phone-pro', name: 'Pro Smartphone 256GB', price: '799.00', currency: 'USD', reason: 'Premium smartphone option.' },
  { id: 'phone-air', name: 'Air Smartphone 128GB', price: '499.00', currency: 'USD', reason: 'Lower-cost smartphone option.' },
  { id: 'audio-wireless', name: 'Wireless ANC Headphones', price: '249.00', currency: 'USD', reason: 'Wireless audio with active noise cancellation.' },
  { id: 'audio-compact', name: 'Compact Wireless Earbuds', price: '129.00', currency: 'USD', reason: 'Compact wireless audio at a lower price.' },
  { id: 'monitor-27', name: '27-inch Developer Monitor', price: '329.00', currency: 'USD', reason: 'Large display suited to development and productivity.' }
];

export function discoverProducts(intent: PurchaseIntent): ProductOption[] {
  const budget = intent.maxPrice ? Number(intent.maxPrice) : Number.POSITIVE_INFINITY;
  const category = intent.category.toLowerCase();

  const matches = CATALOG.filter((product) => {
    if (product.currency !== intent.currency) return false;
    if (Number(product.price) > budget) return false;
    return categoryMatches(category, product);
  });

  return rankProducts(matches, intent).slice(0, 3);
}

function categoryMatches(category: string, product: ProductOption): boolean {
  if (category.includes('computer')) return product.id.startsWith('laptop');
  if (category.includes('phone')) return product.id.startsWith('phone');
  if (category.includes('audio')) return product.id.startsWith('audio');
  if (category.includes('monitor')) return product.id.startsWith('monitor');
  return product.name.toLowerCase().includes(category) || category === 'general';
}

function rankProducts(products: ProductOption[], intent: PurchaseIntent): ProductOption[] {
  const requirements = intent.requirements.map((item) => item.toLowerCase());
  return [...products].sort((a, b) => {
    const score = (product: ProductOption) =>
      requirements.reduce(
        (total, requirement) => total + (product.reason.toLowerCase().includes(requirement) || product.name.toLowerCase().includes(requirement) ? 2 : 0),
        0
      );
    const scoreDifference = score(b) - score(a);
    return scoreDifference !== 0 ? scoreDifference : Number(a.price) - Number(b.price);
  });
}
