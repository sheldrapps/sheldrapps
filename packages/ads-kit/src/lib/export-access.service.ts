import { Injectable, inject } from '@angular/core';
import { AdsService } from './ads.service';
import { BillingService } from './billing.service';
import { reportAdsFailure } from './ad-telemetry';
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
      const accepted = await this.handleAdFailure(handlers, fallback);
      return {
        granted: accepted,
        source: accepted ? 'fallback' : 'denied',
        adResult: fallback,
      };
    }

    let adResult: RewardedAdResult;
    try {
      adResult = await this.ads.showRewarded();
    } catch (error) {
      reportAdsFailure({
        stage: 'rewarded_authorize',
        errorCode: 'ADS_REWARDED_FLOW_FAILED',
        reason: 'show_rejected',
      });
      throw error;
    }
    if (adResult.rewardEarned && adResult.adClosed && !adResult.failed) {
      return { granted: true, source: 'rewarded', adResult };
    }

    if (adResult.rewardEarned) {
      reportAdsFailure({
        stage: 'rewarded_delivery',
        errorCode: 'ADS_REWARDED_DELIVERY_FAILED',
        reason: 'incomplete_reward_state',
      });
    }

    if (adResult.failed) {
      const accepted = await this.handleAdFailure(handlers, adResult);
      return {
        granted: accepted,
        source: accepted ? 'fallback' : 'denied',
        adResult,
      };
    }

    return { granted: false, source: 'denied', adResult };
  }

  private async handleAdFailure(
    handlers: ExportAccessHandlers,
    result: RewardedAdResult,
  ): Promise<boolean> {
    try {
      return await handlers.onAdFailure(result);
    } catch (error) {
      reportAdsFailure({
        stage: 'rewarded_delivery',
        errorCode: 'ADS_REWARDED_FALLBACK_FAILED',
        reason: 'fallback_handler_rejected',
      });
      throw error;
    }
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
