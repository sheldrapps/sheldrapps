import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
} from '@capacitor-community/admob';
import {
  ADS_KIT_CONFIG,
  AdsService,
  BillingService,
  ConsentService,
  provideAdsKit,
} from '@sheldrapps/ads-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';

describe('ConsentService', () => {
  let service: ConsentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAdsKit({
          isTesting: false,
          units: {
            android: {
              test: { rewarded: 'test-rewarded' },
              prod: { rewarded: 'prod-rewarded' },
            },
          },
        }),
      ],
    });
    service = TestBed.inject(ConsentService);
  });

  it('allows ads when requestConsentInfo omits canRequestAds but status is not REQUIRED', async () => {
    spyOn(AdMob, 'requestConsentInfo').and.resolveTo({
      status: 'NOT_REQUIRED',
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
    } as never);

    const result = await service.gatherConsent();

    expect(result.canRequestAds).toBeTrue();
  });

  it('allows ads after consent form when canRequestAds is omitted but status stops being REQUIRED', async () => {
    spyOn(AdMob, 'requestConsentInfo').and.resolveTo({
      status: 'REQUIRED',
      privacyOptionsRequirementStatus: 'REQUIRED',
      isConsentFormAvailable: true,
    } as never);
    spyOn(AdMob, 'showConsentForm').and.resolveTo({
      status: 'OBTAINED',
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    } as never);

    const result = await service.gatherConsent();

    expect(result.canRequestAds).toBeTrue();
  });
});

describe('BillingService', () => {
  let service: BillingService;
  let settingsStore: jasmine.SpyObj<SettingsStore<Record<string, unknown>>>;

  beforeEach(() => {
    settingsStore = jasmine.createSpyObj<SettingsStore<Record<string, unknown>>>(
      'SettingsStore',
      ['load', 'set'],
    );
    settingsStore.load.and.resolveTo({});
    settingsStore.set.and.resolveTo({});

    TestBed.configureTestingModule({
      providers: [
        BillingService,
        {
          provide: ADS_KIT_CONFIG,
          useValue: {
            isTesting: false,
            units: {
              android: {
                test: { rewarded: 'test-rewarded' },
                prod: { rewarded: 'prod-rewarded' },
              },
            },
            billing: {
              removeAdsProductId: 'ccfk_remove_ads_forever',
            },
          },
        },
        {
          provide: SettingsStore,
          useValue: settingsStore,
        },
      ],
    });

    service = TestBed.inject(BillingService);
  });

  afterEach(() => {
    delete (globalThis as { __SHELDRAPPS_NATIVE_DEBUG__?: boolean })
      .__SHELDRAPPS_NATIVE_DEBUG__;
  });

  it('does not unlock premium mode on native debug builds', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    (globalThis as { __SHELDRAPPS_NATIVE_DEBUG__?: boolean })
      .__SHELDRAPPS_NATIVE_DEBUG__ = true;

    await service.hydrateCachedState();

    expect(service.isDevelopmentMode()).toBeFalse();
    expect(service.isAdsRemoved()).toBeFalse();
  });

  it('exposes the billing state needed to diagnose disabled purchase UI', () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');

    expect(service.getPurchaseDiagnostics()).toEqual(
      jasmine.objectContaining({
        state: 'idle',
        isReady: false,
        billingAvailable: false,
        canRunBillingOperations: false,
        hasRemoveAdsEntitlement: false,
        priceFormatted: null,
        productId: 'ccfk_remove_ads_forever',
        platform: 'android',
        native: true,
        android: true,
      }),
    );
  });
});

describe('AdsService', () => {
  let service: AdsService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideAdsKit({
          isTesting: true,
          units: {
            android: {
              test: { rewarded: 'android-test-rewarded' },
              prod: { rewarded: 'android-prod-rewarded' },
            },
          },
        }),
        {
          provide: SettingsStore,
          useValue: { load: async () => ({}), set: async () => ({}) },
        },
      ],
    });

    service = TestBed.inject(AdsService);
  });

  afterEach(() => {
    delete (globalThis as { __SHELDRAPPS_NATIVE_DEBUG__?: boolean })
      .__SHELDRAPPS_NATIVE_DEBUG__;
  });

  it('treats web testing mode as rewarded-success development flow', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');

    const result = await service.showRewarded();

    expect(result).toEqual({
      rewardEarned: true,
      adClosed: true,
      failed: false,
    });
  });

  it('uses production ad ids on native debug builds', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    (globalThis as { __SHELDRAPPS_NATIVE_DEBUG__?: boolean })
      .__SHELDRAPPS_NATIVE_DEBUG__ = true;
    spyOn(AdMob, 'initialize').and.resolveTo(undefined as never);
    spyOn(AdMob, 'requestConsentInfo').and.resolveTo({
      canRequestAds: true,
      status: 'NOT_REQUIRED',
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
    } as never);
    const consoleInfoSpy = spyOn(console, 'info');

    const result = await service.warmRewarded();

    expect(result.status).toBe('ready');
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      jasmine.stringMatching('"adId":"android-prod-rewarded"'),
    );
  });

});
async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;

  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
