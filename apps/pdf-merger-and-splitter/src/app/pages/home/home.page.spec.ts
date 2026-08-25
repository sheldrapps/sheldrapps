import { signal } from '@angular/core';

import { type CropperResult } from '@sheldrapps/image-workflow';
import { HomePage } from './home.page';
import { mergedPdfOutputName, splitPdfOutputName } from '../../pdf/pdf-output-naming';

describe('HomePage', () => {
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
