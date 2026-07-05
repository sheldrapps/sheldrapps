import { type EpubDiagnosticIssue } from '@sheldrapps/file-kit';

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

  it('shows the Fix action for an ambiguous OPF diagnosis and waits for a guided choice', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      viewState: 'diagnosed' as const,
      selectedGuidedOptionByIssueKey: {},
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
    const primaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'resultPrimaryActionKey',
    );

    expect(canRepairDescriptor?.get?.call(ctx)).toBeFalse();
    expect(primaryDescriptor?.get?.call(ctx)).toBe('FIX.ACTION_REPAIR');

    FixPage.prototype.onGuidedOptionChange.call(
      ctx,
      ctx.diagnosis.issues[0],
      'OPS/alt.opf',
    );

    expect(canRepairDescriptor?.get?.call(ctx)).toBeTrue();
    expect(
      FixPage.prototype.selectedGuidedOption.call(ctx, ctx.diagnosis.issues[0]),
    ).toBe('OPS/alt.opf');
  });

  it('requires confirmation checkboxes before repairing confirmation issues', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      preparedSessionId: 'session-1',
      viewState: 'diagnosed' as const,
      selectedConfirmationByIssueKey: {},
      selectedGuidedOptionByIssueKey: {},
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'ORPHAN_RESOURCE_UNUSED',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_ORPHAN_RESOURCE_UNUSED',
            repairMode: 'review',
          },
        ],
      },
    });

    const canRepairDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'canRepair',
    );

    expect(canRepairDescriptor?.get?.call(ctx)).toBeFalse();

    FixPage.prototype.onConfirmationChange.call(
      ctx,
      ctx.diagnosis.issues[0],
      true,
    );

    expect(
      FixPage.prototype.isConfirmationChecked.call(ctx, ctx.diagnosis.issues[0]),
    ).toBeTrue();
    expect(canRepairDescriptor?.get?.call(ctx)).toBeTrue();
  });

  it('toggles confirmation selection from the choice row handler', () => {
    const issue = {
      code: 'ORPHAN_RESOURCE_UNUSED',
      severity: 'warning',
      fixable: true,
      messageKey: 'FIX.ISSUE_ORPHAN_RESOURCE_UNUSED',
      repairMode: 'review',
    } satisfies EpubDiagnosticIssue;
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      selectedConfirmationByIssueKey: {},
      diagnosis: {
        status: 'repairable',
        issues: [issue],
      },
    });

    expect(
      FixPage.prototype.isConfirmationChecked.call(ctx, issue),
    ).toBeFalse();

    FixPage.prototype.toggleConfirmation.call(ctx, issue);

    expect(
      FixPage.prototype.isConfirmationChecked.call(ctx, issue),
    ).toBeTrue();
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

  it('shows the remove ads entry point only while ads are active', () => {
    const billing = {
      canShowRemoveAdsEntryPoint: jasmine
        .createSpy('canShowRemoveAdsEntryPoint')
        .and.returnValue(true),
    };
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      adsRemoved: false,
      billing,
    });

    expect(FixPage.prototype.canShowRemoveAdsEntryPoint.call(ctx)).toBeTrue();

    ctx.adsRemoved = true;

    expect(FixPage.prototype.canShowRemoveAdsEntryPoint.call(ctx)).toBeFalse();
    expect(billing.canShowRemoveAdsEntryPoint).toHaveBeenCalledTimes(1);
  });

  it('opens the remove ads modal after preparing the billing UI', async () => {
    const preparePurchaseUi = jasmine
      .createSpy('preparePurchaseUi')
      .and.resolveTo(undefined);
    const billing = {
      canShowRemoveAdsEntryPoint: jasmine
        .createSpy('canShowRemoveAdsEntryPoint')
        .and.returnValue(true),
      preparePurchaseUi,
      isBillingAvailable: jasmine
        .createSpy('isBillingAvailable')
        .and.returnValue(true),
    };
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      adsRemoved: false,
      purchaseBusy: false,
      purchaseModalOpen: false,
      billing,
    });

    await FixPage.prototype.openPurchaseModal.call(ctx);

    expect(preparePurchaseUi).toHaveBeenCalled();
    expect(ctx.purchaseModalOpen).toBeTrue();
    expect(ctx.purchaseBusy).toBeFalse();
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

    expect(repair).toHaveBeenCalledWith('OPS/package.opf', undefined);
  });

  it('uses the guided OPF selection when fixing an ambiguous package', async () => {
    const repair = jasmine.createSpy('repair').and.resolveTo({
      success: true,
      repairedIssues: ['OPF_AMBIGUOUS'],
    });
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: 'session-1',
      selectedEpubName: 'book.epub',
      selectedGuidedOptionByIssueKey: {},
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
    const issue = ctx.diagnosis.issues[0];

    FixPage.prototype.onGuidedOptionChange.call(
      ctx,
      issue,
      'OPS/alt.opf',
    );

    await FixPage.prototype.onPrimaryAction.call(ctx);

    const selectionKey = FixPage.prototype.issueSelectionKey.call(
      ctx,
      issue,
    );

    expect(repair).toHaveBeenCalledWith('OPS/alt.opf', {
      [selectionKey]: 'OPS/alt.opf',
    });
  });

  it('forwards guided selections for internal link repairs', async () => {
    const repair = jasmine.createSpy('repair').and.resolveTo({
      success: true,
      repairedIssues: ['LINK_TARGET_MISSING'],
    });
    const issue = {
      code: 'LINK_TARGET_MISSING',
      severity: 'warning',
      fixable: true,
      messageKey: 'FIX.ISSUE_LINK_TARGET_MISSING',
      repairMode: 'guided',
      details: 'OPS/text.xhtml: ../img/cover.png',
      options: ['OPS/media/cover.png', 'OPS/img/cover.png'],
    } satisfies EpubDiagnosticIssue;
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      busyAction: undefined,
      busyProgressPercent: 0,
      preparedSessionId: 'session-1',
      selectedEpubName: 'book.epub',
      selectedGuidedOptionByIssueKey: {},
      diagnosis: {
        status: 'repairable',
        issues: [issue],
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

    FixPage.prototype.onGuidedOptionChange.call(ctx, issue, 'OPS/img/cover.png');

    await FixPage.prototype.runRepair.call(ctx);

    const selectionKey = FixPage.prototype.issueSelectionKey.call(ctx, issue);

    expect(repair).toHaveBeenCalledWith(undefined, {
      [selectionKey]: 'OPS/img/cover.png',
    });
  });

  it('summarizes diagnosis severity correctly', () => {
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
          {
            code: 'ZIP_UNREADABLE',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_ZIP_UNREADABLE',
          },
        ],
      },
    });

    const summaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisSeveritySummary',
    );
    const severityDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'issueSeverityLevel',
    );

    expect(summaryDescriptor?.get?.call(ctx)).toEqual({
      totalIssues: 3,
      criticalIssues: 1,
      highIssues: 1,
      mediumIssues: 1,
      lowIssues: 0,
    });
    expect(
      severityDescriptor?.value?.call(ctx, {
        code: 'MIMETYPE_MISSING',
        severity: 'error',
        fixable: true,
        messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
      }),
    ).toBe('high');
  });

  it('classifies manifest items as automatic repairs', () => {
    expect(
      FixPage.prototype.issueRepairMode.call(Object.create(FixPage.prototype), {
        code: 'MANIFEST_ITEM_MISSING',
        severity: 'warning',
        fixable: true,
        messageKey: 'FIX.ISSUE_MANIFEST_ITEM_MISSING',
      }),
    ).toBe('automatic');
    expect(
      FixPage.prototype.issueRepairMode.call(Object.create(FixPage.prototype), {
        code: 'SPINE_ITEM_INVALID',
        severity: 'warning',
        fixable: true,
        messageKey: 'FIX.ISSUE_SPINE_ITEM_INVALID',
      }),
    ).toBe('automatic');
    expect(
      FixPage.prototype.issueRepairMode.call(Object.create(FixPage.prototype), {
        code: 'ORPHAN_RESOURCE_UNUSED',
        severity: 'warning',
        fixable: true,
        messageKey: 'FIX.ISSUE_ORPHAN_RESOURCE_UNUSED',
      }),
    ).toBe('review');
  });

  it('treats unreadable zips as recoverable severity', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {});

    expect(
      FixPage.prototype.issueSeverityLevel.call(ctx, {
        code: 'ZIP_UNREADABLE',
        severity: 'error',
        fixable: true,
        messageKey: 'FIX.ISSUE_ZIP_UNREADABLE',
      }),
    ).toBe('high');
  });

  it('returns a severity summary for a clean diagnosis', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'valid',
        issues: [],
      },
    });

    const summaryDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'diagnosisSeveritySummary',
    );

    expect(summaryDescriptor?.get?.call(ctx)).toEqual({
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
    });
  });

  it('orders auto-fixable issues by severity first', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'MIMETYPE_INVALID',
            severity: 'info',
            fixable: true,
            messageKey: 'FIX.ISSUE_MIMETYPE_INVALID',
          },
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
          {
            code: 'OPF_AMBIGUOUS',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
            repairMode: 'guided',
          },
          {
            code: 'ZIP_UNREADABLE',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_ZIP_UNREADABLE',
          },
        ],
      },
    });

    const issuesDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'autoFixableIssues',
    );

    expect(
      issuesDescriptor?.get?.call(ctx).map((issue: { messageKey: string }) => issue.messageKey),
    ).toEqual([
      'FIX.ISSUE_MIMETYPE_MISSING',
      'FIX.ISSUE_ZIP_UNREADABLE',
      'FIX.ISSUE_MANIFEST_ITEM_MISSING',
      'FIX.ISSUE_MIMETYPE_INVALID',
    ]);
  });

  it('keeps manual intervention issues limited to guided items', () => {
    const ctx = Object.assign(Object.create(FixPage.prototype), {
      diagnosis: {
        status: 'repairable',
        issues: [
          {
            code: 'OPF_AMBIGUOUS',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
            repairMode: 'guided',
          },
        ],
      },
    });

    const issuesDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'manualInterventionIssues',
    );

    expect(
      issuesDescriptor?.get?.call(ctx).map((issue: { messageKey: string }) => issue.messageKey),
    ).toEqual([
      'FIX.ISSUE_OPF_AMBIGUOUS',
    ]);
  });

  it('groups the issue list by repairability section', () => {
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
            code: 'ORPHAN_RESOURCE_UNUSED',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_ORPHAN_RESOURCE_UNUSED',
            repairMode: 'review',
          },
          {
            code: 'OPF_AMBIGUOUS',
            severity: 'warning',
            fixable: true,
            messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
            repairMode: 'guided',
          },
          {
            code: 'ZIP_UNREADABLE',
            severity: 'error',
            fixable: true,
            messageKey: 'FIX.ISSUE_ZIP_UNREADABLE',
          },
        ],
      },
    });

    const sectionsDescriptor = Object.getOwnPropertyDescriptor(
      FixPage.prototype,
      'issueSections',
    );

    expect(
      sectionsDescriptor?.get?.call(ctx).map((section: { key: string; count: number }) => ({
        key: section.key,
        count: section.count,
      })),
    ).toEqual([
      { key: 'automatic', count: 2 },
      { key: 'confirmation', count: 1 },
      { key: 'manual', count: 1 },
    ]);
  });

  it('treats unresolved internal link issues as blocked', () => {
    const issue = {
      code: 'LINK_TARGET_MISSING',
      severity: 'warning',
      fixable: false,
      messageKey: 'FIX.ISSUE_LINK_TARGET_MISSING',
    } as const;
    const ctx = Object.create(FixPage.prototype);

    expect(FixPage.prototype.issueRepairMode.call(ctx, issue)).toBe(
      'not_repairable',
    );
  });

  it('treats a fixable empty spine as a review issue', () => {
    const issue = {
      code: 'SPINE_EMPTY',
      severity: 'error',
      fixable: true,
      messageKey: 'FIX.ISSUE_SPINE_EMPTY',
    } as const;
    const ctx = Object.create(FixPage.prototype);

    expect(FixPage.prototype.issueRepairMode.call(ctx, issue)).toBe('review');
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
