import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  RewardAdPluginEvents,
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
});

describe('AdsService', () => {
  let service: AdsService;

  beforeEach(() => {
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
    spyOn(AdMob, 'prepareRewardVideoAd').and.resolveTo(undefined as never);
    spyOn(AdMob, 'showRewardVideoAd').and.resolveTo(undefined as never);
    spyOn(AdMob, 'addListener').and.resolveTo({
      remove: async () => undefined,
    } as never);

    void service.showRewarded();
    await Promise.resolve();
    await Promise.resolve();

    expect(AdMob.prepareRewardVideoAd).toHaveBeenCalledWith(
      jasmine.objectContaining({
        adId: 'android-prod-rewarded',
        isTesting: false,
      }),
    );
  });

  it('classifies Google Ads error code 3 as no-fill', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    spyOn(AdMob, 'initialize').and.resolveTo(undefined as never);
    spyOn(AdMob, 'requestConsentInfo').and.resolveTo({
      canRequestAds: true,
      status: 'NOT_REQUIRED',
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
    } as never);
    spyOn(AdMob, 'prepareRewardVideoAd').and.resolveTo(undefined as never);
    spyOn(AdMob, 'showRewardVideoAd').and.resolveTo(undefined as never);
    spyOn(AdMob, 'addListener').and.callFake((event, listener) => {
      if (event === RewardAdPluginEvents.FailedToLoad) {
        setTimeout(() => listener(3 as never), 0);
      }

      return Promise.resolve({
        remove: async () => undefined,
      } as never);
    });

    const result = await service.showRewarded();

    expect(result).toEqual(
      jasmine.objectContaining({
        failed: true,
        failureReason: 'no-fill',
        failureConfidence: 'high',
      }),
    );
  });
});
