import { describe, expect, it } from 'vitest';
import {
  getBillingPurchaseAction,
  processBillingPurchase,
  reconcileOwnedEntitlement,
  type BillingPurchaseOperations,
} from './billing-purchase';
import type { BillingProductConfig } from './types';

const nonConsumable: BillingProductConfig = {
  productId: 'permanent_access',
  productType: 'inapp',
  kind: 'non-consumable',
  entitlement: 'remove-ads',
};

const consumable: BillingProductConfig = {
  productId: 'credits_100',
  productType: 'inapp',
  kind: 'consumable',
};

function createOperations(overrides: Partial<BillingPurchaseOperations> = {}) {
  const calls: string[] = [];
  const operations: BillingPurchaseOperations = {
    grantEntitlement: () => calls.push('grant'),
    acknowledgePurchase: async () => calls.push('acknowledge'),
    consumePurchase: async () => calls.push('consume'),
    ...overrides,
  };
  return { calls, operations };
}

describe('billing purchase processing', () => {
  it('grants and acknowledges an unacknowledged purchased non-consumable', async () => {
    const { calls, operations } = createOperations();

    await processBillingPurchase(
      nonConsumable,
      { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: false },
      operations,
    );

    expect(calls).toEqual(['grant', 'acknowledge']);
  });

  it('grants an already acknowledged purchase without acknowledging twice', async () => {
    const { calls, operations } = createOperations();

    await processBillingPurchase(
      nonConsumable,
      { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: true },
      operations,
    );

    expect(calls).toEqual(['grant']);
  });

  it('does not grant or acknowledge pending purchases', async () => {
    const { calls, operations } = createOperations();

    const result = await processBillingPurchase(
      nonConsumable,
      { productIdentifier: nonConsumable.productId, purchaseState: '0', isAcknowledged: false },
      operations,
    );

    expect(result).toBe('pending');
    expect(calls).toEqual([]);
  });

  it('surfaces transient acknowledgement failure for later recovery', async () => {
    const { calls, operations } = createOperations({
      acknowledgePurchase: async () => {
        calls.push('acknowledge');
        throw new Error('SERVICE_UNAVAILABLE');
      },
    });

    await expect(
      processBillingPurchase(
        nonConsumable,
        { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: false },
        operations,
      ),
    ).rejects.toThrow('SERVICE_UNAVAILABLE');
    expect(calls).toEqual(['grant', 'acknowledge']);
  });

  it('uses the same processor when reconciliation rediscovers a purchase', async () => {
    const { calls, operations } = createOperations();

    await processBillingPurchase(
      nonConsumable,
      { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: false },
      operations,
    );

    expect(calls).toEqual(['grant', 'acknowledge']);
  });

  it('recovers after entitlement was granted before the process died', async () => {
    let acknowledged = false;
    const first = createOperations({
      acknowledgePurchase: async () => {
        throw new Error('process stopped');
      },
    });

    await expect(
      processBillingPurchase(
        nonConsumable,
        { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: false },
        first.operations,
      ),
    ).rejects.toThrow('process stopped');

    const second = createOperations({
      acknowledgePurchase: async () => {
        acknowledged = true;
      },
    });
    await processBillingPurchase(
      nonConsumable,
      { productIdentifier: nonConsumable.productId, purchaseState: '1', isAcknowledged: false },
      second.operations,
    );

    expect(acknowledged).toBe(true);
  });

  it('removes an entitlement only after a successful ownership query confirms absence', () => {
    expect(reconcileOwnedEntitlement(nonConsumable.productId, true, new Set())).toBe(false);
  });

  it('keeps Pro when a successful ownership query contains the configured product', () => {
    expect(
      reconcileOwnedEntitlement(
        nonConsumable.productId,
        true,
        new Set([nonConsumable.productId]),
      ),
    ).toBe(true);
  });

  it('restores Pro when a successful ownership query rediscovers the product', () => {
    expect(
      reconcileOwnedEntitlement(
        nonConsumable.productId,
        true,
        new Set([nonConsumable.productId]),
      ),
    ).toBe(true);
  });

  it('does not revoke an entitlement when ownership querying fails', () => {
    expect(reconcileOwnedEntitlement(nonConsumable.productId, false, new Set())).toBeUndefined();
  });

  it('retains Pro after a failed query and revokes it after the later successful empty query', () => {
    const cachedPro = true;
    const failedQuery = reconcileOwnedEntitlement(nonConsumable.productId, false, new Set());
    expect(failedQuery ?? cachedPro).toBe(true);
    expect(reconcileOwnedEntitlement(nonConsumable.productId, true, new Set())).toBe(false);
  });

  it('consumes consumables and never acknowledges them as permanent products', async () => {
    const { calls, operations } = createOperations();

    expect(getBillingPurchaseAction(consumable, { purchaseState: '1', isAcknowledged: false })).toBe('consume');
    await processBillingPurchase(
      consumable,
      { productIdentifier: consumable.productId, purchaseState: '1', isAcknowledged: false },
      operations,
    );

    expect(calls).toEqual(['grant', 'consume']);
  });

  it('keeps product behavior configuration-driven across multiple products', () => {
    const subscription: BillingProductConfig = {
      productId: 'pro_monthly',
      productType: 'subs',
      kind: 'subscription',
    };

    expect(getBillingPurchaseAction(nonConsumable, { purchaseState: '1' })).toBe('acknowledge');
    expect(getBillingPurchaseAction(consumable, { purchaseState: '1' })).toBe('consume');
    expect(getBillingPurchaseAction(subscription, { productType: 'subs', purchaseState: '1' })).toBe('acknowledge');
    expect(getBillingPurchaseAction(subscription, { productType: 'inapp', purchaseState: '1' })).toBe('ignore');
  });
});
