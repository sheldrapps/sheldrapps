import { TestBed } from '@angular/core/testing';

import { CoversEventsService } from './covers-events.service';

describe('CoversEventsService', () => {
  let service: CoversEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CoversEventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
