import { Injectable, inject } from '@angular/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { BehaviorSubject } from 'rxjs';
import { toDebugString } from './adapters/debug';
import { isAndroid, isNative, isNativeDebugBuild } from './adapters/platform';
import { ADS_KIT_CONFIG } from './types';

type BillingSettings = Record<string, unknown> & {
  adsRemoved?: boolean;
};

type BillingRuntimeState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'error'
  | 'unavailable';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private initPromise: Promise<void> | null = null;
  private hydrateCachedStatePromise: Promise<void> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();
  private refreshRetryHandle: ReturnType<typeof setTimeout> | null = null;
  private hasHydratedCachedState = false;
  private isReady = false;
  private state: BillingRuntimeState = 'idle';
  private billingAvailable = false;
  private hasRemoveAdsEntitlement = false;
  private removeAdsPriceFormatted: string | null = null;
  private readonly config = inject(ADS_KIT_CONFIG);
  private readonly settings = inject(SettingsStore<BillingSettings>);
  readonly adsRemoved$ = new BehaviorSubject<boolean>(false);
  readonly removeAdsPrice$ = new BehaviorSubject<string | null>(null);

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

  async hydrateCachedState(): Promise<void> {
    if (this.hasHydratedCachedState) {
      return;
    }

    if (this.hydrateCachedStatePromise) {
      return this.hydrateCachedStatePromise;
    }

    this.hydrateCachedStatePromise = this.readCachedEntitlement()
      .then((cachedEntitlement) => {
        this.setEntitlement(cachedEntitlement);
        this.hasHydratedCachedState = true;
      })
      .catch((error) => {
        this.logDebug('load cached entitlement failed', error);
      })
      .finally(() => {
        this.hydrateCachedStatePromise = null;
      });

    return this.hydrateCachedStatePromise;
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
    await this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return;
      }

      await this.performEntitlementRefresh();
    });
  }

  async purchaseRemoveAds(): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return false;
      }

      try {
        const transaction = await NativePurchases.purchaseProduct({
          productIdentifier: this.removeAdsProductId!,
          productType: PURCHASE_TYPE.INAPP,
        });

        if (!this.isPurchasedTransaction(transaction)) {
          return false;
        }

        this.setEntitlement(true);
        await this.persistCachedEntitlement(true);
        await this.performEntitlementRefresh();
        return this.hasRemoveAdsEntitlement;
      } catch (error) {
        if (this.isPurchaseCancelled(error)) {
          this.logDebug('purchase cancelled', error);
          return false;
        }

        if (this.isPurchaseAlreadyOwned(error)) {
          this.logDebug('purchase already owned, running restore flow', error);
          return this.restoreAndRefreshEntitlement();
        }

        this.logDebug('purchase failed', error);
        throw error;
      }
    });
  }

  async restorePurchases(): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return this.hasRemoveAdsEntitlement;
      }

      return this.restoreAndRefreshEntitlement();
    });
  }

  async loadProductsSafe(): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureReady();
      if (!this.canRunBillingOperations()) {
        return;
      }

      await this.performProductDetailsRefresh();
    });
  }

  async restorePurchasesSafe(): Promise<void> {
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

  getRemoveAdsPriceFormatted(): string | null {
    return this.removeAdsPriceFormatted;
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

  isBillingAvailable(): boolean {
    return this.billingAvailable && this.isReady;
  }

  private async doInitialize(): Promise<void> {
    await this.hydrateCachedState();
    const cachedEntitlement = this.hasRemoveAdsEntitlement;

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
    const productId = this.removeAdsProductId;
    if (!productId || !this.canRunBillingOperations()) {
      return this.hasRemoveAdsEntitlement;
    }

    try {
      const purchasedProductIds = await this.getPurchasedProductIds();
      const hasPurchase = purchasedProductIds.includes(productId);

      if (hasPurchase !== this.hasRemoveAdsEntitlement) {
        this.setEntitlement(hasPurchase);
        await this.persistCachedEntitlement(hasPurchase);
      }

      await this.performProductDetailsRefresh();
      this.clearRefreshRetry();
      return this.hasRemoveAdsEntitlement;
    } catch (error) {
      this.logDebug('refresh entitlement failed', error);
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
      const restored = await this.performEntitlementRefresh();
      if (restored) {
        return true;
      }

      if (attempt < maxAttempts) {
        await this.wait(waitMsBetweenAttempts);
      }
    }

    return this.hasRemoveAdsEntitlement;
  }

  private async getPurchasedProductIds(): Promise<string[]> {
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
    });

    return purchases
      .filter((purchase) => this.isCompletedTransaction(purchase))
      .map((purchase) =>
        this.pickString(
          this.asRecord(purchase)?.['productIdentifier'],
          this.asRecord(purchase)?.['productId'],
        ),
      )
      .filter((productId): productId is string => !!productId);
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
      this.clearRefreshRetry();
    } catch (error) {
      // Keep billing as available; product lookup can fail transiently/offline.
      this.logDebug('getProduct failed', error);
      this.scheduleRefreshRetry();
    }
  }

  private async readCachedEntitlement(): Promise<boolean> {
    try {
      const settings = await this.settings.load();
      return settings.adsRemoved === true;
    } catch (error) {
      this.logDebug('load persisted state failed', error);
      return false;
    }
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
    this.hasRemoveAdsEntitlement = value;
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

    this.refreshRetryHandle = setTimeout(() => {
      this.refreshRetryHandle = null;
      void this.refreshEntitlement();
    }, 5000);
  }

  private clearRefreshRetry(): void {
    if (!this.refreshRetryHandle || typeof globalThis.clearTimeout !== 'function') {
      return;
    }

    clearTimeout(this.refreshRetryHandle);
    this.refreshRetryHandle = null;
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

  private get removeAdsProductId(): string | undefined {
    const raw = this.config.billing?.removeAdsProductId;
    if (typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private isPurchasedTransaction(transaction: unknown): boolean {
    const tx = this.asRecord(transaction);
    if (!tx) {
      return false;
    }

    const productIdentifier = this.pickString(
      tx['productIdentifier'],
      tx['productId'],
    );
    if (productIdentifier && productIdentifier !== this.removeAdsProductId) {
      return false;
    }

    return this.isCompletedTransaction(transaction);
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
