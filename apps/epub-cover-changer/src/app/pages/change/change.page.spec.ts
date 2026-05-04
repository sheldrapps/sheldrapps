import { ChangePage } from './change.page';
import { Capacitor } from '@capacitor/core';

describe('ChangePage', () => {
  it('uses PNG export for premium users', () => {
    const ctx = { adsRemoved: true };

    const mime = (
      ChangePage as unknown as {
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
      ChangePage as unknown as {
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
      ChangePage as unknown as {
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
      ChangePage as unknown as {
        prototype: {
          resolveExportQuality: (this: {
            adsRemoved: boolean;
          }) => number | undefined;
        };
      }
    ).prototype.resolveExportQuality.call(ctx);

    expect(quality).toBe(1);
  });

  it('targets PNG rewrite extension for premium users', () => {
    const ctx = {
      adsRemoved: true,
      coverEntryExtension: () => 'jpg' as const,
    };

    const ext = (
      ChangePage as unknown as {
        prototype: {
          nativeRewriteTargetExtension: (this: {
            adsRemoved: boolean;
            coverEntryExtension: () => 'jpg' | 'png' | 'webp' | null;
          }) => 'jpg' | 'png' | 'webp' | null;
        };
      }
    ).prototype.nativeRewriteTargetExtension.call(ctx);

    expect(ext).toBe('png');
  });

  it('keeps source extension rewrite target for non-premium users', () => {
    const ctx = {
      adsRemoved: false,
      coverEntryExtension: () => 'webp' as const,
    };

    const ext = (
      ChangePage as unknown as {
        prototype: {
          nativeRewriteTargetExtension: (this: {
            adsRemoved: boolean;
            coverEntryExtension: () => 'jpg' | 'png' | 'webp' | null;
          }) => 'jpg' | 'png' | 'webp' | null;
        };
      }
    ).prototype.nativeRewriteTargetExtension.call(ctx);

    expect(ext).toBe('webp');
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
});
