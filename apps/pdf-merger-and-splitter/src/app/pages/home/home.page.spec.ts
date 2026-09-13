import { signal } from '@angular/core';

import { type CropperResult } from '@sheldrapps/image-workflow';
import { HomePage } from './home.page';
import { mergedPdfOutputName, splitPdfOutputName } from '../../pdf/pdf-output-naming';
import { PdfRewriteError } from '../../pdf/pdf-rewrite.service';

describe('HomePage', () => {
  it('shows only the operation step before merge or split is selected', () => {
    const mergeSteps = [
      { id: 'merge-split', key: 'HOME.STEPPER.MERGE_SPLIT' },
      { id: 'select', key: 'HOME.STEPPER.SORT' },
    ];
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal(null),
      mergeSteps,
      splitSteps: [],
      hasCurrentToc: signal(false),
    });

    const getWorkflowSteps = (HomePage.prototype as unknown as {
      getWorkflowSteps(): readonly typeof mergeSteps[number][];
    }).getWorkflowSteps;

    expect(getWorkflowSteps.call(ctx)).toEqual([mergeSteps[0]]);
  });

  it('derives PDF output names from the source document like EMAS', () => {
    expect(mergedPdfOutputName('Book.pdf')).toBe('Book_merged.pdf');
    expect(splitPdfOutputName('Book.pdf', 2)).toBe('Book - 2.pdf');
    expect(mergedPdfOutputName(undefined)).toBe('merged_merged.pdf');
    expect(splitPdfOutputName(undefined, 1)).toBe('split - 1.pdf');
  });

  it('skips directly to review without adding a cover page', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(new File(['cover'], 'cover.jpg')),
      coverImageUri: signal<string | null>('file:///cover.jpg'),
      coverPreviewUri: signal<string | null>('data:image/jpeg;base64,Y292ZXI='),
      coverMasterBlob: new Blob(['cover']),
      steps: () => [{ id: 'select' }, { id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(1),
    });

    HomePage.prototype.skipCover.call(ctx);

    expect(ctx.cover()).toEqual({ source: 'none' });
    expect(ctx.coverFile()).toBeNull();
    expect(ctx.coverImageUri()).toBeNull();
    expect(ctx.coverPreviewUri()).toBeNull();
    expect(ctx.workflowStep()).toBe(3);
  });

  it('keeps the adjusted editor image available for the visible preview', async () => {
    const file = new File(['adjusted-cover'], 'adjusted-cover.jpg', { type: 'image/jpeg' });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      editorSession: {
        getSession: () => null,
        consumeResult: () => ({ file, editorMasterBlob: file }),
      },
      rewrite: {
        stageCoverImage: async () => 'file:///adjusted-cover.jpg',
      },
      lastEditorSessionId: 'cover-session',
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(null),
      coverImageUri: signal<string | null>(null),
      coverPreviewUri: signal<string | null>(null),
      coverMasterBlob: undefined,
      editorFlowEpoch: 0,
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(1),
      applySelectedExportQuality: async () => undefined,
    });

    const consumeEditorResult = (HomePage.prototype as unknown as {
      consumeEditorResult(): Promise<void>;
    }).consumeEditorResult;
    await consumeEditorResult.call(ctx);

    expect(ctx.coverFile()).toBe(file);
    expect(ctx.coverImageUri()).toBe('file:///adjusted-cover.jpg');
    expect(ctx.coverPreviewUri()).toContain('data:image/jpeg');
    expect(ctx.workflowStep()).toBe(2);
  });

  it('stages the rendered editor image instead of the original source image', async () => {
    const sourceFile = new File(['source'], 'cover.jpg', { type: 'image/jpeg' });
    const renderedBlob = new Blob(['rendered'], { type: 'image/png' });
    const stageCoverImage = jasmine
      .createSpy('stageCoverImage')
      .and.resolveTo('file:///rendered-cover.png');
    const renderedFilePreview = 'data:image/png;base64,cmVuZGVyZWQ=';
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      rewrite: { stageCoverImage },
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(sourceFile),
      coverImageUri: signal<string | null>(null),
      coverPreviewUri: signal<string | null>(null),
      coverMasterBlob: undefined,
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(1),
      applySelectedExportQuality: async () => undefined,
      createPreviewUri: async () => renderedFilePreview,
    });

    const applyEditorResult = (HomePage.prototype as unknown as {
      applyEditorResult(result: CropperResult): Promise<void>;
    }).applyEditorResult;
    await applyEditorResult.call(ctx, {
      file: sourceFile,
      renderedBlob,
      renderedMimeType: 'image/png',
      editorMasterBlob: new Blob(['master'], { type: 'image/png' }),
    });

    const stagedFile = stageCoverImage.calls.mostRecent().args[0] as File;
    expect(stagedFile.name).toBe('cover_rendered.png');
    expect(await stagedFile.text()).toBe('rendered');
    expect(ctx.coverFile()!.name).toBe('cover_rendered.png');
    expect(ctx.coverPreviewUri()).toBe(renderedFilePreview);
  });

  it('does not start a second export while the first one is busy', async () => {
    const canContinue = jasmine.createSpy('canContinue').and.returnValue(true);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      isBusy: signal(true),
      selectedMode: signal('split'),
      canContinue,
    });

    const execute = (HomePage.prototype as unknown as {
      execute(): Promise<void>;
    }).execute;
    await execute.call(ctx);

    expect(canContinue).not.toHaveBeenCalled();
    expect(ctx.isBusy()).toBeTrue();
  });

  it('does not report a split export failure as an unavailable native engine', () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      selectedMode: signal('split'),
    });

    const errorKeyFor = (HomePage.prototype as unknown as {
      errorKeyFor(error: unknown): string;
    }).errorKeyFor;

    expect(errorKeyFor.call(ctx, new PdfRewriteError('PUBLIC_EXPORT_FAILED'))).toBe(
      'HOME.OPERATION.SPLIT_FAILURE_BODY',
    );
    expect(errorKeyFor.call(ctx, new PdfRewriteError('NATIVE_ENGINE_UNAVAILABLE'))).toBe(
      'PDF_WORKFLOW.NATIVE_ENGINE_NOTICE',
    );
  });

  it('returns the flow to its initial state and releases transient resources', async () => {
    const cleanupSession = jasmine.createSpy('cleanupSession').and.resolveTo(undefined);
    const releaseStagedCoverImage = jasmine.createSpy('releaseStagedCoverImage').and.resolveTo(undefined);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      editorFlowEpoch: 0,
      sessionId: signal('pdf-session'),
      coverImageUri: signal<string | null>('staged-cover'),
      selectedMode: signal('split'),
      pendingMode: signal('split'),
      mergePdfs: signal([{ id: 'pdf' }]),
      splitPdf: signal({ id: 'pdf' }),
      cover: signal({ source: 'editor' }),
      coverFile: signal<File | null>(new File(['cover'], 'cover.jpg')),
      coverPreviewUri: signal<string | null>('data:image/jpeg;base64,Y292ZXI='),
      coverMasterBlob: new Blob(['cover']),
      lastEditorSessionId: 'editor-session',
      editorSession: {
        consumeResult: jasmine.createSpy('consumeResult'),
        consumeSession: jasmine.createSpy('consumeSession'),
      },
      rewrite: { cleanupSession, releaseStagedCoverImage },
      resetSplitConfiguration: jasmine.createSpy('resetSplitConfiguration'),
      workflowStep: signal(4),
      errorKey: signal('error'),
      pickerErrorKey: signal('picker-error'),
      fidelityWarningsAcknowledged: signal(true),
      resultWarnings: signal(['warning']),
      operationCompleted: signal(true),
      operationOutputs: signal([{ fileName: 'part.pdf', sizeBytes: 1 }]),
      isRebuildingExportQuality: signal(true),
      isBusy: signal(true),
      previewObjectUrls: new Set<string>(),
    });

    const clearFlowState = (HomePage.prototype as unknown as {
      clearFlowState(): Promise<void>;
    }).clearFlowState;
    await clearFlowState.call(ctx);

    expect(cleanupSession).toHaveBeenCalledOnceWith('pdf-session');
    expect(releaseStagedCoverImage).toHaveBeenCalledOnceWith('staged-cover');
    expect(ctx.editorSession.consumeResult).toHaveBeenCalledOnceWith('editor-session');
    expect(ctx.editorSession.consumeSession).toHaveBeenCalledOnceWith('editor-session');
    expect(ctx.sessionId()).toBeNull();
    expect(ctx.selectedMode()).toBeNull();
    expect(ctx.coverImageUri()).toBeNull();
    expect(ctx.coverPreviewUri()).toBeNull();
    expect(ctx.errorKey()).toBeNull();
    expect(ctx.pickerErrorKey()).toBeNull();
    expect(ctx.operationCompleted()).toBeFalse();
    expect(ctx.isRebuildingExportQuality()).toBeFalse();
    expect(ctx.isBusy()).toBeFalse();
  });

  it('marks the adjust step while the cover editor is open', async () => {
    const coverFile = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(coverFile),
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(0),
      editorSession: {
        createSession: jasmine
          .createSpy('createSession')
          .and.returnValue('cover-session'),
      },
      router: {
        navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      },
    });

    const openCoverEditor = (HomePage.prototype as unknown as {
      openCoverEditor(sourceMode: 'image' | 'scratch', file?: File): Promise<void>;
    }).openCoverEditor;
    await openCoverEditor.call(ctx, 'image', coverFile);

    expect(ctx.workflowStep()).toBe(1);
    expect(ctx.editorSession.createSession).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ file: coverFile, sourceMode: 'image' }),
    );
  });

  it('lands on review when the editor applies Done before navigation', async () => {
    const coverFile = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' });
    const adjustedCover = new File(['adjusted'], 'adjusted.jpg', { type: 'image/jpeg' });
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(coverFile),
      coverImageUri: signal<string | null>(null),
      coverPreviewUri: signal<string | null>(null),
      coverMasterBlob: undefined,
      editorFlowEpoch: 0,
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(0),
      editorSession: {
        createSession: jasmine
          .createSpy('createSession')
          .and.returnValue('cover-session'),
        consumeResult: jasmine.createSpy('consumeResult'),
      },
      rewrite: {
        stageCoverImage: async () => 'file:///adjusted.jpg',
      },
      applySelectedExportQuality: async () => undefined,
      router: {
        navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      },
    });

    const openCoverEditor = (HomePage.prototype as unknown as {
      openCoverEditor(sourceMode: 'image' | 'scratch', file?: File): Promise<void>;
    }).openCoverEditor;
    await openCoverEditor.call(ctx, 'image', coverFile);

    const sessionOptions = ctx.editorSession.createSession.calls.mostRecent().args[0] as {
      onResultApplied?: (result: CropperResult) => Promise<void>;
    };
    await sessionOptions.onResultApplied?.({ file: adjustedCover } as CropperResult);

    expect(ctx.coverFile()).toBe(adjustedCover);
    expect(ctx.workflowStep()).toBe(2);
    expect(ctx.editorSession.consumeResult).toHaveBeenCalledOnceWith('cover-session');
  });

  it('does not enter the adjust step without an editable cover', async () => {
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      cover: signal({ source: 'none' }),
      coverFile: signal<File | null>(null),
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(0),
      operationCompleted: signal(false),
    });

    await HomePage.prototype.onWorkflowStepSelected.call(ctx, 1);

    expect(ctx.workflowStep()).toBe(0);
  });

  it('opens the editor instead of rendering the adjust step', async () => {
    const coverFile = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' });
    const openExistingCoverEditor = jasmine
      .createSpy('openExistingCoverEditor')
      .and.resolveTo(undefined);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      cover: signal({ source: 'image' }),
      coverFile: signal<File | null>(coverFile),
      steps: () => [{ id: 'cover' }, { id: 'adjust' }, { id: 'review' }],
      workflowStep: signal(2),
      operationCompleted: signal(false),
      openExistingCoverEditor,
    });

    await HomePage.prototype.onWorkflowStepSelected.call(ctx, 1);

    expect(openExistingCoverEditor).toHaveBeenCalledOnceWith(2);
    expect(ctx.workflowStep()).toBe(2);
  });
});
