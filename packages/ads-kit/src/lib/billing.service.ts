import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { BehaviorSubject } from 'rxjs';
import { toDebugString } from './adapters/debug';
import {
  getPlatform,
  isAndroid,
  isNative,
  isNativeDebugBuild,
} from './adapters/platform';
import {
  getBillingPurchaseState,
  reconcileOwnedEntitlement,
  processBillingPurchase,
} from './billing-purchase';
import {
  ADS_KIT_CONFIG,
  type AdsEntitlementStatus,
  type BillingProductConfig,
  type BillingProductType,
  type BillingPurchaseRecord,
} from './types';
import { ProPurchaseAnalyticsService } from './pro-purchase-analytics.service';

type BillingSettings = Record<string, unknown> & {
  adsRemoved?: boolean;
};

type BillingRuntimeState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'error'
  | 'unavailable';

export const PURCHASE_INTENT_QUERY_PARAM = 'purchase';
export const REMOVE_ADS_PURCHASE_INTENT = 'remove-ads';

export type BillingPurchaseDiagnostics = {
  state: BillingRuntimeState;
  isReady: boolean;
  billingAvailable: boolean;
  canRunBillingOperations: boolean;
  hasRemoveAdsEntitlement: boolean;
  priceFormatted: string | null;
  productId?: string;
  platform: string;
  native: boolean;
  android: boolean;
};

@Injectable()
export class BillingService {
  private readonly developmentRemoveAdsPriceFormatted = '$1.00';
  private initPromise: Promise<void> | null = null;
  private hydrateCachedStatePromise: Promise<boolean> | null = null;
  private ensureAdsEntitlementPromise: Promise<AdsEntitlementStatus> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();
  private refreshRetryHandle: ReturnType<typeof setTimeout> | null = null;
  private reconciliationRetryAttempt = 0;
  private lastSuccessfulReconciliationAt = 0;
  private hasPendingPurchaseWork = false;
  private hasProductDetailsRefreshFailed = false;
  private hasHydratedCachedState = false;
  private isReady = false;
  private state: BillingRuntimeState = 'idle';
  private billingAvailable = false;
  private hasRemoveAdsEntitlement = false;
  private entitlementStatus: AdsEntitlementStatus = 'unknown';
  private entitlementRefreshSucceeded = false;
  private removeAdsPriceFormatted: string | null = null;
  private readonly config = inject(ADS_KIT_CONFIG);
  private readonly settings = inject(SettingsStore<BillingSettings>);
  private readonly purchaseAnalytics = inject(ProPurchaseAnalyticsService);
  readonly adsRemoved$ = new BehaviorSubject<boolean>(false);
  readonly removeAdsPrice$ = new BehaviorSubject<string | null>(null);

  constructor() {
    if (!this.isBillingSupportedByPlatform()) {
      return;
    }

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.reconcileOwnedPurchases('resume');
      }
    });
    void this.reconcileOwnedPurchases('startup');
  }

  async initializeSafe(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      this.state = 'unavailable';
      this.isReady = false;
      this.billingAvailable = false;
      this.setRemoveAdsPrice(null);
      this.logWarn('Billing unavailable, continuing app', error);
    }
  }

  async refreshEntitlement(): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return this.hasRemoveAdsEntitlement;
      }

      return this.performEntitlementRefresh();
    });
  }

  async hydrateCachedState(): Promise<boolean> {
    if (this.hasHydratedCachedState) {
      return true;
    }

    if (this.hydrateCachedStatePromise) {
      return this.hydrateCachedStatePromise;
    }

    this.hydrateCachedStatePromise = this.readCachedEntitlement()
      .then((cachedEntitlement) => {
        const effectiveEntitlement = this.isDevelopmentPremiumMode()
          ? true
          : cachedEntitlement;
        this.setEntitlement(effectiveEntitlement);
        if (this.isDevelopmentPremiumMode()) {
          this.setEntitlement(true);
          this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
        }
        this.hasHydratedCachedState = true;
        return true;
      })
      .catch((error) => {
        this.logDebug('load cached entitlement failed', error);
        return false;
      })
      .finally(() => {
        this.hydrateCachedStatePromise = null;
      });

    return this.hydrateCachedStatePromise;
  }

  async ensureAdsEntitlement(): Promise<AdsEntitlementStatus> {
    if (this.ensureAdsEntitlementPromise) {
      return this.ensureAdsEntitlementPromise;
    }

    this.ensureAdsEntitlementPromise = (async () => {
      const hydrated = await this.hydrateCachedState().catch(() => false);
      if (!hydrated) {
        this.entitlementStatus = 'unavailable';
        return this.entitlementStatus;
      }

      if (this.isDevelopmentPremiumMode()) {
        this.entitlementStatus = 'pro';
        return this.entitlementStatus;
      }

      if (!this.removeAdsProductId) {
        this.entitlementStatus = 'free';
        return this.entitlementStatus;
      }

      if (
        this.entitlementRefreshSucceeded &&
        Date.now() - this.lastSuccessfulReconciliationAt < 30_000
      ) {
        return this.entitlementStatus;
      }

      await this.initializeSafe();
      if (!this.canRunBillingOperations()) {
        this.entitlementStatus = 'unavailable';
        return this.entitlementStatus;
      }

      this.entitlementRefreshSucceeded = false;
      await this.refreshEntitlement().catch(() => undefined);
      this.entitlementStatus = this.entitlementRefreshSucceeded
        ? this.hasRemoveAdsEntitlement
          ? 'pro'
          : 'free'
        : 'unavailable';
      return this.entitlementStatus;
    })().finally(() => {
      this.ensureAdsEntitlementPromise = null;
    });

    return this.ensureAdsEntitlementPromise;
  }

  async initialize(): Promise<void> {
    if (this.isReady && this.state === 'ready') return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize()
      .then(() => {
        if (this.state !== 'unavailable') {
          this.state = 'ready';
          this.isReady = true;
        }
      })
      .catch((error) => {
        this.state = 'error';
        this.isReady = false;
        this.billingAvailable = false;
        this.setRemoveAdsPrice(null);
        throw error;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
  }

  async preparePurchaseUi(): Promise<void> {
    if (this.isDevelopmentPremiumMode()) {
      return;
    }

    await this.enqueue(async () => {
      try {
        await this.ensureReady();
        if (!this.canRunBillingOperations()) {
          this.trackPurchaseFailure('prepare', 'billing_unavailable');
          return;
        }

        await this.performEntitlementRefresh();
      } catch (error) {
        this.trackPurchaseFailure('prepare', this.classifyBillingError(error));
        throw error;
      }
    });
  }

  async purchaseRemoveAds(): Promise<boolean> {
    this.purchaseAnalytics.trackPurchaseStarted(this.purchaseAnalyticsContext());

    if (this.isDevelopmentPremiumMode()) {
      this.setEntitlement(true);
      this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
      this.purchaseAnalytics.trackPurchaseSuccess({
        ...this.purchaseAnalyticsContext(),
        source: 'new_purchase',
      });
      return true;
    }

    return this.enqueue(async () => {
      try {
        await this.ensureReady();
        if (!this.canRunBillingOperations()) {
          this.trackPurchaseFailure('prepare', 'billing_unavailable');
          return false;
        }
      } catch (error) {
        this.trackPurchaseFailure('prepare', this.classifyBillingError(error));
        throw error;
      }

      return this.purchaseConfiguredProduct(this.removeAdsProduct!);
    });
  }

  private async purchaseConfiguredProduct(
    product: BillingProductConfig,
  ): Promise<boolean> {
    if (!this.canRunBillingOperations()) {
      return false;
    }

    if (!this.removeAdsPriceFormatted) {
      await this.performProductDetailsRefresh();
    }

    if (!this.removeAdsPriceFormatted) {
      this.logDebug('purchase blocked because product offer is unavailable', {
        productId: product.productId,
      });
      this.trackPurchaseFailure('purchase', 'offer_unavailable');
      return false;
    }

    try {
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: product.productId,
        productType: this.toNativeProductType(product.productType),
        isConsumable: product.kind === 'consumable',
        autoAcknowledgePurchases: false,
      });

      await this.processPurchase(transaction, 'new-purchase');
      await this.performEntitlementRefresh();
      if (!this.hasRemoveAdsEntitlement) {
        this.trackPurchaseFailure('confirmation', 'entitlement_not_confirmed');
        return false;
      }

      this.purchaseAnalytics.trackPurchaseSuccess({
        ...this.purchaseAnalyticsContext(),
        source: 'new_purchase',
      });
      return true;
    } catch (error) {
      if (this.isPurchaseCancelled(error)) {
        this.logDebug('purchase cancelled', error);
        this.purchaseAnalytics.trackPurchaseCancelled(this.purchaseAnalyticsContext());
        return false;
      }

      if (this.isPurchaseAlreadyOwned(error)) {
        this.logDebug('purchase already owned, running restore flow', error);
        this.purchaseAnalytics.trackPurchaseAlreadyOwned(this.purchaseAnalyticsContext());
        const restored = await this.restoreAndRefreshEntitlement();
        if (restored) {
          this.purchaseAnalytics.trackPurchaseSuccess({
            ...this.purchaseAnalyticsContext(),
            source: 'restored',
          });
        } else {
          this.trackPurchaseFailure('restore', 'entitlement_not_restored');
        }
        return restored;
      }

      this.logDebug('purchase failed', this.describeBillingError(error));
      this.trackPurchaseFailure('purchase', this.classifyBillingError(error));
      throw error;
    }
  }

  async restorePurchases(): Promise<boolean> {
    if (this.isDevelopmentPremiumMode()) {
      this.setEntitlement(true);
      this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
      this.purchaseAnalytics.trackPurchaseSuccess({
        ...this.purchaseAnalyticsContext(),
        source: 'restored',
      });
      return this.hasRemoveAdsEntitlement;
    }

    return this.enqueue(async () => {
      try {
        await this.ensureReady();
        if (!this.canRunBillingOperations()) {
          this.trackPurchaseFailure('restore', 'billing_unavailable');
          return this.hasRemoveAdsEntitlement;
        }

        const restored = await this.restoreAndRefreshEntitlement();
        if (restored) {
          this.purchaseAnalytics.trackPurchaseSuccess({
            ...this.purchaseAnalyticsContext(),
            source: 'restored',
          });
        } else {
          this.trackPurchaseFailure('restore', 'entitlement_not_restored');
        }
        return restored;
      } catch (error) {
        this.trackPurchaseFailure('restore', this.classifyBillingError(error));
        throw error;
      }
    });
  }

  async loadProductsSafe(): Promise<void> {
    if (this.isDevelopmentPremiumMode()) {
      this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
      return;
    }

    await this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return;
      }

      await this.performProductDetailsRefresh();
    });
  }

  async restorePurchasesSafe(): Promise<void> {
    if (this.isDevelopmentPremiumMode()) {
      this.setEntitlement(true);
      this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
      return;
    }

    await this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return;
      }

      await this.restoreAndRefreshEntitlement();
    });
  }

  isAdsRemoved(): boolean {
    return this.hasRemoveAdsEntitlement;
  }

  getAdsEntitlementStatus(): AdsEntitlementStatus {
    return this.entitlementStatus;
  }

  getRemoveAdsPriceFormatted(): string | null {
    return this.removeAdsPriceFormatted;
  }

  getRemoveAdsProductId(): string | undefined {
    return this.removeAdsProductId;
  }

  getPurchaseDiagnostics(): BillingPurchaseDiagnostics {
    return {
      state: this.state,
      isReady: this.isReady,
      billingAvailable: this.billingAvailable,
      canRunBillingOperations: this.canRunBillingOperations(),
      hasRemoveAdsEntitlement: this.hasRemoveAdsEntitlement,
      priceFormatted: this.removeAdsPriceFormatted,
      ...(this.removeAdsProductId
        ? { productId: this.removeAdsProductId }
        : {}),
      platform: getPlatform(),
      native: isNative(),
      android: isAndroid(),
    };
  }

  logPurchaseUiState(
    source: string,
    context: Record<string, unknown> = {},
  ): void {
    console.info(
      `[Billing] purchase-ui ${toDebugString({
        source,
        ...context,
        ...this.getPurchaseDiagnostics(),
      })}`,
    );
  }

  isDevelopmentMode(): boolean {
    return this.isDevelopmentPremiumMode();
  }

  canShowRemoveAdsEntryPoint(): boolean {
    if (!this.removeAdsProductId) {
      return false;
    }

    if (this.isBillingSupportedByPlatform()) {
      return true;
    }

    // Keep the entry point visible on web during dev/test so it can be reviewed in ionic serve.
    return !isNative() && this.config.isTesting === true;
  }

  private purchaseAnalyticsContext(): {
    productId?: string;
    priceAvailable: boolean;
  } {
    return {
      ...(this.removeAdsProductId ? { productId: this.removeAdsProductId } : {}),
      priceAvailable: !!this.removeAdsPriceFormatted,
    };
  }

  private trackPurchaseFailure(
    stage: 'prepare' | 'purchase' | 'confirmation' | 'restore',
    reason: string,
  ): void {
    this.purchaseAnalytics.trackPurchaseFailed({
      ...this.purchaseAnalyticsContext(),
      stage,
      reason: reason.toLowerCase(),
    });
  }

  isBillingAvailable(): boolean {
    return this.isDevelopmentPremiumMode() || (this.billingAvailable && this.isReady);
  }

  private async doInitialize(): Promise<void> {
    await this.hydrateCachedState();
    const cachedEntitlement = this.hasRemoveAdsEntitlement;

    if (this.isDevelopmentPremiumMode()) {
      this.state = 'ready';
      this.isReady = true;
      this.billingAvailable = true;
      this.setEntitlement(true);
      this.setRemoveAdsPrice(this.developmentRemoveAdsPriceFormatted);
      this.logDebug('initialized in development mode', {
        billingAvailable: this.billingAvailable,
        productId: this.removeAdsProductId,
        cachedEntitlement,
      });
      return;
    }

    if (!this.isBillingSupportedByPlatform() || !this.removeAdsProductId) {
      this.state = 'unavailable';
      this.isReady = false;
      this.billingAvailable = false;
      this.setRemoveAdsPrice(null);
      return;
    }

    this.state = 'initializing';

    const support = await NativePurchases.isBillingSupported();
    this.billingAvailable = support.isBillingSupported === true;
    if (!this.billingAvailable) {
      this.state = 'unavailable';
      this.isReady = false;
      this.setRemoveAdsPrice(null);
      return;
    }

    this.state = 'ready';
    this.isReady = true;

    this.logDebug('initialized', {
      billingAvailable: this.billingAvailable,
      productId: this.removeAdsProductId,
      cachedEntitlement,
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(fn, fn);
    this.operationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async ensureReady(): Promise<void> {
    await this.hydrateCachedState();
    if (this.isReady) {
      return;
    }

    await this.initializeSafe();
  }

  private async performEntitlementRefresh(): Promise<boolean> {
    const product = this.removeAdsProduct;
    if (!product || !this.canRunBillingOperations()) {
      return this.hasRemoveAdsEntitlement;
    }

    this.hasPendingPurchaseWork = false;
    this.logBillingEvent('BILLING_RECONCILIATION_STARTED', {
      source: 'ownership-query',
    });

    try {
      const query = await this.queryAndProcessPurchases();
      const querySucceeded = query.successfulProductTypes.has(product.productType);

      if (!querySucceeded) {
        this.entitlementRefreshSucceeded = false;
        this.logBillingEvent('ENTITLEMENT_CACHE_RETAINED_ON_FAILURE', {
          productId: product.productId,
        });
        this.logBillingEvent('BILLING_RECONCILIATION_COMPLETE', {
          status: 'unavailable',
        });
        this.scheduleRefreshRetry();
        return this.hasRemoveAdsEntitlement;
      }

      const hasPurchase = reconcileOwnedEntitlement(
        product.productId,
        querySucceeded,
        query.purchasedProductIds,
      );

      if (hasPurchase === undefined) {
        return this.hasRemoveAdsEntitlement;
      }

      await this.persistCachedEntitlement(hasPurchase);
      if (hasPurchase !== this.hasRemoveAdsEntitlement) {
        this.setEntitlement(hasPurchase);
        if (!hasPurchase) {
          this.logBillingEvent('BILLING_ENTITLEMENT_REVOKED', {
            productId: product.productId,
          });
        }
      }

      await this.performProductDetailsRefresh();
      if (this.hasPendingPurchaseWork || this.hasProductDetailsRefreshFailed) {
        this.scheduleRefreshRetry();
      } else {
        this.clearRefreshRetry();
      }
      this.entitlementRefreshSucceeded = true;
      this.lastSuccessfulReconciliationAt = Date.now();
      this.reconciliationRetryAttempt = 0;
      this.entitlementStatus = hasPurchase ? 'pro' : 'free';
      this.logBillingEvent(
        hasPurchase ? 'ENTITLEMENT_CONFIRMED_PRO' : 'ENTITLEMENT_CONFIRMED_FREE',
        { productId: product.productId },
      );
      this.logBillingEvent('BILLING_RECONCILIATION_COMPLETE', {
        status: hasPurchase ? 'owned' : 'not-owned',
      });
      return this.hasRemoveAdsEntitlement;
    } catch (error) {
      this.entitlementRefreshSucceeded = false;
      this.logBillingEvent('ENTITLEMENT_CACHE_RETAINED_ON_FAILURE', {
        productId: product.productId,
      });
      this.logDebug('refresh entitlement failed', this.describeBillingError(error));
      this.scheduleRefreshRetry();
      return this.hasRemoveAdsEntitlement;
    }
  }

  private async restoreAndRefreshEntitlement(): Promise<boolean> {
    try {
      await NativePurchases.restorePurchases();
    } catch (error) {
      this.logDebug('restorePurchases failed before query', error);
    }

    return this.performEntitlementRefreshWithRetry();
  }

  private async performEntitlementRefreshWithRetry(
    maxAttempts = 3,
    waitMsBetweenAttempts = 900,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.performEntitlementRefresh();
      if (this.entitlementRefreshSucceeded) {
        return true;
      }

      if (attempt < maxAttempts) {
        await this.wait(waitMsBetweenAttempts);
      }
    }

    return this.hasRemoveAdsEntitlement;
  }

  private async queryAndProcessPurchases(): Promise<{
    purchasedProductIds: Set<string>;
    successfulProductTypes: Set<BillingProductType>;
  }> {
    const purchasedProductIds = new Set<string>();
    const successfulProductTypes = new Set<BillingProductType>();

    for (const productType of this.configuredProductTypes) {
      try {
        const { purchases } = await NativePurchases.getPurchases({
          productType: this.toNativeProductType(productType),
        });
        if (!Array.isArray(purchases)) {
          throw new Error('Billing purchases query returned an invalid response');
        }
        successfulProductTypes.add(productType);
        this.logBillingEvent(
          purchases.length > 0 ? 'GET_PURCHASES_SUCCESS' : 'GET_PURCHASES_EMPTY',
          { productType, purchaseCount: purchases.length },
        );

        for (const purchase of purchases) {
          const productId = this.getPurchaseProductId(purchase);
          if (productId && this.isCompletedTransaction(purchase)) {
            purchasedProductIds.add(productId);
          }
          await this.processPurchase(purchase, 'reconciliation');
        }
      } catch (error) {
        this.logBillingEvent('GET_PURCHASES_FAILURE', {
          productType,
          error: this.describeBillingError(error),
        });
        this.logDebug('purchase ownership query failed', {
          productType,
          error: this.describeBillingError(error),
        });
      }
    }

    return { purchasedProductIds, successfulProductTypes };
  }

  private async reconcileOwnedPurchases(source: 'startup' | 'resume'): Promise<void> {
    await this.enqueue(async () => {
      this.logBillingEvent('BILLING_RECONCILIATION_STARTED', { source });
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return;
      }

      await this.performEntitlementRefresh();
    });
  }

  private async processPurchase(
    transaction: unknown,
    source: 'new-purchase' | 'reconciliation',
  ): Promise<void> {
    const purchase = this.toBillingPurchaseRecord(transaction);
    const product = this.findProduct(purchase.productIdentifier);
    if (!product) {
      return;
    }

    this.logBillingEvent('BILLING_PURCHASE_DETECTED', {
      productId: product.productId,
      source,
    });

    const state = getBillingPurchaseState(purchase.purchaseState);
    if (state === 'pending') {
      this.logBillingEvent('BILLING_PURCHASE_PENDING', {
        productId: product.productId,
        source,
      });
      return;
    }

    if (state !== 'purchased') {
      return;
    }

    this.logBillingEvent('BILLING_PURCHASE_PROCESSING', {
      productId: product.productId,
      source,
    });

    try {
      const result = await processBillingPurchase(product, purchase, {
        grantEntitlement: () => this.grantEntitlementForProduct(product, purchase),
        acknowledgePurchase: async () => {
          this.logBillingEvent('BILLING_ACK_REQUIRED', {
            productId: product.productId,
            source,
          });
          await this.acknowledgePurchaseWithRetry(product, purchase);
        },
        consumePurchase: async () => {
          await this.consumePurchaseWithRetry(product, purchase);
        },
      });
      if (source === 'reconciliation' && result === 'processed') {
        this.logBillingEvent('BILLING_PURCHASE_RESTORED', {
          productId: product.productId,
        });
      }
    } catch (error) {
      this.hasPendingPurchaseWork = this.isRetryableBillingError(error);
      this.logBillingEvent('BILLING_ACK_FAILURE', {
        productId: product.productId,
        source,
        category: this.classifyBillingError(error),
      });
    }
  }

  private async grantEntitlementForProduct(
    product: BillingProductConfig,
    purchase: BillingPurchaseRecord,
  ): Promise<void> {
    await product.onPurchased?.(purchase);

    if (product.entitlement !== 'remove-ads' || product.kind === 'consumable') {
      return;
    }

    if (this.hasRemoveAdsEntitlement) {
      return;
    }

    this.setEntitlement(true);
    await this.persistCachedEntitlement(true);
    this.logBillingEvent('BILLING_ENTITLEMENT_GRANTED', {
      productId: product.productId,
    });
  }

  private async acknowledgePurchaseWithRetry(
    product: BillingProductConfig,
    purchase: BillingPurchaseRecord,
  ): Promise<void> {
    if (!purchase.purchaseToken) {
      throw new Error('Missing purchase token');
    }

    const delays = [0, 500, 1500];
    let lastError: unknown;
    for (const delay of delays) {
      await this.wait(delay);
      try {
        await NativePurchases.acknowledgePurchase({
          purchaseToken: purchase.purchaseToken,
        });
        this.logBillingEvent('BILLING_ACK_SUCCESS', {
          productId: product.productId,
        });
        return;
      } catch (error) {
        lastError = error;
        if (!this.isRetryableBillingError(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error('Purchase acknowledgement failed');
  }

  private async consumePurchaseWithRetry(
    product: BillingProductConfig,
    purchase: BillingPurchaseRecord,
  ): Promise<void> {
    if (!purchase.purchaseToken) {
      throw new Error('Missing purchase token');
    }

    try {
      await NativePurchases.consumePurchase({
        purchaseToken: purchase.purchaseToken,
      });
    } catch (error) {
      if (this.isRetryableBillingError(error)) {
        this.hasPendingPurchaseWork = true;
      }
      this.logBillingEvent('BILLING_ACK_FAILURE', {
        productId: product.productId,
        category: this.classifyBillingError(error),
        operation: 'consume',
      });
      throw error;
    }
  }

  private async performProductDetailsRefresh(): Promise<void> {
    if (!this.canRunBillingOperations()) {
      this.setRemoveAdsPrice(null);
      return;
    }

    try {
      const result = await NativePurchases.getProduct({
        productIdentifier: this.removeAdsProductId!,
        productType: PURCHASE_TYPE.INAPP,
      });

      const product = this.asRecord(this.asRecord(result)?.['product']);
      const price = this.pickString(
        product?.['priceString'],
        product?.['formattedPrice'],
        product?.['localizedPriceString'],
      );
      this.setRemoveAdsPrice(price ?? null);
      this.hasProductDetailsRefreshFailed = false;
      if (!this.hasPendingPurchaseWork) {
        this.clearRefreshRetry();
      }
    } catch (error) {
      this.hasProductDetailsRefreshFailed = true;
      this.setRemoveAdsPrice(null);
      this.logDebug('getProduct failed', error);
      this.scheduleRefreshRetry();
    }
  }

  private async readCachedEntitlement(): Promise<boolean> {
    const settings = await this.settings.load();
    return settings.adsRemoved === true;
  }

  private async persistCachedEntitlement(value: boolean): Promise<void> {
    try {
      await this.settings.set((prev) => ({
        ...prev,
        adsRemoved: value,
      }));
    } catch (error) {
      this.logDebug('persist adsRemoved failed', error);
    }
  }

  private setEntitlement(value: boolean): void {
    if (this.hasRemoveAdsEntitlement === value) {
      return;
    }

    this.hasRemoveAdsEntitlement = value;
    this.entitlementStatus = value
      ? 'pro'
      : this.isDevelopmentPremiumMode()
        ? 'pro'
        : 'unknown';
    this.adsRemoved$.next(value);
  }

  private setRemoveAdsPrice(value: string | null): void {
    const normalized = typeof value === 'string' ? value.trim() : '';
    const nextValue = normalized.length > 0 ? normalized : null;
    if (this.removeAdsPriceFormatted === nextValue) {
      return;
    }

    this.removeAdsPriceFormatted = nextValue;
    this.removeAdsPrice$.next(nextValue);
  }

  private scheduleRefreshRetry(): void {
    if (!this.isBillingSupportedByPlatform() || !this.removeAdsProductId) {
      return;
    }

    if (this.refreshRetryHandle || typeof globalThis.setTimeout !== 'function') {
      return;
    }

    const delays = [5_000, 30_000, 120_000, 600_000, 1_800_000, 7_200_000];
    const delay = delays[Math.min(this.reconciliationRetryAttempt, delays.length - 1)];
    this.reconciliationRetryAttempt += 1;
    this.refreshRetryHandle = setTimeout(() => {
      this.refreshRetryHandle = null;
      void this.refreshEntitlement();
    }, delay);
  }

  private clearRefreshRetry(): void {
    if (!this.refreshRetryHandle || typeof globalThis.clearTimeout !== 'function') {
      return;
    }

    clearTimeout(this.refreshRetryHandle);
    this.refreshRetryHandle = null;
    this.reconciliationRetryAttempt = 0;
  }

  private isBillingSupportedByPlatform(): boolean {
    return isNative() && isAndroid();
  }

  private canRunBillingOperations(): boolean {
    return (
      this.isBillingSupportedByPlatform() &&
      !!this.removeAdsProductId &&
      this.billingAvailable &&
      this.isReady
    );
  }

  private isDevelopmentPremiumMode(): boolean {
    return (
      this.config.billing?.developmentPremiumMode !== false &&
      !isNative() &&
      this.config.isTesting === true
    );
  }

  private get removeAdsProductId(): string | undefined {
    const raw = this.config.billing?.removeAdsProductId;
    if (typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private get removeAdsProduct(): BillingProductConfig | undefined {
    const productId = this.removeAdsProductId;
    if (!productId) {
      return undefined;
    }

    return (
      this.configuredProducts.find((product) => product.productId === productId) ?? {
        productId,
        productType: 'inapp',
        kind: 'non-consumable',
        entitlement: 'remove-ads',
      }
    );
  }

  private get configuredProducts(): BillingProductConfig[] {
    const configured = (this.config.billing?.products ?? [])
      .map((product) => ({
        ...product,
        productId: product.productId.trim(),
      }))
      .filter((product) => product.productId.length > 0);
    const removeAdsProduct = this.removeAdsProductId;

    if (
      removeAdsProduct &&
      !configured.some((product) => product.productId === removeAdsProduct)
    ) {
      configured.push({
        productId: removeAdsProduct,
        productType: 'inapp',
        kind: 'non-consumable',
        entitlement: 'remove-ads',
      });
    }

    return configured;
  }

  private get configuredProductTypes(): BillingProductType[] {
    return [...new Set(this.configuredProducts.map((product) => product.productType))];
  }

  private findProduct(productId: string | undefined): BillingProductConfig | undefined {
    if (!productId) {
      return undefined;
    }

    return this.configuredProducts.find((product) => product.productId === productId);
  }

  private toNativeProductType(productType: BillingProductType): PURCHASE_TYPE {
    return productType === 'subs' ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP;
  }

  private getPurchaseProductId(transaction: unknown): string | undefined {
    const record = this.asRecord(transaction);
    return this.pickString(record?.['productIdentifier'], record?.['productId']);
  }

  private toBillingPurchaseRecord(transaction: unknown): BillingPurchaseRecord {
    const record = this.asRecord(transaction);
    return {
      productIdentifier: this.getPurchaseProductId(transaction),
      productType: this.pickString(record?.['productType']),
      purchaseState: record?.['purchaseState'],
      isAcknowledged:
        typeof record?.['isAcknowledged'] === 'boolean'
          ? record['isAcknowledged']
          : undefined,
      purchaseToken: this.pickString(
        record?.['purchaseToken'],
        record?.['transactionId'],
      ),
    };
  }

  private isCompletedTransaction(transaction: unknown): boolean {
    const tx = this.asRecord(transaction);
    if (!tx) {
      return false;
    }

    const purchaseState = tx['purchaseState'];
    if (typeof purchaseState === 'number') {
      return purchaseState === 1;
    }

    if (typeof purchaseState === 'string') {
      return purchaseState === '1' || purchaseState.toLowerCase() === 'purchased';
    }

    // iOS or plugin paths may omit purchaseState for completed transactions.
    return true;
  }

  private isPurchaseCancelled(error: unknown): boolean {
    const raw =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? `${error.name} ${error.message}`
          : JSON.stringify(error ?? '');
    const normalized = raw.toLowerCase();

    return (
      normalized.includes('cancel') ||
      normalized.includes('user aborted') ||
      normalized.includes('purchase canceled')
    );
  }

  private isPurchaseAlreadyOwned(error: unknown): boolean {
    const raw =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? `${error.name} ${error.message}`
          : JSON.stringify(error ?? '');
    const normalized = raw.toLowerCase();

    return (
      normalized.includes('already owned') ||
      normalized.includes('already purchased') ||
      normalized.includes('you already own') ||
      normalized.includes('item_already_owned') ||
      normalized.includes('response code: 7') ||
      normalized.includes('code:7')
    );
  }

  private async wait(ms: number): Promise<void> {
    if (ms <= 0 || typeof globalThis.setTimeout !== 'function') {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private pickString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }

      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    return undefined;
  }

  private classifyBillingError(error: unknown):
    | 'SERVICE_DISCONNECTED'
    | 'SERVICE_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | 'DEVELOPER_ERROR'
    | 'ITEM_NOT_OWNED'
    | 'OTHER' {
    const normalized = this.describeBillingError(error).toLowerCase();
    if (
      normalized.includes('service_disconnected') ||
      normalized.includes('service disconnected') ||
      this.hasBillingResponseCode(normalized, -1)
    ) {
      return 'SERVICE_DISCONNECTED';
    }
    if (
      normalized.includes('service_unavailable') ||
      normalized.includes('service unavailable') ||
      this.hasBillingResponseCode(normalized, 2)
    ) {
      return 'SERVICE_UNAVAILABLE';
    }
    if (
      normalized.includes('network_error') ||
      normalized.includes('network error') ||
      normalized.includes('timeout') ||
      this.hasBillingResponseCode(normalized, 12)
    ) {
      return 'NETWORK_ERROR';
    }
    if (
      normalized.includes('developer_error') ||
      normalized.includes('developer error') ||
      this.hasBillingResponseCode(normalized, 5)
    ) {
      return 'DEVELOPER_ERROR';
    }
    if (
      normalized.includes('item_not_owned') ||
      normalized.includes('item not owned') ||
      this.hasBillingResponseCode(normalized, 8)
    ) {
      return 'ITEM_NOT_OWNED';
    }
    return 'OTHER';
  }

  private hasBillingResponseCode(message: string, code: number): boolean {
    return new RegExp(String.raw`(?:response\s+)?code[:\s]+${code}\b`).test(message);
  }

  private isRetryableBillingError(error: unknown): boolean {
    const category = this.classifyBillingError(error);
    return (
      category === 'SERVICE_DISCONNECTED' ||
      category === 'SERVICE_UNAVAILABLE' ||
      category === 'NETWORK_ERROR'
    );
  }

  private describeBillingError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown billing error';
  }

  private logBillingEvent(
    event:
      | 'BILLING_PURCHASE_DETECTED'
      | 'BILLING_PURCHASE_PENDING'
      | 'BILLING_PURCHASE_PROCESSING'
      | 'BILLING_ENTITLEMENT_GRANTED'
      | 'BILLING_ACK_REQUIRED'
      | 'BILLING_ACK_SUCCESS'
      | 'BILLING_ACK_FAILURE'
      | 'BILLING_PURCHASE_RESTORED'
      | 'BILLING_RECONCILIATION_STARTED'
      | 'BILLING_RECONCILIATION_COMPLETE'
      | 'BILLING_ENTITLEMENT_REVOKED'
      | 'GET_PURCHASES_SUCCESS'
      | 'GET_PURCHASES_EMPTY'
      | 'GET_PURCHASES_FAILURE'
      | 'ENTITLEMENT_CONFIRMED_PRO'
      | 'ENTITLEMENT_CONFIRMED_FREE'
      | 'ENTITLEMENT_CACHE_RETAINED_ON_FAILURE',
    payload: Record<string, unknown> = {},
  ): void {
    if (!this.debugEnabled) {
      return;
    }

    console.info(`[Billing] ${event} ${toDebugString(payload)}`);
  }

  private logDebug(message: string, payload: unknown): void {
    if (!this.debugEnabled) {
      return;
    }

    console.info(
      `[Billing] ${message} ${toDebugString({
        payload,
      })}`,
    );
  }

  private logWarn(message: string, payload: unknown): void {
    console.warn(
      `[Billing] ${message} ${toDebugString({
        payload,
      })}`,
    );
  }

  private get debugEnabled(): boolean {
    return !!this.config.billing?.debug || (isNative() && isNativeDebugBuild());
  }
}
