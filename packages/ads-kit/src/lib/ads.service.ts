import { Injectable, inject } from '@angular/core';
import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { ConsentService } from './consent.service';
import { ADS_KIT_CONFIG, type AdsUnits } from './types';
import { isNative, isAndroid, getPlatform } from './adapters/platform';

@Injectable({ providedIn: 'root' })
export class AdsService {
  private initialized = false;
  private readonly config = inject(ADS_KIT_CONFIG);
  private readonly consent = inject(ConsentService);

  private get platform() {
    return getPlatform();
  }

  private get isNative(): boolean {
    return isNative();
  }

  private get isAndroid(): boolean {
    return isAndroid();
  }

  private get isTesting(): boolean {
    return this.config.isTesting;
  }

  private get units(): AdsUnits {
    if (this.isAndroid) {
      const androidUnits = this.config.units.android;
      return this.isTesting ? androidUnits.test : androidUnits.prod;
    }
    // Fallback to iOS or Android if iOS not configured
    const iosUnits = this.config.units.ios || this.config.units.android;
    return this.isTesting ? iosUnits.test : iosUnits.prod;
  }

  private canShowAds(): boolean {
    const c = this.consent.state;
    return c.umpReady && c.canRequestAds;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.isNative) return;

    if (this.config.debug) {
      console.log('[Ads] Initializing AdMob', {
        platform: this.platform,
        isTesting: this.isTesting,
      });
    }

    await AdMob.initialize();
    this.initialized = true;
  }

  async showRewarded(): Promise<boolean> {
    await this.init();
    if (!this.initialized) return false;

    await this.consent.ready.catch(() => undefined);
    if (!this.canShowAds()) return false;

    const opts: RewardAdOptions = {
      adId: this.units.rewarded,
      isTesting: this.isTesting,
    };

    try {
      if (this.config.debug) {
        console.log('[Ads] Preparing rewarded ad', opts);
      }
      await AdMob.prepareRewardVideoAd(opts);
      await AdMob.showRewardVideoAd();
      return true;
    } catch (e) {
      console.warn('[Ads] rewarded failed', e);
      return false;
    }
  }
}
