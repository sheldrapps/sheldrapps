import { Injectable, inject, NgZone } from "@angular/core";
import {
  AdMob,
  RewardAdOptions,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import type { PluginListenerHandle } from "@capacitor/core";
import { ConsentService } from "./consent.service";
import { BillingService } from "./billing.service";
import {
  ADS_KIT_CONFIG,
  type AdFailureConfidence,
  type AdFailureReason,
  type AdsUnits,
  type RewardedAdResult,
  type RewardedAdStatus,
  type RewardedAdWarmResult,
} from "./types";
import {
  isNative,
  isAndroid,
  getPlatform,
  isNativeDebugBuild,
} from "./adapters/platform";
import { toDebugString } from "./adapters/debug";

type RewardedEventListener = (
  eventName: RewardAdPluginEvents,
  listener: (payload?: unknown) => void,
) => Promise<PluginListenerHandle>;

@Injectable()
export class AdsService {
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;
  private warmPromise: Promise<RewardedAdWarmResult> | null = null;
  private rewardedReady = false;
  private rewardedPreparedAt = 0;
  private rewardedRequestId: string | null = null;
  private rewardedAttemptSequence = 0;
  private rewardShowing = false;
  private rewardedStatus: RewardedAdStatus = 'idle';
  private rewardedFailureRetryAt = 0;
  private readonly rewardedCacheTtlMs = 50 * 60 * 1000;
  private readonly rewardedFailureCooldownMs = 10 * 1000;
  private readonly rewardedShowTimeoutMs = 15 * 1000;
  private readonly config = inject(ADS_KIT_CONFIG);
  private readonly consent = inject(ConsentService);
  private readonly billing = inject(BillingService);
  private readonly zone = inject(NgZone);
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
    return !this.isNative && this.config.isTesting;
  }

  private get debugEnabled(): boolean {
    return !!this.config.debug || (this.isNative && isNativeDebugBuild());
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

  get rewardedAdStatus(): RewardedAdStatus {
    return this.rewardedStatus;
  }

  async init(): Promise<void> {
    const eligibility = await this.checkAdEligibility();
    if (eligibility !== 'eligible' || !this.isNative) {
      return;
    }

    await this.ensureInitialized();
    await this.consent.gatherConsent().catch(() => undefined);
    if (!this.canShowAds()) {
      return;
    }
  }

  async warmRewarded(): Promise<RewardedAdWarmResult> {
    if (!this.isNative) {
      return { status: 'unavailable' };
    }
    if (this.rewardShowing) {
      return { status: 'showing' };
    }
    const eligibility = await this.checkAdEligibility();
    if (eligibility === 'premium') {
      return { status: 'premium' };
    }
    if (eligibility !== 'eligible') {
      return { status: 'unavailable' };
    }

    if (
      this.rewardedReady &&
      Date.now() - this.rewardedPreparedAt < this.rewardedCacheTtlMs
    ) {
      this.setRewardedStatus('ready');
      return { status: 'ready' };
    }

    if (this.rewardedFailureRetryAt > Date.now()) {
      this.setRewardedStatus('unavailable');
      return {
        status: 'unavailable',
        failureReason: 'network',
        failureConfidence: 'low',
      };
    }

    if (this.warmPromise) {
      return this.warmPromise;
    }

    this.warmPromise = this.doWarmRewarded().finally(() => {
      this.warmPromise = null;
    });

    return this.warmPromise;
  }

  async showRewarded(): Promise<RewardedAdResult> {
    if (!this.isNative && this.isTesting) {
      return {
        rewardEarned: true,
        adClosed: true,
        failed: false,
      };
    }

    if (!this.isNative) {
      return this.failedResult('unknown', 'low');
    }

    if (this.rewardShowing) {
      return {
        rewardEarned: false,
        adClosed: false,
        failed: false,
        skippedReason: 'busy',
      };
    }

    const eligibility = await this.checkAdEligibility();
    if (eligibility === 'premium') {
      return {
        rewardEarned: true,
        adClosed: true,
        failed: false,
        skippedReason: 'premium',
      };
    }
    if (eligibility !== 'eligible') {
      return this.failedResult('unknown', 'low');
    }

    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return this.failedResult('unknown', 'low');
    }

    await this.consent.gatherConsent().catch(() => undefined);
    if (!this.canShowAds()) {
      return this.failedResult('unknown', 'low');
    }

    const warmed = await this.warmRewarded();
    if (warmed.status !== 'ready') {
      return this.failedResult(
        warmed.failureReason ?? 'unknown',
        warmed.failureConfidence ?? 'low',
      );
    }

    const finalEligibility = await this.checkAdEligibility();
    if (finalEligibility === 'premium') {
      return {
        rewardEarned: true,
        adClosed: true,
        failed: false,
        skippedReason: 'premium',
      };
    }
    if (finalEligibility !== 'eligible') {
      return this.failedResult('unknown', 'low');
    }

    if (this.rewardShowing) {
      return this.failedResult('unknown', 'low');
    }

    this.rewardShowing = true;
    this.setRewardedStatus('showing');

    const listeners: PluginListenerHandle[] = [];
    let rewardEarned = false;
    let adClosed = false;
    let adWasShown = false;
    let showRequested = false;
    let resolved = false;
    let showTimeout: ReturnType<typeof setTimeout> | null = null;

    return new Promise<RewardedAdResult>((resolve) => {
      const cleanup = () => {
        if (showTimeout) {
          clearTimeout(showTimeout);
          showTimeout = null;
        }
        listeners.splice(0).forEach((listener) => {
          void listener.remove();
        });
      };

      const finish = (
        result: RewardedAdResult,
        shouldWarmNext = false,
      ): void => {
        if (resolved) return;
        if (result.failed && rewardEarned) {
          result = { rewardEarned: true, adClosed: true, failed: false };
          shouldWarmNext = true;
        }
        resolved = true;
        this.rewardShowing = false;
        this.rewardedReady = false;
        this.rewardedPreparedAt = 0;
        this.rewardedRequestId = null;
        this.setRewardedStatus('idle');
        cleanup();
        this.zone.run(() => resolve(result));
        if (shouldWarmNext && typeof globalThis.setTimeout === 'function') {
          setTimeout(() => {
            void this.warmRewarded().catch(() => undefined);
          }, 0);
        }
      };

      const track = (
        promise: Promise<PluginListenerHandle>,
      ): Promise<void> =>
        promise
          .then((listener) => {
            if (resolved) {
              void listener.remove();
            } else {
              listeners.push(listener);
            }
          })
          .catch(() => undefined);

      showTimeout = setTimeout(() => {
        if (showRequested) {
          this.setRewardedStatus('settling');
          this.logRewardedFailure('show-watchdog', {
            timeoutMs: this.rewardedShowTimeoutMs,
          });
          return;
        }
        this.logRewardedFailure('show-timeout', {
          timeoutMs: this.rewardedShowTimeoutMs,
        });
        finish(this.failedResult('network', 'low'));
      }, this.rewardedShowTimeoutMs);

      void Promise.all([
        track(
          Promise.resolve().then(() =>
            AdMob.addListener(RewardAdPluginEvents.Loaded, (info) => {
              if (!this.isCurrentRewardedEvent(info)) return;
              this.debugLog('callback=loaded', info);
            }),
          ),
        ),
        track(
          Promise.resolve().then(() =>
            this.addRewardedListener(RewardAdPluginEvents.Showed, (info) => {
              if (!this.isCurrentRewardedEvent(info)) return;
              adWasShown = true;
              this.debugLog('callback=shown');
            }),
          ),
        ),
        track(
          Promise.resolve().then(() =>
            AdMob.addListener(RewardAdPluginEvents.Rewarded, (info) => {
              if (!this.isCurrentRewardedEvent(info)) return;
              this.debugLog('callback=rewarded');
              rewardEarned = true;
              if (adClosed) {
                finish(
                  { rewardEarned: true, adClosed: true, failed: false },
                  true,
                );
              }
            }),
          ),
        ),
        track(
          Promise.resolve().then(() =>
            this.addRewardedListener(RewardAdPluginEvents.Dismissed, (info) => {
              if (!this.isCurrentRewardedEvent(info)) return;
              this.debugLog('callback=dismissed');
              adClosed = true;
              if (!rewardEarned) {
                finish(
                  { rewardEarned: false, adClosed: true, failed: false },
                  true,
                );
              } else {
                finish(
                  { rewardEarned: true, adClosed: true, failed: false },
                  true,
                );
              }
            }),
          ),
        ),
        track(
          Promise.resolve().then(() =>
            AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
              if (!this.isCurrentRewardedEvent(error)) return;
              if (showRequested || adWasShown || rewardEarned) return;
              this.logRewardedFailure('load', error);
              const failure = this.resolveFailureMetadata(error);
              finish(this.failedResult(failure.reason, failure.confidence));
            }),
          ),
        ),
        track(
          Promise.resolve().then(() =>
            AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
              if (!this.isCurrentRewardedEvent(error)) return;
              if (rewardEarned) {
                finish({ rewardEarned: true, adClosed: true, failed: false }, true);
                return;
              }
              this.logRewardedFailure('show', error);
              const failure = this.resolveFailureMetadata(error);
              finish(this.failedResult(failure.reason, failure.confidence));
            }),
          ),
        ),
      ]).then(() => {
        if (resolved) return;

        showRequested = true;
        this.setRewardedStatus('showing');
        void AdMob.showRewardVideoAd().catch((error) => {
          if (adWasShown || rewardEarned) return;
          this.logRewardedFailure('show', error);
          const failure = this.resolveFailureMetadata(error);
          finish(this.failedResult(failure.reason, failure.confidence));
        });
      });
    });
  }

  private async doWarmRewarded(): Promise<RewardedAdWarmResult> {
    const eligibility = await this.checkAdEligibility();
    if (eligibility === 'premium') {
      return { status: 'premium' };
    }
    if (eligibility !== 'eligible') {
      return { status: 'unavailable' };
    }

    this.setRewardedStatus('initializing');
    if (!(await this.ensureInitialized())) {
      this.setRewardedStatus('unavailable');
      return {
        status: 'unavailable',
        failureReason: 'unknown',
        failureConfidence: 'low',
      };
    }

    this.setRewardedStatus('awaiting-consent');
    await this.consent.gatherConsent().catch(() => undefined);
    if (!this.canShowAds()) {
      this.setRewardedStatus('unavailable');
      return {
        status: 'unavailable',
        failureReason: 'unknown',
        failureConfidence: 'low',
      };
    }

    const finalEligibility = await this.checkAdEligibility();
    if (finalEligibility !== 'eligible') {
      this.setRewardedStatus(
        finalEligibility === 'premium' ? 'premium' : 'unavailable',
      );
      return {
        status: finalEligibility === 'premium' ? 'premium' : 'unavailable',
      };
    }

    this.setRewardedStatus('loading');
    const requestId = this.createRewardedRequestId();
    const opts = {
      adId: this.units.rewarded,
      isTesting: this.isTesting,
      requestId,
    } as RewardAdOptions & { requestId: string };
    this.rewardedRequestId = requestId;

    try {
      await this.prepareRewardedAd(opts);
      this.rewardedReady = true;
      this.rewardedPreparedAt = Date.now();
      this.rewardedFailureRetryAt = 0;
      this.setRewardedStatus('ready');
      this.debugLog('rewarded prepared', {
        adId: opts.adId,
        effectiveTesting: opts.isTesting,
      });
      return { status: 'ready' };
    } catch (error) {
      this.logRewardedFailure('load', error);
      const failure = this.resolveFailureMetadata(error);
      this.rewardedReady = false;
      this.rewardedPreparedAt = 0;
      this.rewardedRequestId = null;
      this.rewardedFailureRetryAt =
        Date.now() + this.rewardedFailureCooldownMs;
      this.setRewardedStatus('unavailable');
      return {
        status: 'unavailable',
        failureReason: failure.reason,
        failureConfidence: failure.confidence,
      };
    }
  }

  private async prepareRewardedAd(opts: RewardAdOptions): Promise<void> {
    let rejectFailure!: (error: unknown) => void;
    const failureEvent = new Promise<never>((_, reject) => {
      rejectFailure = reject;
    });

    let listener: PluginListenerHandle | null = null;
    try {
      listener = await AdMob.addListener(
        RewardAdPluginEvents.FailedToLoad,
        (error) => {
          if (this.isCurrentRewardedEvent(error)) {
            rejectFailure(error);
          }
        },
      );
    } catch {
      // The prepare call remains the source of truth if the event listener
      // cannot be registered on a plugin version/device.
    }

    try {
      await Promise.race([AdMob.prepareRewardVideoAd(opts), failureEvent]);
    } finally {
      if (listener) {
        await listener.remove().catch(() => undefined);
      }
    }
  }
  private async checkAdEligibility(): Promise<'eligible' | 'premium' | 'unavailable'> {
    this.setRewardedStatus('checking-entitlement');
    const entitlement = await this.billing.ensureAdsEntitlement().catch(() => 'unavailable' as const);
    if (entitlement === 'pro') {
      this.setRewardedStatus('premium');
      this.rewardedReady = false;
      this.rewardedPreparedAt = 0;
      this.rewardedRequestId = null;
      return 'premium';
    }

    if (entitlement !== 'free') {
      this.setRewardedStatus('unavailable');
      return 'unavailable';
    }

    return 'eligible';
  }

  private createRewardedRequestId(): string {
    this.rewardedAttemptSequence += 1;
    return `rewarded-${Date.now()}-${this.rewardedAttemptSequence}`;
  }

  private addRewardedListener(
    eventName: RewardAdPluginEvents,
    listener: (payload?: unknown) => void,
  ): Promise<PluginListenerHandle> {
    return (AdMob.addListener as unknown as RewardedEventListener)(
      eventName,
      listener,
    );
  }

  private isCurrentRewardedEvent(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return true;
    }

    const requestId = (payload as Record<string, unknown>)['requestId'];
    return (
      typeof requestId !== 'string' ||
      !this.rewardedRequestId ||
      requestId === this.rewardedRequestId
    );
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!this.isNative) {
      return false;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = AdMob.initialize()
      .then(() => {
        this.initialized = true;
        this.debugLog('initialized', {
          platform: this.platform,
          native: this.isNative,
          nativeDebugBuild: isNativeDebugBuild(),
          configuredTesting: this.config.isTesting,
          effectiveTesting: this.isTesting,
        });
        return true;
      })
      .catch((error) => {
        this.logRewardedFailure('initialize', error);
        return false;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
  }

  private setRewardedStatus(status: RewardedAdStatus): void {
    this.rewardedStatus = status;
  }

  private logRewardedFailure(stage: string, error: unknown): void {
    if (this.debugEnabled) {
      console.warn('[Ads] rewarded ' + stage + ' failed ' + toDebugString(error));
    }
  }
  private failedResult(
    reason: AdFailureReason,
    confidence: AdFailureConfidence,
  ): RewardedAdResult {
    return {
      rewardEarned: false,
      adClosed: false,
      failed: true,
      failureReason: reason,
      failureConfidence: confidence,
    };
  }

  private debugLog(message: string, details?: unknown): void {
    if (!this.debugEnabled) return;
    const suffix = details === undefined ? '' : ` ${toDebugString(details)}`;
    console.info(`[Ads] ${message}${suffix}`);
  }

  private resolveFailureMetadata(error: unknown): {
    reason: AdFailureReason;
    confidence: AdFailureConfidence;
  } {
    const googleAdsErrorCode = this.extractGoogleAdsErrorCode(error);
    if (googleAdsErrorCode === 3) {
      return { reason: "no-fill", confidence: "high" };
    }

    if (googleAdsErrorCode === 2) {
      return { reason: "network", confidence: "high" };
    }

    const normalized = this.normalizeErrorText(error);

    if (!normalized) {
      return { reason: "unknown", confidence: "low" };
    }

    if (
      /dns|enotfound|unknown host|name not resolved|unable to resolve host/.test(
        normalized,
      )
    ) {
      return { reason: "dns", confidence: "high" };
    }

    if (/no[\s_-]?fill|no ads available|code["':=\s]+3/.test(normalized)) {
      return { reason: "no-fill", confidence: "high" };
    }

    if (/adblock|ad blocker|blocked by|request blocked|blocker/.test(normalized)) {
      return { reason: "blocked", confidence: "high" };
    }

    if (/region|country|geo|not available in your region/.test(normalized)) {
      return { reason: "region", confidence: "high" };
    }

    if (
      /network|timeout|timed out|offline|connection|internet|socket|reset|503|504/.test(
        normalized,
      )
    ) {
      return { reason: "network", confidence: "high" };
    }

    return { reason: "unknown", confidence: "low" };
  }

  private extractGoogleAdsErrorCode(error: unknown): number | null {
    if (typeof error === "number" && Number.isFinite(error)) {
      return Math.trunc(error);
    }

    if (typeof error === "string") {
      const parsed = this.parseGoogleAdsErrorCodeCandidate(error);
      return parsed;
    }

    if (!error || typeof error !== "object") {
      return null;
    }

    const record = error as Record<string, unknown>;
    for (const key of ["code", "errorCode", "nativeErrorCode"]) {
      const candidate = this.parseGoogleAdsErrorCodeValue(record[key]);
      if (candidate !== null) {
        return candidate;
      }
    }

    for (const key of ["message", "error", "description", "reason"]) {
      const candidate = this.parseGoogleAdsErrorCodeValue(record[key]);
      if (candidate !== null) {
        return candidate;
      }
    }

    return null;
  }

  private parseGoogleAdsErrorCodeValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value !== "string") {
      return null;
    }

    return this.parseGoogleAdsErrorCodeCandidate(value);
  }

  private parseGoogleAdsErrorCodeCandidate(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^[0-9]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }

    const match = trimmed.match(
      /\b(?:code|errorcode|nativeerrorcode|ad failed to load)\b[^0-9-]*([0-9]+)\b/i,
    );
    if (!match) {
      return null;
    }

    return Number.parseInt(match[1], 10);
  }

  private normalizeErrorText(error: unknown): string {
    if (typeof error === "string") {
      return error.toLowerCase();
    }

    if (!error) {
      return "";
    }

    const maybeError = error as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ["code", "message", "error", "description", "reason"]) {
      const value = maybeError[key];
      if (typeof value === "string" || typeof value === "number") {
        parts.push(String(value));
      }
    }

    if (!parts.length) {
      try {
        return JSON.stringify(error).toLowerCase();
      } catch {
        return "";
      }
    }

    return parts.join(" ").toLowerCase();
  }
}
