import { TestBed } from '@angular/core/testing';
import { provideAdsKit } from '@sheldrapps/ads-kit';

import { AdsService } from './ads.service';

describe('AdsService', () => {
  let service: AdsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAdsKit({
          isTesting: true,
          units: {
            android: {
              test: { rewarded: 'test-rewarded' },
              prod: { rewarded: 'prod-rewarded' },
            },
          },
        }),
      ],
    });
    service = TestBed.inject(AdsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
