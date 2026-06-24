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

    expect(trackSuccessEvent).toHaveBeenCalledWith('pdf_saved');
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

    expect(trackSuccessEvent).toHaveBeenCalledWith('pdf_saved');
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
      pdfRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            pdfRewrite: { isSupported: () => boolean };
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
      pdfRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            pdfRewrite: { isSupported: () => boolean };
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
      pdfRewrite: {
        isSupported: () => true,
      },
    };

    const nativeEnabled = (
      ChangePage as unknown as {
        prototype: {
          usesNativeRewrite: (this: {
            nativeRewriteSessionDisabled: boolean;
            nativeRewriteSdkBlocked: boolean;
            pdfRewrite: { isSupported: () => boolean };
          }) => boolean;
        };
      }
    ).prototype.usesNativeRewrite.call(ctx);

    expect(nativeEnabled).toBeTrue();
  });

  it('allows scratch start when pdf exists and app is idle', () => {
    const ctx = {
      isPickingImage: false,
      isExporting: false,
      hasValidPdf: () => true,
    };

    const canStartScratch = (
      ChangePage as unknown as {
        prototype: {
          canStartScratch: (this: {
            isPickingImage: boolean;
            isExporting: boolean;
            hasValidPdf: () => boolean;
          }) => boolean;
        };
      }
    ).prototype.canStartScratch.call(ctx);

    expect(canStartScratch).toBeTrue();
  });

  it('rehydrates working pdf context for project editing on web flow', async () => {
    const sourcePdf = new File([new Uint8Array([1, 2, 3])], 'book.pdf', {
      type: 'application/pdf',
      lastModified: 11,
    });
    const cycle = {
      workingPath: 'pdfcovermakerWork/book.pdf',
      workingName: 'book.pdf',
      outputBaseName: 'ignored',
      workingFile: new File([new Uint8Array([1, 2, 3])], 'book-working.pdf', {
        type: 'application/pdf',
      }),
      sourceMeta: {
        name: 'book.pdf',
        size: sourcePdf.size,
        lastModified: 11,
        type: 'application/pdf',
      },
    };
    const clearPdfError = jasmine.createSpy('clearPdfError');
    const resolvePdfFirstPageDims = jasmine
      .createSpy('resolvePdfFirstPageDims')
      .and.resolveTo(undefined);
    const startCycle = jasmine.createSpy('startCycle').and.resolveTo(cycle);
    const startStreamingCycle = jasmine.createSpy('startStreamingCycle');
    const ctx = {
      workingCopy: {
        startCycle,
        startStreamingCycle,
      },
      usesNativeRewrite: () => false,
      clearPdfError,
      resolvePdfFirstPageDims,
      sourcePdfFile: undefined as File | undefined,
      sourcePdfMeta: undefined as
        | {
            name: string;
            size: number;
            lastModified: number;
            type: string;
          }
        | undefined,
      workingPdfFile: undefined as File | undefined,
      workingPdfPath: undefined as string | undefined,
      workingPdfNativePath: 'stale' as string | undefined,
      workingPdfName: undefined as string | undefined,
      outputBaseName: undefined as string | undefined,
      selectedPdfName: undefined as string | undefined,
      coverEntryPath: 'stale' as string | undefined,
    };

    await (
      ChangePage as unknown as {
        prototype: {
          hydrateProjectPdfContext: (
            this: typeof ctx,
            filename: string,
            sourcePdfFile: File,
          ) => Promise<void>;
        };
      }
    ).prototype.hydrateProjectPdfContext.call(ctx, 'book.pdf', sourcePdf);

    expect(startCycle).toHaveBeenCalledWith(sourcePdf);
    expect(startStreamingCycle).not.toHaveBeenCalled();
    expect(ctx.sourcePdfFile).toBe(sourcePdf);
    expect(ctx.sourcePdfMeta).toEqual(cycle.sourceMeta);
    expect(ctx.workingPdfFile).toBe(cycle.workingFile);
    expect(ctx.workingPdfPath).toBe(cycle.workingPath);
    expect(ctx.workingPdfNativePath).toBeUndefined();
    expect(ctx.workingPdfName).toBe(cycle.workingName);
    expect(ctx.outputBaseName).toBe('book');
    expect(ctx.selectedPdfName).toBe('book.pdf');
    expect(ctx.coverEntryPath).toBeUndefined();
    expect(clearPdfError).toHaveBeenCalled();
    expect(resolvePdfFirstPageDims).toHaveBeenCalled();
  });

  it('rehydrates working pdf context for project editing on native flow', async () => {
    const sourcePdf = new File([new Uint8Array([4, 5, 6])], 'book.pdf', {
      type: 'application/pdf',
      lastModified: 22,
    });
    const cycle = {
      workingPath: 'pdfcovermakerWork/book.pdf',
      workingName: 'book.pdf',
      workingNativePath: '/data/user/0/book.pdf',
      outputBaseName: 'ignored',
      sourceMeta: {
        name: 'book.pdf',
        size: sourcePdf.size,
        lastModified: 22,
        type: 'application/pdf',
      },
    };
    const clearPdfError = jasmine.createSpy('clearPdfError');
    const resolvePdfFirstPageDims = jasmine
      .createSpy('resolvePdfFirstPageDims')
      .and.resolveTo(undefined);
    const startCycle = jasmine.createSpy('startCycle');
    const startStreamingCycle = jasmine
      .createSpy('startStreamingCycle')
      .and.resolveTo(cycle);
    const ctx = {
      workingCopy: {
        startCycle,
        startStreamingCycle,
      },
      usesNativeRewrite: () => true,
      clearPdfError,
      resolvePdfFirstPageDims,
      sourcePdfFile: undefined as File | undefined,
      sourcePdfMeta: undefined as
        | {
            name: string;
            size: number;
            lastModified: number;
            type: string;
          }
        | undefined,
      workingPdfFile: undefined as File | undefined,
      workingPdfPath: undefined as string | undefined,
      workingPdfNativePath: undefined as string | undefined,
      workingPdfName: undefined as string | undefined,
      outputBaseName: undefined as string | undefined,
      selectedPdfName: undefined as string | undefined,
      coverEntryPath: 'stale' as string | undefined,
    };

    await (
      ChangePage as unknown as {
        prototype: {
          hydrateProjectPdfContext: (
            this: typeof ctx,
            filename: string,
            sourcePdfFile: File,
          ) => Promise<void>;
        };
      }
    ).prototype.hydrateProjectPdfContext.call(ctx, 'book.pdf', sourcePdf);

    expect(startStreamingCycle).toHaveBeenCalledWith(sourcePdf);
    expect(startCycle).not.toHaveBeenCalled();
    expect(ctx.sourcePdfFile).toBe(sourcePdf);
    expect(ctx.sourcePdfMeta).toEqual(cycle.sourceMeta);
    expect(ctx.workingPdfFile).toBe(sourcePdf);
    expect(ctx.workingPdfPath).toBe(cycle.workingPath);
    expect(ctx.workingPdfNativePath).toBe(cycle.workingNativePath);
    expect(ctx.workingPdfName).toBe(cycle.workingName);
    expect(ctx.outputBaseName).toBe('book');
    expect(ctx.selectedPdfName).toBe('book.pdf');
    expect(ctx.coverEntryPath).toBeUndefined();
    expect(clearPdfError).toHaveBeenCalled();
    expect(resolvePdfFirstPageDims).toHaveBeenCalled();
  });

  it('prefers direct first-page viewport dimensions for pdf cover sizing', async () => {
    const candidateImageService = {
      getFirstPageDimensions: jasmine
        .createSpy('getFirstPageDimensions')
        .and.resolveTo({ width: 6, height: 16 }),
    };
    const ctx = {
      candidateImageService,
      pdfFirstPageDims: { width: 123, height: 456 } as
        | { width: number; height: number }
        | undefined,
      workingPdfFile: new File([new Uint8Array([1])], 'weird.pdf', {
        type: 'application/pdf',
      }),
      workingPdfNativePath: undefined as string | undefined,
      selectedPdfName: 'weird.pdf',
      workingPdfName: 'weird',
      normalizeDims: (
        dims: Partial<{ width: number; height: number }> | null | undefined,
      ) => {
        const width = Number(dims?.width);
        const height = Number(dims?.height);
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
          return null;
        }
        return { width: Math.round(width), height: Math.round(height) };
      },
    };

    await (
      ChangePage as unknown as {
        prototype: {
          resolvePdfFirstPageDims: (this: typeof ctx) => Promise<void>;
        };
      }
    ).prototype.resolvePdfFirstPageDims.call(ctx);

    expect(candidateImageService.getFirstPageDimensions).toHaveBeenCalledWith({
      pdfFile: ctx.workingPdfFile,
      pdfNativePath: undefined,
      pdfName: 'weird.pdf',
    });
    expect(ctx.pdfFirstPageDims).toEqual({ width: 6, height: 16 });
  });

  it('builds pdf crop presets with auto, standards and custom labels', () => {
    const translate = {
      instant: (key: string) => {
        if (key === 'CHANGE.FORMAT_CUSTOM') {
          return 'Custom';
        }
        return key.split('.').pop() ?? key;
      },
    };
    const ctx = {
      translate,
      baseTarget: { width: 1236, height: 1648 },
      resolveDocumentDims: () => ({ width: 1236, height: 1648 }),
      buildAbsoluteTarget: (dims: { width: number; height: number }) => ({
        width: dims.width,
        height: dims.height,
        output: 'target' as const,
      }),
      buildRatioTarget: (width: number, height: number) => ({
        width,
        height,
        output: 'source' as const,
      }),
      buildCustomFormatLabel: () => 'Custom',
    };

    const options = (
      ChangePage as unknown as {
        prototype: {
          getCurrentFormatOptions: (this: typeof ctx) => Array<{
            id: string;
            label: string;
            target: { width: number; height: number; output?: string };
          }>;
        };
      }
    ).prototype.getCurrentFormatOptions.call(ctx);

    expect(options.map((option) => option.id)).toEqual([
      'auto',
      'a4',
      'carta',
      'oficio',
      'nine_sixteen',
      'three_four',
      'one_one',
      'custom',
    ]);
    expect(options[0].label).toBe('FORMAT_AUTO');
    expect(options[1].label).toBe('FORMAT_A4');
    expect(options[7].label).toBe('Custom');
    expect(options[0].target).toEqual({
      width: 1236,
      height: 1648,
      output: 'target',
    });
    expect(options[4].target).toEqual({
      width: 9,
      height: 16,
      output: 'source',
    });
  });

  it('maps legacy crop ids to the new auto preset', () => {
    const ctx = {
      getCurrentFormatOptions: () => [
        { id: 'auto' },
        { id: 'a4' },
      ],
    };

    const resolveFormatId = (
      ChangePage as unknown as {
        prototype: {
          resolveFormatId: (this: typeof ctx, formatId?: string) => string;
        };
      }
    ).prototype.resolveFormatId;

    expect(resolveFormatId.call(ctx, 'without_frame')).toBe('auto');
    expect(resolveFormatId.call(ctx, 'with_frame')).toBe('auto');
    expect(resolveFormatId.call(ctx, 'a4')).toBe('a4');
    expect(resolveFormatId.call(ctx, 'unknown')).toBe('auto');
  });
});
