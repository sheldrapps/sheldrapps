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
});
