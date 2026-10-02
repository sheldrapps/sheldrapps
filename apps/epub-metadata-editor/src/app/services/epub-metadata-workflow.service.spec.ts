import { EpubMetadataWorkflowService } from './epub-metadata-workflow.service';

describe('EpubMetadataWorkflowService', () => {
  it('starts with no pending files', () => {
    const context = Object.assign(Object.create(EpubMetadataWorkflowService.prototype), {
      pendingFiles: [],
      currentFile: null,
    }) as EpubMetadataWorkflowService;

    expect(context.hasPendingFiles).toBeFalse();
  });
});
