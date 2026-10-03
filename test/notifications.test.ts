import { describe, expect, it } from 'vitest';
import { addNotification, listNotifications } from '../server/notifications';

describe('purchase notifications', () => {
  it('records and lists purchase notifications', async () => {
    await addNotification({
      type: 'approval_required',
      purchaseId: 'purchase-1',
      message: 'Approval is required.',
    });
    expect((await listNotifications())[0]?.purchaseId).toBe('purchase-1');
  });
});
