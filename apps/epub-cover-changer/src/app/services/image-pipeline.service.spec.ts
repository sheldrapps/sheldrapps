import { TestBed } from '@angular/core/testing';

import { ImagePipelineService } from './image-pipeline.service';

describe('ImagePipelineService', () => {
  let service: ImagePipelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImagePipelineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
