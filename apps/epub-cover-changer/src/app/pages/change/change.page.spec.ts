import { ProjectSaveState } from '@sheldrapps/image-workflow/editor';
import { ChangePage } from './change.page';
import { Capacitor } from '@capacitor/core';

describe('ChangePage', () => {
  it('uses PNG export for premium lossless mode', () => {
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'lossless' as const,
      getSelectedCoverExportOptions() {
        return {
          mimeType: 'image/png',
        };
      },
    };

    const mime = (
      ChangePage as unknown as {
        prototype: {
          resolveExportMimeType: (this: {
            adsRemoved: boolean;
            coverExportMode: 'lossless' | 'compressed';
            getSelectedCoverExportOptions: () => { mimeType: string } | null;
          }) => string | undefined;
        };
      }
    ).prototype.resolveExportMimeType.call(ctx);

    expect(mime).toBe('image/png');
  });

  it('uses JPEG export for premium compressed mode', () => {
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'compressed' as const,
      getSelectedCoverExportOptions() {
        return {
          mimeType: 'image/jpeg',
        };
      },
    };

    const mime = (
      ChangePage as unknown as {
        prototype: {
          resolveExportMimeType: (this: {
            adsRemoved: boolean;
            coverExportMode: 'lossless' | 'compressed';
            getSelectedCoverExportOptions: () => { mimeType: string } | null;
          }) => string | undefined;
        };
      }
    ).prototype.resolveExportMimeType.call(ctx);

    expect(mime).toBe('image/jpeg');
  });

  it('forces JPEG export for non-premium users', () => {
    const ctx = {
      adsRemoved: false,
      getSelectedCoverExportOptions: () => ({
        mimeType: 'image/jpeg',
      }),
    };

    const mime = (
      ChangePage as unknown as {
        prototype: {
          resolveExportMimeType: (this: {
            adsRemoved: boolean;
            getSelectedCoverExportOptions: () => { mimeType: string } | null;
          }) => string | undefined;
        };
      }
    ).prototype.resolveExportMimeType.call(ctx);

    expect(mime).toBe('image/jpeg');
  });

  it('disables lossy quality override for premium lossless mode', () => {
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'lossless' as const,
      getSelectedCoverExportOptions() {
        return {
          quality: undefined,
        };
      },
    };

    const quality = (
      ChangePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
            coverExportMode: 'lossless' | 'compressed';
            getSelectedCoverExportOptions: () => { quality?: number } | null;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBeUndefined();
  });

  it('uses JPEG quality override for premium compressed mode', () => {
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'compressed' as const,
      getSelectedCoverExportOptions() {
        return {
          quality: 0.92,
        };
      },
    };

    const quality = (
      ChangePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
            coverExportMode: 'lossless' | 'compressed';
            getSelectedCoverExportOptions: () => { quality?: number } | null;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBe(0.92);
  });

  it('uses compressed quality override for non-premium users', () => {
    const ctx = {
      adsRemoved: false,
      getSelectedCoverExportOptions: () => ({
        quality: 0.92,
      }),
    };

    const quality = (
      ChangePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
            getSelectedCoverExportOptions: () => { quality?: number } | null;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBe(0.92);
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
      ensureExportImageFile: jasmine
        .createSpy('ensureExportImageFile')
        .and.resolveTo(new File(['cover'], 'cover.png', { type: 'image/png' })),
      projectSaveState: new ProjectSaveState(),
      lastSavedFilename: undefined,
      generatedEpubFilename: undefined,
      modalCtrl: { create },
      translate: { instant: (key: string) => key },
    };
    ctx.projectSaveState.setProject('book.epub', 'copy');

    await (
      ChangePage as unknown as {
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

  it('persists premium export mode selection to settings-kit', async () => {
    const invalidateGeneratedOutputState = jasmine.createSpy(
      'invalidateGeneratedOutputState',
    );
    const set = jasmine.createSpy('set').and.resolveTo(undefined);
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'compressed' as const,
      exportImageFile: undefined as File | undefined,
      invalidateGeneratedOutputState,
      settings: { set },
    };

    await (
      ChangePage as unknown as {
        prototype: {
          onCoverExportModeChange: (
            this: {
              adsRemoved: boolean;
              coverExportMode: 'lossless' | 'compressed';
              exportImageFile: File | undefined;
              invalidateGeneratedOutputState: () => void;
              settings: {
                set: (value: {
                  coverExportMode: 'lossless' | 'compressed';
                }) => Promise<void>;
              };
            },
            mode: 'lossless' | 'compressed',
          ) => Promise<void>;
        };
      }
    ).prototype.onCoverExportModeChange.call(ctx, 'lossless');

    expect(ctx.coverExportMode).toBe('lossless');
    expect(invalidateGeneratedOutputState).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ coverExportMode: 'lossless' });
  });

  it('does not overwrite stored premium export preference for non-premium users', async () => {
    const invalidateGeneratedOutputState = jasmine.createSpy(
      'invalidateGeneratedOutputState',
    );
    const set = jasmine.createSpy('set').and.resolveTo(undefined);
    const ctx = {
      adsRemoved: false,
      coverExportMode: 'lossless' as const,
      exportImageFile: undefined as File | undefined,
      invalidateGeneratedOutputState,
      settings: { set },
    };

    await (
      ChangePage as unknown as {
        prototype: {
          onCoverExportModeChange: (
            this: {
              adsRemoved: boolean;
              coverExportMode: 'lossless' | 'compressed';
              exportImageFile: File | undefined;
              invalidateGeneratedOutputState: () => void;
              settings: {
                set: (value: {
                  coverExportMode: 'lossless' | 'compressed';
                }) => Promise<void>;
              };
            },
            mode: 'lossless' | 'compressed',
          ) => Promise<void>;
        };
      }
    ).prototype.onCoverExportModeChange.call(ctx, 'compressed');

    expect(ctx.coverExportMode).toBe('lossless');
    expect(invalidateGeneratedOutputState).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('targets PNG rewrite extension for premium lossless mode', () => {
    const ctx = {
      adsRemoved: true,
      coverEntryExtension: () => 'jpg' as const,
      getSelectedCoverExportOptions() {
        return {
          extension: 'png' as const,
        };
      },
    };

    const ext = (
      ChangePage as unknown as {
        prototype: {
          nativeRewriteTargetExtension: (this: {
            adsRemoved: boolean;
            coverEntryExtension: () => 'jpg' | 'png' | 'webp' | null;
            getSelectedCoverExportOptions: () => {
              extension: 'jpg' | 'png' | 'webp';
            } | null;
          }) => 'jpg' | 'png' | 'webp' | null;
        };
      }
    ).prototype.nativeRewriteTargetExtension.call(ctx);

    expect(ext).toBe('png');
  });

  it('targets JPG rewrite extension for premium compressed mode', () => {
    const ctx = {
      adsRemoved: true,
      coverEntryExtension: () => 'png' as const,
      getSelectedCoverExportOptions() {
        return {
          extension: 'jpg' as const,
        };
      },
    };

    const ext = (
      ChangePage as unknown as {
        prototype: {
          nativeRewriteTargetExtension: (this: {
            adsRemoved: boolean;
            coverEntryExtension: () => 'jpg' | 'png' | 'webp' | null;
            getSelectedCoverExportOptions: () => {
              extension: 'jpg' | 'png' | 'webp';
            } | null;
          }) => 'jpg' | 'png' | 'webp' | null;
        };
      }
    ).prototype.nativeRewriteTargetExtension.call(ctx);

    expect(ext).toBe('jpg');
  });

  it('targets JPG rewrite extension for non-premium users', () => {
    const ctx = {
      adsRemoved: false,
      coverEntryExtension: () => 'webp' as const,
      getSelectedCoverExportOptions: () => ({
        extension: 'jpg' as const,
      }),
    };

    const ext = (
      ChangePage as unknown as {
        prototype: {
          nativeRewriteTargetExtension: (this: {
            adsRemoved: boolean;
            coverEntryExtension: () => 'jpg' | 'png' | 'webp' | null;
            getSelectedCoverExportOptions: () => {
              extension: 'jpg' | 'png' | 'webp';
            } | null;
          }) => 'jpg' | 'png' | 'webp' | null;
        };
      }
    ).prototype.nativeRewriteTargetExtension.call(ctx);

    expect(ext).toBe('jpg');
  });

  it('tracks success event before asking for rating after web save', async () => {
    const trackSuccessEvent = jasmine
      .createSpy('trackSuccessEvent')
      .and.resolveTo(undefined);
    const maybeAskForRating = jasmine
      .createSpy('maybeAskForRating')
      .and.resolveTo(undefined);

    const ctx = {
      ratingService: {
        trackSuccessEvent,
        maybeAskForRating,
      },
    };

    await (
      ChangePage as unknown as {
        prototype: {
          maybeAskForRatingAfterSuccessfulSave: (
            this: {
              ratingService: {
                trackSuccessEvent: (eventName: string) => Promise<void>;
                maybeAskForRating: (context: {
                  source: string;
                  metadata: { flow: 'native' | 'web' };
                }) => Promise<void>;
              };
            },
            flow: 'native' | 'web',
          ) => Promise<void>;
        };
      }
    ).prototype.maybeAskForRatingAfterSuccessfulSave.call(ctx, 'web');

    expect(trackSuccessEvent).toHaveBeenCalledWith('epub_saved');
    expect(maybeAskForRating).toHaveBeenCalledWith({
      source: 'save-success',
      metadata: { flow: 'web' },
    });
    expect(trackSuccessEvent).toHaveBeenCalledBefore(maybeAskForRating);
  });

  it('asks for rating with native flow metadata after native save', async () => {
    const trackSuccessEvent = jasmine
      .createSpy('trackSuccessEvent')
      .and.resolveTo(undefined);
    const maybeAskForRating = jasmine
      .createSpy('maybeAskForRating')
      .and.resolveTo(undefined);

    const ctx = {
      ratingService: {
        trackSuccessEvent,
        maybeAskForRating,
      },
    };

    await (
      ChangePage as unknown as {
        prototype: {
          maybeAskForRatingAfterSuccessfulSave: (
            this: {
              ratingService: {
                trackSuccessEvent: (eventName: string) => Promise<void>;
                maybeAskForRating: (context: {
                  source: string;
                  metadata: { flow: 'native' | 'web' };
                }) => Promise<void>;
              };
            },
            flow: 'native' | 'web',
          ) => Promise<void>;
        };
      }
    ).prototype.maybeAskForRatingAfterSuccessfulSave.call(ctx, 'native');

    expect(trackSuccessEvent).toHaveBeenCalledWith('epub_saved');
    expect(maybeAskForRating).toHaveBeenCalledWith({
      source: 'save-success',
      metadata: { flow: 'native' },
    });
  });

  it('disables native rewrite when sdk gate is blocked', () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');

    const ctx = {
      nativeRewriteSessionDisabled: false,
      nativeRewriteSdkBlocked: true,
      epubRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            epubRewrite: { isSupported: () => boolean };
          }) => boolean;
        };
      }
    ).prototype.usesNativeRewrite.call(ctx);

    expect(nativeEnabled).toBeFalse();
  });

  it('disables native rewrite when session circuit breaker is active', () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');

    const ctx = {
      nativeRewriteSessionDisabled: true,
      nativeRewriteSdkBlocked: false,
      epubRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            epubRewrite: { isSupported: () => boolean };
          }) => boolean;
        };
      }
    ).prototype.usesNativeRewrite.call(ctx);

    expect(nativeEnabled).toBeFalse();
  });

  it('keeps native rewrite enabled when safety gates are clear', () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');

    const ctx = {
      nativeRewriteSessionDisabled: false,
      nativeRewriteSdkBlocked: false,
      epubRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            epubRewrite: { isSupported: () => boolean };
          }) => boolean;
        };
      }
    ).prototype.usesNativeRewrite.call(ctx);

    expect(nativeEnabled).toBeTrue();
  });

  it('allows scratch start when epub exists and app is idle', () => {
    const ctx = {
      isPickingImage: false,
      isExporting: false,
      hasValidEpub: () => true,
    };

    const canStartScratch = (
      ChangePage as unknown as {
        prototype: {
          canStartScratch: (this: {
            isPickingImage: boolean;
            isExporting: boolean;
            hasValidEpub: () => boolean;
          }) => boolean;
        };
      }
    ).prototype.canStartScratch.call(ctx);

    expect(canStartScratch).toBeTrue();
  });

  it('rehydrates generated epub before opening project editor', async () => {
    const sourceFile = new File(['cover'], 'cover.jpg', {
      type: 'image/jpeg',
    });
    const sourceEpubFile = new File(['epub'], 'book.epub', {
      type: 'application/epub+zip',
    });
    const resetWorkflowForNewEpub = jasmine
      .createSpy('resetWorkflowForNewEpub')
      .and.resolveTo(undefined);
    const hydrateProjectEpubContext = jasmine
      .createSpy('hydrateProjectEpubContext')
      .and.resolveTo(undefined);
    const resolveProjectCoverEntryPath = jasmine
      .createSpy('resolveProjectCoverEntryPath')
      .and.resolveTo(undefined);
    const setProject = jasmine.createSpy('setProject');
    const revokePreviewUrl = jasmine.createSpy('revokePreviewUrl');
    const openEditor = jasmine.createSpy('openEditor').and.resolveTo(undefined);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:cover');

    const ctx = {
      fileService: {
        loadProjectByFilename: jasmine.createSpy('loadProjectByFilename').and.resolveTo({
          snapshot: {
            coverFilename: 'book.epub',
            sourceInfo: undefined,
            target: { width: 1236, height: 1648 },
            cropState: { zoom: 1 },
          },
          sourceFile,
        }),
        loadGeneratedEpubByFilename: jasmine
          .createSpy('loadGeneratedEpubByFilename')
          .and.resolveTo(sourceEpubFile),
      },
      imagePipe: {
        getDimensions: jasmine
          .createSpy('getDimensions')
          .and.resolveTo({ width: 1200, height: 1600 }),
      },
      formatOptions: [{ id: 'epub', target: { width: 1236, height: 1648 } }],
      sourceInfoToDims: () => null,
      resetWorkflowForNewEpub,
      hydrateProjectEpubContext,
      resolveProjectCoverEntryPath,
      projectSaveState: { setProject },
      revokePreviewUrl,
      openEditor,
      activeProjectFilename: undefined as string | undefined,
      generatedEpubFilename: undefined as string | undefined,
      lastSavedFilename: undefined as string | undefined,
      projectEditReturnUrl: null as string | null,
    };

    const opened = await (
      ChangePage as unknown as {
        prototype: {
          openProjectByFilename: (
            this: typeof ctx,
            filename: string,
            editMode?: 'overwrite' | 'copy',
          ) => Promise<boolean>;
        };
      }
    ).prototype.openProjectByFilename.call(ctx, 'project.json', 'overwrite');

    expect(opened).toBeTrue();
    expect(ctx.fileService.loadGeneratedEpubByFilename).toHaveBeenCalledWith(
      'book.epub',
    );
    expect(resetWorkflowForNewEpub).toHaveBeenCalled();
    expect(hydrateProjectEpubContext).toHaveBeenCalledWith(
      'book.epub',
      sourceEpubFile,
    );
    expect(resolveProjectCoverEntryPath).toHaveBeenCalled();
    expect(setProject).toHaveBeenCalledWith('book.epub', 'overwrite');
    expect(ctx.activeProjectFilename).toBe('book.epub');
    expect(ctx.generatedEpubFilename).toBe('book.epub');
    expect(ctx.lastSavedFilename).toBe('book.epub');
    expect(openEditor).toHaveBeenCalledWith('image');
    expect(ctx.projectEditReturnUrl).toBeNull();
  });
});
