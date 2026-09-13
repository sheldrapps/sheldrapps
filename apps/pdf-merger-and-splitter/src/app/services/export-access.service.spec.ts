import { TestBed } from '@angular/core/testing';
import {
  AdsService,
  BillingService,
  ExportAccessService,
} from '@sheldrapps/ads-kit';

describe('ExportAccessService', () => {
  let service: ExportAccessService;
  let billing: {
    ensureAdsEntitlement: jasmine.Spy;
  };
  let ads: {
    showRewarded: jasmine.Spy;
  };

  beforeEach(() => {
    billing = {
      ensureAdsEntitlement: jasmine.createSpy('ensureAdsEntitlement'),
    };
    ads = {
      showRewarded: jasmine.createSpy('showRewarded'),
    };

    TestBed.configureTestingModule({
      providers: [
        ExportAccessService,
        { provide: BillingService, useValue: billing },
        { provide: AdsService, useValue: ads },
      ],
    });

    service = TestBed.inject(ExportAccessService);
  });

  it('grants Pro exports without showing rewarded', async () => {
    billing.ensureAdsEntitlement.and.resolveTo('pro');

    const result = await service.authorize({
      onAdFailure: () => false,
    });

    expect(result).toEqual({ granted: true, source: 'premium' });
    expect(ads.showRewarded).not.toHaveBeenCalled();
  });

  it('uses rewarded for a free export', async () => {
    billing.ensureAdsEntitlement.and.resolveTo('free');
    ads.showRewarded.and.resolveTo({
      rewardEarned: true,
      adClosed: true,
      failed: false,
    });

    const result = await service.authorize({
      onAdFailure: () => false,
    });

    expect(result).toEqual(jasmine.objectContaining({
      granted: true,
      source: 'rewarded',
    }));
    expect(ads.showRewarded).toHaveBeenCalledOnceWith();
  });

  it('allows a fallback export when rewarded fails', async () => {
    billing.ensureAdsEntitlement.and.resolveTo('free');
    ads.showRewarded.and.resolveTo({
      rewardEarned: false,
      adClosed: false,
      failed: true,
      failureReason: 'no-fill',
      failureConfidence: 'high',
    });

    const result = await service.authorize({
      onAdFailure: () => true,
    });

    expect(result).toEqual(jasmine.objectContaining({
      granted: true,
      source: 'fallback',
    }));
  });
});
