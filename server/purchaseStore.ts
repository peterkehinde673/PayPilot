export type PurchaseRecord = {
  id: string;
  productId: string;
  productName: string;
  amount: string;
  currency: string;
  status: 'approval_required' | 'checkout_created' | 'captured';
  createdAt: string;
  paypalOrderId?: string;
};

const purchases = new Map<string, PurchaseRecord>();

export function createPurchase(record: Omit<PurchaseRecord, 'createdAt'>): PurchaseRecord {
  const purchase = { ...record, createdAt: new Date().toISOString() };
  purchases.set(purchase.id, purchase);
  return purchase;
}

export function updatePurchase(id: string, patch: Partial<PurchaseRecord>): PurchaseRecord | null {
  const current = purchases.get(id);
  if (!current) return null;
  const updated = { ...current, ...patch };
  purchases.set(id, updated);
  return updated;
}

export function findPurchase(id: string): PurchaseRecord | null {
  return purchases.get(id) ?? null;
}

export function findPurchaseByPayPalOrderId(paypalOrderId: string): PurchaseRecord | null {
  return [...purchases.values()].find((purchase) => purchase.paypalOrderId === paypalOrderId) ?? null;
}

export function listPurchases(): PurchaseRecord[] {
  return [...purchases.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
