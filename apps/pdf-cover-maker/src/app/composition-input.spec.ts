import { buildCompositionInput, toPdfPageTarget } from '@sheldrapps/image-workflow';
import type { CoverCropState } from '@sheldrapps/image-workflow';

describe('buildCompositionInput', () => {
  const baseState: CoverCropState = {
    scale: 1,
    tx: 0,
    ty: 0,
    rot: 0,
    flipX: false,
    flipY: false,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    bw: false,
    dither: false,
  };

  it('uses frameWidth/frameHeight from state when provided', () => {
    const file = new File([new Blob(['x'])], 'test.jpg', { type: 'image/jpeg' });
    const state: CoverCropState = { ...baseState, frameWidth: 320, frameHeight: 480 };

    const input = buildCompositionInput({
      file,
      target: { width: 1200, height: 1600 },
      state,
      naturalWidth: 2400,
      naturalHeight: 3200,
      frameFallback: { width: 1200, height: 1600 },
    });

    expect(input).toBeTruthy();
    expect(input?.frameWidth).toBe(320);
    expect(input?.frameHeight).toBe(480);
    expect(input?.target.width).toBe(1200);
    expect(input?.target.height).toBe(1600);
  });

  it('falls back to target dims when frame is missing', () => {
    const file = new File([new Blob(['y'])], 'test.jpg', { type: 'image/jpeg' });

    const input = buildCompositionInput({
      file,
      target: { width: 1236, height: 1648 },
      state: { ...baseState },
      naturalWidth: 2472,
      naturalHeight: 3296,
      frameFallback: { width: 1236, height: 1648 },
    });

    expect(input).toBeTruthy();
    expect(input?.frameWidth).toBe(1236);
    expect(input?.frameHeight).toBe(1648);
    expect(input?.target.width).toBe(1236);
    expect(input?.target.height).toBe(1648);
  });

  it('accepts physical targets without treating millimeters as pixels', () => {
    const file = new File([new Blob(['z'])], 'test.jpg', { type: 'image/jpeg' });
    const input = buildCompositionInput({
      file,
      target: {
        width: 210,
        height: 297,
        unit: 'mm',
        outputMode: 'physical-size',
      },
      state: { ...baseState },
      naturalWidth: 2400,
      naturalHeight: 3200,
      frameFallback: { width: 210, height: 297 },
    });

    expect(input).toBeTruthy();
    expect(input?.target.width).toBe(210);
    expect(input?.target.height).toBe(297);
    expect(toPdfPageTarget(210, 297, 'mm')).toEqual({
      widthPt: 595.2755905511812,
      heightPt: 841.8897637795276,
    });
  });
});
