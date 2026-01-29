import { Injectable } from '@angular/core';
import { AdMob } from '@capacitor-community/admob';
import type { ConsentResult } from './types';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private canRequestAds = false;
  private privacyOptionsRequired = false;
  private umpReady = false;

  private readyResolve!: () => void;
  readonly ready = new Promise<void>(
    (resolve) => (this.readyResolve = resolve)
  );

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
      this.canRequestAds = info.status !== 'REQUIRED';
      this.privacyOptionsRequired =
        info.privacyOptionsRequirementStatus === 'REQUIRED';

      if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
        const after = await AdMob.showConsentForm();
        this.canRequestAds = after.status !== 'REQUIRED';
        this.privacyOptionsRequired =
          after.privacyOptionsRequirementStatus === 'REQUIRED';
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
