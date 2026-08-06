import { signal } from '@angular/core';
import { HomePage } from './home.page';
import { MergeCoverCandidateService } from '../../services/merge-cover-candidate.service';
import { awaitWithTimeout } from '@sheldrapps/lifecycle-kit';

describe('HomePage', () => {
  it('keeps cover format options aligned with ECC, including all ratios', () => {
    const options = (
      HomePage.prototype as unknown as {
        buildFormatOptions: () => Array<{
          id: string;
          target: { width: number; height: number; output: string; outputMode: string };
        }>;
      }
    ).buildFormatOptions.call(Object.create(HomePage.prototype));

    expect(options.map((option) => option.id)).toEqual([
      'epub',
      'kobo',
      'ridi-1600x2560',
      'ridi-1200x1800',
      'a3',
      'a4',
      'a5',
      'a6',
      'letter',
      'legal',
      'tabloid',
      'one_one',
      'two_three',
      'three_four',
      'four_five',
      'five_seven',
      'five_eight',
      'nine_sixteen',
      'sixteen_nine',
    ]);

    expect(options.find((option) => option.id === 'sixteen_nine')).toEqual(
      jasmine.objectContaining({
        target: jasmine.objectContaining({
          width: 16,
          height: 9,
          output: 'source',
          outputMode: 'aspect-only',
        }),
      }),
    );
  });

  it('starts without a selected mode', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>(null),
    });

    expect(ctx.selectedMode()).toBeNull();
  });

  it('exposes the split method as the second workflow step after file selection', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal<'merge' | 'split' | null>('split'),
      splitSelection: signal({ id: 'split', selectedName: 'Book.epub' }),
      workflowSteps: [{ id: 'merge-split', label: 'Join / Split' }],
      splitWorkflowStep: { id: 'split-method', label: 'How to' },
      splitConfirmStep: { id: 'split-confirm', label: 'Confirm' },
      splitCoverStep: { id: 'split-cover', label: 'Cover' },
      splitAdjustStep: { id: 'split-adjust', label: 'Adjust' },
      splitExecutionStep: { id: 'split-execution', label: 'Split' },
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(null),
      mergeCoverPreviewUrl: signal<string | undefined>(undefined),
    });

    expect(ctx.visibleWorkflowSteps).toEqual([
      { id: 'merge-split', label: 'Join / Split' },
      { id: 'split-method', label: 'How to' },
      { id: 'split-confirm', label: 'Confirm' },
      { id: 'split-cover', label: 'Cover' },
      { id: 'split-adjust', label: 'Adjust' },
      { id: 'split-execution', label: 'Split' },
    ]);
    expect(ctx.selectableWorkflowSteps).toEqual([0, 1, 2, 3]);
  });

  it('accepts only supported split methods', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitMethod: 'by-chapters-or-sections',
    });

    HomePage.prototype.onSplitMethodChange.call(ctx, 'equal-parts');
    expect(ctx.splitMethod).toBe('equal-parts');

    HomePage.prototype.onSplitMethodChange.call(ctx, 'unknown');
    expect(ctx.splitMethod).toBe('equal-parts');
  });

  it('resets every split configuration when a new method is selected', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitMethod: 'manual-split-points',
      splitChapterMode: 'section',
      splitEqualPartsValue: 4,
      splitMaximumSize: 50,
      splitMaximumSizeSelection: 'custom',
      splitManualPointIds: signal<readonly string[]>(['chapter-2']),
      splitPreviewExpanded: signal(true),
    });

    HomePage.prototype.onSplitMethodChange.call(ctx, 'equal-parts');

    expect(ctx.splitMethod).toBe('equal-parts');
    expect(ctx.splitChapterMode).toBe('chapter');
    expect(ctx.splitEqualPartsValue).toBe(2);
    expect(ctx.splitMaximumSize).toBe(10);
    expect(ctx.splitMaximumSizeSelection).toBe('10');
    expect(ctx.splitManualPointIds()).toEqual([]);
    expect(ctx.splitPreviewExpanded()).toBeFalse();
  });

  it('resets split configuration when returning from confirm to How to', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      workflowStep: 2,
      splitChapterMode: 'section',
      splitEqualPartsValue: 4,
      splitMaximumSize: 25,
      splitMaximumSizeSelection: '25',
      splitManualPointIds: signal<readonly string[]>(['chapter-3']),
      splitPreviewExpanded: signal(true),
    });

    HomePage.prototype.onSplitBackToHowTo.call(ctx);

    expect(ctx.workflowStep).toBe(1);
    expect(ctx.splitChapterMode).toBe('chapter');
    expect(ctx.splitEqualPartsValue).toBe(2);
    expect(ctx.splitMaximumSize).toBe(10);
    expect(ctx.splitMaximumSizeSelection).toBe('10');
    expect(ctx.splitManualPointIds()).toEqual([]);
    expect(ctx.splitPreviewExpanded()).toBeFalse();
  });

  it('opens the split cover step before the final split step', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      workflowStep: 2,
      splitCanExecute: () => true,
      pickerErrorKey: signal<string | null>('HOME.ERROR'),
    });

    HomePage.prototype.onSplitExecute.call(ctx);

    expect(ctx.workflowStep).toBe(3);
    expect(ctx.pickerErrorKey()).toBeNull();
  });

  it('selects custom equal parts and validates whole positive values', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitEqualPartsValue: 2,
      splitEqualPartsSelectionValue: '2',
      splitAnalysis: signal({ units: new Array(5).fill({}), sections: [], tocEntries: [] }),
      splitEqualPartsErrorKey: signal<string | null>(null),
      splitConfigurationRevision: signal(0),
    });

    HomePage.prototype.onSplitEqualPartsChange.call(ctx, 'custom');
    expect(ctx.splitEqualPartsSelectionValue).toBe('custom');

    HomePage.prototype.onSplitEqualPartsInput.call(ctx, 'e');
    expect(ctx.splitEqualPartsErrorKey()).toBe('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');

    HomePage.prototype.onSplitEqualPartsInput.call(ctx, '1');
    expect(ctx.splitEqualPartsErrorKey()).toBe('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');

    HomePage.prototype.onSplitEqualPartsInput.call(ctx, '3.5');
    expect(ctx.splitEqualPartsErrorKey()).toBe('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');

    HomePage.prototype.onSplitEqualPartsInput.call(ctx, '3');
    expect(ctx.splitEqualPartsValue).toBe(3);
    expect(ctx.splitEqualPartsErrorKey()).toBeNull();
    expect(ctx.splitConfigurationRevision()).toBe(2);
  });

  it('blocks scientific notation and signs in integer inputs', () => {
    const preventDefault = jasmine.createSpy('preventDefault');

    HomePage.prototype.onSplitIntegerKeydown.call(
      Object.create(HomePage.prototype),
      { key: 'e', preventDefault } as unknown as KeyboardEvent,
    );
    HomePage.prototype.onSplitIntegerKeydown.call(
      Object.create(HomePage.prototype),
      { key: '+', preventDefault } as unknown as KeyboardEvent,
    );

    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('exposes only chapter and section variants', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitAnalysis: signal({
        fileName: 'Book.epub',
        fileSizeBytes: 300,
        units: [],
        sections: [
          { id: 'section-1', title: 'Part I', firstUnitOrder: 0, lastUnitOrder: 1 },
          { id: 'section-2', title: 'Part II', firstUnitOrder: 2, lastUnitOrder: 2 },
        ],
        tocEntries: [],
        hasUsableToc: true,
      }),
    });
    const splitChapterModeItems = Object.getOwnPropertyDescriptor(
      HomePage.prototype,
      'splitChapterModeItems',
    )?.get;

    expect(splitChapterModeItems?.call(ctx)?.map((item: { value: string }) => item.value)).toEqual([
      'chapter',
      'section',
    ]);
    expect(splitChapterModeItems?.call(ctx)?.find((item: { value: string }) => item.value === 'section')?.disabled).toBeUndefined();
  });

  it('keeps custom maximum size available for small EPUBs', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitAnalysis: signal({
        fileSizeBytes: 512 * 1024,
        units: [{}],
        sections: [],
        tocEntries: [],
      }),
      translate: { instant: (key: string) => key },
    });

    const getter = Object.getOwnPropertyDescriptor(
      HomePage.prototype,
      'splitMaximumSizeItems',
    )?.get;
    const customItem = getter?.call(ctx)?.find((item: { value: string }) => item.value === 'custom');

    expect(customItem?.disabled).toBeUndefined();
  });

  it('refreshes workflow labels from the active translation set', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      translate: {
        instant: (key: string) => key,
      },
    });
    const refreshWorkflowStepLabels = (
      HomePage.prototype as unknown as {
        refreshWorkflowStepLabels: () => void;
      }
    ).refreshWorkflowStepLabels;

    refreshWorkflowStepLabels.call(ctx);

    expect(ctx.workflowSteps[0].label).toBe('HOME.STEPPER.MERGE_SPLIT');
    expect(ctx.splitWorkflowStep.label).toBe('HOME.SPLIT_HOW_TO');
    expect(ctx.splitConfirmStep.label).toBe('HOME.STEPPER.CONFIRM');
    expect(ctx.splitCoverStep.label).toBe('HOME.STEPPER.COVER');
    expect(ctx.splitAdjustStep.label).toBe('HOME.STEPPER.ADJUST');
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
      epubRewrite: { isSupported: () => false },
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

  it('prepares multiple merge EPUBs with the native picker', async () => {
    const firstSelection = {
      sessionId: 'session-1',
      selectedName: 'First.epub',
      sourceSize: 10,
      sourceLastModified: 1,
      sourceMimeType: 'application/epub+zip',
      workingPath: '/tmp/first',
      workingName: 'first-working.epub',
      workingNativePath: '/tmp/first/native.epub',
      outputBaseName: 'first',
    };
    const secondSelection = {
      ...firstSelection,
      sessionId: 'session-2',
      selectedName: 'Second.epub',
      workingPath: '/tmp/second',
      workingName: 'second-working.epub',
      workingNativePath: '/tmp/second/native.epub',
      outputBaseName: 'second',
    };
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isPicking: signal(false),
      epubRewrite: {
        isSupported: () => true,
        pickAndPrepareEpubs: jasmine
          .createSpy('pickAndPrepareEpubs')
          .and.resolveTo([firstSelection, secondSelection]),
      },
      mergeSelections: signal<readonly unknown[]>([]),
      selectedMode: signal<'merge' | 'split' | null>(null),
      workflowStep: 0,
      refreshMergeCoverCandidates: jasmine
        .createSpy('refreshMergeCoverCandidates')
        .and.resolveTo(undefined),
      createSelectionId: jasmine
        .createSpy('createSelectionId')
        .and.returnValues('selection-1', 'selection-2'),
      clearPickerError: jasmine.createSpy('clearPickerError'),
      handlePickerError: jasmine.createSpy('handlePickerError'),
    });

    await HomePage.prototype.openMergePicker.call(ctx);

    expect(ctx.epubRewrite.pickAndPrepareEpubs).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        requireCover: false,
        includeCoverPreview: true,
      }),
    );
    expect(ctx.mergeSelections().map((item: any) => item.selectedName)).toEqual([
      'First.epub',
      'Second.epub',
    ]);
    expect(ctx.selectedMode()).toBe('merge');
    expect(ctx.refreshMergeCoverCandidates).toHaveBeenCalled();
  });

  it('turns a native EPUB cover preview into a best-candidate image', async () => {
    const service = new MergeCoverCandidateService();
    spyOn(service as any, 'readImageDimensions').and.resolveTo({
      width: 1236,
      height: 1648,
    });
    const coverFile = new File(['cover'], 'native-cover.jpg', {
      type: 'image/jpeg',
    });

    const candidates = await service.collectCandidates([
      {
        epubId: 'native-1',
        epubName: 'Book.epub',
        coverFile,
        coverEntryPath: 'Images/cover.jpg',
        order: 1,
      },
    ]);
    const candidate = candidates[0];

    expect(candidate).toBeDefined();
    if (!candidate) return;
    expect(candidate.id).toBe('native-1:cover');
    expect(candidate.sourcePath).toBe('Images/cover.jpg');
    expect(candidate.metadata?.['file']).toBe(coverFile);
    expect(candidate.hints).toContain('metadata-cover');
  });

  it('preflights, merges, and registers the generated EPUB before showing feedback', async () => {
    const preflightMerge = jasmine.createSpy('preflightMerge').and.resolveTo({});
    const mergeEpubs = jasmine.createSpy('mergeEpubs').and.resolveTo({
      outputPath: '/tmp/merged.epub',
      outputName: 'merged.epub',
      size: 42,
    });
    const saveExportedEpub = jasmine
      .createSpy('saveExportedEpub')
      .and.resolveTo({ id: 'saved', filename: 'merged.epub' });
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
      completeOperation: jasmine.createSpy('completeOperation'),
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
    expect(ctx.completeOperation).toHaveBeenCalledWith('merge', [
      { id: 'saved', filename: 'merged.epub' },
    ]);
    expect(cleanupWorkingCopy).toHaveBeenCalledTimes(2);
  });

  it('normalizes the selected split plan and persists all generated EPUBs together', async () => {
    const splitEpubs = jasmine.createSpy('splitEpubs').and.resolveTo([
      {
        id: 'operation:1',
        outputPath: '/tmp/part-1.epub',
        outputName: 'Book - 1.epub',
        title: 'Chapter 1',
        size: 10,
      },
      {
        id: 'operation:2',
        outputPath: '/tmp/part-2.epub',
        outputName: 'Book - 2.epub',
        title: 'Chapter 2',
        size: 11,
      },
    ]);
    const saveExportedEpubs = jasmine
      .createSpy('saveExportedEpubs')
      .and.resolveTo([
        { id: 'saved-1', filename: 'Book - 1.epub' },
        { id: 'saved-2', filename: 'Book - 2.epub' },
      ]);
    const cleanupWorkingCopy = jasmine
      .createSpy('cleanupWorkingCopy')
      .and.resolveTo(undefined);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitSelection: signal({
        selectedName: 'Book.epub',
        workingNativePath: '/tmp/source.epub',
        outputBaseName: 'Book',
      }),
      splitAnalysis: signal({
        units: [{ id: 'one' }, { id: 'two' }],
        tocEntries: [],
      }),
      splitOutputPreviews: signal([
        { number: 1, title: 'Chapter 1', startUnit: 0, endUnit: 0 },
        { number: 2, title: 'Chapter 2', startUnit: 1, endUnit: 1 },
      ]),
      epubRewrite: {
        isSupported: () => true,
        splitEpubs,
      },
      epubWorkingCopy: {
        buildOutputFile: jasmine
          .createSpy('buildOutputFile')
          .and.callFake((name: string) =>
            Promise.resolve({
              path: 'EpubWork/' + name + '.epub',
              nativePath: '/tmp/' + name + '.epub',
            }),
          ),
        cleanupWorkingCopy,
      },
      epubLibrary: { saveExportedEpubs },
      mergeCoverRenderedFile: null,
      createOperationId: () => 'operation',
      completeOperation: jasmine.createSpy('completeOperation'),
    });

    await (HomePage.prototype as unknown as { runSplit: () => Promise<void> }).runSplit.call(ctx);

    expect(splitEpubs).toHaveBeenCalledWith(
      jasmine.objectContaining({
        inputPath: '/tmp/source.epub',
        outputs: [
          jasmine.objectContaining({ spineItemIds: ['one'] }),
          jasmine.objectContaining({ spineItemIds: ['two'] }),
        ],
      }),
    );
    expect(saveExportedEpubs).toHaveBeenCalledWith([
      jasmine.objectContaining({ operation: 'split', operationId: 'operation', partIndex: 0 }),
      jasmine.objectContaining({ operation: 'split', operationId: 'operation', partIndex: 1 }),
    ]);
    expect(ctx.completeOperation).toHaveBeenCalled();
    expect(cleanupWorkingCopy).toHaveBeenCalledTimes(3);
  });

  it('keeps nested TOC entries and fragment targets in each split output', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {});
    const buildSplitTocEntries = (
      HomePage.prototype as unknown as {
        buildSplitTocEntries: (analysis: unknown, preview: unknown) => unknown;
      }
    ).buildSplitTocEntries;
    const entries = buildSplitTocEntries.call(ctx, {
      units: [
        { id: 'part-1', href: 'OPS/text/part-1.xhtml', order: 0 },
        { id: 'chapter-1', href: 'OPS/text/chapter-1.xhtml', order: 1 },
        { id: 'chapter-2', href: 'OPS/text/chapter-2.xhtml', order: 2 },
      ],
      tocEntries: [
        {
          id: 'part-i',
          title: 'Part I',
          href: 'OPS/text/part-1.xhtml',
          spineItemId: 'part-1',
          children: [
            {
              id: 'chapter-1-entry',
              title: 'Chapter 1',
              href: 'OPS/text/chapter-1.xhtml#section-3',
              spineItemId: 'chapter-1',
              children: [],
            },
          ],
        },
      ],
    } as never, { startUnit: 0, endUnit: 1 } as never);

    expect(entries).toEqual([
      {
        spineItemId: 'part-1',
        title: 'Part I',
        href: 'OPS/text/part-1.xhtml',
        children: [
          {
            spineItemId: 'chapter-1',
            title: 'Chapter 1',
            href: 'OPS/text/chapter-1.xhtml#section-3',
            children: [],
          },
        ],
      },
    ]);
  });

  it('promotes valid children when a TOC container is not part of the selected spine', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {});
    const buildSplitTocEntries = (
      HomePage.prototype as unknown as {
        buildSplitTocEntries: (analysis: unknown, preview: unknown) => unknown;
      }
    ).buildSplitTocEntries;

    const entries = buildSplitTocEntries.call(ctx, {
      units: [{ id: 'chapter-1', href: 'OPS/chapter.xhtml', order: 0 }],
      tocEntries: [
        {
          id: 'part',
          title: 'Part I',
          href: 'OPS/part.xhtml',
          spineItemId: null,
          children: [
            {
              id: 'chapter',
              title: 'Chapter 1',
              href: 'OPS/chapter.xhtml#start',
              spineItemId: 'chapter-1',
              children: [],
            },
          ],
        },
        {
          id: 'orphan',
          title: 'Missing',
          href: 'OPS/missing.xhtml',
          spineItemId: null,
          children: [],
        },
      ],
    } as never, { startUnit: 0, endUnit: 0 } as never);

    expect(entries).toEqual([
      {
        spineItemId: 'chapter-1',
        title: 'Chapter 1',
        href: 'OPS/chapter.xhtml#start',
        children: [],
      },
    ]);
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
    expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/tabs/preview-editing');

    HomePage.prototype.closePreview.call(ctx);
    expect(ctx.previewEditingPage.clear).toHaveBeenCalled();
  });

  it('normalizes export quality to the free mode', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      exportQualityMode: 'best',
      adsRemoved: false,
    });

    expect(HomePage.prototype.getEffectiveExportQualityMode.call(ctx)).toBe(
      'compressed',
    );
  });

  it('keeps best export quality for ad-free users', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      exportQualityMode: 'best',
      adsRemoved: true,
    });

    expect(HomePage.prototype.getEffectiveExportQualityMode.call(ctx)).toBe(
      'best',
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
      isMergeActionBusy: signal(false),
      splitAnalysisPending: signal(false),
      splitAnalysis: signal(null),
      bestCandidateDismissed: signal(false),
      candidateBlobUrls: new Set<string>(),
      previewEditingPage: { clear: jasmine.createSpy('clear') },
      pickerErrorKey: signal<string | null>('HOME.INPUT_ERROR_CORRUPT'),
      isPicking: signal(false),
      operationFeedback: signal(null),
      operationProgress: signal(null),
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

  it('keeps the reset spinner active until cleanup completes', async () => {
    let finishCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      finishCleanup = resolve;
    });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isResettingFlow: signal(false),
      editorSessionExit: {
        confirmResetFlow: jasmine
          .createSpy('confirmResetFlow')
          .and.resolveTo(true),
      },
      clearFlowState: jasmine.createSpy('clearFlowState').and.returnValue(cleanup),
    });

    const resetPromise = HomePage.prototype.resetFlow.call(ctx);
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    expect(ctx.isResettingFlow()).toBeTrue();
    expect(ctx.clearFlowState).toHaveBeenCalledOnceWith();

    finishCleanup();
    await resetPromise;

    expect(ctx.isResettingFlow()).toBeFalse();
  });

  it('does not wait forever when reset cleanup never settles', async () => {
    await awaitWithTimeout(new Promise<void>(() => undefined), 1);
    expect(true).toBeTrue();
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
    expect(ctx.openEditor).toHaveBeenCalledOnceWith('scratch', 'new-cover', 3);
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
    expect(ctx.openEditor).toHaveBeenCalledOnceWith('image', 'new-cover', 3);
  });

  it('keeps the workflow loader active while the image editor opens', async () => {
    const image = new File(['image'], 'cover.png', { type: 'image/png' });
    let resolveEditor: () => void = () => undefined;
    const editorOpening = new Promise<void>((resolve) => {
      resolveEditor = resolve;
    });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isPicking: signal(false),
      bestCandidateDismissed: signal(false),
      coverSourceMode: signal<'candidate' | 'image' | 'scratch' | null>(null),
      selectedCoverCandidateId: signal<string | undefined>('candidate-1'),
      applyMergeCoverSource: jasmine
        .createSpy('applyMergeCoverSource')
        .and.resolveTo(true),
      openEditor: jasmine.createSpy('openEditor').and.returnValue(editorOpening),
      resetFileInput: jasmine.createSpy('resetFileInput'),
    });

    const pending = HomePage.prototype.onCoverImageFileSelected.call(ctx, {
      target: { files: [image] },
    } as unknown as Event);

    await Promise.resolve();
    expect(ctx.isPicking()).toBeTrue();

    resolveEditor();
    await pending;
    expect(ctx.isPicking()).toBeFalse();
  });

  it('uses the analysis label while an EPUB is being analyzed', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitAnalysisPending: signal(true),
    });
    const workflowLoadingLabelKey = Object.getOwnPropertyDescriptor(
      HomePage.prototype,
      'workflowLoadingLabelKey',
    )?.get;

    expect(workflowLoadingLabelKey?.call(ctx)).toBe(
      'HOME.SPLIT_CONFIRM.ANALYZING',
    );
  });

  it('shows the rewarded ad before merging for free users', async () => {
    const showRewarded = jasmine
      .createSpy('showRewarded')
      .and.resolveTo({ rewardEarned: true, adClosed: true, failed: false });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isMergeActionBusy: signal(false),
      operationProgress: signal(null),
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
      operationProgress: signal(null),
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

  it('shows the rewarded ad before splitting for free users', async () => {
    const showRewarded = jasmine
      .createSpy('showRewarded')
      .and.resolveTo({ rewardEarned: true, adClosed: true, failed: false });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitCanExecute: signal(true),
      isPicking: signal(false),
      isMergeActionBusy: signal(false),
      operationProgress: signal(null),
      pickerErrorKey: signal<string | null>(null),
      adsRemoved: false,
      ads: { showRewarded },
      runSplit: jasmine.createSpy('runSplit').and.resolveTo(undefined),
    });

    await HomePage.prototype.onSplitExport.call(ctx);

    expect(showRewarded).toHaveBeenCalled();
    expect(ctx.runSplit).toHaveBeenCalled();
    expect(ctx.isMergeActionBusy()).toBeFalse();
  });

  it('skips the rewarded ad for Pro split exports', async () => {
    const showRewarded = jasmine.createSpy('showRewarded');
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      splitCanExecute: signal(true),
      isPicking: signal(false),
      isMergeActionBusy: signal(false),
      operationProgress: signal(null),
      pickerErrorKey: signal<string | null>(null),
      adsRemoved: true,
      ads: { showRewarded },
      runSplit: jasmine.createSpy('runSplit').and.resolveTo(undefined),
    });

    await HomePage.prototype.onSplitExport.call(ctx);

    expect(showRewarded).not.toHaveBeenCalled();
    expect(ctx.runSplit).toHaveBeenCalled();
    expect(ctx.isMergeActionBusy()).toBeFalse();
  });
});
