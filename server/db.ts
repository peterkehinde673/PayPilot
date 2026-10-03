import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDatabasePool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
  }
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabasePool();
  if (!db) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      currency CHAR(3) NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      paypal_order_id TEXT UNIQUE
    );

    CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases (created_at DESC);
    CREATE INDEX IF NOT EXISTS purchases_paypal_order_id_idx ON purchases (paypal_order_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      purchase_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);
  `);
}
