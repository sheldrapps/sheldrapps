import { TestBed } from '@angular/core/testing';

import { KindleCatalogService } from './kindle-catalog.service';

describe('KindleCatalogService', () => {
  let service: KindleCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KindleCatalogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
