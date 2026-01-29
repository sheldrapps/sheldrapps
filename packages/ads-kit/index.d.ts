import * as i0 from '@angular/core';
import { InjectionToken, Provider } from '@angular/core';

/**
 * Ad unit IDs for different ad formats
 */
type AdsUnits = {
    rewarded: string;
};
/**
 * Platform-specific ad units
 */
type PlatformUnits = {
    test: AdsUnits;
    prod: AdsUnits;
};
/**
 * Configuration for ads-kit
 */
interface AdsKitConfig {
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
declare const ADS_KIT_CONFIG: InjectionToken<AdsKitConfig>;
/**
 * Consent status from UMP
 */
type ConsentResult = {
    canRequestAds: boolean;
    privacyOptionsRequired: boolean;
    umpReady: boolean;
};

declare class AdsService {
    private initialized;
    private readonly config;
    private readonly consent;
    private get platform();
    private get isNative();
    private get isAndroid();
    private get isTesting();
    private get units();
    private canShowAds;
    init(): Promise<void>;
    showRewarded(): Promise<boolean>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AdsService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AdsService>;
}

declare class ConsentService {
    private canRequestAds;
    private privacyOptionsRequired;
    private umpReady;
    private readyResolve;
    readonly ready: Promise<void>;
    get state(): ConsentResult;
    /**
     * Call once on app launch (or before initializing ads).
     */
    gatherConsent(): Promise<ConsentResult>;
    showPrivacyOptionsIfAvailable(): Promise<boolean>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ConsentService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ConsentService>;
}

/**
 * Main provider factory for ads-kit
 * Set up all necessary providers for AdMob and UMP consent
 *
 * @param config Ads configuration
 * @returns Array of Angular providers
 *
 * @example
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideAdsKit({
 *       isTesting: !environment.production,
 *       units: {
 *         android: {
 *           test: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },
 *           prod: { rewarded: 'ca-app-pub-1676607690625695/8384333921' }
 *         }
 *       }
 *     })
 *   ]
 * });
 */
declare function provideAdsKit(config: AdsKitConfig): Provider[];

/**
 * Get current Capacitor platform
 */
declare function getPlatform(): string;
/**
 * Check if running on native platform (Android or iOS)
 */
declare function isNative(): boolean;
/**
 * Check if running on Android
 */
declare function isAndroid(): boolean;
/**
 * Check if running on iOS
 */
declare function isIOS(): boolean;
/**
 * Check if running on web
 */
declare function isWeb(): boolean;

export { ADS_KIT_CONFIG, AdsService, ConsentService, getPlatform, isAndroid, isIOS, isNative, isWeb, provideAdsKit };
export type { AdsKitConfig, AdsUnits, ConsentResult, PlatformUnits };
