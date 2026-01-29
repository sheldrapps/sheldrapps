import { Provider } from '@angular/core';
import { ADS_KIT_CONFIG, type AdsKitConfig } from './types';
import { AdsService } from './ads.service';
import { ConsentService } from './consent.service';

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
export function provideAdsKit(config: AdsKitConfig): Provider[] {
  return [
    // Provide config via injection token
    { provide: ADS_KIT_CONFIG, useValue: config },

    // Provide services
    AdsService,
    ConsentService,
  ];
}
