import { getDatabasePool } from './db.js';

export type PurchaseNotification = {
  type: 'approval_required' | 'checkout_ready' | 'payment_captured';
  purchaseId: string;
  message: string;
  createdAt: string;
};

const notifications: PurchaseNotification[] = [];

export async function addNotification(notification: Omit<PurchaseNotification, 'createdAt'>): Promise<PurchaseNotification> {
  const item = { ...notification, createdAt: new Date().toISOString() };
  const db = getDatabasePool();
  if (db) {
    await db.query(
      `INSERT INTO notifications (type, purchase_id, message, created_at)
       VALUES ($1, $2, $3, $4)`,
      [item.type, item.purchaseId, item.message, item.createdAt]
    );
  } else {
    notifications.unshift(item);
  }
  return item;
}

export async function listNotifications(): Promise<PurchaseNotification[]> {
  const db = getDatabasePool();
  if (db) {
    const result = await db.query(
      `SELECT type, purchase_id, message, created_at
       FROM notifications ORDER BY created_at DESC LIMIT 100`
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      type: row.type as PurchaseNotification['type'],
      purchaseId: String(row.purchase_id),
      message: String(row.message),
      createdAt: new Date(String(row.created_at)).toISOString()
    }));
  }
  return [...notifications];
}
