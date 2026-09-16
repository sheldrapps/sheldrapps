import type {
  BillingProductConfig,
  BillingProductKind,
  BillingPurchaseRecord,
} from './types';

export type BillingPurchaseState = 'purchased' | 'pending' | 'other';

export type BillingPurchaseAction =
  | 'acknowledge'
  | 'consume'
  | 'pending'
  | 'ignore';

export type BillingPurchaseProcessingResult =
  | 'processed'
  | 'pending'
  | 'ignored';

export type BillingPurchaseOperations = {
  grantEntitlement: () => Promise<void> | void;
  acknowledgePurchase: () => Promise<void>;
  consumePurchase: () => Promise<void>;
};

export function getBillingPurchaseState(
  purchaseState: unknown,
): BillingPurchaseState {
  if (purchaseState === 1 || purchaseState === '1') {
    return 'purchased';
  }

  if (
    purchaseState === 0 ||
    purchaseState === '0' ||
    purchaseState === 2 ||
    purchaseState === '2' ||
    purchaseState === 'pending'
  ) {
    return 'pending';
  }

  if (typeof purchaseState === 'string' && purchaseState.toLowerCase() === 'purchased') {
    return 'purchased';
  }

  return 'other';
}

export function getBillingPurchaseAction(
  product: BillingProductConfig,
  purchase: BillingPurchaseRecord,
): BillingPurchaseAction {
  const state = getBillingPurchaseState(purchase.purchaseState);
  if (state === 'pending') {
    return 'pending';
  }

  if (state !== 'purchased') {
    return 'ignore';
  }

  if (purchase.productType && purchase.productType !== product.productType) {
    return 'ignore';
  }

  return isConsumable(product.kind) ? 'consume' : 'acknowledge';
}

export async function processBillingPurchase(
  product: BillingProductConfig,
  purchase: BillingPurchaseRecord,
  operations: BillingPurchaseOperations,
): Promise<BillingPurchaseProcessingResult> {
  const action = getBillingPurchaseAction(product, purchase);
  if (action === 'pending') {
    return 'pending';
  }

  if (action === 'ignore') {
    return 'ignored';
  }

  await operations.grantEntitlement();

  if (action === 'consume') {
    await operations.consumePurchase();
    return 'processed';
  }

  if (!purchase.isAcknowledged) {
    await operations.acknowledgePurchase();
  }

  return 'processed';
}

export function reconcileOwnedEntitlement(
  productId: string,
  querySucceeded: boolean,
  purchasedProductIds: ReadonlySet<string>,
): boolean | undefined {
  if (!querySucceeded) {
    return undefined;
  }

  return purchasedProductIds.has(productId);
}

function isConsumable(kind: BillingProductKind): boolean {
  return kind === 'consumable';
}
