import { CreatePage } from './create.page';

describe('CreatePage', () => {
  it('uses PNG export for premium users', () => {
    const ctx = { adsRemoved: true };

    const mime = (
      CreatePage as unknown as {
        prototype: {
          resolveExportMimeType: (this: {
            adsRemoved: boolean;
          }) => string | undefined;
        };
      }
    ).prototype.resolveExportMimeType.call(ctx);

    expect(mime).toBe('image/png');
  });

  it('keeps default export MIME for non-premium users', () => {
    const ctx = { adsRemoved: false };

    const mime = (
      CreatePage as unknown as {
        prototype: {
          resolveExportMimeType: (this: {
            adsRemoved: boolean;
          }) => string | undefined;
        };
      }
    ).prototype.resolveExportMimeType.call(ctx);

    expect(mime).toBeUndefined();
  });

  it('disables lossy quality override for premium users', () => {
    const ctx = { adsRemoved: true };

    const quality = (
      CreatePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBeUndefined();
  });

  it('uses quality override for non-premium users', () => {
    const ctx = { adsRemoved: false };

    const quality = (
      CreatePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBe(1);
  });

  it('requires an applied editor cover before generating', () => {
    const ctx = {
      selectedModel: { id: 'pw', width: 1072, height: 1448 },
      workingImageFile: new File(['x'], 'cover.jpg', { type: 'image/jpeg' }),
      imageErrorKey: undefined,
    };

    const canExport = (
      CreatePage as unknown as {
        prototype: {
          canExport: (this: {
            selectedModel?: unknown;
            workingImageFile?: File;
            imageErrorKey?: string;
            cropState?: unknown;
            activeProjectHistory?: unknown;
          }) => boolean;
        };
      }
    ).prototype.canExport.call(ctx);

    expect(canExport).toBeFalse();
  });

  it('allows generate once the editor has applied a cover', () => {
    const ctx = {
      selectedModel: { id: 'pw', width: 1072, height: 1448 },
      workingImageFile: new File(['x'], 'cover.jpg', { type: 'image/jpeg' }),
      imageErrorKey: undefined,
      cropState: {},
    };

    const canExport = (
      CreatePage as unknown as {
        prototype: {
          canExport: (this: {
            selectedModel?: unknown;
            workingImageFile?: File;
            imageErrorKey?: string;
            cropState?: unknown;
            activeProjectHistory?: unknown;
          }) => boolean;
        };
      }
    ).prototype.canExport.call(ctx);

    expect(canExport).toBeTrue();
  });

  it('allows scratch start when model exists and app is idle', () => {
    const ctx = {
      selectedModel: { id: 'pw', width: 1072, height: 1448 },
      isPickingImage: false,
      isExporting: false,
    };

    const canStartScratch = (
      CreatePage as unknown as {
        prototype: {
          canStartScratch: (this: {
            selectedModel?: unknown;
            isPickingImage: boolean;
            isExporting: boolean;
          }) => boolean;
        };
      }
    ).prototype.canStartScratch.call(ctx);

    expect(canStartScratch).toBeTrue();
  });

  it('preserves project save context when selecting a new image during project edit', async () => {
    const clear = jasmine.createSpy('clear');
    const applySmallWarn = jasmine
      .createSpy('applySmallWarn')
      .and.resolveTo(undefined);
    const syncActiveProjectSourceInfo = jasmine.createSpy(
      'syncActiveProjectSourceInfo',
    );
    const completeInteraction = jasmine
      .createSpy('completeInteraction')
      .and.resolveTo(undefined);
    const source = new File(['source'], 'new-cover.jpg', {
      type: 'image/jpeg',
    });
    const working = new File(['working'], 'new-cover-working.jpg', {
      type: 'image/jpeg',
    });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:cover');

    const ctx = {
      setBusy: jasmine.createSpy('setBusy'),
      imagePipe: {
        validateBasic: jasmine.createSpy('validateBasic').and.returnValue(null),
        materializeFile: jasmine
          .createSpy('materializeFile')
          .and.resolveTo(source),
        getDimensions: jasmine
          .createSpy('getDimensions')
          .and.resolveTo({ width: 1200, height: 1600 }),
        normalizeFile: jasmine.createSpy('normalizeFile').and.resolveTo(null),
        prepareWorkingImage: jasmine
          .createSpy('prepareWorkingImage')
          .and.resolveTo(working),
      },
      clearImageError: jasmine.createSpy('clearImageError'),
      clearImageWarn: jasmine.createSpy('clearImageWarn'),
      applySmallWarn,
      revokePreviewUrl: jasmine.createSpy('revokePreviewUrl'),
      homeTour: { completeInteraction },
      projectSaveState: {
        clear,
        hasProject: () => true,
      },
      activeProjectFilename: 'book.epub',
      activeProjectHistory: { steps: [] },
      syncActiveProjectSourceInfo,
    };
    const input = {
      files: [new File(['picked'], 'picked.jpg', { type: 'image/jpeg' })],
      value: 'picked.jpg',
    } as unknown as HTMLInputElement;

    await (
      CreatePage as unknown as {
        prototype: {
          onImageSelected: (
            this: typeof ctx,
            event: Event,
          ) => Promise<void>;
        };
      }
    ).prototype.onImageSelected.call(ctx, {
      target: input,
    } as unknown as Event);

    expect(clear).not.toHaveBeenCalled();
    expect(ctx.activeProjectFilename).toBe('book.epub');
    expect(ctx.activeProjectHistory).toBeNull();
    expect(syncActiveProjectSourceInfo).toHaveBeenCalled();
    expect(applySmallWarn).toHaveBeenCalledWith('image-selected', {
      width: 1200,
      height: 1600,
    });
  });

  it('preserves project save context when model changes during project edit', async () => {
    const clear = jasmine.createSpy('clear');
    const set = jasmine.createSpy('set').and.resolveTo(undefined);

    const ctx = {
      generatedEpubBytes: new Uint8Array([1, 2, 3]),
      generatedEpubFilename: 'copy.epub',
      lastSavedFilename: 'copy.epub',
      wasAutoSaved: true,
      exportImageFile: new File(['export'], 'cover.jpg', {
        type: 'image/jpeg',
      }),
      activeProjectFilename: 'book.epub',
      activeProjectHistory: { steps: [] },
      activeProjectSourceInfo: { name: 'cover.jpg' },
      projectSaveState: { clear },
      resolveCurrentSelection: () => ({
        brandId: 'kindle',
        groupId: 'paperwhite',
        modelId: 'pw',
        model: { id: 'pw', width: 1072, height: 1448 },
      }),
      settings: { set },
      workingImageFile: undefined,
      workingImageDims: undefined,
      applySmallWarn: jasmine.createSpy('applySmallWarn').and.resolveTo(undefined),
    };

    await (
      CreatePage as unknown as {
        prototype: {
          persistModelSelection: (
            this: typeof ctx,
            opts: { applyWarn: boolean },
          ) => Promise<void>;
        };
      }
    ).prototype.persistModelSelection.call(ctx, { applyWarn: false });

    expect(clear).not.toHaveBeenCalled();
    expect(ctx.activeProjectFilename).toBe('book.epub');
    expect(ctx.activeProjectHistory).toBeNull();
    expect(ctx.activeProjectSourceInfo).toEqual({ name: 'cover.jpg' });
    expect(set).toHaveBeenCalledWith({
      brandId: 'kindle',
      modelId: 'pw',
    });
  });

  it('uses original project filename as save suggestion when editing a copy', async () => {
    const present = jasmine.createSpy('present').and.resolveTo(undefined);
    const onWillDismiss = jasmine
      .createSpy('onWillDismiss')
      .and.resolveTo({ role: 'cancel' });
    const create = jasmine.createSpy('create').and.resolveTo({
      present,
      onWillDismiss,
    });

    const ctx = {
      canSaveShare: () => true,
      projectSaveState: {
        isOverwriteMode: () => false,
        getOriginalFilename: () => 'book.epub',
        getProjectFilename: () => 'book.epub',
        getSuggestedBaseName: () => 'book',
      },
      lastSavedFilename: undefined,
      generatedEpubFilename: undefined,
      modalCtrl: { create },
      translate: { instant: (key: string) => key },
      ensureEpubExtension: (name: string) => name,
    };

    await (
      CreatePage as unknown as {
        prototype: {
          onSave: (this: typeof ctx) => Promise<void>;
        };
      }
    ).prototype.onSave.call(ctx);

    expect(create).toHaveBeenCalled();
    expect(create.calls.mostRecent().args[0].componentProps.initialFilename).toBe(
      'book',
    );
  });

  it('persists editor snapshots from the current project filename during overwrite', async () => {
    const saveLocalProjectSnapshot = jasmine
      .createSpy('saveLocalProjectSnapshot')
      .and.resolveTo(undefined);
    const emit = jasmine.createSpy('emit');
    type EditorResultLike = {
      file: File;
      history: { steps: string[] };
      renderedBlob: Blob;
      renderedMimeType: string;
    };

    const ctx = {
      activeProjectFilename: undefined,
      activeProjectHistory: { steps: [] },
      projectSaveState: {
        getCurrentFilename: () => 'book.epub',
        getProjectFilename: () => 'book.epub',
      },
      saveLocalProjectSnapshot,
      coversEvents: { emit },
    };

    const result = {
      file: new File(['thumb'], 'thumb.png', { type: 'image/png' }),
      history: { steps: ['crop'] },
      renderedBlob: new Blob(['thumb'], { type: 'image/png' }),
      renderedMimeType: 'image/png',
    };

    await (
      CreatePage as unknown as {
        prototype: {
          persistProjectSnapshotFromEditorResult: (
            this: typeof ctx,
            result: EditorResultLike,
          ) => Promise<void>;
        };
      }
    ).prototype.persistProjectSnapshotFromEditorResult.call(ctx, result);

    expect(saveLocalProjectSnapshot).toHaveBeenCalledWith(
      'book.epub',
      jasmine.any(File),
      result.history,
    );
    expect(emit).toHaveBeenCalledWith({
      type: 'saved',
      filename: 'book.epub',
    });
  });

  it('keeps overwrite mode on the original project filename even if current filename is missing', async () => {
    const exportFile = new File(['export'], 'cover.png', {
      type: 'image/png',
    });
    const saveGeneratedEpub = jasmine
      .createSpy('saveGeneratedEpub')
      .and.resolveTo(undefined);
    const saveLocalProjectSnapshot = jasmine
      .createSpy('saveLocalProjectSnapshot')
      .and.resolveTo(undefined);
    const setCurrentFilename = jasmine.createSpy('setCurrentFilename');
    const emit = jasmine.createSpy('emit');
    const logSaveFlow = jasmine.createSpy('logSaveFlow');
    const consumeAdFallbackAttemptAfterSuccess = jasmine
      .createSpy('consumeAdFallbackAttemptAfterSuccess')
      .and.resolveTo(undefined);
    const showToast = jasmine.createSpy('showToast').and.resolveTo(undefined);
    const ensureExportImageFile = jasmine
      .createSpy('ensureExportImageFile')
      .and.resolveTo(exportFile);
    const ensureGeneratedEpubForCurrentState = jasmine
      .createSpy('ensureGeneratedEpubForCurrentState')
      .and.resolveTo({
        bytes: new Uint8Array([1, 2, 3]),
        filename: 'book.epub',
      });
    const zone = {
      run: jasmine.createSpy('run').and.callFake((fn: () => void) => fn()),
    };

    const ctx = {
      setBusy: jasmine.createSpy('setBusy'),
      ensureExportImageFile,
      ensureGeneratedEpubForCurrentState,
      fileService: {
        saveGeneratedEpub,
      },
      buildCoverProcessingMetadata: () => ({}),
      saveLocalProjectSnapshot,
      projectSaveState: {
        isOverwriteMode: () => true,
        hasCurrentFilename: () => false,
        getCurrentFilename: () => null,
        getOriginalFilename: () => 'book.epub',
        getProjectFilename: () => 'book.epub',
        getOverwriteFilename: () => 'book.epub',
        setCurrentFilename,
      },
      activeProjectFilename: 'book.epub',
      lastSavedFilename: undefined,
      generatedEpubFilename: undefined,
      generatedEpubBytes: undefined,
      wasAutoSaved: true,
      coversEvents: { emit },
      logSaveFlow,
      consumeAdFallbackAttemptAfterSuccess,
      showToast,
      zone,
    };

    await (
      CreatePage as unknown as {
        prototype: {
          performSave: (this: typeof ctx, filename: string) => Promise<void>;
        };
      }
    ).prototype.performSave.call(ctx, 'book.epub');

    expect(saveGeneratedEpub).toHaveBeenCalledWith(
      jasmine.objectContaining({
        filename: 'book.epub',
        overwriteExisting: true,
      }),
    );
    expect(saveLocalProjectSnapshot).toHaveBeenCalledWith(
      'book.epub',
      exportFile,
    );
    expect(setCurrentFilename).toHaveBeenCalledWith('book.epub');
    expect(emit).toHaveBeenCalledWith({
      type: 'saved',
      filename: 'book.epub',
    });
  });

  it('auto-saves overwrite projects to the original filename when creating the cover', async () => {
    const exportFile = new File(['export'], 'cover.png', {
      type: 'image/png',
    });
    const saveGeneratedEpub = jasmine
      .createSpy('saveGeneratedEpub')
      .and.resolveTo(undefined);
    const saveLocalProjectSnapshot = jasmine
      .createSpy('saveLocalProjectSnapshot')
      .and.resolveTo(undefined);
    const setCurrentFilename = jasmine.createSpy('setCurrentFilename');
    const emit = jasmine.createSpy('emit');
    const logSaveFlow = jasmine.createSpy('logSaveFlow');
    const consumeAdFallbackAttemptAfterSuccess = jasmine
      .createSpy('consumeAdFallbackAttemptAfterSuccess')
      .and.resolveTo(undefined);
    const showToast = jasmine.createSpy('showToast').and.resolveTo(undefined);
    const trackSuccessEvent = jasmine
      .createSpy('trackSuccessEvent')
      .and.resolveTo(undefined);
    const maybeAskForRating = jasmine
      .createSpy('maybeAskForRating')
      .and.resolveTo(undefined);
    const completeInteraction = jasmine
      .createSpy('completeInteraction')
      .and.resolveTo(undefined);
    const ensureExportImageFile = jasmine
      .createSpy('ensureExportImageFile')
      .and.resolveTo(exportFile);
    const generateEpubBytes = jasmine
      .createSpy('generateEpubBytes')
      .and.resolveTo({
        bytes: new Uint8Array([1, 2, 3]),
        filename: 'kindle_cover.epub',
      });
    const zone = {
      run: jasmine.createSpy('run').and.callFake((fn: () => void) => fn()),
    };

    const ctx = {
      selectedModel: { id: 'pw' },
      setBusy: jasmine.createSpy('setBusy'),
      ensureExportImageFile,
      fileService: {
        generateEpubBytes,
        saveGeneratedEpub,
      },
      buildCoverProcessingMetadata: () => ({}),
      saveLocalProjectSnapshot,
      projectSaveState: {
        isOverwriteMode: () => true,
        hasCurrentFilename: () => true,
        getCurrentFilename: () => null,
        getOriginalFilename: () => 'book.epub',
        getProjectFilename: () => 'book.epub',
        getOverwriteFilename: () => 'book.epub',
        setCurrentFilename,
      },
      generatedEpubBytes: undefined,
      generatedEpubFilename: undefined,
      lastSavedFilename: undefined,
      wasAutoSaved: false,
      coversEvents: { emit },
      logSaveFlow,
      consumeAdFallbackAttemptAfterSuccess,
      showToast,
      ratingService: {
        trackSuccessEvent,
        maybeAskForRating,
      },
      homeTour: {
        completeInteraction,
      },
      zone,
      resolveUniqueEpubFilename: jasmine.createSpy('resolveUniqueEpubFilename'),
    };

    await (
      CreatePage as unknown as {
        prototype: {
          generateCoverWithCurrentSelection: (
            this: typeof ctx,
          ) => Promise<void>;
        };
      }
    ).prototype.generateCoverWithCurrentSelection.call(ctx);

    expect(generateEpubBytes).toHaveBeenCalledWith(
      jasmine.objectContaining({
        modelId: 'pw',
        filename: 'book.epub',
      }),
    );
    expect(saveGeneratedEpub).toHaveBeenCalledWith(
      jasmine.objectContaining({
        filename: 'book.epub',
        overwriteExisting: true,
      }),
    );
    expect(saveLocalProjectSnapshot).toHaveBeenCalledWith(
      'book.epub',
      exportFile,
    );
    expect(setCurrentFilename).toHaveBeenCalledWith('book.epub');
    expect(emit).toHaveBeenCalledWith({
      type: 'saved',
      filename: 'book.epub',
    });
  });

  it('restores overwrite project filename from the latest editor session when returning from editor', async () => {
    const setProject = jasmine.createSpy('setProject');
    const applyCropResult = jasmine.createSpy('applyCropResult').and.resolveTo();
    const file = new File(['edited'], 'edited.png', { type: 'image/png' });
    const ctx = {
      lastEditorSessionId: undefined,
      editorSession: {
        getSessionForLatestResult: jasmine.createSpy('getSessionForLatestResult').and.returnValue({
          project: {
            filename: 'book.epub',
            mode: 'overwrite',
          },
        }),
        consumeLatestResult: jasmine.createSpy('consumeLatestResult').and.returnValue({
          file,
        }),
      },
      projectSaveState: {
        setProject,
      },
      applyCropResult,
    };

    await (
      CreatePage as unknown as {
        prototype: {
          consumeEditorResult: (this: typeof ctx) => Promise<void>;
        };
      }
    ).prototype.consumeEditorResult.call(ctx);

    expect(setProject).toHaveBeenCalledWith('book.epub', 'overwrite');
    expect(applyCropResult).toHaveBeenCalledWith({ file });
  });

  it('restores the preview from an editor result after the host is recreated', async () => {
    const file = new File(['edited'], 'edited.png', { type: 'image/png' });
    const renderedBlob = new Blob(['rendered'], { type: 'image/png' });
    const setPreviewUrl = jasmine.createSpy('setPreviewUrl');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:edited-preview');

    const ctx = {
      cropState: undefined,
      workingImageFile: undefined,
      exportImageFile: new File(['old'], 'old.png', { type: 'image/png' }),
      generatedEpubBytes: new Uint8Array([1]),
      generatedEpubFilename: 'old.epub',
      lastSavedFilename: 'old.epub',
      wasAutoSaved: true,
      selectedImageName: undefined,
      workingImageDims: undefined,
      imageErrorKey: 'IMAGE.ERROR',
      clearImageError: jasmine.createSpy('clearImageError'),
      clearImageWarn: jasmine.createSpy('clearImageWarn'),
      imagePipe: {
        getDimensions: jasmine
          .createSpy('getDimensions')
          .and.resolveTo({ width: 1200, height: 1600 }),
      },
      applySmallWarn: jasmine.createSpy('applySmallWarn').and.resolveTo(),
      extractEditorExportDims: () => undefined,
      setPreviewUrl,
      markEditorTourSeen: jasmine.createSpy('markEditorTourSeen').and.resolveTo(),
      homeTour: {
        completeInteraction: jasmine.createSpy('completeInteraction').and.resolveTo(),
      },
    };

    await (
      CreatePage as unknown as {
        prototype: {
          applyCropResult: (
            this: typeof ctx,
            result: { file: File; renderedBlob: Blob },
          ) => Promise<void>;
        };
      }
    ).prototype.applyCropResult.call(ctx, { file, renderedBlob });

    expect(ctx.workingImageFile).toBe(file);
    expect(ctx.exportImageFile).toBeUndefined();
    expect(setPreviewUrl).toHaveBeenCalledWith('blob:edited-preview');
  });
});
