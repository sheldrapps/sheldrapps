import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { getPlatform } from './adapters/platform';

export type ProPurchaseAnalyticsContext = {
  app?: string;
  productId?: string;
  entryPoint?: string;
  priceAvailable?: boolean;
};

type ProPurchaseFailureStage =
  | 'prepare'
  | 'purchase'
  | 'confirmation'
  | 'restore';

@Injectable({ providedIn: 'root' })
export class ProPurchaseAnalyticsService {
  trackScreenView(context: ProPurchaseAnalyticsContext): void {
    this.log('pro_screen_view', context);
  }

  trackScreenClosed(
    context: ProPurchaseAnalyticsContext & {
      reason: 'dismissed' | 'purchased' | 'restored';
    },
  ): void {
    this.log('pro_screen_closed', context);
  }

  trackPurchaseStarted(context: ProPurchaseAnalyticsContext): void {
    this.log('pro_purchase_started', context);
  }

  trackPurchaseSuccess(
    context: ProPurchaseAnalyticsContext & { source: 'new_purchase' | 'restored' },
  ): void {
    this.log('pro_purchase_success', context);
  }

  trackPurchaseCancelled(context: ProPurchaseAnalyticsContext): void {
    this.log('pro_purchase_cancelled', context);
  }

  trackPurchaseAlreadyOwned(context: ProPurchaseAnalyticsContext): void {
    this.log('pro_purchase_already_owned', context);
  }

  trackPurchaseFailed(
    context: ProPurchaseAnalyticsContext & {
      stage: ProPurchaseFailureStage;
      reason: string;
    },
  ): void {
    this.log('pro_purchase_failed', context);
  }

  private log(
    name: string,
    context: object,
  ): void {
    if (!Capacitor.isPluginAvailable('FirebaseAnalytics')) {
      return;
    }

    const params: Record<string, string | number> = {
      platform: getPlatform(),
    };
    for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number') {
        params[key] = value;
      } else if (typeof value === 'boolean') {
        params[key] = value ? 1 : 0;
      }
    }

    void FirebaseAnalytics.logEvent({ name, params }).catch((error) => {
      console.warn('[Billing] analytics event failed', {
        name,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
