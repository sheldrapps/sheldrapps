import * as i0 from '@angular/core';
import { InjectionToken, Injectable, inject } from '@angular/core';
import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

/**
 * Injection token for AdsKitConfig
 */
const ADS_KIT_CONFIG = new InjectionToken('ADS_KIT_CONFIG');

class ConsentService {
    canRequestAds = false;
    privacyOptionsRequired = false;
    umpReady = false;
    readyResolve;
    ready = new Promise((resolve) => (this.readyResolve = resolve));
    get state() {
        return {
            canRequestAds: this.canRequestAds,
            privacyOptionsRequired: this.privacyOptionsRequired,
            umpReady: this.umpReady,
        };
    }
    /**
     * Call once on app launch (or before initializing ads).
     */
    async gatherConsent() {
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
        }
        catch (e) {
            console.error('[Consent] gatherConsent failed', e);
            // Mark UMP as "done" (attempted), but ads are not allowed
            this.umpReady = true;
            this.canRequestAds = false;
            this.privacyOptionsRequired = false;
            return this.state;
        }
        finally {
            // Always unblock waiters
            this.readyResolve?.();
        }
    }
    async showPrivacyOptionsIfAvailable() {
        try {
            if (!this.umpReady)
                return false;
            await AdMob.showPrivacyOptionsForm();
            return true;
        }
        catch (e) {
            console.error('[Consent] showPrivacyOptionsForm failed', e);
            return false;
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: ConsentService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: ConsentService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: ConsentService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });

/**
 * Get current Capacitor platform
 */
function getPlatform() {
    return Capacitor.getPlatform();
}
/**
 * Check if running on native platform (Android or iOS)
 */
function isNative() {
    const platform = getPlatform();
    return platform === 'android' || platform === 'ios';
}
/**
 * Check if running on Android
 */
function isAndroid() {
    return getPlatform() === 'android';
}
/**
 * Check if running on iOS
 */
function isIOS() {
    return getPlatform() === 'ios';
}
/**
 * Check if running on web
 */
function isWeb() {
    return getPlatform() === 'web';
}

class AdsService {
    initialized = false;
    config = inject(ADS_KIT_CONFIG);
    consent = inject(ConsentService);
    get platform() {
        return getPlatform();
    }
    get isNative() {
        return isNative();
    }
    get isAndroid() {
        return isAndroid();
    }
    get isTesting() {
        return this.config.isTesting;
    }
    get units() {
        if (this.isAndroid) {
            const androidUnits = this.config.units.android;
            return this.isTesting ? androidUnits.test : androidUnits.prod;
        }
        // Fallback to iOS or Android if iOS not configured
        const iosUnits = this.config.units.ios || this.config.units.android;
        return this.isTesting ? iosUnits.test : iosUnits.prod;
    }
    canShowAds() {
        const c = this.consent.state;
        return c.umpReady && c.canRequestAds;
    }
    async init() {
        if (this.initialized)
            return;
        if (!this.isNative)
            return;
        if (this.config.debug) {
            console.log('[Ads] Initializing AdMob', {
                platform: this.platform,
                isTesting: this.isTesting,
            });
        }
        await AdMob.initialize();
        this.initialized = true;
    }
    async showRewarded() {
        await this.init();
        if (!this.initialized)
            return false;
        await this.consent.ready.catch(() => undefined);
        if (!this.canShowAds())
            return false;
        const opts = {
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
        }
        catch (e) {
            console.warn('[Ads] rewarded failed', e);
            return false;
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: AdsService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: AdsService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: AdsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });

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
function provideAdsKit(config) {
    return [
        // Provide config via injection token
        { provide: ADS_KIT_CONFIG, useValue: config },
        // Provide services
        AdsService,
        ConsentService,
    ];
}

/**
 * Public API for @sheldrapps/ads-kit
 */
// Core exports

/**
 * Generated bundle index. Do not edit.
 */

export { ADS_KIT_CONFIG, AdsService, ConsentService, getPlatform, isAndroid, isIOS, isNative, isWeb, provideAdsKit };
//# sourceMappingURL=sheldrapps-ads-kit.mjs.map
