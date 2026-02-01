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
};

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
