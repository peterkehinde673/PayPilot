import { getDatabasePool } from './db.js';

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

export async function createPurchase(record: Omit<PurchaseRecord, 'createdAt'>): Promise<PurchaseRecord> {
  const purchase = { ...record, createdAt: new Date().toISOString() };
  const db = getDatabasePool();
  if (db) {
    await db.query(
      `INSERT INTO purchases (id, product_id, product_name, amount, currency, status, created_at, paypal_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [purchase.id, purchase.productId, purchase.productName, purchase.amount, purchase.currency, purchase.status, purchase.createdAt, purchase.paypalOrderId ?? null]
    );
  } else {
    purchases.set(purchase.id, purchase);
  }
  return purchase;
}

export async function removePurchase(id: string): Promise<boolean> {
  const db = getDatabasePool();
  if (db) {
    const result = await db.query('DELETE FROM purchases WHERE id = $1', [id]);
    return result.rowCount === 1;
  }
  return purchases.delete(id);
}

export async function updatePurchase(id: string, patch: Partial<PurchaseRecord>): Promise<PurchaseRecord | null> {
  const current = await findPurchase(id);
  if (!current) return null;
  const updated = { ...current, ...patch };
  const db = getDatabasePool();
  if (db) {
    const result = await db.query(
      `UPDATE purchases
       SET product_id = $2, product_name = $3, amount = $4, currency = $5, status = $6, created_at = $7, paypal_order_id = $8
       WHERE id = $1`,
      [updated.id, updated.productId, updated.productName, updated.amount, updated.currency, updated.status, updated.createdAt, updated.paypalOrderId ?? null]
    );
    return result.rowCount === 1 ? updated : null;
  }
  purchases.set(id, updated);
  return updated;
}

export async function findPurchase(id: string): Promise<PurchaseRecord | null> {
  const db = getDatabasePool();
  if (db) {
    const result = await db.query(
      `SELECT id, product_id, product_name, amount::text, currency, status, created_at, paypal_order_id
       FROM purchases WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapPurchase(result.rows[0]) : null;
  }
  return purchases.get(id) ?? null;
}

export async function findPurchaseByPayPalOrderId(paypalOrderId: string): Promise<PurchaseRecord | null> {
  const db = getDatabasePool();
  if (db) {
    const result = await db.query(
      `SELECT id, product_id, product_name, amount::text, currency, status, created_at, paypal_order_id
       FROM purchases WHERE paypal_order_id = $1`,
      [paypalOrderId]
    );
    return result.rows[0] ? mapPurchase(result.rows[0]) : null;
  }
  return [...purchases.values()].find((purchase) => purchase.paypalOrderId === paypalOrderId) ?? null;
}

export async function listPurchases(): Promise<PurchaseRecord[]> {
  const db = getDatabasePool();
  if (db) {
    const result = await db.query(
      `SELECT id, product_id, product_name, amount::text, currency, status, created_at, paypal_order_id
       FROM purchases ORDER BY created_at DESC`
    );
    return result.rows.map(mapPurchase);
  }
  return [...purchases.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mapPurchase(row: Record<string, unknown>): PurchaseRecord {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    amount: String(row.amount),
    currency: String(row.currency),
    status: row.status as PurchaseRecord['status'],
    createdAt: new Date(String(row.created_at)).toISOString(),
    ...(row.paypal_order_id ? { paypalOrderId: String(row.paypal_order_id) } : {})
  };
}
