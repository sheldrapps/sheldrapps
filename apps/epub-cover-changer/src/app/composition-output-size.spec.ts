import {
  buildEditorRenderInfo,
  resolveCompositionOutputSize,
} from '../../../../packages/image-workflow/src/lib/core/pipeline/composition-render';
import {
  buildCompositionInputForPurpose,
  computeSourceCropDims,
  isValidCompositionTarget,
  resolveCompositionTarget,
} from '../../../../packages/image-workflow/src/lib/core/pipeline/composition-input';
import { updateEditorRenderQuality } from '../../../../packages/image-workflow/src/lib/core/pipeline/composition-render';

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

  it('reports fixed-size upscale from the effective source crop', () => {
    const input = {
      file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
      target: {
        width: 600,
        height: 800,
        unit: 'px' as const,
        outputMode: 'fixed-size' as const,
      },
      frameWidth: 600,
      frameHeight: 800,
      baseScale: 2,
      naturalWidth: 300,
      naturalHeight: 400,
      state: {
        scale: 1,
        rot: 0,
        tx: 0,
        ty: 0,
      } as never,
    };

    const info = buildEditorRenderInfo({
      input,
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'recommended',
    });

    expect(info.outputMode).toBe('fixed-size');
    expect(info.effectiveSourceWidth).toBe(300);
    expect(info.effectiveSourceHeight).toBe(400);
    expect(info.upscaleApplied).toBe(true);
    expect(info.upscaleFactor).toBe(2);
    expect(info.warningCode).toBe('FIXED_TARGET_UPSCALE');
  });

  it('does not warn for thumbnail quality even when fixed output upscales', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
        target: { width: 600, height: 800, output: 'target' },
        frameWidth: 600,
        frameHeight: 800,
        baseScale: 2,
        naturalWidth: 300,
        naturalHeight: 400,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'thumbnail',
    });

    expect(info.upscaleApplied).toBe(true);
    expect(info.warningCode).toBeUndefined();
  });

  it('never reports an upscale warning for aspect-only output', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
        target: { width: 3, height: 4, output: 'source' },
        frameWidth: 3,
        frameHeight: 4,
        baseScale: 0.01,
        naturalWidth: 300,
        naturalHeight: 400,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 300,
      renderedHeight: 400,
      exportQuality: 'high-quality',
    });

    expect(info.outputMode).toBe('aspect-only');
    expect(info.requestedWidth).toBeUndefined();
    expect(info.upscaleApplied).toBe(false);
    expect(info.warningCode).toBeUndefined();
  });

  it('does not warn for a scratch composition without raster input', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['scratch'], 'scratch.png', { type: 'image/png' }),
        target: { width: 600, height: 800, output: 'target' },
        frameWidth: 600,
        frameHeight: 800,
        baseScale: 2,
        naturalWidth: 300,
        naturalHeight: 400,
        sourceIsRaster: false,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'recommended',
    });

    expect(info.effectiveSourceWidth).toBeUndefined();
    expect(info.warningCode).toBeUndefined();
  });

  it('keeps fixed-size output exact when the source is larger', () => {
    const size = resolveCompositionOutputSize({
      target: {
        width: 600,
        height: 800,
        unit: 'px',
        outputMode: 'fixed-size',
      },
      frameWidth: 600,
      frameHeight: 800,
      baseScale: 1,
      naturalWidth: 2400,
      naturalHeight: 3200,
      state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
    });

    expect(size).toEqual({ width: 600, height: 800 });
  });

  it('keeps aspect-only output at the effective crop resolution', () => {
    const size = resolveCompositionOutputSize({
      target: { width: 3, height: 4, unit: 'ratio', outputMode: 'aspect-only' },
      frameWidth: 300,
      frameHeight: 400,
      baseScale: 1,
      naturalWidth: 1200,
      naturalHeight: 1800,
      state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
    });

    expect(size).toEqual({ width: 300, height: 400 });
  });

  it('uses the full rotated source when the crop frame contains it', () => {
    const size = resolveCompositionOutputSize({
      target: { width: 4, height: 3, unit: 'ratio', outputMode: 'aspect-only' },
      frameWidth: 400,
      frameHeight: 300,
      baseScale: 0.25,
      naturalWidth: 1200,
      naturalHeight: 900,
      state: { scale: 1, rot: 90, tx: 0, ty: 0 } as never,
    });

    expect(size).toEqual({ width: 900, height: 1200 });
  });

  it('accounts for zoom in the effective source crop', () => {
    const dims = computeSourceCropDims({
      frameWidth: 600,
      frameHeight: 800,
      baseScale: 1,
      naturalWidth: 1200,
      naturalHeight: 1600,
      state: { scale: 2, rot: 0, tx: 0, ty: 0 } as never,
    });

    expect(dims).toEqual({ width: 300, height: 400 });
  });

  it('accounts for right-angle rotation in effective source dimensions', () => {
    const dims = computeSourceCropDims({
      frameWidth: 600,
      frameHeight: 800,
      baseScale: 1,
      naturalWidth: 1200,
      naturalHeight: 1600,
      state: { scale: 1, rot: 90, tx: 0, ty: 0 } as never,
    });

    expect(dims).toEqual({ width: 600, height: 800 });
  });

  it('does not warn when upscale stays within the one-percent tolerance', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
        target: { width: 600, height: 800, unit: 'px', outputMode: 'fixed-size' },
        frameWidth: 600,
        frameHeight: 800,
        baseScale: 1,
        naturalWidth: 597,
        naturalHeight: 796,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'recommended',
    });

    expect(info.upscaleApplied).toBe(false);
    expect(info.warningCode).toBeUndefined();
  });

  it('does not warn when a fixed target is already covered by the source crop', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
        target: { width: 600, height: 800, unit: 'px', outputMode: 'fixed-size' },
        frameWidth: 600,
        frameHeight: 800,
        baseScale: 1,
        naturalWidth: 1200,
        naturalHeight: 1600,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'high-quality',
    });

    expect(info.upscaleApplied).toBe(false);
    expect(info.warningCode).toBeUndefined();
  });

  it('recalculates the warning when export quality changes', () => {
    const info = buildEditorRenderInfo({
      input: {
        file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
        target: { width: 600, height: 800, unit: 'px', outputMode: 'fixed-size' },
        frameWidth: 600,
        frameHeight: 800,
        baseScale: 2,
        naturalWidth: 300,
        naturalHeight: 400,
        state: { scale: 1, rot: 0, tx: 0, ty: 0 } as never,
      },
      renderedWidth: 600,
      renderedHeight: 800,
      exportQuality: 'recommended',
    });

    expect(updateEditorRenderQuality(info, 'thumbnail').warningCode).toBeUndefined();
    expect(updateEditorRenderQuality(info, 'high-quality').warningCode).toBe(
      'FIXED_TARGET_UPSCALE',
    );
  });

  it('rejects fixed-size targets expressed in physical units', () => {
    expect(
      isValidCompositionTarget({
        width: 210,
        height: 297,
        unit: 'mm',
        outputMode: 'fixed-size',
      }),
    ).toBe(false);
  });

  it('rejects aspect-only targets expressed in pixels', () => {
    expect(
      isValidCompositionTarget({
        width: 600,
        height: 800,
        unit: 'px',
        outputMode: 'aspect-only',
      }),
    ).toBe(false);
  });

  it('adapts legacy target output to an explicit fixed-size mode', () => {
    expect(resolveCompositionTarget({ width: 600, height: 800, output: 'target' })).toEqual({
      width: 600,
      height: 800,
      output: 'target',
      unit: 'px',
      outputMode: 'fixed-size',
    });
  });

  it('adapts legacy source output to an explicit aspect-only mode', () => {
    expect(resolveCompositionTarget({ width: 3, height: 4, output: 'source' })).toEqual({
      width: 3,
      height: 4,
      output: 'source',
      unit: 'ratio',
      outputMode: 'aspect-only',
    });
  });
});
