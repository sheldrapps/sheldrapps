import type { CoverCropState } from '../../types';
import {
  DEFAULT_DITHERING_SETTINGS,
  DEFAULT_IMAGE_CLEANUP_SETTINGS,
} from './output-processing-state';

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
    cleanup: { ...DEFAULT_IMAGE_CLEANUP_SETTINGS },
    dithering: { ...DEFAULT_DITHERING_SETTINGS },
    backgroundMode: 'transparent',
    backgroundColor: '#000000',
    backgroundBlur: 80,
    textLayers: [],
  };
}
