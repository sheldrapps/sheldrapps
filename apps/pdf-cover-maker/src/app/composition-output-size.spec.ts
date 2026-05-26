import { resolveCompositionOutputSize } from '../../../../packages/image-workflow/src/lib/core/pipeline/composition-render';
import { buildCompositionInputForPurpose } from '../../../../packages/image-workflow/src/lib/core/pipeline/composition-input';

describe('composition output size', () => {
  it('keeps source-resolution export for output: source ratios like 9:16', () => {
    const size = resolveCompositionOutputSize({
      target: { width: 9, height: 16, output: 'source' },
      frameWidth: 9,
      frameHeight: 16,
      baseScale: 0.01,
      naturalWidth: 900,
      naturalHeight: 1600,
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
      } as never,
    });

    expect(size).toEqual({ width: 900, height: 1600 });
  });

  it('keeps source-resolution export for output: source ratios like 3:4', () => {
    const size = resolveCompositionOutputSize({
      target: { width: 3, height: 4, output: 'source' },
      frameWidth: 3,
      frameHeight: 4,
      baseScale: 0.01,
      naturalWidth: 1200,
      naturalHeight: 1600,
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
      } as never,
    });

    expect(size).toEqual({ width: 1200, height: 1600 });
  });

  it('builds export composition from the original source when working is downscaled', () => {
    const originalFile = new File(['original'], 'original.png', {
      type: 'image/png',
    });
    const workingFile = new File(['working'], 'working.jpg', {
      type: 'image/jpeg',
    });

    const input = buildCompositionInputForPurpose({
      purpose: 'export',
      sources: {
        working: {
          file: workingFile,
          naturalWidth: 900,
          naturalHeight: 1600,
        },
        original: {
          file: originalFile,
          naturalWidth: 1800,
          naturalHeight: 3200,
        },
      },
      target: {
        width: 9,
        height: 16,
        output: 'source',
      },
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
        frameWidth: 9,
        frameHeight: 16,
      } as never,
      frameFallback: { width: 9, height: 16 },
    });

    expect(input).not.toBeNull();
    expect(input?.file).toBe(originalFile);
    expect(input?.naturalWidth).toBe(1800);
    expect(input?.naturalHeight).toBe(3200);
  });

  it('keeps preview composition on the working source while export can stay full quality', () => {
    const originalFile = new File(['original'], 'original.png', {
      type: 'image/png',
    });
    const workingFile = new File(['working'], 'working.jpg', {
      type: 'image/jpeg',
    });

    const input = buildCompositionInputForPurpose({
      purpose: 'preview',
      sources: {
        working: {
          file: workingFile,
          naturalWidth: 1200,
          naturalHeight: 1600,
        },
        original: {
          file: originalFile,
          naturalWidth: 2400,
          naturalHeight: 3200,
        },
      },
      target: {
        width: 3,
        height: 4,
        output: 'source',
      },
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
        frameWidth: 3,
        frameHeight: 4,
      } as never,
      frameFallback: { width: 3, height: 4 },
    });

    expect(input).not.toBeNull();
    expect(input?.file).toBe(workingFile);
    expect(input?.naturalWidth).toBe(1200);
    expect(input?.naturalHeight).toBe(1600);
  });

  it('keeps explicit target dimensions for fixed-size exports', () => {
    const size = resolveCompositionOutputSize({
      target: { width: 1236, height: 1648 },
      frameWidth: 1236,
      frameHeight: 1648,
      baseScale: 1,
      naturalWidth: 1800,
      naturalHeight: 2400,
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
      } as never,
    });

    expect(size).toEqual({ width: 1236, height: 1648 });
  });
});
