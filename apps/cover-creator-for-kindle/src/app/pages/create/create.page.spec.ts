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

  it('allows generate without editor crop state when image and model exist', () => {
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
});
