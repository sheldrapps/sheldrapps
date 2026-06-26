import { FixPage } from './fix.page';

describe('FixPage', () => {
  it('diagnoses automatically after preparing an EPUB', async () => {
    const file = new File(['epub'], 'book.epub', {
      type: 'application/epub+zip',
    });
    const input = { files: [file], value: 'keep' } as unknown as HTMLInputElement;
    const prepare = jasmine.createSpy('prepare').and.resolveTo({
      sessionId: 'session-1',
      originalName: 'book.epub',
      originalSize: file.size,
      isZipReadable: true,
    });
    const diagnose = jasmine.createSpy('diagnose').and.resolveTo({
      sessionId: 'session-1',
      status: 'valid' as const,
      issues: [],
    });

    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: undefined,
      selectedEpubName: undefined,
      sourceEpubMeta: undefined,
      diagnosis: undefined,
      repairResult: undefined,
      exportResult: undefined,
      viewState: 'idle' as const,
      epubErrorKey: undefined,
      epubErrorParams: {},
      workflow: {
        prepareFromFile: prepare,
        diagnoseCurrentEpub: diagnose,
        pickAndPrepareNative: jasmine.createSpy('pickAndPrepareNative'),
        cleanup: jasmine.createSpy('cleanup').and.resolveTo(undefined),
        cleanupCurrentEpub: jasmine
          .createSpy('cleanupCurrentEpub')
          .and.resolveTo(undefined),
      },
    });

    await FixPage.prototype.onEpubSelected.call(ctx, {
      target: input,
    } as unknown as Event);

    expect(prepare).toHaveBeenCalledWith(file);
    expect(diagnose).toHaveBeenCalled();
    expect(ctx.viewState).toBe('diagnosed');
    expect(ctx.busyAction).toBeUndefined();
    expect(ctx.busyProgressPercent).toBe(0);
    expect(input.value).toBe('');
  });

  it('fixes and saves a copy after a rewarded ad on the free flow', async () => {
    const repair = jasmine.createSpy('repair').and.resolveTo({
      success: true,
      repairedIssues: ['SPINE_EMPTY'],
    });
    const diagnose = jasmine.createSpy('diagnose').and.resolveTo({
      sessionId: 'session-1',
      status: 'valid' as const,
      issues: [],
    });
    const exportCurrentEpub = jasmine.createSpy('exportCurrentEpub').and.resolveTo(
      {
        outputUri: 'blob:fixed',
        size: 123,
      },
    );
    const saveExportedEpub = jasmine
      .createSpy('saveExportedEpub')
      .and.resolveTo(undefined);
    const emit = jasmine.createSpy('emit');
    const showRewarded = jasmine.createSpy('showRewarded').and.resolveTo({
      rewardEarned: true,
      adClosed: true,
      failed: false,
    });
    const toastCreate = jasmine.createSpy('create').and.resolveTo({
      present: jasmine.createSpy('present').and.resolveTo(undefined),
    });

    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: 'session-1',
      selectedEpubName: 'book.epub',
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'SPINE_EMPTY',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_SPINE_EMPTY',
          },
        ],
      },
      repairResult: undefined,
      exportResult: undefined,
      viewState: 'diagnosed' as const,
      epubErrorKey: undefined,
      epubErrorParams: {},
      adsRemoved: false,
      ads: {
        showRewarded,
      },
      toastCtrl: {
        create: toastCreate,
      },
      translate: {
        instant: jasmine.createSpy('instant').and.callFake((key: string) => key),
      },
      workflow: {
        repairCurrentEpub: repair,
        diagnoseCurrentEpub: diagnose,
        exportCurrentEpub,
        buildFixedOutputName: jasmine
          .createSpy('buildFixedOutputName')
          .and.returnValue('book_fixed.epub'),
      },
      library: {
        saveExportedEpub,
      },
      coversEvents: {
        emit,
      },
    });

    await FixPage.prototype.runRepair.call(ctx);

    expect(showRewarded).toHaveBeenCalled();
    expect(repair).toHaveBeenCalled();
    expect(diagnose).toHaveBeenCalled();
    expect(toastCreate).toHaveBeenCalled();
    expect(exportCurrentEpub).toHaveBeenCalledWith('book_fixed.epub');
    expect(saveExportedEpub).toHaveBeenCalledWith(
      'blob:fixed',
      'book_fixed.epub',
    );
    expect(emit).toHaveBeenCalledWith({
      type: 'saved',
      filename: 'book_fixed.epub',
    });
    expect(ctx.viewState).toBe('repaired');
    expect(ctx.exportResult).toEqual({
      size: 123,
      outputName: 'book_fixed.epub',
      outputUri: 'blob:fixed',
    });
    expect(ctx.busyAction).toBeUndefined();
    expect(ctx.busyProgressPercent).toBe(0);
  });

  it('shows the Fix action for a repairable missing mimetype diagnosis', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      viewState: 'diagnosed' as const,
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'MIMETYPE_MISSING',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          },
        ],
      },
    });

    const descriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'resultPrimaryActionKey',
    );

    expect(descriptor?.get?.call(ctx)).toBe('FIX.ACTION_REPAIR');
  });

  it('shows the Fix action for a repairable container issue diagnosis', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      viewState: 'diagnosed' as const,
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'CONTAINER_MISSING',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_CONTAINER_MISSING',
          },
        ],
      },
    });

    const descriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'resultPrimaryActionKey',
    );

    expect(descriptor?.get?.call(ctx)).toBe('FIX.ACTION_REPAIR');
  });

  it('shows the Resolve action for an ambiguous OPF diagnosis', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      viewState: 'diagnosed' as const,
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'OPF_AMBIGUOUS',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
            repairMode: 'guided',
            options: ['OPS/package.opf', 'OPS/alt.opf'],
          },
        ],
      },
    });

    const canRepairDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'canRepair',
    );
    const canResolveDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'canResolve',
    );
    const primaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'resultPrimaryActionKey',
    );

    expect(canRepairDescriptor?.get?.call(ctx)).toBeFalse();
    expect(canResolveDescriptor?.get?.call(ctx)).toBeTrue();
    expect(primaryDescriptor?.get?.call(ctx)).toBe('FIX.ACTION_RESOLVE');
  });

  it('shows save/share actions after an export result exists', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      exportResult: {
        size: 123,
        outputName: 'book_fixed.epub',
        outputUri: 'blob:fixed',
      },
    });

    const canSaveShareDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'canSaveShare',
    );
    const primaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'resultPrimaryActionKey',
    );

    expect(canSaveShareDescriptor?.get?.call(ctx)).toBeTrue();
    expect(primaryDescriptor?.get?.call(ctx)).toBeNull();
  });

  it('forwards a preferred OPF path to the repair workflow', async () => {
    const repair = jasmine.createSpy('repair').and.resolveTo({
      success: true,
      repairedIssues: ['OPF_AMBIGUOUS'],
    });
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: 'session-1',
      selectedEpubName: 'book.epub',
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'OPF_AMBIGUOUS',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
            repairMode: 'guided',
            options: ['OPS/package.opf', 'OPS/alt.opf'],
          },
        ],
      },
      repairResult: undefined,
      exportResult: undefined,
      viewState: 'diagnosed' as const,
      epubErrorKey: undefined,
      epubErrorParams: {},
      adsRemoved: true,
      ads: {
        showRewarded: jasmine.createSpy('showRewarded'),
      },
      toastCtrl: {
        create: jasmine.createSpy('create').and.resolveTo({
          present: jasmine.createSpy('present').and.resolveTo(undefined),
        }),
      },
      translate: {
        instant: jasmine.createSpy('instant').and.callFake((key: string) => key),
      },
      workflow: {
        repairCurrentEpub: repair,
        diagnoseCurrentEpub: jasmine.createSpy('diagnoseCurrentEpub').and.resolveTo(
          {
            sessionId: 'session-1',
            status: 'valid' as const,
            issues: [],
          },
        ),
        exportCurrentEpub: jasmine.createSpy('exportCurrentEpub').and.resolveTo({
          outputUri: 'blob:fixed',
          size: 123,
        }),
        buildFixedOutputName: jasmine
          .createSpy('buildFixedOutputName')
          .and.returnValue('book_fixed.epub'),
      },
      library: {
        saveExportedEpub: jasmine
          .createSpy('saveExportedEpub')
          .and.resolveTo(undefined),
      },
      coversEvents: {
        emit: jasmine.createSpy('emit'),
      },
    });

    await FixPage.prototype.runRepair.call(ctx, 'OPS/package.opf');

    expect(repair).toHaveBeenCalledWith('OPS/package.opf');
  });

  it('summarizes automatic and partial diagnosis results correctly', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'MIMETYPE_MISSING',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          },
          {
            code: 'MANIFEST_ITEM_MISSING',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_MANIFEST_ITEM_MISSING',
          },
        ],
      },
    });

    const summaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisSummary',
    );
    const overviewDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisOverviewKey',
    );

    expect(summaryDescriptor?.get?.call(ctx)).toEqual({
      totalIssues: 2,
      automaticIssues: 1,
      reviewIssues: 0,
      guidedIssues: 0,
      partialIssues: 1,
      blockedIssues: 0,
    });
    expect(overviewDescriptor?.get?.call(ctx)).toBe(
      'FIX.DIAGNOSIS_STATUS_PARTIAL',
    );
  });

  it('marks blocked issues as critical', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'unsupported',
        issues: [
          {
            code: 'ZIP_UNREADABLE',
            severity: 'error',
            fixable: false,
            messageKey: 'FIX.ISSUE_ZIP_UNREADABLE',
          },
        ],
      },
    });

    const summaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisSummary',
    );
    const overviewDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisOverviewKey',
    );

    expect(summaryDescriptor?.get?.call(ctx)).toEqual({
      totalIssues: 1,
      automaticIssues: 0,
      reviewIssues: 0,
      guidedIssues: 0,
      partialIssues: 0,
      blockedIssues: 1,
    });
    expect(overviewDescriptor?.get?.call(ctx)).toBe(
      'FIX.DIAGNOSIS_STATUS_CRITICAL',
    );
  });

  it('marks a clean diagnosis as ready to export', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'valid',
        issues: [],
      },
    });

    const overviewDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisOverviewKey',
    );

    expect(overviewDescriptor?.get?.call(ctx)).toBe(
      'FIX.DIAGNOSIS_STATUS_READY',
    );
  });

  it('opens a saved EPUB project back in the fix flow', async () => {
    const file = new File(['epub'], 'book.epub', {
      type: 'application/epub+zip',
    });
    const loadGenerated = jasmine.createSpy('loadGenerated').and.resolveTo({
      file,
      uri: 'file:///tmp/book.epub',
      size: file.size,
    });
    const prepare = jasmine.createSpy('prepare').and.resolveTo({
      sessionId: 'session-2',
      originalName: 'book.epub',
      originalSize: file.size,
      isZipReadable: true,
    });
    const diagnose = jasmine.createSpy('diagnose').and.resolveTo({
      sessionId: 'session-2',
      status: 'valid' as const,
      issues: [],
    });

    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: undefined,
      selectedEpubName: undefined,
      sourceEpubMeta: undefined,
      diagnosis: undefined,
      repairResult: undefined,
      exportResult: undefined,
      viewState: 'idle' as const,
      epubErrorKey: undefined,
      epubErrorParams: {},
      workflow: {
        usesNativePicker: () => false,
        prepareFromFile: prepare,
        diagnoseCurrentEpub: diagnose,
        repairCurrentEpub: jasmine.createSpy('repairCurrentEpub'),
        exportCurrentEpub: jasmine.createSpy('exportCurrentEpub'),
        buildFixedOutputName: jasmine.createSpy('buildFixedOutputName'),
        cleanup: jasmine.createSpy('cleanup').and.resolveTo(undefined),
        cleanupCurrentEpub: jasmine
          .createSpy('cleanupCurrentEpub')
          .and.resolveTo(undefined),
      },
      library: {
        loadGeneratedEpubByFilename: loadGenerated,
      },
    });

    const opened = await FixPage.prototype[
      'openSavedProjectByFilename'
    ].call(ctx, 'book.epub');

    expect(opened).toBeTrue();
    expect(loadGenerated).toHaveBeenCalledWith('book.epub');
    expect(prepare).toHaveBeenCalledWith(file);
    expect(diagnose).toHaveBeenCalled();
    expect(ctx.preparedSessionId).toBe('session-2');
    expect(ctx.selectedEpubName).toBe('book.epub');
    expect(ctx.viewState).toBe('diagnosed');
  });

  it('formats loading progress as a percentage', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyProgressPercent: 37.6,
    });

    const descriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'loadingProgressLabel',
    );
    expect(descriptor?.get?.call(ctx)).toBe('38%');
  });
});
