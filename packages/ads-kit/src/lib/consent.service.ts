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
      this.canRequestAds = this.resolveCanRequestAds(info);
      this.privacyOptionsRequired =
        info.privacyOptionsRequirementStatus === 'REQUIRED';

      if (this.debugEnabled) {
        console.info(
          `[Consent] requestConsentInfo ${toDebugString(info)}`
        );
      }

      if (info.isConsentFormAvailable && this.isConsentRequired(info)) {
        const after = await AdMob.showConsentForm();
        this.canRequestAds = this.resolveCanRequestAds(after);
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

  private resolveCanRequestAds(source: unknown): boolean {
    const record = this.asRecord(source);
    const explicitValue = record?.['canRequestAds'];
    if (typeof explicitValue === 'boolean') {
      return explicitValue;
    }

    return !this.isConsentRequired(source);
  }

  private isConsentRequired(source: unknown): boolean {
    const status = this.pickString(this.asRecord(source)?.['status']);
    return status?.toUpperCase() === 'REQUIRED';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private pickString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
