import { InjectionToken } from '@angular/core';

/**
 * Ad unit IDs for different ad formats
 */
export type AdsUnits = {
  rewarded: string;
  // Future: banner, interstitial, etc.
};

/**
 * Result of showing a rewarded ad
 */
export type RewardedAdResult = {
  /** Whether the user earned the reward by watching the ad */
  rewardEarned: boolean;
  /** Whether the ad was closed (dismissed) */
  adClosed: boolean;
  /** Whether there was an error loading or showing the ad */
  failed: boolean;
  /** Normalized reason for ad failure when failed=true */
  failureReason?: AdFailureReason;
  /** Confidence level for failureReason when failed=true */
  failureConfidence?: AdFailureConfidence;
};

export type AdFailureReason =
  | 'network'
  | 'dns'
  | 'no-fill'
  | 'blocked'
  | 'region'
  | 'unknown';

export type AdFailureConfidence = 'high' | 'low';

/**
 * Platform-specific ad units
 */
export type PlatformUnits = {
  test: AdsUnits;
  prod: AdsUnits;
};

/**
 * Configuration for ads-kit
 */
export interface AdsKitConfig {
  /**
   * Whether to use test ads (equivalent to !environment.production)
   */
  isTesting: boolean;

  /**
   * Ad units by platform
   */
  units: {
    android: PlatformUnits;
    ios?: PlatformUnits;
  };

  /**
   * Optional billing configuration for "remove ads forever" purchases.
   */
  billing?: BillingKitConfig;

  /**
   * Optional debug logging
   */
  debug?: boolean;
}

/**
 * Billing configuration
 */
export interface BillingKitConfig {
  /**
   * Android product identifier for the non-consumable remove-ads purchase.
   */
  removeAdsProductId?: string;

  /**
   * Optional debug logging
   */
  debug?: boolean;
}

/**
 * Injection token for AdsKitConfig
 */
export const ADS_KIT_CONFIG = new InjectionToken<AdsKitConfig>('ADS_KIT_CONFIG');

/**
 * Consent status from UMP
 */
export type ConsentResult = {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  umpReady: boolean;
};
