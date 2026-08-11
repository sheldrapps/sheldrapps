import { TestBed } from '@angular/core/testing';
import { provideAdsKit } from '@sheldrapps/ads-kit';

import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let service: ConsentService;

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
    service = TestBed.inject(ConsentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
