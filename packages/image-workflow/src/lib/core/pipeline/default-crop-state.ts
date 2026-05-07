import type { CoverCropState } from '../../types';

export function buildDefaultCoverCropState(): CoverCropState {
  return {
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
    artifactReductionEnabled: false,
    backgroundMode: 'transparent',
    backgroundColor: '#000000',
    backgroundBlur: 80,
    textLayers: [],
  };
}
