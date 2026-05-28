import { ChangePage } from './change.page';
import { Capacitor } from '@capacitor/core';

describe('ChangePage', () => {
  it('uses PNG export for premium lossless mode', () => {
    const ctx = {
      adsRemoved: true,
      coverExportMode: 'lossless',
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
      coverExportMode: 'compressed',
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
      coverExportMode: 'lossless',
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
      coverExportMode: 'compressed',
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
});
