import type { ProductOption, PurchaseIntent } from './ai.js';

export type ProductAssessment = ProductOption & {
  score: number;
  tradeoff: string;
};

export type Comparison = {
  recommendedId: string | null;
  assessments: ProductAssessment[];
  summary: string;
};

export function compareProducts(intent: PurchaseIntent, products: ProductOption[]): Comparison {
  const budget = intent.maxPrice ? Number(intent.maxPrice) : Number.POSITIVE_INFINITY;
  const requirements = intent.requirements.map((item) => item.toLowerCase());

  const assessments = products.map((product) => {
    const price = Number(product.price);
    const budgetScore = Number.isFinite(budget) ? Math.max(0, 100 - (price / budget) * 30) : 70;
    const requirementScore = requirements.length
      ? requirements.reduce((total, requirement) =>
          total + (product.name.toLowerCase().includes(requirement) || product.reason.toLowerCase().includes(requirement) ? 20 : 0), 0)
      : 20;
    const score = Math.round(Math.min(100, budgetScore + requirementScore));
    const tradeoff = price <= budget * 0.8 ? 'Leaves meaningful budget headroom.' : 'Uses more of the available budget.';
    return { ...product, score, tradeoff };
  }).sort((a, b) => b.score - a.score || Number(a.price) - Number(b.price));

  const recommended = assessments[0];
  return {
    recommendedId: recommended?.id ?? null,
    assessments,
    summary: recommended
      ? `Based on the stated requirements and budget, ${recommended.name} scores highest in the current catalog. This is a comparison result, not a live-market claim.`
      : 'No catalog option currently satisfies the interpreted request.'
  };
}
