import { Injectable, inject } from '@angular/core';
import { AdMob } from '@capacitor-community/admob';
import { ADS_KIT_CONFIG } from './types';
import { toDebugString } from './adapters/debug';
import { isNative, isNativeDebugBuild } from './adapters/platform';
import type { ConsentResult } from './types';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private canRequestAds = false;
  private privacyOptionsRequired = false;
  private umpReady = false;
  private readonly config = inject(ADS_KIT_CONFIG);

  private readyResolve!: () => void;
  readonly ready = new Promise<void>(
    (resolve) => (this.readyResolve = resolve)
  );

  private get debugEnabled(): boolean {
    return !!this.config.debug || (isNative() && isNativeDebugBuild());
  }

  get state(): ConsentResult {
    return {
      canRequestAds: this.canRequestAds,
      privacyOptionsRequired: this.privacyOptionsRequired,
      umpReady: this.umpReady,
    };
  }

  /**
   * Call once on app launch (or before initializing ads).
   */
  async gatherConsent(): Promise<ConsentResult> {
    try {
      const info = await AdMob.requestConsentInfo({});

      this.umpReady = true;
      this.canRequestAds = !!info.canRequestAds;
      this.privacyOptionsRequired =
        info.privacyOptionsRequirementStatus === 'REQUIRED';

      if (this.debugEnabled) {
        console.info(
          `[Consent] requestConsentInfo ${toDebugString(info)}`
        );
      }

      if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
        const after = await AdMob.showConsentForm();
        this.canRequestAds = !!after.canRequestAds;
        this.privacyOptionsRequired =
          after.privacyOptionsRequirementStatus === 'REQUIRED';

        if (this.debugEnabled) {
          console.info(`[Consent] showConsentForm ${toDebugString(after)}`);
        }
      }

      return this.state;
    } catch (e) {
      console.error('[Consent] gatherConsent failed', e);

      // Mark UMP as "done" (attempted), but ads are not allowed
      this.umpReady = true;
      this.canRequestAds = false;
      this.privacyOptionsRequired = false;

      return this.state;
    } finally {
      // Always unblock waiters
      this.readyResolve?.();
    }
  }

  async showPrivacyOptionsIfAvailable(): Promise<boolean> {
    try {
      if (!this.umpReady) return false;
      await AdMob.showPrivacyOptionsForm();
      return true;
    } catch (e) {
      console.error('[Consent] showPrivacyOptionsForm failed', e);
      return false;
    }
  }
}
