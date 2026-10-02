export type PurchaseNotification = {
  type: 'approval_required' | 'checkout_ready';
  purchaseId: string;
  message: string;
  createdAt: string;
};

const notifications: PurchaseNotification[] = [];

export function addNotification(notification: Omit<PurchaseNotification, 'createdAt'>): PurchaseNotification {
  const item = { ...notification, createdAt: new Date().toISOString() };
  notifications.unshift(item);
  return item;
}

export function listNotifications(): PurchaseNotification[] {
  return [...notifications];
}
