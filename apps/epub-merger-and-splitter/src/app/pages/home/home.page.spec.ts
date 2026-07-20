import { signal } from '@angular/core';
import { HomePage } from './home.page';

describe('HomePage', () => {
  it('starts without a selected mode', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>(null),
    });

    expect(ctx.selectedMode()).toBeNull();
  });

  it('uses a workflow title only after files are loaded', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>(null),
      mergeSelections: signal<readonly { id: string; selectedName: string }[]>(
        [],
      ),
      splitSelection: signal<{ id: string; selectedName: string } | null>(null),
    });

    expect(HomePage.prototype.getPageTitleKey.call(ctx)).toBe('TABS.HOME');
    expect(HomePage.prototype.hasLoadedFiles.call(ctx)).toBeFalse();

    ctx.selectedMode.set('merge');
    expect(HomePage.prototype.getPageTitleKey.call(ctx)).toBe('TABS.HOME');
    expect(HomePage.prototype.hasLoadedFiles.call(ctx)).toBeFalse();

    ctx.mergeSelections.set([{ id: '1', selectedName: 'First.epub' }]);
    expect(HomePage.prototype.hasLoadedFiles.call(ctx)).toBeTrue();
    expect(HomePage.prototype.getPageTitleKey.call(ctx)).toBe(
      'HOME.MERGING_TITLE',
    );

    ctx.mergeSelections.set([]);
    ctx.selectedMode.set('split');
    ctx.splitSelection.set({ id: '2', selectedName: 'Second.epub' });
    expect(HomePage.prototype.hasLoadedFiles.call(ctx)).toBeTrue();
    expect(HomePage.prototype.getPageTitleKey.call(ctx)).toBe(
      'HOME.SPLITTING_TITLE',
    );
  });

  it('opens the merge file input directly', async () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>(null),
      isPicking: signal(false),
      mergeInput: {
        nativeElement: {
          click: jasmine.createSpy('click'),
        },
      },
      clearPickerError: jasmine.createSpy('clearPickerError'),
    });

    await HomePage.prototype.openMergePicker.call(ctx);

    expect(ctx.mergeInput.nativeElement.click).toHaveBeenCalled();
    expect(ctx.selectedMode()).toBeNull();
    expect(ctx.clearPickerError).toHaveBeenCalled();
  });

  it('preflights, merges, and registers the generated EPUB before opening the library', async () => {
    const preflightMerge = jasmine.createSpy('preflightMerge').and.resolveTo({});
    const mergeEpubs = jasmine.createSpy('mergeEpubs').and.resolveTo({
      outputPath: '/tmp/merged.epub',
      outputName: 'merged.epub',
      size: 42,
    });
    const saveExportedEpub = jasmine
      .createSpy('saveExportedEpub')
      .and.resolveTo(undefined);
    const cleanupWorkingCopy = jasmine
      .createSpy('cleanupWorkingCopy')
      .and.resolveTo(undefined);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      mergeSelections: signal([
        {
          id: 'one',
          selectedName: 'One.epub',
          workingNativePath: '/tmp/one.epub',
          outputBaseName: 'one',
        },
        {
          id: 'two',
          selectedName: 'Two.epub',
          workingNativePath: '/tmp/two.epub',
          outputBaseName: 'two',
        },
      ]),
      mergeCoverRenderedFile: new File(['cover'], 'cover.jpg', {
        type: 'image/jpeg',
      }),
      tocMode: 'books-and-chapters',
      epubRewrite: {
        isSupported: () => true,
        preflightMerge,
        mergeEpubs,
      },
      epubWorkingCopy: {
        buildOutputFile: jasmine.createSpy('buildOutputFile').and.resolveTo({
          path: 'EpubWork/output.epub',
          nativePath: '/tmp/output.epub',
        }),
        writeTempCoverFile: jasmine.createSpy('writeTempCoverFile').and.resolveTo({
          path: 'EpubWork/cover.jpg',
          nativePath: '/tmp/cover.jpg',
        }),
        cleanupWorkingCopy,
      },
      epubLibrary: { saveExportedEpub },
      router: { navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) },
    });

    const runMerge = (
      HomePage.prototype as unknown as { runMerge: () => Promise<void> }
    ).runMerge;
    await runMerge.call(ctx);

    expect(preflightMerge).toHaveBeenCalled();
    expect(mergeEpubs).toHaveBeenCalledWith(
      jasmine.objectContaining({
        outputPath: '/tmp/output.epub',
        coverPath: '/tmp/cover.jpg',
      }),
    );
    expect(saveExportedEpub).toHaveBeenCalledWith(
      '/tmp/merged.epub',
      'merged.epub',
    );
    expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/tabs/my-epubs');
    expect(cleanupWorkingCopy).toHaveBeenCalledTimes(2);
  });

  it('opens the editing preview page only when a cover exists', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      mergeCoverPreviewUrl: signal<string | undefined>(undefined),
      previewEditingPage: {
        open: jasmine.createSpy('open'),
        clear: jasmine.createSpy('clear'),
      },
      router: {
        navigateByUrl: jasmine.createSpy('navigateByUrl'),
      },
    });

    HomePage.prototype.openPreview.call(ctx);
    expect(ctx.previewEditingPage.open).not.toHaveBeenCalled();

    ctx.mergeCoverPreviewUrl.set('blob:cover');
    HomePage.prototype.openPreview.call(ctx);
    expect(ctx.previewEditingPage.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        imageSrc: 'blob:cover',
        returnUrl: '/tabs/home',
      }),
    );
    expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/preview-editing');

    HomePage.prototype.closePreview.call(ctx);
    expect(ctx.previewEditingPage.clear).toHaveBeenCalled();
  });

  it('normalizes export quality to the free mode', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      exportQualityMode: 'best',
    });

    expect(HomePage.prototype.getEffectiveExportQualityMode.call(ctx)).toBe(
      'compressed',
    );
  });

  it('opens the split native picker when supported', async () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isPicking: signal(false),
      epubRewrite: {
        isSupported: () => true,
      },
      pickNativeEpubForSplit: jasmine
        .createSpy('pickNativeEpubForSplit')
        .and.resolveTo(undefined),
      clearPickerError: jasmine.createSpy('clearPickerError'),
    });

    await HomePage.prototype.openSplitPicker.call(ctx);

    expect(ctx.pickNativeEpubForSplit).toHaveBeenCalled();
    expect(ctx.clearPickerError).toHaveBeenCalled();
  });

  it('cancels the workflow and restores the initial state', async () => {
    const firstSelection = {
      id: '1',
      selectedName: 'First.epub',
      workingPath: '/tmp/first.epub',
    };
    const secondSelection = {
      id: '2',
      selectedName: 'Second.epub',
      workingPath: '/tmp/second.epub',
    };
    const splitSelection = {
      id: '3',
      selectedName: 'Third.epub',
      workingPath: '/tmp/third.epub',
    };
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>('merge'),
      mergeSelections: signal([firstSelection, secondSelection]),
      splitSelection: signal(splitSelection),
      coverCandidates: signal([]),
      selectedCoverCandidateId: signal<string | undefined>(undefined),
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(
        'candidate',
      ),
      mergeCoverPreviewUrl: signal<string | undefined>(undefined),
      mergeCoverPreviewRevision: signal(0),
      isDetectingCoverCandidates: signal(false),
      bestCandidateDismissed: signal(false),
      candidateBlobUrls: new Set<string>(),
      previewEditingPage: { clear: jasmine.createSpy('clear') },
      pickerErrorKey: signal<string | null>('HOME.INPUT_ERROR_CORRUPT'),
      isPicking: signal(false),
      mergeInput: { nativeElement: { value: 'merge-selection' } },
      splitInput: { nativeElement: { value: 'split-selection' } },
      cleanupSelection: jasmine
        .createSpy('cleanupSelection')
        .and.resolveTo(undefined),
    });

    await HomePage.prototype.cancelWorkflow.call(ctx);

    expect(ctx.selectedMode()).toBeNull();
    expect(ctx.mergeSelections()).toEqual([]);
    expect(ctx.splitSelection()).toBeNull();
    expect(ctx.pickerErrorKey()).toBeNull();
    expect(ctx.mergeInput.nativeElement.value).toBe('');
    expect(ctx.splitInput.nativeElement.value).toBe('');
    expect(ctx.cleanupSelection).toHaveBeenCalledWith(firstSelection);
    expect(ctx.cleanupSelection).toHaveBeenCalledWith(secondSelection);
    expect(ctx.cleanupSelection).toHaveBeenCalledWith(splitSelection);
  });

  it('prepares every EPUB returned by the merge input', async () => {
    const firstFile = new File(['a'], 'First.epub', {
      type: 'application/epub+zip',
    });
    const secondFile = new File(['b'], 'Second.epub', {
      type: 'application/epub+zip',
    });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>(null),
      mergeSelections: signal<readonly { id: string; selectedName: string }[]>(
        [],
      ),
      pickerErrorKey: signal<string | null>(null),
      isPicking: signal(false),
      refreshMergeCoverCandidates: jasmine
        .createSpy('refreshMergeCoverCandidates')
        .and.resolveTo(undefined),
      clearPickerError: jasmine.createSpy('clearPickerError'),
      handlePickerError: jasmine.createSpy('handlePickerError'),
      resetFileInput: jasmine.createSpy('resetFileInput'),
      prepareWebSelection: jasmine
        .createSpy('prepareWebSelection')
        .and.callFake((file: File) =>
          Promise.resolve({
            id: file.name,
            selectedName: file.name,
          }),
        ),
    });

    await HomePage.prototype.onMergeFilesSelected.call(ctx, {
      target: {
        files: [firstFile, secondFile],
      },
    } as unknown as Event);

    expect(ctx.prepareWebSelection).toHaveBeenCalledTimes(2);
    expect(
      ctx
        .mergeSelections()
        .map((item: { selectedName: string }) => item.selectedName),
    ).toEqual(['First.epub', 'Second.epub']);
    expect(ctx.selectedMode()).toBe('merge');
  });

  it('reorders merge selections and keeps numbering derived from order', async () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      mergeSelections: signal([
        { id: '1', selectedName: 'First.epub' },
        { id: '2', selectedName: 'Second.epub' },
        { id: '3', selectedName: 'Third.epub' },
      ]),
      refreshMergeCoverCandidates: jasmine
        .createSpy('refreshMergeCoverCandidates')
        .and.resolveTo(undefined),
    });

    await HomePage.prototype.onMergeItemsReordered.call(ctx, { from: 0, to: 2 });

    expect(
      ctx.mergeSelections().map((item: { id: string }) => item.id),
    ).toEqual(['2', '3', '1']);
    expect(ctx.refreshMergeCoverCandidates).toHaveBeenCalled();
  });

  it('removes a merge selection and cleans its working copy', async () => {
    const firstSelection = {
      id: '1',
      selectedName: 'First.epub',
      workingPath: '/tmp/first.epub',
    };
    const secondSelection = {
      id: '2',
      selectedName: 'Second.epub',
      workingPath: '/tmp/second.epub',
    };
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>('merge'),
      mergeSelections: signal([firstSelection, secondSelection]),
      pickerErrorKey: signal<string | null>(null),
      mergeInput: { nativeElement: { value: 'merge-selection' } },
      refreshMergeCoverCandidates: jasmine
        .createSpy('refreshMergeCoverCandidates')
        .and.resolveTo(undefined),
      cleanupSelection: jasmine
        .createSpy('cleanupSelection')
        .and.resolveTo(undefined),
    });

    await HomePage.prototype.onMergeItemRemoved.call(ctx, {
      id: firstSelection.id,
      index: 0,
    });

    expect(ctx.mergeSelections()).toEqual([secondSelection]);
    expect(ctx.selectedMode()).toBe('merge');
    expect(ctx.refreshMergeCoverCandidates).toHaveBeenCalled();
    expect(ctx.cleanupSelection).toHaveBeenCalledOnceWith(firstSelection);
  });

  it('restores the initial flow after removing the last merge selection', async () => {
    const selection = {
      id: '1',
      selectedName: 'First.epub',
      workingPath: '/tmp/first.epub',
    };
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>('merge'),
      mergeSelections: signal([selection]),
      coverCandidates: signal([]),
      selectedCoverCandidateId: signal<string | undefined>(undefined),
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(
        'candidate',
      ),
      mergeCoverPreviewUrl: signal<string | undefined>(undefined),
      mergeCoverPreviewRevision: signal(0),
      isDetectingCoverCandidates: signal(false),
      bestCandidateDismissed: signal(false),
      candidateBlobUrls: new Set<string>(),
      pickerErrorKey: signal<string | null>('HOME.INPUT_ERROR_CORRUPT'),
      mergeInput: { nativeElement: { value: 'merge-selection' } },
      cleanupSelection: jasmine
        .createSpy('cleanupSelection')
        .and.resolveTo(undefined),
    });

    await HomePage.prototype.onMergeItemRemoved.call(ctx, {
      id: selection.id,
      index: 0,
    });

    expect(ctx.mergeSelections()).toEqual([]);
    expect(ctx.selectedMode()).toBeNull();
    expect(ctx.pickerErrorKey()).toBeNull();
    expect(ctx.mergeInput.nativeElement.value).toBe('');
    expect(ctx.cleanupSelection).toHaveBeenCalledOnceWith(selection);
  });

  it('opens the editor in scratch mode from the cover selector', async () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isPicking: signal(false),
      bestCandidateDismissed: signal(false),
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(null),
      selectedCoverCandidateId: signal<string | undefined>('candidate-1'),
      openEditor: jasmine.createSpy('openEditor').and.resolveTo(undefined),
    });

    await HomePage.prototype.onCoverScratchSelected.call(ctx);

    expect(ctx.coverSourceMode()).toBe('scratch');
    expect(ctx.selectedCoverCandidateId()).toBeUndefined();
    expect(ctx.openEditor).toHaveBeenCalledOnceWith('scratch');
  });

  it('loads a cover image and opens the editor in image mode', async () => {
    const image = new File(['image'], 'cover.png', { type: 'image/png' });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isPicking: signal(false),
      bestCandidateDismissed: signal(false),
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(null),
      selectedCoverCandidateId: signal<string | undefined>('candidate-1'),
      applyMergeCoverSource: jasmine
        .createSpy('applyMergeCoverSource')
        .and.resolveTo(true),
      openEditor: jasmine.createSpy('openEditor').and.resolveTo(undefined),
      resetFileInput: jasmine.createSpy('resetFileInput'),
    });

    await HomePage.prototype.onCoverImageFileSelected.call(ctx, {
      target: {
        files: [image],
      },
    } as unknown as Event);

    expect(ctx.applyMergeCoverSource).toHaveBeenCalledOnceWith(image);
    expect(ctx.coverSourceMode()).toBe('image');
    expect(ctx.selectedCoverCandidateId()).toBeUndefined();
    expect(ctx.openEditor).toHaveBeenCalledOnceWith('image');
  });

  it('shows the rewarded ad before merging for free users', async () => {
    const showRewarded = jasmine
      .createSpy('showRewarded')
      .and.resolveTo({ rewardEarned: true, adClosed: true, failed: false });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isMergeActionBusy: signal(false),
      isPicking: signal(false),
      adsRemoved: false,
      ads: { showRewarded },
      runMerge: jasmine.createSpy('runMerge').and.resolveTo(undefined),
    });

    await HomePage.prototype.onMergeButtonClick.call(ctx);

    expect(showRewarded).toHaveBeenCalled();
    expect(ctx.runMerge).toHaveBeenCalled();
    expect(ctx.isMergeActionBusy()).toBeFalse();
  });

  it('skips the rewarded ad for Pro users', async () => {
    const showRewarded = jasmine.createSpy('showRewarded');
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isMergeActionBusy: signal(false),
      isPicking: signal(false),
      adsRemoved: true,
      ads: { showRewarded },
      runMerge: jasmine.createSpy('runMerge').and.resolveTo(undefined),
    });

    await HomePage.prototype.onMergeButtonClick.call(ctx);

    expect(showRewarded).not.toHaveBeenCalled();
    expect(ctx.runMerge).toHaveBeenCalled();
    expect(ctx.isMergeActionBusy()).toBeFalse();
  });
});
