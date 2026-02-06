import { Injectable, inject, NgZone } from "@angular/core";
import {
  AdMob,
  RewardAdOptions,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import type { PluginListenerHandle } from "@capacitor/core";
import { ConsentService } from "./consent.service";
import { ADS_KIT_CONFIG, type AdsUnits, type RewardedAdResult } from "./types";
import { isNative, isAndroid, getPlatform } from "./adapters/platform";

@Injectable({ providedIn: "root" })
export class AdsService {
  private initialized = false;
  private readonly config = inject(ADS_KIT_CONFIG);
  private readonly consent = inject(ConsentService);
  private readonly zone = inject(NgZone);

  // Listeners to clean up
  private listeners: PluginListenerHandle[] = [];

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

    await AdMob.initialize();
    this.initialized = true;
  }

  async showRewarded(): Promise<RewardedAdResult> {
    await this.init();
    if (!this.initialized) {
      return { rewardEarned: false, adClosed: false, failed: true };
    }

    await this.consent.ready.catch(() => undefined);
    if (!this.canShowAds()) {
      return { rewardEarned: false, adClosed: false, failed: true };
    }

    const opts: RewardAdOptions = {
      adId: this.units.rewarded,
      isTesting: this.isTesting,
    };

    // Reset flags for this new ad attempt
    let rewardEarned = false;
    let adClosed = false;
    let resolved = false;

    return new Promise<RewardedAdResult>((resolve) => {
      const cleanup = () => {
        // Remove all listeners
        this.listeners.forEach((l) => l.remove());
        this.listeners = [];
      };

      const tryResolve = () => {
        if (resolved) return;

        // Only resolve when BOTH events have occurred
        if (rewardEarned && adClosed) {
          resolved = true;
          cleanup();
          this.zone.run(() => {
            resolve({ rewardEarned: true, adClosed: true, failed: false });
          });
        }
      };

      // Listen for Rewarded event
      AdMob.addListener(RewardAdPluginEvents.Rewarded, (_reward) => {
        rewardEarned = true;
        tryResolve();
      }).then((handle) => this.listeners.push(handle));

      // Listen for Dismissed event (ad closed)
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        adClosed = true;

        // If ad closed without reward, resolve immediately with failure
        if (!rewardEarned) {
          if (!resolved) {
            resolved = true;
            cleanup();
            this.zone.run(() => {
              resolve({ rewardEarned: false, adClosed: true, failed: false });
            });
          }
        } else {
          // Otherwise, try to resolve (will succeed if reward already earned)
          tryResolve();
        }
      }).then((handle) => this.listeners.push(handle));

      // Listen for FailedToLoad
      AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
        if (this.config.debug) {
          console.warn("[Ads] Failed to load rewarded ad", error);
        }
        if (!resolved) {
          resolved = true;
          cleanup();
          this.zone.run(() => {
            resolve({ rewardEarned: false, adClosed: false, failed: true });
          });
        }
      }).then((handle) => this.listeners.push(handle));

      // Listen for FailedToShow
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
        if (this.config.debug) {
          console.warn("[Ads] Failed to show rewarded ad", error);
        }
        if (!resolved) {
          resolved = true;
          cleanup();
          this.zone.run(() => {
            resolve({ rewardEarned: false, adClosed: false, failed: true });
          });
        }
      }).then((handle) => this.listeners.push(handle));

      // Now prepare and show the ad
      (async () => {
        try {
          await AdMob.prepareRewardVideoAd(opts);
          await AdMob.showRewardVideoAd();
        } catch (e) {
          console.warn("[Ads] rewarded failed", e);
          if (!resolved) {
            resolved = true;
            cleanup();
            this.zone.run(() => {
              resolve({ rewardEarned: false, adClosed: false, failed: true });
            });
          }
        }
      })();
    });
  }
}
