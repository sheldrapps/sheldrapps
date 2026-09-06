import { Injectable, inject } from '@angular/core';
import { AdsService } from './ads.service';
import { BillingService } from './billing.service';
import type { RewardedAdResult } from './types';

export type ExportAccessResult = {
  granted: boolean;
  source: 'premium' | 'rewarded' | 'fallback' | 'denied' | 'busy';
  adResult?: RewardedAdResult;
};

export type ExportAccessHandlers = {
  onAdFailure: (result: RewardedAdResult) => Promise<boolean> | boolean;
  onActiveFallbackTrial?: () => Promise<boolean> | boolean;
};

@Injectable()
export class ExportAccessService {
  private readonly ads = inject(AdsService);
  private readonly billing = inject(BillingService);
  private authorizationPromise: Promise<ExportAccessResult> | null = null;

  async authorize(handlers: ExportAccessHandlers): Promise<ExportAccessResult> {
    if (this.authorizationPromise) {
      return {
        granted: false,
        source: 'busy',
      };
    }

    this.authorizationPromise = this.authorizeOnce(handlers).finally(() => {
      this.authorizationPromise = null;
    });

    return this.authorizationPromise;
  }

  private async authorizeOnce(
    handlers: ExportAccessHandlers,
  ): Promise<ExportAccessResult> {
    const entitlement = await this.billing.ensureAdsEntitlement().catch(() => 'unavailable' as const);
    if (entitlement === 'pro') {
      return { granted: true, source: 'premium' };
    }

    if (handlers.onActiveFallbackTrial) {
      const accepted = await handlers.onActiveFallbackTrial();
      if (accepted) {
        return { granted: true, source: 'fallback' };
      }
    }

    if (entitlement !== 'free') {
      const fallback = this.failedEntitlementResult();
      const accepted = await handlers.onAdFailure(fallback);
      return {
        granted: accepted,
        source: accepted ? 'fallback' : 'denied',
        adResult: fallback,
      };
    }

    const adResult = await this.ads.showRewarded();
    if (adResult.rewardEarned && adResult.adClosed && !adResult.failed) {
      return { granted: true, source: 'rewarded', adResult };
    }

    if (adResult.failed) {
      const accepted = await handlers.onAdFailure(adResult);
      return {
        granted: accepted,
        source: accepted ? 'fallback' : 'denied',
        adResult,
      };
    }

    return { granted: false, source: 'denied', adResult };
  }

  private failedEntitlementResult(): RewardedAdResult {
    return {
      rewardEarned: false,
      adClosed: false,
      failed: true,
      failureReason: 'unknown',
      failureConfidence: 'low',
      skippedReason: 'entitlement-unavailable',
    };
  }
}
