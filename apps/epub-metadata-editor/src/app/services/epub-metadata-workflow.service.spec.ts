import { EpubMetadataWorkflowService } from './epub-metadata-workflow.service';

describe('EpubMetadataWorkflowService', () => {
  it('starts with no pending files', () => {
    const context = Object.assign(Object.create(EpubMetadataWorkflowService.prototype), {
      pendingFiles: [],
      currentFile: null,
    }) as EpubMetadataWorkflowService;

    expect(context.hasPendingFiles).toBeFalse();
  });

  it('clears the entire session when canceled', async () => {
    const cleanup = jasmine.createSpy('cleanup').and.resolveTo();
    const clearPage = jasmine.createSpy('clearPage');
    const setPendingCommit = jasmine.createSpy('setPendingCommit');
    const setCompletedFiles = jasmine.createSpy('setCompletedFiles');
    const currentFile = { filename: 'current.epub', sessionId: 'current-session' };
    const pendingFile = { filename: 'next.epub', sessionId: 'pending-session' };
    const context = Object.assign(
      Object.create(EpubMetadataWorkflowService.prototype),
      {
        sessionGeneration: 4,
        pendingFiles: [pendingFile],
        currentFile,
        formReturnIntent: true,
        multipleMode: true,
        pendingCommit: { set: setPendingCommit },
        completedFiles: { set: setCompletedFiles },
        epubRewrite: { cleanup },
        metadataPage: { clear: clearPage },
      },
    ) as EpubMetadataWorkflowService;
    const internal = context as any;

    await context.cancel();

    expect(internal.sessionGeneration).toBe(5);
    expect(internal.pendingFiles).toEqual([]);
    expect(internal.currentFile).toBeNull();
    expect(internal.formReturnIntent).toBeFalse();
    expect(internal.multipleMode).toBeFalse();
    expect(setPendingCommit).toHaveBeenCalledOnceWith(null);
    expect(setCompletedFiles).toHaveBeenCalledOnceWith([]);
    expect(clearPage).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith('current-session');
    expect(cleanup).toHaveBeenCalledWith('pending-session');
  });

  it('cleans up files returned by load more after the session is canceled', async () => {
    let resolvePreparedFiles!: (files: { selectedName: string; sessionId: string; workingNativePath: string }[]) => void;
    const pickAndPrepareEpubs = jasmine
      .createSpy('pickAndPrepareEpubs')
      .and.returnValue(
        new Promise<{ selectedName: string; sessionId: string; workingNativePath: string }[]>(
          (resolve) => {
            resolvePreparedFiles = resolve;
          },
        ),
      );
    const cleanup = jasmine.createSpy('cleanup').and.resolveTo();
    const context = Object.assign(
      Object.create(EpubMetadataWorkflowService.prototype),
      {
        sessionGeneration: 9,
        pendingFiles: [],
        currentFile: null,
        formReturnIntent: false,
        multipleMode: true,
        pendingCommit: { set: jasmine.createSpy('setPendingCommit') },
        completedFiles: { set: jasmine.createSpy('setCompletedFiles') },
        epubRewrite: { isSupported: () => true, pickAndPrepareEpubs, cleanup },
        metadataPage: { clear: jasmine.createSpy('clearPage') },
      },
    ) as EpubMetadataWorkflowService;
    const internal = context as any;
    const loadingMore = context.loadMoreFromNativePicker();

    await context.cancel();
    resolvePreparedFiles([
      {
        selectedName: 'late.epub',
        sessionId: 'late-session',
        workingNativePath: '/working/late.epub',
      },
    ]);
    await loadingMore;

    expect(internal.pendingFiles).toEqual([]);
    expect(cleanup).toHaveBeenCalledOnceWith('late-session');
  });
});
